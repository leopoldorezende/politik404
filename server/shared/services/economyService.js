/**
 * economyService.js - VERSÃO SIMPLIFICADA SEM DUPLICAÇÕES
 * Remove todas as funções duplicadas e delega para economicCalculations.js
 * Mantém apenas gerenciamento de estado e persistência
 */

import redis from '../redisClient.js';
import { getNumericValue, calculateRiskPremium } from '../utils/economicUtils.js';
import { ECONOMIC_CONSTANTS } from '../utils/economicConstants.js';
import { 
  calculateAdvancedGrowth,
  calculateDynamicInflation,
  calculateDynamicUnemployment,
  calculateDynamicPopularity,
  calculateCreditRating,
  processDeptPayments,
  applySectoralVariation,
  resetUnrealisticIndicators,
  debugAdvancedEconomicCalculations,
  validateEconomicCalculations
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
  }

  // ========================================================================
  // CORE STATE MANAGEMENT - Fonte única de verdade (PRESERVADO)
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
  // INICIALIZAÇÃO DE PAÍSES (PRESERVADO)
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
    
    if (countriesInitialized > 0) {
      console.log(`[ECONOMY] Room ${roomName}: initialized ${countriesInitialized} countries with delegated calculations`);
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
        // ===== CAMPOS ORIGINAIS PRESERVADOS =====
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
        
        // ===== NOVOS CAMPOS EXPANDIDOS =====
        _cycleCount: 0,
        _lastQuarterGdp: initialGdp,
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
        
        // Mantém históricos originais para compatibilidade
        historicoPIB: [initialGdp],
        historicoInflacao: [initialInflation],
        historicoPopularidade: [initialPopularity],
        historicoDesemprego: [initialUnemployment],
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
    
    console.log(`[ECONOMY] Migrated existing state with delegated calculations`);
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
  // CÁLCULOS ECONÔMICOS DELEGADOS (SEM DUPLICAÇÃO)
  // ========================================================================

  performAdvancedEconomicCalculations(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return;

    const economy = countryState.economy;
    
    // Incrementar contador de ciclos
    economy._cycleCount++;
    
    // ===== APLICAÇÃO DOS CÁLCULOS COMO NO economy-game.js =====
    
    // 1. Calcular outputs setoriais
    economy.servicesOutput = (economy.gdp * economy.services / 100);
    economy.commoditiesOutput = (economy.gdp * economy.commodities / 100);
    economy.manufacturesOutput = (economy.gdp * economy.manufactures / 100);
    
    // 2. Calcular necessidades setoriais
    this.calculateSectoralNeeds(economy);
    
    // 3. Calcular balanços setoriais incluindo comércio
    this.calculateSectoralBalances(roomName, countryName, economy);
    
    // 4. ===== CRESCIMENTO APLICADO DIRETAMENTE COMO NO economy-game.js =====
    const crescimento = calculateAdvancedGrowth(economy);
    
    // APLICAÇÃO DIRETA sem divisões extras - IGUAL AO economy-game.js
    economy.gdp *= (1 + crescimento);
    
    // Converter crescimento para percentual para compatibilidade
    economy.gdpGrowth = crescimento * 100;
    
    // 5. Aplicar cálculos básicos DELEGADOS (aplicação direta)
    economy.inflation = calculateDynamicInflation(economy);
    economy.unemployment = calculateDynamicUnemployment(economy);
    economy.popularity = calculateDynamicPopularity(economy);
    economy.creditRating = calculateCreditRating(economy);
    
    // 6. ===== CAIXA ATUALIZADO COMO NO economy-game.js =====
    // Arrecadação via impostos - CÓPIA EXATA do economy-game.js
    const arrecadacao = economy.gdp * (economy.taxBurden / 100) * 0.017;
    
    // Gastos com investimento público - CÓPIA EXATA do economy-game.js
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
    
    // Atualizar caixa - CÓPIA EXATA do economy-game.js
    economy.treasury += arrecadacao - gastoInvestimento;
    
    // Verificar se o caixa está negativo - COMO NO economy-game.js
    if (economy.treasury <= 0) {
      economy.treasury = 0;
      // Emitir títulos de emergência seria aqui, mas simplificamos
    }
    
    // 7. ===== EFEITO DA INFLAÇÃO NO PIB - COMO NO economy-game.js =====
    if (economy.inflation > 0.1) {
      const excesso = economy.inflation - 0.1;
      const fatorPenalidade = 0.9998 - (excesso * 0.001);
      economy.gdp *= Math.max(0.9995, fatorPenalidade);
    }
    
    // 8. Processamento mensal das dívidas - COMO NO economy-game.js
    if (economy._cycleCount % 30 === 0) {
      const countryKey = `${countryName}:${roomName}`;
      const debtContracts = this.debtContracts.get(countryKey) || [];
      
      if (debtContracts.length > 0) {
        // USAR A FUNÇÃO IMPORTADA do economicCalculations.js
        processDeptPayments(economy, debtContracts, 1); // Fator 1 para pagamento mensal completo
        
        // Filtrar contratos pagos
        const activeContracts = debtContracts.filter(contract => contract.remainingInstallments > 0);
        this.debtContracts.set(countryKey, activeContracts);
      }
    }
    
    // 9. Processamento mensal para variações setoriais - COMO NO economy-game.js
    if (economy._cycleCount % ECONOMIC_CONSTANTS.MONTHLY_CYCLE === 0) {
      // USAR A FUNÇÃO IMPORTADA do economicCalculations.js
      applySectoralVariation(economy);
      
      // Atualizar históricos
      this.updateHistoricalData(economy);
    }
    
    // Atualizar valores absolutos das necessidades - COMO NO economy-game.js
    economy.commoditiesNeeds = economy.gdp * (economy._commoditiesNeedsBasePercent / 100);
    economy.manufacturesNeeds = economy.gdp * (economy._manufacturesNeedsBasePercent / 100);
    
    // Atualizar estado
    this.setCountryState(roomName, countryName, countryState);
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
    const gameState = global.gameState;
    const room = gameState?.rooms?.get(roomName);
    const tradeAgreements = room?.tradeAgreements || [];
    
    const tradeImpact = this.calculateTradeImpact(tradeAgreements, countryName);
    
    // Calcular balanços finais
    economy.commoditiesBalance = economy.commoditiesOutput + tradeImpact.commodityImports 
                                - tradeImpact.commodityExports - economy.commoditiesNeeds;
    economy.manufacturesBalance = economy.manufacturesOutput + tradeImpact.manufactureImports 
                                - tradeImpact.manufactureExports - economy.manufacturesNeeds;
    
    // Armazenar estatísticas de comércio
    economy.tradeStats = {
      commodityImports: tradeImpact.commodityImports,
      commodityExports: tradeImpact.commodityExports,
      manufactureImports: tradeImpact.manufactureImports,
      manufactureExports: tradeImpact.manufactureExports
    };
  }

  calculateTradeImpact(tradeAgreements, countryName) {
    let commodityImports = 0, commodityExports = 0;
    let manufactureImports = 0, manufactureExports = 0;

    const ownAgreements = tradeAgreements.filter(agreement => 
      agreement.originCountry === countryName
    );
    
    ownAgreements.forEach(agreement => {
      if (agreement.type === 'export') {
        if (agreement.product === 'commodity') {
          commodityExports += agreement.value;
        } else if (agreement.product === 'manufacture') {
          manufactureExports += agreement.value;
        }
      } else if (agreement.type === 'import') {
        if (agreement.product === 'commodity') {
          commodityImports += agreement.value;
        } else if (agreement.product === 'manufacture') {
          manufactureImports += agreement.value;
        }
      }
    });

    return { commodityImports, commodityExports, manufactureImports, manufactureExports };
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
    
    // Manter históricos originais para compatibilidade
    this.addToHistory(economy.historicoPIB, economy.gdp);
    this.addToHistory(economy.historicoInflacao, economy.inflation);
    this.addToHistory(economy.historicoPopularidade, economy.popularity);
    this.addToHistory(economy.historicoDesemprego, economy.unemployment);
  }

  addToHistory(historyArray, value) {
    historyArray.push(value);
    if (historyArray.length > ECONOMIC_CONSTANTS.MAX_HISTORY_SIZE) {
      historyArray.shift();
    }
  }

  // ========================================================================
  // SISTEMA DE DÍVIDA (PRESERVADO)
  // ========================================================================

  issueDebtBonds(roomName, countryName, bondAmount) {
    const countryState = this.getCountryState(roomName, countryName);

    if (!countryState) {
      return { success: false, message: 'País não encontrado' };
    }

    const economy = countryState.economy;
    const debtToGdpRatio = economy.publicDebt / economy.gdp;
    
    if (bondAmount <= 0 || bondAmount > 1000) {
      return { success: false, message: 'Valor deve estar entre 0 e 1000 bilhões' };
    }
    
    const newDebtToGdp = (economy.publicDebt + bondAmount) / economy.gdp;
    if (newDebtToGdp > ECONOMIC_CONSTANTS.MAX_DEBT_TO_GDP_RATIO) {
      return { success: false, message: 'Emissão faria a dívida ultrapassar 120% do PIB' };
    }

    // DELEGADO: Calcular taxa de juros com função de economicUtils
    const riskPremium = calculateRiskPremium(economy.creditRating, debtToGdpRatio);
    const effectiveRate = economy.interestRate + riskPremium;
    
    // Criar contrato expandido
    const contract = {
      id: this.nextDebtId++,
      originalValue: bondAmount,
      remainingValue: bondAmount,
      interestRate: effectiveRate,
      baseRate: economy.interestRate,
      riskPremium: riskPremium,
      monthlyPayment: this.calculateMonthlyPayment(bondAmount, effectiveRate, 120),
      remainingInstallments: 120,
      issueDate: new Date(),
      emergencyBond: false
    };
    
    // Armazenar contrato
    const countryKey = `${countryName}:${roomName}`;
    const contracts = this.debtContracts.get(countryKey) || [];
    contracts.push(contract);
    this.debtContracts.set(countryKey, contracts);
    
    // Atualizar economia
    economy.treasury += bondAmount;
    economy.publicDebt += bondAmount;
    
    this.setCountryState(roomName, countryName, countryState);
    
    return {
      success: true,
      message: `Títulos emitidos com taxa: ${effectiveRate.toFixed(2)}%`,
      bondAmount,
      newTreasury: economy.treasury,
      newPublicDebt: economy.publicDebt,
      newContract: contract,
      effectiveRate
    };
  }

  createInitialDebtContracts(countryName, countryState, totalDebt) {
    const roomName = 'initial';
    const economy = countryState.economy;
    const contracts = [];
    
    // Dividir dívida em 4 títulos
    const debtDistribution = [0.4, 0.3, 0.2, 0.1];
    const ageMonths = [24, 12, 6, 0]; // Idades dos títulos em meses
    
    debtDistribution.forEach((percentage, index) => {
      const bondValue = totalDebt * percentage;
      const age = ageMonths[index];
      const rateAdjustment = index === 0 ? -1 : index === 3 ? 0.5 : 0;
      const effectiveRate = Math.max(3, economy.interestRate + rateAdjustment);
      
      const contract = {
        id: this.nextDebtId++,
        originalValue: bondValue,
        remainingValue: bondValue * (1 - age * 0.008), // Simulação de pagamentos anteriores
        interestRate: effectiveRate,
        baseRate: economy.interestRate,
        riskPremium: rateAdjustment,
        monthlyPayment: this.calculateMonthlyPayment(bondValue, effectiveRate, 120),
        remainingInstallments: 120 - age,
        issueDate: new Date(Date.now() - (age * 30 * 24 * 60 * 60 * 1000)),
        emergencyBond: false
      };
      
      contracts.push(contract);
    });
    
    // Calcular dívida real restante
    const totalRemainingDebt = contracts.reduce((sum, contract) => sum + contract.remainingValue, 0);
    economy.publicDebt = totalRemainingDebt;
    
    // Armazenar contratos
    const countryKey = `${countryName}:initial`;
    this.debtContracts.set(countryKey, contracts);
    
    return contracts;
  }

  calculateMonthlyPayment(principal, annualRate, months) {
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return principal / months;
    
    return principal * monthlyRate * Math.pow(1 + monthlyRate, months) / 
           (Math.pow(1 + monthlyRate, months) - 1);
  }

  getDebtSummary(roomName, countryName) {
    const countryKey = `${countryName}:${roomName}`;
    const contracts = this.debtContracts.get(countryKey) || [];
    const countryState = this.getCountryState(roomName, countryName);
    const economy = countryState?.economy || {};
    
    if (contracts.length === 0) {
      return {
        totalMonthlyPayment: 0,
        principalRemaining: 0,
        totalFuturePayments: 0,
        numberOfContracts: 0,
        contracts: [],
        economicData: {
          gdp: economy.gdp || 0,
          treasury: economy.treasury || 0,
          publicDebt: economy.publicDebt || 0
        }
      };
    }
    
    const totalMonthlyPayment = contracts.reduce((sum, contract) => sum + contract.monthlyPayment, 0);
    const principalRemaining = contracts.reduce((sum, contract) => sum + contract.remainingValue, 0);
    const totalFuturePayments = contracts.reduce((sum, contract) => 
      sum + (contract.monthlyPayment * contract.remainingInstallments), 0
    );
    
    return {
      totalMonthlyPayment,
      principalRemaining,
      totalFuturePayments,
      numberOfContracts: contracts.length,
      contracts,
      economicData: {
        gdp: economy.gdp || 0,
        treasury: economy.treasury || 0,
        publicDebt: economy.publicDebt || 0
      }
    };
  }

  // ========================================================================
  // ATUALIZAÇÃO DE PARÂMETROS ECONÔMICOS (PRESERVADO)
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
  // ACORDOS COMERCIAIS (PRESERVADO)
  // ========================================================================

  createTradeAgreement(roomName, agreementData) {
    const gameState = global.gameState;
    const room = gameState?.rooms?.get(roomName);
    if (!room) return null;
    
    const { type, product, country, value, originCountry, originPlayer } = agreementData;
    
    const originAgreement = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      type, product, country, value, originCountry, originPlayer
    };
    
    const targetAgreement = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      type: type === 'import' ? 'export' : 'import',
      product,
      country: originCountry,
      value,
      originCountry: country,
      originPlayer: null
    };
    
    if (!room.tradeAgreements) room.tradeAgreements = [];
    
    room.tradeAgreements = room.tradeAgreements.filter(existing => 
      !(existing.type === type && existing.product === product && 
        existing.country === country && existing.originCountry === originCountry) &&
      !(existing.type === targetAgreement.type && existing.product === product && 
        existing.country === originCountry && existing.originCountry === country)
    );
    
    room.tradeAgreements.push(originAgreement, targetAgreement);
    
    // Recalcular economias com cálculos delegados
    this.performAdvancedEconomicCalculations(roomName, originCountry);
    this.performAdvancedEconomicCalculations(roomName, country);
    
    return originAgreement;
  }

  cancelTradeAgreement(roomName, agreementId) {
    const gameState = global.gameState;
    const room = gameState?.rooms?.get(roomName);
    if (!room || !room.tradeAgreements) return false;
    
    const agreementIndex = room.tradeAgreements.findIndex(a => a.id === agreementId);
    if (agreementIndex === -1) return false;
    
    const agreement = room.tradeAgreements[agreementIndex];
    room.tradeAgreements.splice(agreementIndex, 1);
    
    const mirroredType = agreement.type === 'import' ? 'export' : 'import';
    const mirroredIndex = room.tradeAgreements.findIndex(a => 
      a.type === mirroredType && a.product === agreement.product && 
      a.country === agreement.originCountry && a.originCountry === agreement.country
    );
    
    if (mirroredIndex !== -1) {
      room.tradeAgreements.splice(mirroredIndex, 1);
    }
    
    // Recalcular economias
    this.performAdvancedEconomicCalculations(roomName, agreement.originCountry);
    this.performAdvancedEconomicCalculations(roomName, agreement.country);
    
    return true;
  }

  // ========================================================================
  // ATUALIZAÇÕES PERIÓDICAS (PRESERVADO)
  // ========================================================================

  startPeriodicUpdates() {
    this.stopPeriodicUpdates();
    
    // Atualizar economia a cada 500ms com cálculos delegados
    this.updateInterval = setInterval(() => {
      this.performPeriodicAdvancedUpdates();
    }, ECONOMIC_CONSTANTS.UPDATE_INTERVAL);
    
    // Salvar no Redis a cada 50 segundos
    this.saveInterval = setInterval(() => {
      this.saveToRedis();
    }, ECONOMIC_CONSTANTS.SAVE_INTERVAL);
    
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
    
    // Log ocasional do status dos cálculos delegados
    if (Math.random() < 0.01) { // 1% de chance
      console.log(`[ECONOMY] Delegated calculations updated ${updatedCountries} countries`);
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

  validateAdvancedCalculations(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return { valid: false, errors: ['Country state not found'] };
    
    // DELEGADO: Usar função de economicCalculations.js
    return validateEconomicCalculations(countryState.economy);
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
  // PERSISTÊNCIA (PRESERVADO)
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
      console.log(`[ECONOMY] Delegated data saved to Redis - ${this.debtContracts.size} debt contracts, ${this.countryStates.size} rooms`);
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
        
        console.log(`[ECONOMY] Delegated calculations loaded from Redis: ${this.countryStates.size} rooms, ${this.debtContracts.size} debt contracts`);
      }
    } catch (error) {
      console.error('[ECONOMY] Error loading from Redis:', error);
    }
  }

  // ========================================================================
  // CLEANUP (PRESERVADO)
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
    
    console.log(`[ECONOMY] Room ${roomName} removed with all delegated economic data`);
  }

  cleanup() {
    this.stopPeriodicUpdates();
    this.saveToRedis();
    console.log('[ECONOMY] EconomyService cleanup completed - all delegated calculations stopped');
  }

  // ========================================================================
  // MÉTODOS DE COMPATIBILIDADE (PRESERVADOS)
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
      
      // Históricos
      historicoPIB: economy.historicoPIB,
      historicoInflacao: economy.historicoInflacao,
      historicoPopularidade: economy.historicoPopularidade,
      historicoDesemprego: economy.historicoDesemprego,
      
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
      updateInterval: ECONOMIC_CONSTANTS.UPDATE_INTERVAL,
      monthlySystemCycle: ECONOMIC_CONSTANTS.MONTHLY_CYCLE,
      quarterlySystemCycle: ECONOMIC_CONSTANTS.QUARTERLY_CYCLE,
      calculationsMethod: 'DELEGATED' // Indica que usa economicCalculations.js
    };
  }
}

// Singleton instance
const economyService = new EconomyService();

export default economyService;