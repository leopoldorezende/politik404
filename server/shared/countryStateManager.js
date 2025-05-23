/**
 * countryStateManager.js (Otimizado)
 * Centralizador único de todos os cálculos econômicos
 * Fonte única de verdade para estados de países
 */

import CountryStateCore from './countryState/countryStateCore.js';
import CountryEconomyCalculator from './countryState/countryEconomyCalculator.js';
import CountryStateUpdater from './countryState/countryStateUpdater.js';

/**
 * Manager Centralizado - Única Fonte de Verdade para Economia
 */
class CountryStateManager {
  constructor() {
    this.core = new CountryStateCore();
    this.economyCalculator = new CountryEconomyCalculator();
    this.updater = new CountryStateUpdater(this.core);
    this.initialized = false;
    
    // Cache para parâmetros econômicos aplicados
    this.appliedParameters = new Map(); // countryKey -> {interestRate, taxBurden, publicServices}
    
    // Contratos de dívida por país
    this.debtContracts = new Map(); // countryKey -> [contracts]
    this.nextDebtId = 1;
  }

  /**
   * Initialize the manager and all its modules
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.core.initialize();
      this.updater.startPeriodicUpdates();
      this.initialized = true;
      console.log('CountryStateManager (otimizado) initialized successfully');
    } catch (error) {
      console.error('Error initializing CountryStateManager:', error);
      throw error;
    }
  }

  // ======================================================================
  // CORE STATE MANAGEMENT (delegated to CountryStateCore)
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

  /**
   * CENTRALIZADO: Atualiza estado do país E recalcula economia
   * Esta é a função principal que centraliza todos os cálculos
   */
  updateCountryState(roomName, countryName, category, updates) {
    const updatedState = this.core.updateCountryState(roomName, countryName, category, updates);
    
    if (!updatedState) return null;
    
    // Se atualizou economia OU parâmetros, recalcula tudo
    if (category === 'economy' || this.isEconomicParameter(updates)) {
      this.performCompleteEconomicCalculation(roomName, countryName);
    }
    
    return updatedState;
  }

  /**
   * NOVO: Centraliza TODOS os cálculos econômicos em um só lugar
   * Esta função substitui a lógica espalhada
   */
  performCompleteEconomicCalculation(roomName, countryName) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) return null;

    // 1. Obter dados estáticos do JSON
    const gameState = global.gameState;
    const staticData = gameState?.countriesData?.[countryName] || { name: countryName };
    
    // 2. Obter acordos comerciais
    const room = gameState?.rooms?.get(roomName);
    const tradeAgreements = room?.tradeAgreements || [];
    
    // 3. Obter parâmetros aplicados
    const countryKey = `${countryName}:${roomName}`;
    const appliedParams = this.appliedParameters.get(countryKey) || this.getDefaultParameters(staticData);
    
    // 4. Obter contratos de dívida
    const debtContracts = this.debtContracts.get(countryKey) || [];
    
    // 5. CÁLCULO COMPLETO usando o calculador
    const updatedCountryState = this.economyCalculator.performEconomicUpdate(
      countryState,
      { ...staticData, ...appliedParams }, // Mescla dados estáticos com parâmetros aplicados
      tradeAgreements
    );
    
    // 6. Adicionar informações de dívida
    updatedCountryState.economy.debtContracts = debtContracts;
    updatedCountryState.economy.numberOfDebtContracts = debtContracts.length;
    
    // 7. Atualizar o estado
    this.setCountryState(roomName, countryName, updatedCountryState);
    
    return updatedCountryState;
  }

  /**
   * NOVO: Atualiza parâmetros econômicos (juros, impostos, investimento)
   */
  updateEconomicParameter(roomName, countryName, parameter, value) {
    const countryKey = `${countryName}:${roomName}`;
    
    // Atualizar parâmetros aplicados
    const currentParams = this.appliedParameters.get(countryKey) || this.getDefaultParameters();
    currentParams[parameter] = value;
    this.appliedParameters.set(countryKey, currentParams);
    
    console.log(`[ECONOMY] ${countryName}: ${parameter} alterado para ${value}`);
    
    // Recalcular economia com novos parâmetros
    return this.performCompleteEconomicCalculation(roomName, countryName);
  }

  /**
   * NOVO: Emite títulos de dívida pública
   */
  issueDebtBonds(roomName, countryName, bondAmount) {
    const countryState = this.getCountryState(roomName, countryName);
    if (!countryState) {
      return { success: false, message: 'País não encontrado' };
    }

    const currentGdp = this.getNumericValue(countryState.economy.gdp);
    const currentDebt = this.getNumericValue(countryState.economy.publicDebt) || 0;
    const debtToGdpRatio = currentDebt / currentGdp;
    
    // Validações
    if (bondAmount <= 0 || bondAmount > 1000) {
      return { success: false, message: 'Valor deve estar entre 0 e 1000 bilhões' };
    }
    
    const newDebtToGdp = (currentDebt + bondAmount) / currentGdp;
    if (newDebtToGdp > 1.2) {
      return { success: false, message: 'Emissão faria a dívida ultrapassar 120% do PIB' };
    }

    // Calcular taxa de juros baseada no rating e situação
    const countryKey = `${countryName}:${roomName}`;
    const appliedParams = this.appliedParameters.get(countryKey) || this.getDefaultParameters();
    const baseRate = appliedParams.interestRate || 8.0;
    
    // Premium de risco baseado na dívida atual
    let riskPremium = 0;
    if (debtToGdpRatio > 0.6) {
      riskPremium = (debtToGdpRatio - 0.6) * 20;
    }
    
    const effectiveRate = baseRate + riskPremium + (Math.random() * 2); // Variação aleatória
    
    // Criar contrato de dívida
    const newContract = {
      id: this.nextDebtId++,
      originalValue: bondAmount,
      remainingValue: bondAmount,
      interestRate: effectiveRate,
      monthlyPayment: this.calculateMonthlyPayment(bondAmount, effectiveRate, 120), // 10 anos
      remainingInstallments: 120,
      issueDate: new Date(),
      roomName,
      countryName
    };
    
    // Armazenar contrato
    const existingContracts = this.debtContracts.get(countryKey) || [];
    existingContracts.push(newContract);
    this.debtContracts.set(countryKey, existingContracts);
    
    // Atualizar tesouro e dívida pública no estado
    const currentTreasury = this.getNumericValue(countryState.economy.treasury);
    const newTreasury = currentTreasury + bondAmount;
    const newPublicDebt = currentDebt + bondAmount;
    
    // Atualizar estado da economia
    this.updateCountryState(roomName, countryName, 'economy', {
      treasury: { value: newTreasury, unit: 'bi USD' },
      publicDebt: { value: newPublicDebt, unit: 'bi USD' }
    });
    
    console.log(`[ECONOMY] ${countryName}: Emitiu ${bondAmount} bi em títulos (taxa: ${effectiveRate.toFixed(2)}%)`);
    
    return {
      success: true,
      message: `Títulos emitidos com sucesso. Taxa efetiva: ${effectiveRate.toFixed(2)}%`,
      bondAmount,
      newTreasury,
      newPublicDebt,
      newContract,
      effectiveRate
    };
  }

  /**
   * NOVO: Obtém resumo completo de dívidas de um país
   */
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
  // TRADE AGREEMENTS (simplificado)
  // ======================================================================

  updateCountryStateForTrade(roomName, countryName, tradeAgreements) {
    // Apenas recalcula a economia considerando os acordos
    return this.performCompleteEconomicCalculation(roomName, countryName);
  }

  updateCountriesForTradeAgreement(roomName, agreement) {
    const { originCountry, country: targetCountry } = agreement;
    
    // Atualizar ambos os países
    this.performCompleteEconomicCalculation(roomName, originCountry);
    this.performCompleteEconomicCalculation(roomName, targetCountry);
  }

  updateCountryEconomy(roomName, countryName, tradeAgreements = []) {
    return this.performCompleteEconomicCalculation(roomName, countryName);
  }

  // ======================================================================
  // PERIODIC UPDATES (delegated)
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
  // PERSISTENCE (delegated)
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

  getNumericValue(property) {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
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

  // ======================================================================
  // HELPER METHODS
  // ======================================================================

  /**
   * Obtém parâmetros econômicos padrão de um país
   */
  getDefaultParameters(staticData = {}) {
    return {
      interestRate: this.getNumericValue(staticData.interestRate) || 8.0,
      taxBurden: this.getNumericValue(staticData.taxBurden) || 40.0,
      publicServices: this.getNumericValue(staticData.publicServices) || 30.0
    };
  }

  /**
   * Verifica se um update contém parâmetros econômicos
   */
  isEconomicParameter(updates) {
    return updates && (
      updates.interestRate !== undefined ||
      updates.taxBurden !== undefined ||
      updates.publicServices !== undefined
    );
  }

  /**
   * Calcula pagamento mensal de um empréstimo
   */
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
    
    // Limpar caches locais
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