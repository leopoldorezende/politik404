/**
 * economyService.js - Serviço centralizado para toda economia
 * VERSÃO EXPANDIDA COM CÁLCULOS ECONÔMICOS SOFISTICADOS
 * Migração dos cálculos avançados mantendo arquitetura centralizada
 */

import redis from '../redisClient.js';
import { getNumericValue } from '../utils/economicUtils.js';
import { SYNC_CONFIG } from '../config/syncConfig.js';

// Constantes econômicas consolidadas
const ECONOMIC_CONSTANTS = {
  EQUILIBRIUM_INTEREST_RATE: 8.0,
  EQUILIBRIUM_TAX_RATE: 40.0,
  EQUILIBRIUM_INFLATION: 0.04,
  MAX_DEBT_TO_GDP_RATIO: 1.2,
  IDEAL_UNEMPLOYMENT: 15.0,
  IDEAL_POPULARITY: 50.0,

  UPDATE_INTERVAL: SYNC_CONFIG.ECONOMY_UPDATE_INTERVAL,
  SAVE_INTERVAL: SYNC_CONFIG.ECONOMY_SAVE_INTERVAL,
  
  // Novos ciclos temporais
  MONTHLY_CYCLE: 60,    // 60 ciclos = 30 segundos = 1 mês
  QUARTERLY_CYCLE: 180, // 180 ciclos = 90 segundos = 1 trimestre
  
  // Limites de histórico
  MAX_HISTORY_SIZE: 20,
  
  // Limites setoriais
  MIN_SECTOR_PERCENT: 20,
  MAX_SECTOR_PERCENT: 50,
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
      console.log('[ECONOMY] EconomyService initialized with advanced calculations');
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
  // INICIALIZAÇÃO DE PAÍSES COM CAMPOS EXPANDIDOS
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
      console.log(`[ECONOMY] Room ${roomName}: initialized ${countriesInitialized} countries with advanced calculations`);
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

    // Criar contratos de dívida inicial se necessário
    const initialDebt = getNumericValue(economy.publicDebt) || 0;
    if (initialDebt > 0) {
      this.createInitialDebtContracts(countryName, countryState, initialDebt);
    }

    return countryState;
  }

  /**
   * Migra estados existentes para incluir os novos campos
   */
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
    
    console.log(`[ECONOMY] Migrated existing state with advanced calculations`);
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
  // CÁLCULOS ECONÔMICOS AVANÇADOS
  // ========================================================================

  /**
   * Executa os cálculos econômicos avançados para um país
   */
  performAdvancedEconomicCalculations(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return;

    const economy = countryState.economy;
    
    // Incrementar contador de ciclos
    economy._cycleCount++;
    
    // ===== PROCESSAMENTO A CADA CICLO (500ms) =====
    
    // 1. Calcular outputs setoriais
    economy.servicesOutput = (economy.gdp * economy.services / 100);
    economy.commoditiesOutput = (economy.gdp * economy.commodities / 100);
    economy.manufacturesOutput = (economy.gdp * economy.manufactures / 100);
    
    // 2. Calcular necessidades setoriais
    this.calculateSectoralNeeds(economy);
    
    // 3. Calcular balanços setoriais incluindo comércio
    this.calculateSectoralBalances(roomName, countryName, economy);
    
    // 4. Aplicar cálculos básicos
    this.calculateAdvancedInflation(economy);
    this.calculateAdvancedUnemployment(economy);
    this.calculateAdvancedPopularity(economy);
    this.updateCreditRating(economy);
    
    // ===== PROCESSAMENTO MENSAL (a cada 60 ciclos) =====
    if (economy._cycleCount % ECONOMIC_CONSTANTS.MONTHLY_CYCLE === 0) {
      this.processMonthlyUpdates(roomName, countryName, economy);
    }
    
    // ===== PROCESSAMENTO TRIMESTRAL (a cada 180 ciclos) =====
    if (economy._cycleCount % ECONOMIC_CONSTANTS.QUARTERLY_CYCLE === 0) {
      this.processQuarterlyUpdates(economy);
    }
    
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
   * Calcula crescimento econômico trimestral avançado
   */
  calculateAdvancedGrowth(economy) {
    // Efeito dos juros no crescimento
    const interestDiff = economy.interestRate - ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
    let interestEffect;
    
    if (economy.interestRate <= 10) {
      interestEffect = -interestDiff * 0.0002;
    } else {
      const excessInterest = economy.interestRate - 10;
      interestEffect = -(interestDiff * 0.0002) - (Math.pow(excessInterest, 1.5) * 0.0001);
    }
    
    // Efeito dos impostos no crescimento
    const taxDiff = economy.taxBurden - ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
    const taxEffect = -taxDiff * 0.00015;
    
    // Efeito do investimento público no crescimento
    let investmentEffect = 0;
    if (economy.publicServices >= 30) {
      investmentEffect = economy.publicServices * 0.0001;
    } else {
      const deficit = 30 - economy.publicServices;
      const penaltyFactor = 1 - Math.pow(deficit / 30, 1.5) * 0.5;
      investmentEffect = economy.publicServices * 0.0001 * penaltyFactor;
    }
    
    // Efeito da dívida pública na confiança dos investidores
    let debtEffect = 0;
    const debtToGDP = economy.publicDebt / economy.gdp;
    if (debtToGDP > 0.9) {
      debtEffect = -(debtToGDP - 0.9) * 0.05;
    }
    
    const baseGrowth = interestEffect + taxEffect + investmentEffect + debtEffect;
    return baseGrowth * 0.061; // Fator de ajuste
  }

  /**
   * Calcula inflação avançada com inércia
   */
  calculateAdvancedInflation(economy) {
    let newInflation = economy.inflation;
    
    // Efeito dos juros na inflação
    const equilibriumRate = ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
    if (economy.interestRate < equilibriumRate) {
      const factor = 1 + ((equilibriumRate - economy.interestRate) * 0.03);
      newInflation *= factor;
    } else if (economy.interestRate > equilibriumRate) {
      if (economy.interestRate <= 10) {
        const factor = 1 - ((economy.interestRate - equilibriumRate) * 0.025);
        newInflation *= Math.max(0.85, factor);
      } else {
        const normalReduction = 1 - ((10 - equilibriumRate) * 0.025);
        const excessReduction = Math.pow(1.2, economy.interestRate - 10) * 0.05;
        newInflation *= Math.max(0.65, normalReduction - excessReduction);
      }
    }
    
    // Efeito dos impostos na inflação
    const equilibriumTax = ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
    if (economy.taxBurden > equilibriumTax) {
      const factor = 1 - ((economy.taxBurden - equilibriumTax) * 0.003);
      newInflation *= Math.max(0.96, factor);
    } else if (economy.taxBurden < equilibriumTax) {
      const factor = 1 + ((equilibriumTax - economy.taxBurden) * 0.002);
      newInflation *= factor;
    }
    
    // Efeito do crescimento na inflação
    const growthEquilibrium = 2.0;
    if (economy.gdpGrowth > growthEquilibrium) {
      const excess = economy.gdpGrowth - growthEquilibrium;
      const emphasisFactor = 1 + (excess * 5);
      newInflation += (excess / 100) * 0.12 * emphasisFactor;
    } else if (economy.gdpGrowth > 0 && economy.gdpGrowth <= growthEquilibrium) {
      newInflation += (economy.gdpGrowth / 100) * 0.005;
    } else if (economy.gdpGrowth < 0) {
      newInflation -= Math.abs(economy.gdpGrowth / 100) * 0.025;
    }
    
    // Efeito da dívida na inflação estrutural
    const debtToGDP = economy.publicDebt / economy.gdp;
    if (debtToGDP > 0.7) {
      const excessDebt = debtToGDP - 0.7;
      newInflation += excessDebt * 0.02;
    }
    
    // Variação aleatória e inércia
    const randomVariation = (Math.random() - 0.5) * 0.0005;
    newInflation += randomVariation;
    newInflation = economy.inflation * 0.8 + newInflation * 0.2;
    
    // Limitar entre -2% e 18%
    economy.inflation = Math.max(-0.02, Math.min(0.18, newInflation));
  }

  /**
   * Calcula desemprego avançado com Curva de Phillips
   */
  calculateAdvancedUnemployment(economy) {
    let newUnemployment = economy.unemployment;
    
    // Efeito do crescimento no desemprego
    if (economy.gdpGrowth > 0) {
      newUnemployment -= economy.gdpGrowth * 5;
    } else {
      newUnemployment += Math.abs(economy.gdpGrowth) * 8;
    }
    
    // Efeito da inflação no desemprego (Curva de Phillips)
    const inflationPercent = economy.inflation * 100;
    if (inflationPercent < 5) {
      newUnemployment += (5 - inflationPercent) * 2;
    } else if (inflationPercent > 10) {
      newUnemployment += (inflationPercent - 10) * 3;
    } else {
      newUnemployment -= (inflationPercent - 5) * 1;
    }
    
    // Efeito dos impostos no desemprego
    if (economy.taxBurden > ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE) {
      newUnemployment += (economy.taxBurden - ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE) * 0.05;
    }
    
    // Efeito dos juros no desemprego
    if (economy.interestRate > 12) {
      newUnemployment += (economy.interestRate - 12) * 0.4;
    } else if (economy.interestRate < 5) {
      newUnemployment -= (5 - economy.interestRate) * 0.3;
    }
    
    // Aplicar inércia e limites
    newUnemployment = economy.unemployment * 0.9 + newUnemployment * 0.1;
    economy.unemployment = Math.max(3, Math.min(40, newUnemployment));
  }

  /**
   * Calcula popularidade avançada com força de retorno
   */
  calculateAdvancedPopularity(economy) {
    let newPopularity = economy.popularity;
    
    // Efeito do crescimento na popularidade
    if (economy.gdpGrowth > 0) {
      newPopularity += economy.gdpGrowth * 100 * 0.2;
    } else if (economy.gdpGrowth < 0) {
      newPopularity += economy.gdpGrowth * 100 * 0.3;
    }
    
    // Efeito da inflação na popularidade
    const idealInflation = ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION;
    const inflationDiff = economy.inflation - idealInflation;
    if (inflationDiff > 0) {
      newPopularity -= inflationDiff * 100 * 0.25;
    } else if (inflationDiff < 0 && economy.inflation > 0) {
      newPopularity += Math.abs(inflationDiff) * 100 * 0.1;
    }
    
    // Efeito dos impostos na popularidade
    const idealTax = ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
    const taxDiff = economy.taxBurden - idealTax;
    if (taxDiff > 0) {
      newPopularity -= taxDiff * 0.2;
    } else if (taxDiff < 0) {
      newPopularity += Math.abs(taxDiff) * 0.1;
    }
    
    // Efeito do investimento público na popularidade
    const investmentRef = Math.round(economy.gdp / 3.33);
    const investmentDiff = economy.publicServices - investmentRef;
    const responseRate = Math.tanh(investmentDiff / 10) * 0.8;
    newPopularity += responseRate * Math.abs(investmentDiff) * 0.15;
    
    // Efeito do desemprego na popularidade
    const idealUnemployment = ECONOMIC_CONSTANTS.IDEAL_UNEMPLOYMENT;
    const unemploymentDiff = economy.unemployment - idealUnemployment;
    
    if (unemploymentDiff > 0) {
      const penaltyFactor = 1 + Math.pow(unemploymentDiff / 10, 1.5);
      newPopularity -= unemploymentDiff * 0.3 * penaltyFactor;
    } else if (unemploymentDiff < 0) {
      newPopularity += Math.abs(unemploymentDiff) * 0.3;
    }
    
    // Índice de miséria (desemprego alto + inflação alta)
    if (economy.unemployment > 30 && economy.inflation > 0.08) {
      const miseryIndex = (economy.unemployment - 30) * (economy.inflation - 0.08) * 100;
      newPopularity -= miseryIndex * 0.2;
    }
    
    // Variação aleatória
    const randomVariation = (Math.random() - 0.5) * 0.5;
    newPopularity += randomVariation;
    
    // Força de retorno para o equilíbrio (50%)
    const distanceFrom50 = Math.abs(newPopularity - ECONOMIC_CONSTANTS.IDEAL_POPULARITY);
    const returnForce = distanceFrom50 * distanceFrom50 * 0.002;
    
    if (newPopularity > ECONOMIC_CONSTANTS.IDEAL_POPULARITY) {
      newPopularity -= returnForce;
    } else if (newPopularity < ECONOMIC_CONSTANTS.IDEAL_POPULARITY) {
      newPopularity += returnForce;
    }
    
    // Aplicar inércia e limites
    newPopularity = economy.popularity * 0.7 + newPopularity * 0.3;
    economy.popularity = Math.max(1, Math.min(99, newPopularity));
  }

  /**
   * Atualiza rating de crédito dinâmico
   */
  updateCreditRating(economy) {
    const debtToGdpRatio = economy.publicDebt / economy.gdp;
    const inflationPercent = economy.inflation * 100;
    const growthPercent = economy.gdpGrowth || 0;
    
    // Nota base baseada APENAS na inflação
    let baseRating;
    if (inflationPercent <= 2) {
      baseRating = "AAA";
    } else if (inflationPercent <= 3) {
      baseRating = "AA";
    } else if (inflationPercent <= 4) {
      baseRating = "A";
    } else if (inflationPercent <= 5.5) {
      baseRating = "BBB";
    } else if (inflationPercent <= 7) {
      baseRating = "BB";
    } else if (inflationPercent <= 9) {
      baseRating = "B";
    } else if (inflationPercent <= 12) {
      baseRating = "CCC";
    } else if (inflationPercent <= 15) {
      baseRating = "CC";
    } else {
      baseRating = "C";
    }
    
    const levels = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
    let ratingIndex = levels.indexOf(baseRating);
    
    // Ajuste pela dívida
    if (debtToGdpRatio > 0.3 && debtToGdpRatio <= 0.6) {
      ratingIndex += 1;
    } else if (debtToGdpRatio > 0.6 && debtToGdpRatio <= 0.9) {
      ratingIndex += 2;
    } else if (debtToGdpRatio > 0.9 && debtToGdpRatio <= 1.2) {
      ratingIndex += 3;
    } else if (debtToGdpRatio > 1.2) {
      ratingIndex += 4;
    }
    
    // Ajuste pelo crescimento
    if (growthPercent < -5) {
      ratingIndex += 4;
    } else if (growthPercent < -3) {
      ratingIndex += 3;
    } else if (growthPercent < -1) {
      ratingIndex += 2;
    } else if (growthPercent < 0) {
      ratingIndex += 1;
    }
    
    // Casos especiais
    if (inflationPercent > 15 && economy._historicInflation.length >= 3) {
      const last3 = economy._historicInflation.slice(-3).map(i => i * 100);
      if (last3[2] > last3[0] || Math.abs(last3[2] - last3[1]) > 2) {
        economy.creditRating = "D";
        return;
      }
    }
    
    if (inflationPercent > 9 && debtToGdpRatio > 0.9 && growthPercent < -3) {
      economy.creditRating = "D";
      return;
    }
    
    // Limitar índice e definir rating
    ratingIndex = Math.min(ratingIndex, levels.length - 1);
    economy.creditRating = levels[ratingIndex];
  }

  /**
   * Processamento mensal (a cada 60 ciclos)
   */
  processMonthlyUpdates(roomName, countryName, economy) {
    // 1. Aplicar variação setorial aleatória
    this.applySectoralRandomVariation(economy);
    
    // 2. Processar pagamentos de dívida proporcionalmente
    this.processProportionalDebtPayments(roomName, countryName, economy);
    
    // 3. Atualizar históricos
    this.updateHistoricalData(economy);
    
    // 4. Calcular receitas e gastos do tesouro
    this.updateTreasury(economy);
  }

  /**
   * Processamento trimestral (a cada 180 ciclos)
   */
  processQuarterlyUpdates(economy) {
    // 1. Calcular crescimento econômico
    const growthRate = this.calculateAdvancedGrowth(economy);
    economy.gdpGrowth = growthRate * 100; // Converter para percentual
    
    // 2. Atualizar PIB baseado no crescimento
    economy.gdp *= (1 + growthRate);
    
    // 3. Armazenar PIB atual como PIB anterior do trimestre
    economy._lastQuarterGdp = economy.gdp;
    
    console.log(`[ECONOMY] ${countryName} trimestral: PIB ${economy.gdp.toFixed(2)}, Crescimento ${economy.gdpGrowth.toFixed(2)}%`);
  }

  /**
   * Aplica variação aleatória nos setores mantendo soma = 100%
   */
  applySectoralRandomVariation(economy) {
    // Gerar variações aleatórias (+1, 0, -1)
    const commoditiesVariation = Math.floor(Math.random() * 3) - 1;
    const manufacturesVariation = Math.floor(Math.random() * 3) - 1;
    
    let newCommodities = economy.commodities + commoditiesVariation;
    let newManufactures = economy.manufactures + manufacturesVariation;
    let newServices = 100 - newCommodities - newManufactures;
    
    // Aplicar limites (20-50% para cada setor)
    newCommodities = Math.max(ECONOMIC_CONSTANTS.MIN_SECTOR_PERCENT, 
                             Math.min(ECONOMIC_CONSTANTS.MAX_SECTOR_PERCENT, newCommodities));
    newManufactures = Math.max(ECONOMIC_CONSTANTS.MIN_SECTOR_PERCENT, 
                              Math.min(ECONOMIC_CONSTANTS.MAX_SECTOR_PERCENT, newManufactures));
    newServices = Math.max(ECONOMIC_CONSTANTS.MIN_SECTOR_PERCENT, 
                          Math.min(ECONOMIC_CONSTANTS.MAX_SECTOR_PERCENT, newServices));
    
    // Rebalancear para somar 100%
    const total = newCommodities + newManufactures + newServices;
    newCommodities = (newCommodities / total) * 100;
    newManufactures = (newManufactures / total) * 100;
    newServices = (newServices / total) * 100;
    
    // Aplicar força de retorno aos valores base
    const returnForce = 0.02;
    newCommodities = newCommodities * (1 - returnForce) + economy._commoditiesBase * returnForce;
    newManufactures = newManufactures * (1 - returnForce) + economy._manufacturesBase * returnForce;
    newServices = newServices * (1 - returnForce) + economy._servicesBase * returnForce;
    
    // Rebalancear final e arredondar
    const finalTotal = newCommodities + newManufactures + newServices;
    economy.commodities = Math.round((newCommodities / finalTotal) * 100);
    economy.manufactures = Math.round((newManufactures / finalTotal) * 100);
    economy.services = 100 - economy.commodities - economy.manufactures;
  }

  /**
   * Processa pagamentos de dívida proporcionalmente
   */
  processProportionalDebtPayments(roomName, countryName, economy) {
    const countryKey = `${countryName}:${roomName}`;
    const debtContracts = this.debtContracts.get(countryKey) || [];
    
    if (debtContracts.length === 0) return;
    
    // Calcular pagamento mensal proporcional (1/60 do pagamento mensal real)
    const cycleFactor = 1 / ECONOMIC_CONSTANTS.MONTHLY_CYCLE;
    let totalPayment = 0;
    
    debtContracts.forEach(contract => {
      if (contract.remainingInstallments > 0) {
        const fractionalPayment = contract.monthlyPayment * cycleFactor;
        const monthlyRate = contract.interestRate / 100 / 12;
        const interestPayment = contract.remainingValue * monthlyRate * cycleFactor;
        const principalPayment = fractionalPayment - interestPayment;
        
        totalPayment += fractionalPayment;
        
        // Atualizar contrato gradualmente
        contract.remainingValue -= principalPayment;
        if (contract.remainingValue < 0.01) {
          contract.remainingValue = 0;
          contract.remainingInstallments = 0;
        }
      }
    });
    
    // Deduzir pagamento do tesouro
    economy.treasury -= totalPayment;
    
    // Se tesouro insuficiente, emitir títulos de emergência
    if (economy.treasury < 0) {
      const shortfall = Math.abs(economy.treasury);
      economy.treasury = 0;
      
      const emergencyAmount = shortfall * 1.1;
      economy.treasury += emergencyAmount;
      economy.publicDebt += emergencyAmount;
    }
    
    // Atualizar dívida total
    const remainingDebt = debtContracts.reduce((sum, contract) => sum + contract.remainingValue, 0);
    economy.publicDebt = remainingDebt;
    
    // Filtrar contratos pagos
    const activeContracts = debtContracts.filter(contract => contract.remainingInstallments > 0);
    this.debtContracts.set(countryKey, activeContracts);
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

  /**
   * Atualiza tesouro com receitas e gastos
   */
  updateTreasury(economy) {
    const cycleFactor = 1 / ECONOMIC_CONSTANTS.MONTHLY_CYCLE;
    
    // Receitas (proporcionais)
    const revenue = economy.gdp * (economy.taxBurden / 100) * 0.01 * cycleFactor;
    
    // Gastos (proporcionais)
    const expenses = economy.gdp * (economy.publicServices / 100) * 0.008 * cycleFactor;
    
    economy.treasury += revenue - expenses;
    
    // Garantir que tesouro não fique muito negativo
    if (economy.treasury < -economy.gdp * 0.1) {
      economy.treasury = -economy.gdp * 0.1;
    }
  }

  /**
   * Função de média móvel para históricos
   */
  calculateMovingAverage(history) {
    if (history.length === 0) return 0;
    return history.reduce((a, b) => a + b, 0) / history.length;
  }

  // ========================================================================
  // SISTEMA DE DÍVIDA EXPANDIDO (PRESERVADO E MELHORADO)
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

    // Calcular taxa de juros com sistema expandido
    const riskPremium = this.calculateRiskPremium(economy);
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

  /**
   * Calcula prêmio de risco baseado no rating de crédito
   */
  calculateRiskPremium(economy) {
    const riskPremiums = {
      "AAA": 0.0,
      "AA": 0.5,
      "A": 1.0,
      "BBB": 2.0,
      "BB": 3.5,
      "B": 5.0,
      "CCC": 8.0,
      "CC": 12.0,
      "C": 18.0,
      "D": 25.0
    };
    
    let premium = riskPremiums[economy.creditRating] || 5.0;
    
    // Prêmio adicional pela alta dívida
    const debtToGdpRatio = economy.publicDebt / economy.gdp;
    if (debtToGdpRatio > 0.6) {
      premium += (debtToGdpRatio - 0.6) * 20;
    }
    
    return premium;
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
    
    // Recalcular economias com sistema avançado
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
  // ATUALIZAÇÕES PERIÓDICAS (MODIFICADO PARA USAR CÁLCULOS AVANÇADOS)
  // ========================================================================

  startPeriodicUpdates() {
    this.stopPeriodicUpdates();
    
    // Atualizar economia a cada 500ms com cálculos avançados
    this.updateInterval = setInterval(() => {
      this.performPeriodicAdvancedUpdates();
    }, ECONOMIC_CONSTANTS.UPDATE_INTERVAL);
    
    // Salvar no Redis a cada 50 segundos
    this.saveInterval = setInterval(() => {
      this.saveToRedis();
    }, ECONOMIC_CONSTANTS.SAVE_INTERVAL);
    
    console.log('[ECONOMY] Periodic updates started with advanced economic calculations');
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
      
      // Broadcast após cálculos avançados
      if (Object.keys(roomStates).length > 0 && global.io) {
        global.io.to(`countryStates:${roomName}`).emit('countryStatesUpdated', {
          roomName,
          states: roomStates,
          timestamp: Date.now()
        });
      }
    }
    
    // Log ocasional do status dos cálculos avançados
    if (Math.random() < 0.005) { // 0.5% de chance
      console.log(`[ECONOMY] Advanced calculations updated ${updatedCountries} countries`);
    }
  }

  // ========================================================================
  // MÉTODOS DE DEBUG EXPANDIDOS
  // ========================================================================

  debugAdvancedCalculations(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return;
    
    const economy = countryState.economy;
    
    console.log(`[ECONOMY DEBUG] Advanced calculations for ${countryName} in ${roomName}:`);
    console.log({
      // Indicadores principais
      gdp: economy.gdp.toFixed(2),
      gdpGrowth: `${economy.gdpGrowth.toFixed(2)}%`,
      inflation: `${(economy.inflation * 100).toFixed(2)}%`,
      unemployment: `${economy.unemployment.toFixed(1)}%`,
      popularity: `${economy.popularity.toFixed(1)}%`,
      creditRating: economy.creditRating,
      
      // Ciclos
      cycleCount: economy._cycleCount,
      
      // Setores
      commodities: `${economy.commodities}%`,
      manufactures: `${economy.manufactures}%`,
      services: `${economy.services}%`,
      
      // Outputs e necessidades
      commoditiesOutput: economy.commoditiesOutput.toFixed(2),
      commoditiesNeeds: economy.commoditiesNeeds.toFixed(2),
      commoditiesBalance: economy.commoditiesBalance.toFixed(2),
      
      // Controles
      interestRate: `${economy.interestRate}%`,
      taxBurden: `${economy.taxBurden}%`,
      publicServices: `${economy.publicServices}%`,
      
      // Dívida
      publicDebt: economy.publicDebt.toFixed(2),
      debtToGdp: `${((economy.publicDebt / economy.gdp) * 100).toFixed(1)}%`,
      treasury: economy.treasury.toFixed(2)
    });
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
      console.log(`[ECONOMY] Advanced data saved to Redis - ${this.debtContracts.size} debt contracts, ${this.countryStates.size} rooms`);
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
        
        console.log(`[ECONOMY] Advanced calculations loaded from Redis: ${this.countryStates.size} rooms, ${this.debtContracts.size} debt contracts`);
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
    
    console.log(`[ECONOMY] Room ${roomName} removed with all advanced economic data`);
  }

  cleanup() {
    this.stopPeriodicUpdates();
    this.saveToRedis();
    console.log('[ECONOMY] EconomyService cleanup completed - all advanced calculations stopped');
  }

  // ========================================================================
  // MÉTODOS DE COMPATIBILIDADE (PRESERVADOS)
  // ========================================================================

  /**
   * Método legado para compatibilidade - delegado para cálculos avançados
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
   * Método para validar se todos os cálculos estão funcionando corretamente
   */
  validateAdvancedCalculations(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return { valid: false, errors: ['Country state not found'] };
    
    const economy = countryState.economy;
    const errors = [];
    
    // Validar campos obrigatórios
    const requiredFields = [
      'gdp', 'inflation', 'unemployment', 'popularity', 'creditRating',
      'gdpGrowth', '_cycleCount', 'commoditiesBalance', 'manufacturesBalance'
    ];
    
    requiredFields.forEach(field => {
      if (economy[field] === undefined || economy[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    });
    
    // Validar ranges
    if (economy.inflation < -0.05 || economy.inflation > 0.5) {
      errors.push('Inflation out of realistic range');
    }
    
    if (economy.unemployment < 0 || economy.unemployment > 50) {
      errors.push('Unemployment out of realistic range');
    }
    
    if (economy.popularity < 0 || economy.popularity > 100) {
      errors.push('Popularity out of realistic range');
    }
    
    // Validar setores somam 100%
    const sectorSum = economy.commodities + economy.manufactures + economy.services;
    if (Math.abs(sectorSum - 100) > 0.1) {
      errors.push(`Sectors don't sum to 100%: ${sectorSum}`);
    }
    
    // Validar históricos
    if (!Array.isArray(economy._historicInflation) || economy._historicInflation.length === 0) {
      errors.push('Invalid inflation history');
    }
    
    if (economy._historicInflation.length > ECONOMIC_CONSTANTS.MAX_HISTORY_SIZE) {
      errors.push('History size exceeds maximum');
    }
    
    // Validar valores não são NaN ou Infinity
    const numericFields = ['gdp', 'inflation', 'unemployment', 'popularity', 'gdpGrowth'];
    numericFields.forEach(field => {
      if (!isFinite(economy[field])) {
        errors.push(`Field ${field} is not a finite number: ${economy[field]}`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors: errors,
      economy: economy
    };
  }

  /**
   * Método para reset de emergência de um país (preserva estrutura básica)
   */
  emergencyResetCountry(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return false;
    
    const economy = countryState.economy;
    
    // Reset apenas campos problemáticos, preserva outros
    economy._cycleCount = 0;
    economy.gdpGrowth = 2.5;
    economy.inflation = Math.max(0.01, Math.min(0.15, economy.inflation || 0.04));
    economy.unemployment = Math.max(5, Math.min(35, economy.unemployment || 12.5));
    economy.popularity = Math.max(10, Math.min(90, economy.popularity || 50));
    
    // Reset históricos com valores atuais
    economy._historicInflation = [economy.inflation];
    economy._historicUnemployment = [economy.unemployment];
    economy._historicPopularity = [economy.popularity];
    economy._historicGdp = [economy.gdp];
    
    // Recalcular valores iniciais
    this.initializeCalculatedValues(economy);
    
    console.log(`[ECONOMY] Emergency reset performed for ${countryName} in ${roomName}`);
    return true;
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
      quarterlySystemCycle: ECONOMIC_CONSTANTS.QUARTERLY_CYCLE
    };
  }
}

// Singleton instance
const economyService = new EconomyService();

export default economyService;