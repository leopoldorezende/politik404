/**
 * countryStateManager.js (Simplificado)
 * Manager centralizado para todos os cálculos econômicos
 */

import CountryStateCore from './countryStateCore.js';
import CountryEconomyCalculator from './countryEconomyCalculator.js';
import CountryStateUpdater from './countryStateUpdater.js';
import { getNumericValue } from '../utils/economicUtils.js';

class CountryStateManager {
  constructor() {
    this.core = new CountryStateCore();
    this.economyCalculator = new CountryEconomyCalculator();
    this.updater = new CountryStateUpdater(this.core);
    this.initialized = false;
    
    // Cache para parâmetros econômicos aplicados
    this.appliedParameters = new Map();
    
    // Contratos de dívida por país
    this.debtContracts = new Map();
    this.nextDebtId = 1;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.core.initialize();
      this.updater.startPeriodicUpdates();
      this.initialized = true;
      console.log('CountryStateManager initialized');
    } catch (error) {
      console.error('Error initializing CountryStateManager:', error);
      throw error;
    }
  }

  // ======================================================================
  // CORE STATE MANAGEMENT
  // ======================================================================

  getRoomCountryStates(roomName) {
    return this.core.getRoomCountryStates(roomName);
  }

  getCountryState(roomName, countryName) {
    return this.core.getCountryState(roomName, countryName);
  }

  setCountryState(roomName, countryName, state) {
    this.core.setCountryState(roomName, countryName, state);
  }

  updateCountryState(roomName, countryName, category, updates) {
    const updatedState = this.core.updateCountryState(roomName, countryName, category, updates);
    
    if (!updatedState) return null;
    
    if (category === 'economy' || this.isEconomicParameter(updates)) {
      this.performCompleteEconomicCalculation(roomName, countryName);
    }
    
    return updatedState;
  }

  // ======================================================================
  // CÁLCULOS ECONÔMICOS CENTRALIZADOS
  // ======================================================================

  performCompleteEconomicCalculation(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return null;

    const gameState = global.gameState;
    const staticData = gameState?.countriesData?.[countryName] || { name: countryName };
    
    const room = gameState?.rooms?.get(roomName);
    const tradeAgreements = room?.tradeAgreements || [];
    
    // Obter parâmetros aplicados
    const countryKey = `${countryName}:${roomName}`;
    const appliedParams = this.appliedParameters.get(countryKey) || this.getDefaultParameters(staticData);
    
    // Garantir que o estado tenha os parâmetros aplicados
    if (!countryState.economy) {
      countryState.economy = {};
    }
    
    countryState.economy.interestRate = appliedParams.interestRate;
    countryState.economy.taxBurden = appliedParams.taxBurden;
    countryState.economy.publicServices = appliedParams.publicServices;
    
    // Obter contratos de dívida
    const debtContracts = this.debtContracts.get(countryKey) || [];
    
    // Cálculo completo
    const updatedCountryState = this.economyCalculator.performEconomicUpdate(
      countryState,
      { ...staticData, ...appliedParams },
      tradeAgreements
    );
    
    // Garantir que os parâmetros permaneçam após cálculos
    updatedCountryState.economy.interestRate = appliedParams.interestRate;
    updatedCountryState.economy.taxBurden = appliedParams.taxBurden;
    updatedCountryState.economy.publicServices = appliedParams.publicServices;
    
    // Adicionar informações de dívida
    updatedCountryState.economy.debtContracts = debtContracts;
    updatedCountryState.economy.numberOfDebtContracts = debtContracts.length;
    
    this.setCountryState(roomName, countryName, updatedCountryState);
    
    return updatedCountryState;
  }

  updateEconomicParameter(roomName, countryName, parameter, value) {
    const countryKey = `${countryName}:${roomName}`;
    
    const currentParams = this.appliedParameters.get(countryKey) || this.getDefaultParameters();
    currentParams[parameter] = value;
    this.appliedParameters.set(countryKey, currentParams);
    
    const countryState = this.getCountryState(roomName, countryName);
    if (countryState && countryState.economy) {
      countryState.economy[parameter] = value;
    }
    
    const result = this.performCompleteEconomicCalculation(roomName, countryName);
    
    if (result && result.economy) {
      result.economy[parameter] = value;
    }
    
    return result;
  }

  // ======================================================================
  // GESTÃO DE DÍVIDA
  // ======================================================================

  issueDebtBonds(roomName, countryName, bondAmount) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) {
      return { success: false, message: 'País não encontrado' };
    }

    const currentGdp = getNumericValue(countryState.economy.gdp);
    const currentDebt = getNumericValue(countryState.economy.publicDebt) || 0;
    const debtToGdpRatio = currentDebt / currentGdp;
    
    if (bondAmount <= 0 || bondAmount > 1000) {
      return { success: false, message: 'Valor deve estar entre 0 e 1000 bilhões' };
    }
    
    const newDebtToGdp = (currentDebt + bondAmount) / currentGdp;
    if (newDebtToGdp > 1.2) {
      return { success: false, message: 'Emissão faria a dívida ultrapassar 120% do PIB' };
    }

    // Calcular taxa de juros
    const countryKey = `${countryName}:${roomName}`;
    const appliedParams = this.appliedParameters.get(countryKey) || this.getDefaultParameters();
    const baseRate = appliedParams.interestRate || 8.0;
    
    let riskPremium = 0;
    if (debtToGdpRatio > 0.6) {
      riskPremium = (debtToGdpRatio - 0.6) * 20;
    }
    
    const effectiveRate = baseRate + riskPremium + (Math.random() * 2);
    
    // Criar contrato de dívida
    const newContract = {
      id: this.nextDebtId++,
      originalValue: bondAmount,
      remainingValue: bondAmount,
      interestRate: effectiveRate,
      monthlyPayment: this.calculateMonthlyPayment(bondAmount, effectiveRate, 120),
      remainingInstallments: 120,
      issueDate: new Date(),
      roomName,
      countryName
    };
    
    // Armazenar contrato
    const existingContracts = this.debtContracts.get(countryKey) || [];
    existingContracts.push(newContract);
    this.debtContracts.set(countryKey, existingContracts);
    
    // Atualizar tesouro e dívida pública
    const currentTreasury = getNumericValue(countryState.economy.treasury);
    const newTreasury = currentTreasury + bondAmount;
    const newPublicDebt = currentDebt + bondAmount;
    
    this.updateCountryState(roomName, countryName, 'economy', {
      treasury: { value: newTreasury, unit: 'bi USD' },
      publicDebt: { value: newPublicDebt, unit: 'bi USD' }
    });
    
    return {
      success: true,
      message: `Títulos emitidos com taxa: ${effectiveRate.toFixed(2)}%`,
      bondAmount,
      newTreasury,
      newPublicDebt,
      newContract,
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

  // ======================================================================
  // ROOM MANAGEMENT
  // ======================================================================

  initializeRoom(roomName, countries) {
    this.core.initializeRoom(roomName, countries);
  }

  removeRoom(roomName) {
    // Limpar dados de parâmetros e dívidas da sala
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
    
    return this.core.removeRoom(roomName);
  }

  // ======================================================================
  // TRADE AGREEMENTS
  // ======================================================================

  updateCountriesForTradeAgreement(roomName, agreement) {
    const { originCountry, country: targetCountry } = agreement;
    
    this.performCompleteEconomicCalculation(roomName, originCountry);
    this.performCompleteEconomicCalculation(roomName, targetCountry);
  }

  updateCountryEconomy(roomName, countryName, tradeAgreements = []) {
    return this.performCompleteEconomicCalculation(roomName, countryName);
  }

  // ======================================================================
  // PERIODIC UPDATES
  // ======================================================================

  startPeriodicUpdates(updateIntervalMs, saveIntervalMs) {
    this.updater.startPeriodicUpdates(updateIntervalMs, saveIntervalMs);
  }

  stopPeriodicUpdates() {
    this.updater.stopPeriodicUpdates();
  }

  performManualUpdate() {
    this.updater.performManualUpdate();
  }

  getUpdateStats() {
    return this.updater.getUpdateStats();
  }

  // ======================================================================
  // PERSISTENCE
  // ======================================================================

  async saveStatesToRedis() {
    return this.core.saveStatesToRedis();
  }

  async loadStatesFromRedis() {
    return this.core.loadStatesFromRedis();
  }

  // ======================================================================
  // UTILITY METHODS
  // ======================================================================

  getLastUpdated(roomName) {
    return this.core.getLastUpdated(roomName);
  }

  getAllRooms() {
    return this.core.getAllRooms();
  }

  getAllCountriesInRoom(roomName) {
    return this.core.getAllCountriesInRoom(roomName);
  }

  isInitialized() {
    return this.initialized;
  }

  getModules() {
    return {
      core: this.core,
      economyCalculator: this.economyCalculator,
      updater: this.updater
    };
  }

  getDefaultParameters(staticData = {}) {
    return {
      interestRate: getNumericValue(staticData.interestRate) || 8.0,
      taxBurden: getNumericValue(staticData.taxBurden) || 40.0,
      publicServices: getNumericValue(staticData.publicServices) || 30.0
    };
  }

  isEconomicParameter(updates) {
    return updates && (
      updates.interestRate !== undefined ||
      updates.taxBurden !== undefined ||
      updates.publicServices !== undefined
    );
  }

  calculateMonthlyPayment(principal, annualRate, months) {
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return principal / months;
    
    return principal * monthlyRate * Math.pow(1 + monthlyRate, months) / 
           (Math.pow(1 + monthlyRate, months) - 1);
  }

  // ======================================================================
  // BACKWARD COMPATIBILITY
  // ======================================================================

  get lastUpdated() {
    return this.core.lastUpdated;
  }

  get roomStates() {
    return this.core.roomStates;
  }

  // ======================================================================
  // CLEANUP
  // ======================================================================

  cleanup() {
    console.log('CountryStateManager cleanup starting...');
    
    this.updater.cleanup();
    this.core.cleanup();
    
    this.appliedParameters.clear();
    this.debtContracts.clear();
    
    console.log('CountryStateManager cleanup completed');
  }
}

// Create and export singleton instance
const countryStateManager = new CountryStateManager();

// Initialize on first import
countryStateManager.initialize().catch(error => {
  console.error('Failed to initialize CountryStateManager:', error);
});

export default countryStateManager;