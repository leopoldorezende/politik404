/**
 * economyService.js
 * Remove todas as funções duplicadas e delega para economicCalculations.js
 * Mantém apenas gerenciamento de estado e persistência
 */

import redis from '../redisClient.js';
import { getNumericValue } from '../utils/economicUtils.js';
import { ECONOMIC_CONSTANTS } from '../utils/economicConstants.js';
import { SYNC_CONFIG } from '../config/syncConfig.js';
import { EconomyDebt } from './economyServiceDebt.js';
import { EconomyTrade } from './economyServiceTrade.js';

import { 
  calculateAdvancedGrowth,
  calculateDynamicInflation,
  calculateDynamicUnemployment,
  calculateDynamicPopularity,
  calculateCreditRating,
  processDebtPayments,
  resetUnrealisticIndicators,
  debugAdvancedEconomicCalculations,
  validateEconomicCalculations,
  issueEmergencyBonds
} from '../utils/economicCalculations.js';

class EconomyService {
  constructor() {
    this.countryStates = new Map(); // roomName -> { countryName -> state }
    this.appliedParameters = new Map(); // key -> { interestRate, taxBurden, publicServices }
    this.debtContracts = new Map(); // key -> [contracts]
    this.nextDebtId = 1;
    this.updateInterval = null;
    this.saveInterval = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.loadFromRedis();
      this.startPeriodicUpdates();
      this.initialized = true;
      console.log('[ECONOMY] EconomyService initialized with advanced calculations (delegated)');
    } catch (error) {
      console.error('[ECONOMY] Error initializing economyService:', error);
    }  
    
    // Inicializar classes auxiliares
    this.debt = new EconomyDebt(this);
    this.trade = new EconomyTrade(this);
  }

  // ========================================================================
  // CORE STATE MANAGEMENT - Fonte única de verdade
  // ========================================================================

  getCountryState(roomName, countryName) {
    const roomStates = this.countryStates.get(roomName);
    return roomStates?.[countryName] || null;
  }

  setCountryState(roomName, countryName, state) {
    if (!this.countryStates.has(roomName)) {
      this.countryStates.set(roomName, {});
    }
    this.countryStates.get(roomName)[countryName] = state;
  }

  getRoomStates(roomName) {
    return this.countryStates.get(roomName) || {};
  }

  // ========================================================================
  // INICIALIZAÇÃO DE PAÍSES
  // ========================================================================

  initializeRoom(roomName, countriesData) {
    if (!this.countryStates.has(roomName)) {
      this.countryStates.set(roomName, {});
    }
    
    const roomStates = this.countryStates.get(roomName);
    let countriesInitialized = 0;
    
    for (const [countryName, countryData] of Object.entries(countriesData)) {
      if (!roomStates[countryName]) {
        roomStates[countryName] = this.createExpandedCountryState(countryName, countryData);
        countriesInitialized++;
        
        // Transferir contratos de dívida inicial
        const initialKey = `${countryName}:initial`;
        const roomKey = `${countryName}:${roomName}`;
        
        if (this.debtContracts.has(initialKey)) {
          const initialContracts = this.debtContracts.get(initialKey);
          this.debtContracts.set(roomKey, initialContracts);
          this.debtContracts.delete(initialKey);
        }
      } else {
        // Migrar estados existentes que não possuem os novos campos
        this.migrateExistingState(roomStates[countryName]);
      }
    }
  }

  createExpandedCountryState(countryName, countryData) {
    const economy = countryData?.economy || {};
    
    // Usar percentuais EXATOS do JSON (sem random)
    let services = getNumericValue(economy.services) || 35;
    let commodities = getNumericValue(economy.commodities) || 35;
    let manufactures = getNumericValue(economy.manufactures) || 30;
    
    // Garantir que os setores somem exatamente 100%
    const totalSectors = services + commodities + manufactures;
    if (Math.abs(totalSectors - 100) > 0.01) {
      services = (services / totalSectors) * 100;
      commodities = (commodities / totalSectors) * 100;
      manufactures = (manufactures / totalSectors) * 100;
    }
    
    // Calcular necessidades base SEM random
    const commoditiesNeedsPercent = Math.max(15, Math.min(45, 25 + (commodities * 0.1)));
    const manufacturesNeedsPercent = Math.max(25, Math.min(55, 35 + (manufactures * 0.1)));
    
    const initialGdp = getNumericValue(economy.gdp) || 100;
    const initialInflation = getNumericValue(economy.inflation) || 0.04;
    const initialUnemployment = getNumericValue(economy.unemployment) || 12.5;
    const initialPopularity = getNumericValue(economy.popularity) || 50;
    
    const countryState = {
      economy: {
        // CAMPOS ORIGINAIS PRESERVADOS 
        gdp: initialGdp,
        treasury: getNumericValue(economy.treasury) || 10,
        publicDebt: getNumericValue(economy.publicDebt) || 0,
        
        services: Math.round(services * 100) / 100,
        commodities: Math.round(commodities * 100) / 100,
        manufactures: Math.round(manufactures * 100) / 100,
        
        inflation: initialInflation,
        unemployment: initialUnemployment,
        popularity: initialPopularity,
        creditRating: 'A',
        
        interestRate: getNumericValue(economy.interestRate) || ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE,
        taxBurden: getNumericValue(economy.taxBurden) || ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE,
        publicServices: getNumericValue(economy.publicServices) || 30.0,
        
        tradeStats: {
          commodityImports: 0,
          commodityExports: 0,
          manufactureImports: 0,
          manufactureExports: 0
        },
        
        // NOVOS CAMPOS EXPANDIDOS
        _cycleCount: 0,
        _lastQuarterGdp: initialGdp * 0.975, // 2.5% menor para simular crescimento inicial
        gdpGrowth: 2.5, // Crescimento trimestral em percentual
        
        // Necessidades e outputs setoriais
        commoditiesNeeds: 0,
        manufacturesNeeds: 0,
        commoditiesBalance: 0,
        manufacturesBalance: 0,
        servicesOutput: 0,
        commoditiesOutput: 0,
        manufacturesOutput: 0,
        
        // Percentuais base para cálculos
        _commoditiesNeedsBasePercent: commoditiesNeedsPercent,
        _manufacturesNeedsBasePercent: manufacturesNeedsPercent,
        _servicesBase: services,
        _commoditiesBase: commodities,
        _manufacturesBase: manufactures,
        
        // Históricos expandidos
        _historicGdp: [initialGdp],
        _historicInflation: [initialInflation],
        _historicPopularity: [initialPopularity],
        _historicUnemployment: [initialUnemployment],
      },
      
      // Outros campos preservados
      defense: {
        navy: getNumericValue(countryData?.defense?.navy) || 20,
        army: getNumericValue(countryData?.defense?.army) || 20,
        airforce: getNumericValue(countryData?.defense?.airforce) || 20
      },
      commerce: {
        exports: 15,
        imports: 15
      },
      politics: {
        parliament: getNumericValue(countryData?.politics?.parliamentSupport) || 50,
        media: getNumericValue(countryData?.politics?.mediaSupport) || 50,
        opposition: getNumericValue(countryData?.politics?.opposition?.strength || countryData?.politics?.opposition) || 25
      }
    };

    // Calcular valores iniciais
    this.initializeCalculatedValues(countryState.economy);

    // Aplicar reset de indicadores irreais
    resetUnrealisticIndicators(countryState.economy);

    // Criar contratos de dívida inicial se necessário
    const initialDebt = getNumericValue(economy.publicDebt) || 0;
    if (initialDebt > 0) {
      this.createInitialDebtContracts(countryName, countryState, initialDebt);
    }

    return countryState;
  }

  migrateExistingState(countryState) {
    const economy = countryState.economy;
    
    // Adicionar campos ausentes com valores padrão
    if (economy._cycleCount === undefined) economy._cycleCount = 0;
    if (economy._lastQuarterGdp === undefined) economy._lastQuarterGdp = economy.gdp || 100;
    if (economy.gdpGrowth === undefined) economy.gdpGrowth = 2.5;
    
    if (economy.commoditiesNeeds === undefined) economy.commoditiesNeeds = 0;
    if (economy.manufacturesNeeds === undefined) economy.manufacturesNeeds = 0;
    if (economy.commoditiesBalance === undefined) economy.commoditiesBalance = 0;
    if (economy.manufacturesBalance === undefined) economy.manufacturesBalance = 0;
    if (economy.servicesOutput === undefined) economy.servicesOutput = 0;
    if (economy.commoditiesOutput === undefined) economy.commoditiesOutput = 0;
    if (economy.manufacturesOutput === undefined) economy.manufacturesOutput = 0;
    
    if (!economy._commoditiesNeedsBasePercent) {
      economy._commoditiesNeedsBasePercent = 25 + ((economy.commodities || 35) * 0.1);
      economy._commoditiesNeedsBasePercent = Math.max(15, Math.min(45, economy._commoditiesNeedsBasePercent));
    }
    if (!economy._manufacturesNeedsBasePercent) {
      economy._manufacturesNeedsBasePercent = 35 + ((economy.manufactures || 30) * 0.1);
      economy._manufacturesNeedsBasePercent = Math.max(25, Math.min(55, economy._manufacturesNeedsBasePercent));
    }
    
    if (!economy._servicesBase) economy._servicesBase = economy.services || 35;
    if (!economy._commoditiesBase) economy._commoditiesBase = economy.commodities || 35;
    if (!economy._manufacturesBase) economy._manufacturesBase = economy.manufactures || 30;
    
    // Criar históricos expandidos baseados nos valores atuais
    if (!economy._historicGdp) economy._historicGdp = [economy.gdp || 100];
    if (!economy._historicInflation) economy._historicInflation = [economy.inflation || 0.04];
    if (!economy._historicPopularity) economy._historicPopularity = [economy.popularity || 50];
    if (!economy._historicUnemployment) economy._historicUnemployment = [economy.unemployment || 12.5];
    
    // Calcular valores iniciais
    this.initializeCalculatedValues(economy);
    
    // Aplicar reset de indicadores irreais
    resetUnrealisticIndicators(economy);
    
    // console.log(`[ECONOMY] Migrated existing state with delegated calculations`);
  }

  initializeCalculatedValues(economy) {
    // Calcular outputs setoriais iniciais
    economy.servicesOutput = (economy.gdp * economy.services / 100);
    economy.commoditiesOutput = (economy.gdp * economy.commodities / 100);
    economy.manufacturesOutput = (economy.gdp * economy.manufactures / 100);
    
    // Calcular necessidades iniciais
    economy.commoditiesNeeds = economy.gdp * (economy._commoditiesNeedsBasePercent / 100);
    economy.manufacturesNeeds = economy.gdp * (economy._manufacturesNeedsBasePercent / 100);
    
    // Calcular balanços iniciais (sem comércio)
    economy.commoditiesBalance = economy.commoditiesOutput - economy.commoditiesNeeds;
    economy.manufacturesBalance = economy.manufacturesOutput - economy.manufacturesNeeds;
  }

  // ========================================================================
  // CÁLCULOS ECONÔMICOS DELEGADOS
  // ========================================================================

  performAdvancedEconomicCalculations(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return;

    const economy = countryState.economy;
    
    // Incrementar contador de ciclos
    economy._cycleCount++;
    
    // 1. Calcular outputs setoriais
    economy.servicesOutput = (economy.gdp * economy.services / 100);
    economy.commoditiesOutput = (economy.gdp * economy.commodities / 100);
    economy.manufacturesOutput = (economy.gdp * economy.manufactures / 100);
    
    // 2. Calcular necessidades setoriais
    this.calculateSectoralNeeds(economy);
    
    // 3. Calcular balanços setoriais incluindo comércio
    this.calculateSectoralBalances(roomName, countryName, economy);
    
    // 4. Crescimento aplicado
    const crescimento = calculateAdvancedGrowth(economy);
    
    economy.gdp *= (1 + crescimento);
    // Atualiza crescimento trimestral a cada 180 ciclos (equivalente a 90 turnos no modelo)
    if (economy._cycleCount % SYNC_CONFIG.QUARTERLY_CYCLE === 0) {
      const oldGdpGrowth = economy.gdpGrowth;
      economy.gdpGrowth = ((economy.gdp - economy._lastQuarterGdp) / economy._lastQuarterGdp) * 100;
      economy._lastQuarterGdp = economy.gdp;
    }
    
    // 5. Aplicar cálculos básicos DELEGADOS
    economy.inflation = calculateDynamicInflation(economy);
    economy.unemployment = calculateDynamicUnemployment(economy);
    economy.popularity = calculateDynamicPopularity(economy);
    economy.creditRating = calculateCreditRating(economy);
    
    // 6. Caixa Atualizado
    // Arrecadação via impostos 
    const arrecadacao = economy.gdp * (economy.taxBurden / 100) * 0.017;
    
    // Gastos com investimento público
    let gastoInvestimento = 0;
    
    if (economy.publicServices > 0) {
      if (economy.publicServices <= 15) {
        gastoInvestimento = economy.gdp * (economy.publicServices / 100) * 0.015;
      } else {
        const baseGasto = economy.gdp * (15 / 100) * 0.015;
        const fatorExtra = 2.0;
        const excedenteInvestimento = economy.publicServices - 15;
        const gastoExcedente = economy.gdp * (excedenteInvestimento / 100) * 0.015 * fatorExtra;
        
        gastoInvestimento = baseGasto + gastoExcedente;
      }
    }
    
    // Atualizar caixa
    economy.treasury += arrecadacao - gastoInvestimento;
    
    // VERIFICAR TESOURO A CADA CICLO
    if (economy.treasury <= 0) {
        const shortfall = Math.abs(economy.treasury);
        economy.treasury = 0;
        
        // Verificar se já foi emitido neste ciclo
        const cycleKey = `emergency_${countryName}_${roomName}_${economy._cycleCount}`;
        if (!this.emergencyBondsIssued) {
          this.emergencyBondsIssued = new Set();
        }
        
        if (!this.emergencyBondsIssued.has(cycleKey)) {
          // Marcar como emitido neste ciclo
          this.emergencyBondsIssued.add(cycleKey);
          
          // Limpar emissões antigas (manter apenas últimos 10 ciclos)
          if (this.emergencyBondsIssued.size > 50) {
            const oldEntries = Array.from(this.emergencyBondsIssued).slice(0, 40);
            oldEntries.forEach(entry => this.emergencyBondsIssued.delete(entry));
          }
          
          // Usar função que retorna dados em vez de flag
          const emergencyBondInfo = issueEmergencyBonds(economy, shortfall);
          
          if (emergencyBondInfo) {
            // Criar contrato de dívida emergencial
            const emergencyContract = this.createEmergencyDebtContract(
              roomName, 
              countryName, 
              emergencyBondInfo.amount, 
              emergencyBondInfo.rate
            );
            
            // Atualizar tesouro e dívida através do contrato
            economy.treasury += emergencyBondInfo.amount;
            economy.publicDebt += emergencyBondInfo.amount;
            
            // Notificar cliente apenas uma vez
            this.notifyEmergencyBondIssued(roomName, countryName, emergencyBondInfo);
          }
        }
      }
    
    // 7. EFEITO DA INFLAÇÃO NO PIB
    if (economy.inflation > 0.1) {
      const excesso = economy.inflation - 0.1;
      const fatorPenalidade = 0.9998 - (excesso * 0.001);
      economy.gdp *= Math.max(0.9995, fatorPenalidade);
    }
    
    // 8. Processamento mensal das dívidas 
    if (economy._cycleCount % SYNC_CONFIG.MONTHLY_CYCLE === 0) {
      const countryKey = `${countryName}:${roomName}`;
      const debtContracts = this.debtContracts.get(countryKey) || [];
      
      if (debtContracts.length > 0) {
        // Capturar estado antes dos pagamentos
        const contractsBeforePayment = [...debtContracts]; // Cópia para comparação
        const contractsCountBefore = debtContracts.length;
        
        // USAR PROCESSAMENTO MENSAL COMPLETO (cycleFactor = 1)
        const totalPayment = processDebtPayments(economy, debtContracts, 1.0); // GARANTIR cycleFactor = 1
        
        // Filtrar contratos ativos (remainingInstallments > 0)
        const activeContracts = debtContracts.filter(contract => contract.remainingInstallments > 0);
        const contractsCountAfter = activeContracts.length;
        const contractsCompleted = contractsCountBefore - contractsCountAfter;
        
        // ATUALIZAR ARRAY DE CONTRATOS 
        this.debtContracts.set(countryKey, activeContracts);
        
        // NOTIFICAÇÃO DETALHADA 
        if (totalPayment > 0 || contractsCompleted > 0) {
          this.notifyDebtContractsUpdated(roomName, countryName, {
            contractsCompleted,
            activeContracts: contractsCountAfter,
            totalRemainingDebt: activeContracts.reduce((sum, contract) => sum + contract.remainingValue, 0),
            totalPayment,
            cycle: economy._cycleCount,
            // Detalhes dos contratos atualizados
            contractDetails: activeContracts.map(contract => ({
              id: contract.id,
              remainingValue: contract.remainingValue,
              remainingInstallments: contract.remainingInstallments,
              monthlyPayment: contract.monthlyPayment
            }))
          });
        }
      }
    }
      
    // 9. Processamento mensal para variações setoriais - 
    if (economy._cycleCount % SYNC_CONFIG.MONTHLY_CYCLE === 0) {
      // Atualizar históricos
      this.updateHistoricalData(economy);
    }
    
    // Atualizar valores absolutos das necessidades - 
    economy.commoditiesNeeds = economy.gdp * (economy._commoditiesNeedsBasePercent / 100);
    economy.manufacturesNeeds = economy.gdp * (economy._manufacturesNeedsBasePercent / 100);
    
    // Atualizar estado
    this.setCountryState(roomName, countryName, countryState);
  }


  /**
   * Notifica cliente sobre atualização de contratos de dívida
   * @param {string} roomName - Nome da sala
   * @param {string} countryName - Nome do país
   * @param {Object} updateInfo - Informações da atualização
   */
  notifyDebtContractsUpdated(roomName, countryName, data) {
    return this.debt.notifyDebtContractsUpdated(roomName, countryName, data);
  }

  /**
   * Cria contrato de dívida emergencial
   * @param {string} roomName - Nome da sala
   * @param {string} countryName - Nome do país
   * @param {number} bondAmount - Valor do título
   * @param {number} effectiveRate - Taxa efetiva
   * @returns {Object} - Contrato criado
   */
  createEmergencyDebtContract(roomName, countryName, amount, rate) {
    return this.debt.createEmergencyDebtContract(roomName, countryName, amount, rate);
  }

  /**
   * Notifica cliente sobre emissão de títulos de emergência
   * @param {string} roomName - Nome da sala
   * @param {string} countryName - Nome do país
   * @param {Object} bondInfo - Informações do título emitido
   */
  notifyEmergencyBondIssued(roomName, countryName, bondInfo) {
    return this.debt.notifyEmergencyBondIssued(roomName, countryName, bondInfo);
  }

  /**
   * Calcula necessidades setoriais baseadas no sistema avançado
   */
  calculateSectoralNeeds(economy) {
    // Calcular necessidades base
    let commoditiesNeedsPercent = economy._commoditiesNeedsBasePercent;
    let manufacturesNeedsPercent = economy._manufacturesNeedsBasePercent;
    
    // Aplicar efeito do emprego
    const employmentRate = 100 - economy.unemployment;
    const employmentEffect = this.calculateEmploymentEffect(employmentRate);
    
    // Aplicar variação sutil baseada no emprego
    commoditiesNeedsPercent *= (1 + employmentEffect.commodities);
    manufacturesNeedsPercent *= (1 + employmentEffect.manufactures);
    
    // Limitar percentuais
    commoditiesNeedsPercent = Math.max(15, Math.min(45, commoditiesNeedsPercent));
    manufacturesNeedsPercent = Math.max(25, Math.min(55, manufacturesNeedsPercent));
    
    // Calcular valores absolutos
    economy.commoditiesNeeds = economy.gdp * (commoditiesNeedsPercent / 100);
    economy.manufacturesNeeds = economy.gdp * (manufacturesNeedsPercent / 100);
  }

  calculateEmploymentEffect(employmentRate) {
    const idealEmployment = 85;
    const employmentDeviation = employmentRate - idealEmployment;
    const maxEffect = 0.05; // 5% máximo
    
    const commoditiesEffect = (employmentDeviation / 15) * maxEffect * 0.6;
    const manufacturesEffect = (employmentDeviation / 15) * maxEffect * 1.0;
    
    return {
      commodities: Math.max(-maxEffect, Math.min(maxEffect, commoditiesEffect)),
      manufactures: Math.max(-maxEffect, Math.min(maxEffect, manufacturesEffect))
    };
  }

  /**
   * Calcula balanços setoriais incluindo acordos comerciais
   */
  calculateSectoralBalances(roomName, countryName, economy) {
    return this.trade.calculateSectoralBalances(roomName, countryName, economy);
  }

  calculateTradeImpact(tradeAgreements, countryName) {
    return this.trade.calculateTradeImpact(tradeAgreements, countryName);
  }

  /**
   * Atualiza dados históricos
   */
  updateHistoricalData(economy) {
    // Atualizar históricos expandidos
    this.addToHistory(economy._historicGdp, economy.gdp);
    this.addToHistory(economy._historicInflation, economy.inflation);
    this.addToHistory(economy._historicPopularity, economy.popularity);
    this.addToHistory(economy._historicUnemployment, economy.unemployment);
  }

  addToHistory(historyArray, value) {
    historyArray.push(value);
    if (historyArray.length > ECONOMIC_CONSTANTS.MAX_HISTORY_SIZE) {
      historyArray.shift();
    }
  }

  // ========================================================================
  // SISTEMA DE DÍVIDA
  // ========================================================================

  issueDebtBonds(roomName, countryName, bondAmount) {
    return this.debt.issueDebtBonds(roomName, countryName, bondAmount);
  }

  createInitialDebtContracts(countryName, countryState, totalDebt) {
    return this.debt.createInitialDebtContracts(countryName, countryState, totalDebt);
  }

  getDebtSummary(roomName, countryName) {
    const countryKey = `${countryName}:${roomName}`;
    const contracts = this.debtContracts.get(countryKey) || [];
    const countryState = this.getCountryState(roomName, countryName);
    const economy = countryState?.economy || {};
    
    // FILTRAR APENAS CONTRATOS ATIVOS 
    const activeContracts = contracts.filter(contract => 
      contract.remainingInstallments > 0 && contract.remainingValue > 0.01
    );
    
    if (activeContracts.length === 0) {
      return {
        totalMonthlyPayment: 0,
        principalRemaining: 0,
        totalFuturePayments: 0,
        numberOfContracts: 0,
        contracts: [],
        debtRecords: [],
        economicData: {
          gdp: economy.gdp || 0,
          treasury: economy.treasury || 0,
          publicDebt: economy.publicDebt || 0
        }
      };
    }
    
    const totalMonthlyPayment = activeContracts.reduce((sum, contract) => sum + contract.monthlyPayment, 0);
    const principalRemaining = activeContracts.reduce((sum, contract) => sum + contract.remainingValue, 0);
    const totalFuturePayments = activeContracts.reduce((sum, contract) => 
      sum + (contract.monthlyPayment * contract.remainingInstallments), 0
    );
    
    // ===== GARANTIR DADOS COMPLETOS E ATUALIZADOS =====
    const detailedContracts = activeContracts.map(contract => ({
      id: contract.id,
      originalValue: contract.originalValue,
      remainingValue: Number(contract.remainingValue.toFixed(2)), // Arredondar para evitar imprecisões
      interestRate: contract.interestRate,
      monthlyPayment: Number(contract.monthlyPayment.toFixed(2)),
      remainingInstallments: Math.max(0, contract.remainingInstallments), // ===== GARANTIR QUE NÃO SEJA NEGATIVO =====
      issueDate: contract.issueDate,
      emergencyBond: contract.emergencyBond || false
    }));
    
    return {
      totalMonthlyPayment: Number(totalMonthlyPayment.toFixed(2)),
      principalRemaining: Number(principalRemaining.toFixed(2)),
      totalFuturePayments: Number(totalFuturePayments.toFixed(2)),
      numberOfContracts: activeContracts.length,
      contracts: detailedContracts,
      debtRecords: detailedContracts, // ===== DUPLICAR PARA COMPATIBILIDADE =====
      economicData: {
        gdp: economy.gdp || 0,
        treasury: economy.treasury || 0,
        publicDebt: economy.publicDebt || 0
      }
    };
  }

  // ========================================================================
  // ATUALIZAÇÃO DE PARÂMETROS ECONÔMICOS
  // ========================================================================

  updateEconomicParameter(roomName, countryName, parameter, value) {
    if (!this.countryStates.has(roomName)) {
      console.error(`[ECONOMY] Room ${roomName} not found in countryStates`);
      return null;
    }
    
    const roomStates = this.countryStates.get(roomName);
    if (!roomStates || !roomStates[countryName]) {
      console.error(`[ECONOMY] Country ${countryName} not found in room ${roomName}`);
      return null;
    }
    
    const countryState = roomStates[countryName];
    if (!countryState.economy) {
      console.error(`[ECONOMY] Economy data not found for ${countryName}`);
      return null;
    }
    
    // Atualizar o parâmetro
    countryState.economy[parameter] = value;
    
    // Armazenar parâmetro aplicado
    const countryKey = `${countryName}:${roomName}`;
    if (!this.appliedParameters.has(countryKey)) {
      this.appliedParameters.set(countryKey, {
        interestRate: ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE,
        taxBurden: ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE,
        publicServices: 30.0
      });
    }
    
    const params = this.appliedParameters.get(countryKey);
    params[parameter] = value;
    
    // Executar cálculos imediatamente
    try {
      this.performAdvancedEconomicCalculations(roomName, countryName);
      return countryState;
    } catch (error) {
      console.error(`[ECONOMY] Error in performAdvancedEconomicCalculations:`, error);
      return null;
    }
  }

  // ========================================================================
  // ACORDOS COMERCIAIS
  // ========================================================================

  createTradeAgreement(roomName, agreementData) {
    return this.trade.createTradeAgreement(roomName, agreementData);
  }

  cancelTradeAgreement(roomName, agreementId) {
    return this.trade.cancelTradeAgreement(roomName, agreementId);
  }

  // ========================================================================
  // ATUALIZAÇÕES PERIÓDICAS
  // ========================================================================

  startPeriodicUpdates() {
    this.stopPeriodicUpdates();
    
    // Atualizar economia a cada 500ms com cálculos delegados
    this.updateInterval = setInterval(() => {
      this.performPeriodicAdvancedUpdates();
    }, SYNC_CONFIG.ECONOMY_UPDATE_INTERVAL);
    
    // Salvar no Redis a cada 50 segundos
    this.saveInterval = setInterval(() => {
      this.saveToRedis();
    }, SYNC_CONFIG.SAVE_INTERVAL);
    
    console.log('[ECONOMY] Periodic updates started with delegated economic calculations');
  }

  stopPeriodicUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  performPeriodicAdvancedUpdates() {
    const gameState = global.gameState;
    if (!gameState || !gameState.rooms) return;
    
    let updatedCountries = 0;
    
    for (const [roomName, room] of gameState.rooms.entries()) {
      const hasOnlinePlayers = room.players && 
        room.players.some(p => typeof p === 'object' && p.isOnline);
      
      if (!hasOnlinePlayers) continue;
      
      const roomStates = this.getRoomStates(roomName);
      
      for (const countryName of Object.keys(roomStates)) {
        this.performAdvancedEconomicCalculations(roomName, countryName);
        updatedCountries++;
      }
      
      // Broadcast após cálculos delegados
      if (Object.keys(roomStates).length > 0 && global.io) {
        global.io.to(`countryStates:${roomName}`).emit('countryStatesUpdated', {
          roomName,
          states: roomStates,
          timestamp: Date.now()
        });
      }
    }
  }

  // ========================================================================
  // MÉTODOS DE DEBUG DELEGADOS
  // ========================================================================

  debugAdvancedCalculations(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return;
    
    // DELEGADO: Usar função de economicCalculations.js
    debugAdvancedEconomicCalculations(countryName, countryState.economy);
  }

  emergencyResetCountry(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return false;
    
    // DELEGADO: Usar função de economicCalculations.js
    resetUnrealisticIndicators(countryState.economy);
    
    // Recalcular valores iniciais
    this.initializeCalculatedValues(countryState.economy);
    
    console.log(`[ECONOMY] Emergency reset performed for ${countryName} in ${roomName} (delegated)`);
    return true;
  }

  // ========================================================================
  // PERSISTÊNCIA
  // ========================================================================

  async saveToRedis() {
    try {
      const data = {
        countryStates: Object.fromEntries(this.countryStates),
        appliedParameters: Object.fromEntries(this.appliedParameters),
        debtContracts: Object.fromEntries(this.debtContracts),
        nextDebtId: this.nextDebtId
      };
      
      await redis.set('economy_service_data', JSON.stringify(data));
    } catch (error) {
      console.error('[ECONOMY] Error saving to Redis:', error);
    }
  }

  async loadFromRedis() {
    try {
      const data = await redis.get('economy_service_data');
      if (data) {
        const parsed = JSON.parse(data);
        
        this.countryStates = new Map(Object.entries(parsed.countryStates || {}));
        this.appliedParameters = new Map(Object.entries(parsed.appliedParameters || {}));
        this.debtContracts = new Map(Object.entries(parsed.debtContracts || {}));
        this.nextDebtId = parsed.nextDebtId || 1;
        
        // Migrar todos os países existentes para o novo sistema
        for (const [roomName, roomStates] of this.countryStates.entries()) {
          for (const [countryName, countryState] of Object.entries(roomStates)) {
            if (countryState.economy) {
              this.migrateExistingState(countryState);
            }
          }
        }
      }
    } catch (error) {
      console.error('[ECONOMY] Error loading from Redis:', error);
    }
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

removeRoom(roomName) {
    this.countryStates.delete(roomName);
    
    // Limpar dados relacionados
    for (const [key] of this.appliedParameters.entries()) {
      if (key.includes(`:${roomName}`)) {
        this.appliedParameters.delete(key);
      }
    }
    
    for (const [key] of this.debtContracts.entries()) {
      if (key.includes(`:${roomName}`)) {
        this.debtContracts.delete(key);
      }
    }
    
    // Integação com cardService
    if (global.cardService && global.cardService.initialized) {
      global.cardService.removeRoom(roomName);
    }
    
    console.log(`[ECONOMY] Room ${roomName} removed with all delegated economic data and cards`);
  }

  cleanup() {
    this.stopPeriodicUpdates();
    this.saveToRedis();
    
    // Limpar controle de títulos emergenciais
    if (this.emergencyBondsIssued) {
      this.emergencyBondsIssued.clear();
    }
  }

  // ========================================================================
  // MÉTODOS DE COMPATIBILIDADE
  // ========================================================================

  /**
   * Método legado para compatibilidade - delegado para cálculos
   */
  performEconomicCalculations(roomName, countryName) {
    return this.performAdvancedEconomicCalculations(roomName, countryName);
  }

  /**
   * Método para obter indicadores formatados (compatibilidade com hooks)
   */
  getFormattedEconomicIndicators(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return null;
    
    const economy = countryState.economy;
    
    return {
      // Indicadores principais
      gdp: economy.gdp,
      gdpGrowth: economy.gdpGrowth,
      treasury: economy.treasury,
      publicDebt: economy.publicDebt,
      inflation: economy.inflation,
      unemployment: economy.unemployment,
      popularity: economy.popularity,
      creditRating: economy.creditRating,
      
      // Controles
      interestRate: economy.interestRate,
      taxBurden: economy.taxBurden,
      publicServices: economy.publicServices,
      
      // Setores
      services: economy.services,
      commodities: economy.commodities,
      manufactures: economy.manufactures,
      
      // Outputs e necessidades
      servicesOutput: economy.servicesOutput,
      commoditiesOutput: economy.commoditiesOutput,
      manufacturesOutput: economy.manufacturesOutput,
      commoditiesNeeds: economy.commoditiesNeeds,
      manufacturesNeeds: economy.manufacturesNeeds,
      
      // Balanços
      commoditiesBalance: economy.commoditiesBalance,
      manufacturesBalance: economy.manufacturesBalance,
      
      // Comércio
      tradeStats: economy.tradeStats,
      
      // Dados avançados
      _cycleCount: economy._cycleCount,
      _lastQuarterGdp: economy._lastQuarterGdp
    };
  }

  /**
   * Método para obter estatísticas de performance dos cálculos
   */
  getPerformanceStats() {
    let totalCountries = 0;
    let totalCycles = 0;
    let averageCycles = 0;
    
    for (const [roomName, roomStates] of this.countryStates.entries()) {
      for (const [countryName, countryState] of Object.entries(roomStates)) {
        if (countryState.economy) {
          totalCountries++;
          totalCycles += countryState.economy._cycleCount || 0;
        }
      }
    }
    
    if (totalCountries > 0) {
      averageCycles = totalCycles / totalCountries;
    }
    
    return {
      totalRooms: this.countryStates.size,
      totalCountries: totalCountries,
      totalDebtContracts: this.debtContracts.size,
      averageCyclesPerCountry: Math.round(averageCycles),
      totalCyclesProcessed: totalCycles,
      isRunning: this.updateInterval !== null,
      updateInterval: SYNC_CONFIG.ECONOMY_UPDATE_INTERVAL,
      monthlySystemCycle: SYNC_CONFIG.MONTHLY_CYCLE,
      calculationsMethod: 'DELEGATED' // Indica que usa economicCalculations.js
    };
  }
}

// Singleton instance
const economyService = new EconomyService();

export default economyService;