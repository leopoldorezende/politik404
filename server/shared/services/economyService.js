/**
 * economyService.js - Serviço centralizado para toda economia
 * Substitui: countryStateCore, countryStateManager, countryStateUpdater, 
 * countryEconomyCalculator, tradeAgreementService
 * VERSÃO COMPLETA COM CÁLCULOS ECONÔMICOS DINÂMICOS
 */

import redis from '../redisClient.js';
import { getNumericValue } from '../utils/economicUtils.js';
import { SYNC_CONFIG } from '../config/syncConfig.js';

// Import do módulo de cálculos econômicos
import { 
  applyEconomicCalculations,
  calculateDynamicInflation,
  calculateDynamicUnemployment, 
  calculateDynamicPopularity,
  calculateDynamicGrowth,
  processDeptPayments
} from '../utils/economicCalculations.js';

// Constantes econômicas consolidadas
const ECONOMIC_CONSTANTS = {
  EQUILIBRIUM_INTEREST_RATE: 8.0,
  EQUILIBRIUM_TAX_RATE: 40.0,
  EQUILIBRIUM_INFLATION: 0.04,
  MAX_DEBT_TO_GDP_RATIO: 1.2,

  UPDATE_INTERVAL: SYNC_CONFIG.ECONOMY_UPDATE_INTERVAL,
  SAVE_INTERVAL: SYNC_CONFIG.ECONOMY_SAVE_INTERVAL,
};

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
      console.log('[ECONOMY] economyService initialized');
    } catch (error) {
      console.error('[ECONOMY] Error initializing economyService:', error);
    }
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
    // Garantir que a estrutura da sala existe
    if (!this.countryStates.has(roomName)) {
      this.countryStates.set(roomName, {});
      console.log(`[ECONOMY] Room ${roomName} structure created`);
    }
    
    const roomStates = this.countryStates.get(roomName);
    let countriesInitialized = 0;
    
    // Inicializar apenas países que ainda não existem
    for (const [countryName, countryData] of Object.entries(countriesData)) {
      if (!roomStates[countryName]) {
        roomStates[countryName] = this.createCountryState(countryName, countryData);
        countriesInitialized++;
        
        // ===== TRANSFERIR CONTRATOS DE DÍVIDA INICIAL PARA A SALA =====
        const initialKey = `${countryName}:initial`;
        const roomKey = `${countryName}:${roomName}`;
        
        if (this.debtContracts.has(initialKey)) {
          const initialContracts = this.debtContracts.get(initialKey);
          this.debtContracts.set(roomKey, initialContracts);
          this.debtContracts.delete(initialKey);
          
          console.log(`[ECONOMY] ${countryName} debt contracts transferred to room ${roomName}: ${initialContracts.length} contracts`);
        }
      }
    }
    
    if (countriesInitialized > 0) {
      console.log(`[ECONOMY] Room ${roomName}: initialized ${countriesInitialized} new countries with debt contracts`);
    } else {
      console.log(`[ECONOMY] Room ${roomName}: all countries already initialized`);
    }
  }

  createCountryState(countryName, countryData) {
    const economy = countryData?.economy || {};
    
    // USAR percentuais EXATOS do JSON (sem random)
    let services = getNumericValue(economy.services) || 35;
    let commodities = getNumericValue(economy.commodities) || 35;
    let manufactures = getNumericValue(economy.manufactures) || 30;
    
    // GARANTIR que os setores somem exatamente 100% (normalizar se necessário)
    const totalSectors = services + commodities + manufactures;
    if (Math.abs(totalSectors - 100) > 0.01) {
      console.log(`[ECONOMY] ${countryName} sectoral total was ${totalSectors}%, normalizing to 100%`);
      // Normalizar proporcionalmente
      services = (services / totalSectors) * 100;
      commodities = (commodities / totalSectors) * 100;
      manufactures = (manufactures / totalSectors) * 100;
    }
    
    // Calcular necessidades base SEM random - baseado apenas na estrutura produtiva
    const commoditiesNeedsPercent = 25 + (commodities * 0.1); // Base 25% + influência da produção
    const manufacturesNeedsPercent = 35 + (manufactures * 0.1); // Base 35% + influência da produção
    
    // Garantir limites razoáveis
    const finalCommoditiesNeeds = Math.max(15, Math.min(45, commoditiesNeedsPercent));
    const finalManufacturesNeeds = Math.max(25, Math.min(55, manufacturesNeedsPercent));
    
    const countryState = {
      economy: {
        // Valores básicos
        gdp: getNumericValue(economy.gdp) || 100,
        treasury: getNumericValue(economy.treasury) || 10,
        publicDebt: getNumericValue(economy.publicDebt) || 0,
        
        // Distribuição setorial EXATA do JSON
        services: Math.round(services * 100) / 100, // 2 casas decimais
        commodities: Math.round(commodities * 100) / 100,
        manufactures: Math.round(manufactures * 100) / 100,
        
        // Outputs calculados dinamicamente (valores absolutos baseados no PIB)
        servicesOutput: 0,
        commoditiesOutput: 0,
        manufacturesOutput: 0,
        
        // Necessidades (apenas commodities e manufactures)
        commoditiesNeeds: 0,
        manufacturesNeeds: 0,
        
        // Balanços
        commoditiesBalance: 0,
        manufacturesBalance: 0,
        
        // Guardar percentuais base para cálculos futuros (SEM random)
        _commoditiesNeedsBasePercent: finalCommoditiesNeeds,
        _manufacturesNeedsBasePercent: finalManufacturesNeeds,
        
        // Indicadores avançados - VALORES INICIAIS REALISTAS
        inflation: 0.04, // 4% inicial
        unemployment: 12.5, // Valor realista inicial
        popularity: 50, // Neutro inicial
        gdpGrowth: 2.5, // 2.5% crescimento inicial
        creditRating: 'A',
        
        // Parâmetros de política econômica
        interestRate: getNumericValue(economy.interestRate) || ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE,
        taxBurden: getNumericValue(economy.taxBurden) || ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE,
        publicServices: getNumericValue(economy.publicServices) || 30.0,
        
        // Estatísticas de comércio
        tradeStats: {
          commodityImports: 0,
          commodityExports: 0,
          manufactureImports: 0,
          manufactureExports: 0
        },
        
        // Históricos para médias móveis
        historicoPIB: [getNumericValue(economy.gdp) || 100],
        historicoInflacao: [0.04],
        historicoPopularidade: [50],
        historicoDesemprego: [12.5],
        
        // Setores base para força de retorno
        _servicesBase: services,
        _commoditiesBase: commodities,
        _manufacturesBase: manufactures
      },
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

    // Aplicar inicialização realística
    countryState.economy = this.initializeRealisticEconomy(countryState.economy);

    // ===== NOVA FUNCIONALIDADE: Converter dívida inicial em títulos reais =====
    const initialDebt = getNumericValue(economy.publicDebt) || 0;
    if (initialDebt > 0) {
      this.createInitialDebtContracts(countryName, countryState, initialDebt);
    }

    return countryState;
  }

  /**
   * Cria contratos de dívida inicial baseados na dívida pública do JSON
   * Simula que já foram emitidos 4 títulos anteriormente
   */
  createInitialDebtContracts(countryName, countryState, totalDebt) {
    const roomName = 'initial'; // Será substituído quando o país for usado em uma sala
    const economy = countryState.economy;
    
    // Dividir a dívida total em 4 títulos com características diferentes
    const contracts = [];
    
    // Título 1: 40% da dívida - Emitido há 2 anos (taxa mais baixa)
    const bond1Value = totalDebt * 0.4;
    const bond1Rate = economy.interestRate - 1; // Taxa 1% menor
    const bond1RemainingMonths = 120 - 24; // 96 meses restantes (2 anos já pagos)
    
    contracts.push({
      id: this.nextDebtId++,
      originalValue: bond1Value,
      remainingValue: bond1Value * 0.8, // 80% do valor original ainda devendo
      interestRate: Math.max(3, bond1Rate),
      monthlyPayment: this.calculateMonthlyPayment(bond1Value, bond1Rate, 120),
      remainingInstallments: bond1RemainingMonths,
      issueDate: new Date(Date.now() - (24 * 30 * 24 * 60 * 60 * 1000)) // 2 anos atrás
    });
    
    // Título 2: 30% da dívida - Emitido há 1 ano (taxa padrão)
    const bond2Value = totalDebt * 0.3;
    const bond2Rate = economy.interestRate;
    const bond2RemainingMonths = 120 - 12; // 108 meses restantes (1 ano já pago)
    
    contracts.push({
      id: this.nextDebtId++,
      originalValue: bond2Value,
      remainingValue: bond2Value * 0.9, // 90% do valor original ainda devendo
      interestRate: bond2Rate,
      monthlyPayment: this.calculateMonthlyPayment(bond2Value, bond2Rate, 120),
      remainingInstallments: bond2RemainingMonths,
      issueDate: new Date(Date.now() - (12 * 30 * 24 * 60 * 60 * 1000)) // 1 ano atrás
    });
    
    // Título 3: 20% da dívida - Emitido há 6 meses (taxa atual)
    const bond3Value = totalDebt * 0.2;
    const bond3Rate = economy.interestRate;
    const bond3RemainingMonths = 120 - 6; // 114 meses restantes (6 meses já pagos)
    
    contracts.push({
      id: this.nextDebtId++,
      originalValue: bond3Value,
      remainingValue: bond3Value * 0.95, // 95% do valor original ainda devendo
      interestRate: bond3Rate,
      monthlyPayment: this.calculateMonthlyPayment(bond3Value, bond3Rate, 120),
      remainingInstallments: bond3RemainingMonths,
      issueDate: new Date(Date.now() - (6 * 30 * 24 * 60 * 60 * 1000)) // 6 meses atrás
    });
    
    // Título 4: 10% da dívida - Emitido recentemente (taxa mais alta por risco)
    const bond4Value = totalDebt * 0.1;
    const bond4Rate = economy.interestRate + 0.5; // Taxa 0.5% maior
    const bond4RemainingMonths = 120; // Título novo, todos os meses restantes
    
    contracts.push({
      id: this.nextDebtId++,
      originalValue: bond4Value,
      remainingValue: bond4Value, // 100% do valor original ainda devendo
      interestRate: bond4Rate,
      monthlyPayment: this.calculateMonthlyPayment(bond4Value, bond4Rate, 120),
      remainingInstallments: bond4RemainingMonths,
      issueDate: new Date() // Emitido recentemente
    });
    
    // Calcular o valor total da dívida baseado nos contratos
    const totalRemainingDebt = contracts.reduce((sum, contract) => sum + contract.remainingValue, 0);
    
    // Atualizar a dívida pública para refletir o valor real restante
    economy.publicDebt = totalRemainingDebt;
    
    // Armazenar os contratos temporariamente (serão movidos para a sala quando o país for usado)
    const countryKey = `${countryName}:initial`;
    this.debtContracts.set(countryKey, contracts);
    
    console.log(`[ECONOMY] ${countryName} initial debt converted: ${totalDebt.toFixed(2)} bi -> 4 contracts totaling ${totalRemainingDebt.toFixed(2)} bi remaining`);
    
    return contracts;
  }

  /**
   * Inicializa indicadores econômicos com valores mais realistas
   */
  initializeRealisticEconomy(economy) {
    // Corrigir valores irreais
    if (economy.inflation === 0 || economy.inflation === undefined) {
      economy.inflation = 0.04; // 4% inicial
    }
    
    if (economy.unemployment < 5 || economy.unemployment === undefined) {
      economy.unemployment = 12.5; // Valor mais realista
    }
    
    if (economy.popularity > 85 || economy.popularity === undefined) {
      economy.popularity = 50; // Começar neutro
    }
    
    if (economy.gdpGrowth === undefined) {
      economy.gdpGrowth = 2.5; // 2.5% crescimento inicial
    }
    
    // Inicializar históricos se não existirem
    if (!economy.historicoPIB || !Array.isArray(economy.historicoPIB)) {
      economy.historicoPIB = [economy.gdp || 100];
    }
    
    if (!economy.historicoInflacao || !Array.isArray(economy.historicoInflacao)) {
      economy.historicoInflacao = [economy.inflation];
    }
    
    if (!economy.historicoPopularidade || !Array.isArray(economy.historicoPopularidade)) {
      economy.historicoPopularidade = [economy.popularity];
    }
    
    if (!economy.historicoDesemprego || !Array.isArray(economy.historicoDesemprego)) {
      economy.historicoDesemprego = [economy.unemployment];
    }
    
    return economy;
  }

  // ========================================================================
  // ATUALIZAÇÃO DE PARÂMETROS ECONÔMICOS
  // ========================================================================

  updateEconomicParameter(roomName, countryName, parameter, value) {
    console.log(`[ECONOMY] updateEconomicParameter called: ${countryName} in ${roomName}, ${parameter} = ${value}`);
    
    // Verificar se a sala existe
    if (!this.countryStates.has(roomName)) {
      console.error(`[ECONOMY] Room ${roomName} not found in countryStates`);
      return null;
    }
    
    // Verificar se o país existe na sala
    const roomStates = this.countryStates.get(roomName);
    if (!roomStates || !roomStates[countryName]) {
      console.error(`[ECONOMY] Country ${countryName} not found in room ${roomName}. Available countries:`, Object.keys(roomStates || {}));
      return null;
    }
    
    const countryState = roomStates[countryName];
    if (!countryState.economy) {
      console.error(`[ECONOMY] Economy data not found for ${countryName}`);
      return null;
    }
    
    // Atualizar o parâmetro
    console.log(`[ECONOMY] Current ${parameter}: ${countryState.economy[parameter]}, New value: ${value}`);
    countryState.economy[parameter] = value;
    
    // Armazenar parâmetro aplicado para referência futura
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
    
    console.log(`[ECONOMY] Parameter ${parameter} updated to ${value} for ${countryName}`);
    
    // Executar cálculos econômicos imediatamente
    try {
      this.performEconomicCalculations(roomName, countryName);
      console.log(`[ECONOMY] Economic calculations completed for ${countryName}`);
      return countryState;
    } catch (error) {
      console.error(`[ECONOMY] Error in performEconomicCalculations:`, error);
      return null;
    }
  }

  // ========================================================================
  // CÁLCULOS ECONÔMICOS DINÂMICOS - VERSÃO COMPLETA
  // ========================================================================

  performEconomicCalculations(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return;

    const economy = countryState.economy;
    
    // ===== APLICAR variação aleatória dinâmica nos setores (a cada ciclo) =====
    this.applySectoralRandomVariation(economy, countryName);
    
    // ===== Calcular outputs setoriais (valores absolutos baseados nos percentuais atualizados) =====
    economy.servicesOutput = (economy.gdp * economy.services / 100);
    economy.commoditiesOutput = (economy.gdp * economy.commodities / 100);
    economy.manufacturesOutput = (economy.gdp * economy.manufactures / 100);
    
    // ===== Verificar se percentuais base de necessidades existem =====
    if (!economy._commoditiesNeedsBasePercent || !economy._manufacturesNeedsBasePercent) {
      economy._commoditiesNeedsBasePercent = 25 + (economy.commodities * 0.1);
      economy._manufacturesNeedsBasePercent = 35 + (economy.manufactures * 0.1);
      economy._commoditiesNeedsBasePercent = Math.max(15, Math.min(45, economy._commoditiesNeedsBasePercent));
      economy._manufacturesNeedsBasePercent = Math.max(25, Math.min(55, economy._manufacturesNeedsBasePercent));
    }
    
    // ===== VARIAÇÃO SUTIL baseada no emprego =====
    const employmentRate = 100 - economy.unemployment;
    const employmentEffect = this.calculateEmploymentEffect(employmentRate);
    
    // Aplicar variação sutil às necessidades base
    const adjustedCommoditiesPercent = economy._commoditiesNeedsBasePercent * (1 + employmentEffect.commodities);
    const adjustedManufacturesPercent = economy._manufacturesNeedsBasePercent * (1 + employmentEffect.manufactures);
    
    // Calcular necessidades finais (valores absolutos)
    economy.commoditiesNeeds = economy.gdp * (adjustedCommoditiesPercent / 100);
    economy.manufacturesNeeds = economy.gdp * (adjustedManufacturesPercent / 100);
    
    // ===== Aplicar impacto do comércio =====
    const gameState = global.gameState;
    const room = gameState?.rooms?.get(roomName);
    const tradeAgreements = room?.tradeAgreements || [];
    
    const tradeImpact = this.calculateTradeImpact(tradeAgreements, countryName);
    
    // Calcular balanços (valores absolutos)
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
    
    // ===== NOVA LÓGICA: Aplicar cálculos econômicos dinâmicos =====
    
    // Obter contratos de dívida para processamento
    const countryKey = `${countryName}:${roomName}`;
    const debtContracts = this.debtContracts.get(countryKey) || [];
    
    // Aplicar todos os cálculos econômicos dinâmicos
    console.log(`[DEBUG] ${countryName} - Antes: inflação=${(economy.inflation*100).toFixed(2)}%, juros=${economy.interestRate}%`);
    const oldInflation = economy.inflation;
    applyEconomicCalculations(economy, debtContracts);
    console.log(`[DEBUG] ${countryName} - Depois: inflação=${(economy.inflation*100).toFixed(2)}%, mudança=${((economy.inflation-oldInflation)*100).toFixed(3)}%`);
    
    // Atualizar contratos de dívida processados
    if (debtContracts.length > 0) {
      // Filtrar contratos pagos
      const activeContracts = debtContracts.filter(contract => contract.remainingInstallments > 0);
      this.debtContracts.set(countryKey, activeContracts);
    }
    
    // ===== Calcular rating de crédito dinamicamente =====
    economy.creditRating = this.calculateCreditRating(economy);
    
    // ===== Atualizar históricos para médias móveis =====
    this.updateHistories(economy);
    
    // ===== Salvar estado atualizado =====
    this.setCountryState(roomName, countryName, countryState);
  }

  /**
   * Atualiza históricos para cálculo de médias móveis
   */
  updateHistories(economy) {
    const maxHistorySize = 20;
    
    // Inicializar arrays se não existirem
    if (!economy.historicoPIB) {
      economy.historicoPIB = [economy.gdp || 100];
    }
    if (!economy.historicoInflacao) {
      economy.historicoInflacao = [economy.inflation || 0.04];
    }
    if (!economy.historicoPopularidade) {
      economy.historicoPopularidade = [economy.popularity || 50];
    }
    if (!economy.historicoDesemprego) {
      economy.historicoDesemprego = [economy.unemployment || 12.5];
    }
    
    // PIB
    economy.historicoPIB.push(economy.gdp);
    if (economy.historicoPIB.length > maxHistorySize) {
      economy.historicoPIB.shift();
    }
    
    // Inflação
    economy.historicoInflacao.push(economy.inflation);
    if (economy.historicoInflacao.length > maxHistorySize) {
      economy.historicoInflacao.shift();
    }
    
    // Popularidade
    economy.historicoPopularidade.push(economy.popularity);
    if (economy.historicoPopularidade.length > maxHistorySize) {
      economy.historicoPopularidade.shift();
    }
    
    // Desemprego
    economy.historicoDesemprego.push(economy.unemployment);
    if (economy.historicoDesemprego.length > maxHistorySize) {
      economy.historicoDesemprego.shift();
    }
  }

  /**
   * Método para calcular rating de crédito dinamicamente
   */
  calculateCreditRating(economy) {
    const debtToGdpRatio = economy.publicDebt / economy.gdp;
    const inflationPercent = economy.inflation * 100;
    const growthPercent = economy.gdpGrowth || 0;
    
    // Base mais equilibrada considerando contexto geral
    let baseRating;
    
    // Análise contextual: país em crescimento com inflação controlada merece nota melhor
    if (growthPercent > 2 && inflationPercent <= 6) {
      // País em crescimento saudável
      if (inflationPercent <= 2) {
        baseRating = "AAA";
      } else if (inflationPercent <= 4) {
        baseRating = "AA";
      } else if (inflationPercent <= 6) {
        baseRating = "A";
      }
    } else {
      // Análise padrão baseada na inflação
      if (inflationPercent <= 2) {
        baseRating = "AAA";
      } else if (inflationPercent <= 3) {
        baseRating = "AA";
      } else if (inflationPercent <= 4) {
        baseRating = "A";
      } else if (inflationPercent <= 6) {
        baseRating = "BBB";
      } else if (inflationPercent <= 8) {
        baseRating = "BB";
      } else if (inflationPercent <= 12) {
        baseRating = "B";
      } else if (inflationPercent <= 18) {
        baseRating = "CCC";
      } else {
        baseRating = "CC";
      }
    }
    
    const levels = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
    let ratingIndex = levels.indexOf(baseRating);
    
    // Ajuste pela dívida (mais equilibrado)
    if (debtToGdpRatio > 0.4 && debtToGdpRatio <= 0.7) {
      ratingIndex += 1;
    } else if (debtToGdpRatio > 0.7 && debtToGdpRatio <= 1.0) {
      ratingIndex += 2;
    } else if (debtToGdpRatio > 1.0) {
      ratingIndex += 3;
    }
    
    // Ajuste pelo crescimento (mais contextual)
    if (growthPercent < -2) {
      ratingIndex += 2; // Recessão forte
    } else if (growthPercent < 0) {
      ratingIndex += 1; // Recessão leve
    } else if (growthPercent > 4) {
      // Crescimento forte pode compensar outros problemas
      ratingIndex = Math.max(0, ratingIndex - 1);
    }
    
    // Casos especiais
    if (inflationPercent > 20 && growthPercent < -3) {
      return "D"; // Crise severa
    }
    
    // Garantir limites
    ratingIndex = Math.min(ratingIndex, levels.length - 1);
    
    return levels[ratingIndex];
  }

  calculateTradeImpact(tradeAgreements, countryName) {
    let commodityImports = 0, commodityExports = 0;
    let manufactureImports = 0, manufactureExports = 0;

    // Filtrar apenas acordos onde este país é originador
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
   * Calcula variação sutil nas necessidades baseada na taxa de emprego
   */
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
   * Aplica variação aleatória nos setores mantendo soma = 100%
   */
  applySectoralRandomVariation(economy, countryName) {
    // Se não existem setores base, salvar os atuais como base
    if (!economy._servicesBase) {
      economy._servicesBase = economy.services;
      economy._commoditiesBase = economy.commodities;
      economy._manufacturesBase = economy.manufactures;
    }
    
    // Gerar variações aleatórias pequenas (±0.5% por ciclo)
    const maxVariation = 0.5;
    const servicesVariation = (Math.random() - 0.5) * maxVariation * 2;
    const commoditiesVariation = (Math.random() - 0.5) * maxVariation * 2;
    const manufacturesVariation = (Math.random() - 0.5) * maxVariation * 2;
    
    // Aplicar variações aos setores
    let newServices = economy.services + servicesVariation;
    let newCommodities = economy.commodities + commoditiesVariation;
    let newManufactures = economy.manufactures + manufacturesVariation;
    
    // Garantir limites mínimos e máximos para cada setor
    newServices = Math.max(5, Math.min(85, newServices));
    newCommodities = Math.max(5, Math.min(85, newCommodities));
    newManufactures = Math.max(5, Math.min(85, newManufactures));
    
    // REBALANCEAR para garantir soma = 100%
    const currentTotal = newServices + newCommodities + newManufactures;
    newServices = (newServices / currentTotal) * 100;
    newCommodities = (newCommodities / currentTotal) * 100;
    newManufactures = (newManufactures / currentTotal) * 100;
    
    // Aplicar força de retorno aos valores base (evita deriva excessiva)
    const returnForce = 0.02; // 2% de força de retorno por ciclo
    newServices = newServices * (1 - returnForce) + economy._servicesBase * returnForce;
    newCommodities = newCommodities * (1 - returnForce) + economy._commoditiesBase * returnForce;
    newManufactures = newManufactures * (1 - returnForce) + economy._manufacturesBase * returnForce;
    
    // Rebalancear novamente após força de retorno
    const finalTotal = newServices + newCommodities + newManufactures;
    economy.services = (newServices / finalTotal) * 100;
    economy.commodities = (newCommodities / finalTotal) * 100;
    economy.manufactures = (newManufactures / finalTotal) * 100;
  }

  // ========================================================================
  // GESTÃO DE DÍVIDA SIMPLIFICADA
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

    // Calcular taxa de juros
    const baseRate = economy.interestRate;
    let riskPremium = 0;
    if (debtToGdpRatio > 0.6) {
      riskPremium = (debtToGdpRatio - 0.6) * 20;
    }
    const effectiveRate = baseRate + riskPremium;
    
    // Criar contrato
    const contract = {
      id: this.nextDebtId++,
      originalValue: bondAmount,
      remainingValue: bondAmount,
      interestRate: effectiveRate,
      monthlyPayment: this.calculateMonthlyPayment(bondAmount, effectiveRate, 120),
      remainingInstallments: 120,
      issueDate: new Date()
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
        // Dados econômicos para o popup
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
      // Dados econômicos completos para o popup
      economicData: {
        gdp: economy.gdp || 0,
        treasury: economy.treasury || 0,
        publicDebt: economy.publicDebt || 0
      }
    };
  }

  calculateMonthlyPayment(principal, annualRate, months) {
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return principal / months;
    
    return principal * monthlyRate * Math.pow(1 + monthlyRate, months) / 
           (Math.pow(1 + monthlyRate, months) - 1);
  }

  // ========================================================================
  // ACORDOS COMERCIAIS
  // ========================================================================

  createTradeAgreement(roomName, agreementData) {
    const gameState = global.gameState;
    const room = gameState?.rooms?.get(roomName);
    if (!room) return null;
    
    const { type, product, country, value, originCountry, originPlayer } = agreementData;
    
    // Criar acordo principal
    const originAgreement = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      type, product, country, value, originCountry, originPlayer
    };
    
    // Criar acordo espelhado
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
    
    // Inicializar e limpar acordos conflitantes
    if (!room.tradeAgreements) room.tradeAgreements = [];
    
    room.tradeAgreements = room.tradeAgreements.filter(existing => 
      !(existing.type === type && existing.product === product && 
        existing.country === country && existing.originCountry === originCountry) &&
      !(existing.type === targetAgreement.type && existing.product === product && 
        existing.country === originCountry && existing.originCountry === country)
    );
    
    // Adicionar novos acordos
    room.tradeAgreements.push(originAgreement, targetAgreement);
    
    // Recalcular economias
    this.performEconomicCalculations(roomName, originCountry);
    this.performEconomicCalculations(roomName, country);
    
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
    
    // Remover acordo espelhado
    const mirroredType = agreement.type === 'import' ? 'export' : 'import';
    const mirroredIndex = room.tradeAgreements.findIndex(a => 
      a.type === mirroredType && a.product === agreement.product && 
      a.country === agreement.originCountry && a.originCountry === agreement.country
    );
    
    if (mirroredIndex !== -1) {
      room.tradeAgreements.splice(mirroredIndex, 1);
    }
    
    // Recalcular economias
    this.performEconomicCalculations(roomName, agreement.originCountry);
    this.performEconomicCalculations(roomName, agreement.country);
    
    return true;
  }

  // ========================================================================
  // ATUALIZAÇÕES PERIÓDICAS
  // ========================================================================

  startPeriodicUpdates() {
    this.stopPeriodicUpdates();
    
    // Atualizar economia a cada 500ms
    this.updateInterval = setInterval(() => {
      this.performPeriodicUpdates();
    }, ECONOMIC_CONSTANTS.UPDATE_INTERVAL);
    
    // Salvar no Redis a cada 50 segundos
    this.saveInterval = setInterval(() => {
      this.saveToRedis();
    }, ECONOMIC_CONSTANTS.SAVE_INTERVAL);
    
    console.log('[ECONOMY] Periodic updates started with dynamic calculations');
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

  performPeriodicUpdates() {
    const gameState = global.gameState;
    if (!gameState || !gameState.rooms) return;
    
    let updatedCountries = 0;
    
    for (const [roomName, room] of gameState.rooms.entries()) {
      // Só atualizar salas com jogadores online
      const hasOnlinePlayers = room.players && 
        room.players.some(p => typeof p === 'object' && p.isOnline);
      
      if (!hasOnlinePlayers) continue;
      
      const roomStates = this.getRoomStates(roomName);
      
      for (const countryName of Object.keys(roomStates)) {
        this.performEconomicCalculations(roomName, countryName);
        updatedCountries++;
      }
      
      // Broadcast após cálculos
      if (Object.keys(roomStates).length > 0 && global.io) {
        // console.log(`[BROADCAST] Enviando dados para ${roomName}:`, Object.keys(roomStates).map(country => ({
        //   country,
        //   inflation: (roomStates[country].economy.inflation * 100).toFixed(2) + '%'
        // })));

        global.io.to(`countryStates:${roomName}`).emit('countryStatesUpdated', {
          roomName,
          states: roomStates,
          timestamp: Date.now()
        });
      }
    }
    
    // Log ocasional do status
    // if (Math.random() < 0.01) { // 1% de chance
    //   console.log(`[ECONOMY] Updated ${updatedCountries} countries with dynamic calculations`);
    // }
  }

  // ========================================================================
  // MÉTODOS DE DEBUG
  // ========================================================================

  debugCountryState(roomName, countryName) {
    console.log(`[ECONOMY DEBUG] Checking state for ${countryName} in ${roomName}`);
    console.log(`[ECONOMY DEBUG] Available rooms:`, Array.from(this.countryStates.keys()));
    
    const roomStates = this.countryStates.get(roomName);
    if (roomStates) {
      console.log(`[ECONOMY DEBUG] Available countries in ${roomName}:`, Object.keys(roomStates));
      
      const countryState = roomStates[countryName];
      if (countryState) {
        console.log(`[ECONOMY DEBUG] ${countryName} has economy:`, !!countryState.economy);
        if (countryState.economy) {
          console.log(`[ECONOMY DEBUG] ${countryName} indicators:`, {
            gdp: countryState.economy.gdp.toFixed(2),
            growth: (countryState.economy.gdpGrowth || 0).toFixed(2) + '%',
            inflation: (countryState.economy.inflation * 100).toFixed(2) + '%',
            unemployment: countryState.economy.unemployment.toFixed(1) + '%',
            popularity: countryState.economy.popularity.toFixed(1) + '%',
            treasury: countryState.economy.treasury.toFixed(2),
            debt: countryState.economy.publicDebt.toFixed(2),
            rating: countryState.economy.creditRating
          });
        }
      }
    }
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
      // console.log(`[ECONOMY] Data saved to Redis - ${this.debtContracts.size} debt contracts, ${this.countryStates.size} rooms`);
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
        
        // Garantir que todos os países têm valores iniciais realistas
        for (const [roomName, roomStates] of this.countryStates.entries()) {
          for (const [countryName, countryState] of Object.entries(roomStates)) {
            if (countryState.economy) {
              countryState.economy = this.initializeRealisticEconomy(countryState.economy);
            }
          }
        }
        
        console.log(`[ECONOMY] Loaded data from Redis: ${this.countryStates.size} rooms, ${this.debtContracts.size} debt contracts`);
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
    
    console.log(`[ECONOMY] Room ${roomName} removed with all economic data`);
  }

  cleanup() {
    this.stopPeriodicUpdates();
    this.saveToRedis();
    console.log('[ECONOMY] EconomyService cleanup completed - all dynamic calculations stopped');
  }
}

// Singleton instance
const economyService = new EconomyService();

export default economyService;