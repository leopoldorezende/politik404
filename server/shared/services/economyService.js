/**
 * economyService.js - Serviço centralizado para toda economia
 * Substitui: countryStateCore, countryStateManager, countryStateUpdater, 
 * countryEconomyCalculator, tradeAgreementService
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
      }
    }
    
    if (countriesInitialized > 0) {
      console.log(`[ECONOMY] Room ${roomName}: initialized ${countriesInitialized} new countries`);
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
    
    // console.log(`[ECONOMY] ${countryName} exact sectors from JSON - Services: ${services.toFixed(1)}%, Commodities: ${commodities.toFixed(1)}%, Manufactures: ${manufactures.toFixed(1)}% (Total: ${(services + commodities + manufactures).toFixed(1)}%)`);
    // console.log(`[ECONOMY] ${countryName} calculated needs - Commodities: ${finalCommoditiesNeeds.toFixed(1)}%, Manufactures: ${finalManufacturesNeeds.toFixed(1)}%`);
    
    return {
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
        
        // Indicadores avançados
        inflation: (getNumericValue(economy.inflation) || 2.8) / 100,
        unemployment: getNumericValue(economy.unemployment) || 12.5,
        popularity: getNumericValue(economy.popularity) || 50,
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
        }
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
  // Método para calcular rating de crédito dinamicamente
  // ========================================================================

  calculateCreditRating(economy) {
    const debtToGdpRatio = economy.publicDebt / economy.gdp;
    const inflationPercent = economy.inflation * 100;
    
    // Determinação da nota base com base na inflação
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
    
    // Ajuste pela dívida
    const levels = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
    let ratingIndex = levels.indexOf(baseRating);
    
    // Impacto da dívida na classificação
    if (debtToGdpRatio > 0.3 && debtToGdpRatio <= 0.6) {
      ratingIndex += 1;
    } else if (debtToGdpRatio > 0.6 && debtToGdpRatio <= 0.9) {
      ratingIndex += 2;
    } else if (debtToGdpRatio > 0.9 && debtToGdpRatio <= 1.2) {
      ratingIndex += 3;
    } else if (debtToGdpRatio > 1.2) {
      ratingIndex += 4;
    }
    
    // Garantir que o índice não ultrapasse o tamanho do array
    ratingIndex = Math.min(ratingIndex, levels.length - 1);
    
    return levels[ratingIndex];
  }


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
        console.log(`[ECONOMY DEBUG] ${countryName} parameters:`, {
          interestRate: countryState.economy.interestRate,
          taxBurden: countryState.economy.taxBurden,
          publicServices: countryState.economy.publicServices
        });
      }
    }
  }
}

  // ========================================================================
  // CÁLCULOS ECONÔMICOS SIMPLIFICADOS
  // ========================================================================

  performEconomicCalculations(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return;

    const economy = countryState.economy;
    
    // APLICAR variação aleatória dinâmica nos setores (a cada ciclo)
    this.applySectoralRandomVariation(economy, countryName);
    
    // Calcular outputs setoriais (valores absolutos baseados nos percentuais atualizados)
    economy.servicesOutput = (economy.gdp * economy.services / 100);
    economy.commoditiesOutput = (economy.gdp * economy.commodities / 100);
    economy.manufacturesOutput = (economy.gdp * economy.manufactures / 100);
    
    // Verificar se percentuais base de necessidades existem
    if (!economy._commoditiesNeedsBasePercent || !economy._manufacturesNeedsBasePercent) {
      economy._commoditiesNeedsBasePercent = 25 + (economy.commodities * 0.1);
      economy._manufacturesNeedsBasePercent = 35 + (economy.manufactures * 0.1);
      economy._commoditiesNeedsBasePercent = Math.max(15, Math.min(45, economy._commoditiesNeedsBasePercent));
      economy._manufacturesNeedsBasePercent = Math.max(25, Math.min(55, economy._manufacturesNeedsBasePercent));
    }
    
    // VARIAÇÃO SUTIL baseada no emprego
    const employmentRate = 100 - economy.unemployment;
    const employmentEffect = this.calculateEmploymentEffect(employmentRate);
    
    // Aplicar variação sutil às necessidades base
    const adjustedCommoditiesPercent = economy._commoditiesNeedsBasePercent * (1 + employmentEffect.commodities);
    const adjustedManufacturesPercent = economy._manufacturesNeedsBasePercent * (1 + employmentEffect.manufactures);
    
    // Calcular necessidades finais (valores absolutos)
    economy.commoditiesNeeds = economy.gdp * (adjustedCommoditiesPercent / 100);
    economy.manufacturesNeeds = economy.gdp * (adjustedManufacturesPercent / 100);
    
    // Aplicar impacto do comércio
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
    
    // Calcular rating de crédito dinamicamente
    economy.creditRating = this.calculateCreditRating(economy);
    
    // Atualizar tesouro baseado em impostos e gastos
    const revenue = economy.gdp * (economy.taxBurden / 100) * 0.001;
    const expenses = economy.gdp * (economy.publicServices / 100) * 0.0008;
    const netChange = revenue - expenses;
    economy.treasury = Math.max(economy.treasury + netChange, -economy.gdp * 0.1);
    
    // Crescimento econômico simples
    const baseGrowthRate = (employmentRate / 1000000) + (Math.random() * 0.0001 - 0.00005);
    economy.gdp = economy.gdp * (1 + baseGrowthRate);
    
    this.setCountryState(roomName, countryName, countryState);
  }
  // ADICIONAR novo método para gerar seed consistente por país:

  /**
   * Gera seed pseudo-aleatório baseado no nome do país
   * @param {string} countryName - Nome do país
   * @returns {Object} - Seeds para commodities e manufactures
   */
  generateCountrySeed(countryName) {
    let hash = 0;
    for (let i = 0; i < countryName.length; i++) {
      const char = countryName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const seed1 = Math.abs(hash % 1000) / 1000;
    const seed2 = Math.abs((hash * 7) % 1000) / 1000;
    const seed3 = Math.abs((hash * 13) % 1000) / 1000;
    
    return {
      services: seed1,
      commodities: seed2,
      manufactures: seed3
    };
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
   * @param {number} employmentRate - Taxa de emprego (0-100)
   * @returns {Object} - Efeitos percentuais nas necessidades
   */
  calculateEmploymentEffect(employmentRate) {
    // Taxa de emprego ideal: ~85%
    const idealEmployment = 85;
    const employmentDeviation = employmentRate - idealEmployment;
    
    // Efeito sutil: ±5% máximo nas necessidades
    const maxEffect = 0.05; // 5% máximo
    
    // Emprego alto = mais consumo (especialmente manufaturas/luxo)
    // Emprego baixo = menos consumo
    const commoditiesEffect = (employmentDeviation / 15) * maxEffect * 0.6; // Commodities menos sensíveis
    const manufacturesEffect = (employmentDeviation / 15) * maxEffect * 1.0; // Manufaturas mais sensíveis
    
    // Limitar efeitos
    return {
      commodities: Math.max(-maxEffect, Math.min(maxEffect, commoditiesEffect)),
      manufactures: Math.max(-maxEffect, Math.min(maxEffect, manufacturesEffect))
    };
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
    
    if (contracts.length === 0) {
      return {
        totalMonthlyPayment: 0,
        principalRemaining: 0,
        totalFuturePayments: 0,
        numberOfContracts: 0,
        contracts: []
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
      contracts
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
    
    // Atualizar economia a cada 2 segundos
    this.updateInterval = setInterval(() => {
      this.performPeriodicUpdates();
    }, ECONOMIC_CONSTANTS.UPDATE_INTERVAL);
    
    // Salvar no Redis a cada minuto
    this.saveInterval = setInterval(() => {
      this.saveToRedis();
    }, ECONOMIC_CONSTANTS.SAVE_INTERVAL);
    
    console.log('[ECONOMY] Periodic updates started');
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
      
      // ADICIONAR ESTA PARTE - Broadcast após cálculos
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
      console.log(`[ECONOMY] Data saved to Redis - ${this.debtContracts.size} debt contracts saved`);
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
        
        console.log(`[ECONOMY] Loaded data from Redis: ${this.countryStates.size} rooms, ${this.debtContracts.size} debt contracts`);
      }
    } catch (error) {
      console.error('[ECONOMY] Error loading from Redis:', error);
    }
  }

  /**
   * Aplica variação aleatória nos setores mantendo soma = 100%
   * @param {Object} economy - Dados econômicos
   * @param {string} countryName - Nome do país para log
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
    
    // Log ocasional para mostrar a variação (a cada 20 ciclos)
    if (Math.random() < 0.05) { // 5% de chance de log
      const servicesChange = economy.services - economy._servicesBase;
      const commoditiesChange = economy.commodities - economy._commoditiesBase;
      const manufacturesChange = economy.manufactures - economy._manufacturesBase;
      
      // console.log(`[ECONOMY] ${countryName} sectoral drift - Services: ${servicesChange >= 0 ? '+' : ''}${servicesChange.toFixed(2)}%, Commodities: ${commoditiesChange >= 0 ? '+' : ''}${commoditiesChange.toFixed(2)}%, Manufactures: ${manufacturesChange >= 0 ? '+' : ''}${manufacturesChange.toFixed(2)}%`);
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
    
    console.log(`[ECONOMY] Room ${roomName} removed`);
  }

  cleanup() {
    this.stopPeriodicUpdates();
    this.saveToRedis();
    console.log('[ECONOMY] EconomyService cleanup completed');
  }
}

// Singleton instance
const economyService = new EconomyService();

export default economyService;