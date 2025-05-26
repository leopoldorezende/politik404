/**
 * economyService.js - Serviço centralizado para toda economia
 * Substitui: countryStateCore, countryStateManager, countryStateUpdater, 
 * countryEconomyCalculator, tradeAgreementService
 */

import redis from '../redisClient.js';
import { getNumericValue } from '../utils/economicUtils.js';

// Constantes econômicas consolidadas
const ECONOMIC_CONSTANTS = {
  EQUILIBRIUM_INTEREST_RATE: 8.0,
  EQUILIBRIUM_TAX_RATE: 40.0,
  EQUILIBRIUM_INFLATION: 0.04,
  MAX_DEBT_TO_GDP_RATIO: 1.2,
  UPDATE_INTERVAL: 2000, // 2 segundos
  SAVE_INTERVAL: 60000 // 1 minuto
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
    if (this.countryStates.has(roomName)) {
      console.log(`[ECONOMY] Room ${roomName} already initialized`);
      return;
    }

    const roomStates = {};
    
    for (const [countryName, countryData] of Object.entries(countriesData)) {
      roomStates[countryName] = this.createCountryState(countryName, countryData);
    }
    
    this.countryStates.set(roomName, roomStates);
    console.log(`[ECONOMY] Room ${roomName} initialized with ${Object.keys(roomStates).length} countries`);
  }

  createCountryState(countryName, countryData) {
    const economy = countryData?.economy || {};
    
    return {
      economy: {
        // Valores básicos
        gdp: getNumericValue(economy.gdp) || 100,
        treasury: getNumericValue(economy.treasury) || 10,
        publicDebt: getNumericValue(economy.publicDebt) || 0,
        
        // Distribuição setorial
        services: getNumericValue(economy.services) || 35,
        commodities: getNumericValue(economy.commodities) || 35,
        manufactures: getNumericValue(economy.manufactures) || 30,
        
        // Outputs calculados
        servicesOutput: 0,
        commoditiesOutput: 0,
        manufacturesOutput: 0,
        
        // Necessidades internas
        commoditiesNeeds: 0,
        manufacturesNeeds: 0,
        commoditiesBalance: 0,
        manufacturesBalance: 0,
        
        // Indicadores avançados
        inflation: getNumericValue(economy.inflation) || 2.8,
        unemployment: getNumericValue(economy.unemployment) || 12.5,
        popularity: getNumericValue(economy.popularity) || 50,
        creditRating: economy.creditRating || 'A',
        
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
        navy: getNumericValue(countryData.defense?.navy) || 20,
        army: getNumericValue(countryData.defense?.army) || 20,
        airforce: getNumericValue(countryData.defense?.airforce) || 20
      },
      commerce: {
        exports: 15,
        imports: 15
      },
      politics: {
        parliament: getNumericValue(countryData.politics?.parliamentSupport) || 50,
        media: getNumericValue(countryData.politics?.mediaSupport) || 50,
        opposition: getNumericValue(countryData.politics?.opposition?.strength || countryData.politics?.opposition) || 25
      }
    };
  }

  // ========================================================================
  // ATUALIZAÇÃO DE PARÂMETROS ECONÔMICOS
  // ========================================================================

  updateEconomicParameter(roomName, countryName, parameter, value) {
    const countryKey = `${countryName}:${roomName}`;
    
    // Armazenar parâmetro aplicado
    if (!this.appliedParameters.has(countryKey)) {
      this.appliedParameters.set(countryKey, {
        interestRate: ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE,
        taxBurden: ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE,
        publicServices: 30.0
      });
    }
    
    const params = this.appliedParameters.get(countryKey);
    params[parameter] = value;
    
    // Atualizar estado do país
    const countryState = this.getCountryState(roomName, countryName);
    if (countryState) {
      countryState.economy[parameter] = value;
      this.performEconomicCalculations(roomName, countryName);
      return countryState;
    }
    
    return null;
  }

  // ========================================================================
  // CÁLCULOS ECONÔMICOS SIMPLIFICADOS
  // ========================================================================

  performEconomicCalculations(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return;

    const economy = countryState.economy;
    
    // Calcular outputs setoriais
    economy.servicesOutput = (economy.gdp * economy.services / 100);
    economy.commoditiesOutput = (economy.gdp * economy.commodities / 100);
    economy.manufacturesOutput = (economy.gdp * economy.manufactures / 100);
    
    // Calcular necessidades internas (30% e 45% do PIB)
    economy.commoditiesNeeds = economy.gdp * 0.30;
    economy.manufacturesNeeds = economy.gdp * 0.45;
    
    // Aplicar impacto do comércio
    const gameState = global.gameState;
    const room = gameState?.rooms?.get(roomName);
    const tradeAgreements = room?.tradeAgreements || [];
    
    const tradeImpact = this.calculateTradeImpact(tradeAgreements, countryName);
    
    // Calcular balanços
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
    
    // Atualizar tesouro baseado em impostos e gastos
    const revenue = economy.gdp * (economy.taxBurden / 100) * 0.001;
    const expenses = economy.gdp * (economy.publicServices / 100) * 0.0008;
    const netChange = revenue - expenses;
    economy.treasury = Math.max(economy.treasury + netChange, -economy.gdp * 0.1);
    
    // Crescimento econômico simples
    const employmentRate = 100 - economy.unemployment;
    const baseGrowthRate = (employmentRate / 1000000) + (Math.random() * 0.0001 - 0.00005);
    economy.gdp = economy.gdp * (1 + baseGrowthRate);
    
    this.setCountryState(roomName, countryName, countryState);
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
    }
    
    if (updatedCountries > 0) {
      console.log(`[ECONOMY] Updated ${updatedCountries} countries`);
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