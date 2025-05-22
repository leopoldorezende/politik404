/**
 * countryStateManager.js (Modular Version)
 * Main manager that coordinates all country state modules
 * Provides a unified interface while delegating to specialized modules
 */

import CountryStateCore from './countryState/countryStateCore.js';
import CountryEconomyCalculator from './countryState/countryEconomyCalculator.js';
import CountryStateUpdater from './countryState/countryStateUpdater.js';

/**
 * Modular Country State Manager
 * Coordinates between core state management, economic calculations, and periodic updates
 */
class CountryStateManager {
  constructor() {
    this.core = new CountryStateCore();
    this.economyCalculator = new CountryEconomyCalculator();
    this.updater = new CountryStateUpdater(this.core);
    this.initialized = false;
  }

  /**
   * Initialize the manager and all its modules
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize core first
      await this.core.initialize();
      
      // Start periodic updates
      this.updater.startPeriodicUpdates();
      
      this.initialized = true;
      console.log('CountryStateManager (modular) initialized successfully');
    } catch (error) {
      console.error('Error initializing CountryStateManager:', error);
      throw error;
    }
  }

  // ======================================================================
  // CORE STATE MANAGEMENT (delegated to CountryStateCore)
  // ======================================================================

  /**
   * Get all country states for a specific room
   * @param {string} roomName - Name of the room
   * @returns {Object} - Country states for the room
   */
  getRoomCountryStates(roomName) {
    return this.core.getRoomCountryStates(roomName);
  }

  /**
   * Get a specific country's state in a room
   * @param {string} roomName - Name of the room
   * @param {string} countryName - Name of the country
   * @returns {Object} - Country state or null if not found
   */
  getCountryState(roomName, countryName) {
    return this.core.getCountryState(roomName, countryName);
  }

  /**
   * Set a country's state in a room
   * @param {string} roomName - Name of the room
   * @param {string} countryName - Name of the country
   * @param {Object} state - Country state
   */
  setCountryState(roomName, countryName, state) {
    this.core.setCountryState(roomName, countryName, state);
  }

  /**
   * Update a country's state indicators
   * @param {string} roomName - Name of the room
   * @param {string} countryName - Name of the country
   * @param {string} category - Indicator category (economy, defense, commerce, politics)
   * @param {Object} updates - Object with indicator updates
   * @returns {Object} - Updated country state
   */
  updateCountryState(roomName, countryName, category, updates) {
    const updatedState = this.core.updateCountryState(roomName, countryName, category, updates);
    
    // If updating economy, perform derived calculations
    if (category === 'economy' && updatedState) {
      const gameState = global.gameState;
      if (gameState && gameState.countriesData && gameState.countriesData[countryName]) {
        const staticData = gameState.countriesData[countryName];
        const room = gameState.rooms.get(roomName);
        const tradeAgreements = room?.tradeAgreements || [];
        
        // Update derived indicators
        this.economyCalculator.updateDerivedEconomicIndicators(updatedState);
        
        // Apply trade impact if there are agreements
        if (tradeAgreements.length > 0) {
          const tradeImpact = this.economyCalculator.calculateTradeImpact(
            updatedState.economy, 
            tradeAgreements, 
            countryName
          );
          this.economyCalculator.applyTradeImpactToBalances(updatedState.economy, tradeImpact);
        }
        
        // Update the state in core
        this.core.setCountryState(roomName, countryName, updatedState);
        
        // Log for debugging trade balances only on relevant changes
        const economy = updatedState.economy;
        const hasTradeActivity = economy.tradeStats && (
          economy.tradeStats.commodityImports > 0 || 
          economy.tradeStats.commodityExports > 0 || 
          economy.tradeStats.manufactureImports > 0 || 
          economy.tradeStats.manufactureExports > 0
        );
        
        if (hasTradeActivity) {
          const now = Date.now();
          const countryLogKey = `${roomName}:${countryName}`;
          const lastLogTime = this.updater.countryLogHistory?.get(countryLogKey) || 0;
          
          if (now - lastLogTime > 60000) { // One minute between logs for same country
            console.log(`[CountryStateManager] Trade balance updated for ${countryName} in room ${roomName}:`, {
              manufacturesBalance: economy.manufacturesBalance?.value,
              commoditiesBalance: economy.commoditiesBalance?.value,
              tradeStats: economy.tradeStats
            });
            
            if (this.updater.countryLogHistory) {
              this.updater.countryLogHistory.set(countryLogKey, now);
            }
          }
        }
      }
    }
    
    return updatedState;
  }

  /**
   * Initialize a new room with country states
   * @param {string} roomName - Name of the room
   * @param {Object} countries - Country data object with country names as keys
   */
  initializeRoom(roomName, countries) {
    this.core.initializeRoom(roomName, countries);
  }

  /**
   * Remove a room and all its country states
   * @param {string} roomName - Name of the room to remove
   * @returns {boolean} - True if removed, false if not found
   */
  removeRoom(roomName) {
    return this.core.removeRoom(roomName);
  }

  // ======================================================================
  // ECONOMIC CALCULATIONS (delegated to CountryEconomyCalculator)
  // ======================================================================

  /**
   * Update country economy for trade agreements
   * @param {string} roomName - Name of the room
   * @param {string} countryName - Name of the country
   * @param {Array} tradeAgreements - List of trade agreements
   * @returns {Object|null} - Updated country state or null if error
   */
  updateCountryStateForTrade(roomName, countryName, tradeAgreements) {
    return this.updater.updateCountryEconomyForTrade(roomName, countryName, tradeAgreements);
  }

  /**
   * Update economies of countries involved in a trade agreement
   * @param {string} roomName - Name of the room
   * @param {Object} agreement - Trade agreement data
   */
  updateCountriesForTradeAgreement(roomName, agreement) {
    this.updater.updateCountriesForTradeAgreement(roomName, agreement);
  }

  /**
   * Perform immediate economic update for a country
   * @param {string} roomName - Name of the room
   * @param {string} countryName - Name of the country
   * @param {Array} tradeAgreements - Trade agreements (optional)
   * @returns {Object|null} - Updated country state or null if error
   */
  updateCountryEconomy(roomName, countryName, tradeAgreements = []) {
    return this.updater.updateCountryEconomy(roomName, countryName, tradeAgreements);
  }

  // ======================================================================
  // PERIODIC UPDATES (delegated to CountryStateUpdater)
  // ======================================================================

  /**
   * Start periodic updates with custom intervals
   * @param {number} updateIntervalMs - Update interval in milliseconds
   * @param {number} saveIntervalMs - Save interval in milliseconds
   */
  startPeriodicUpdates(updateIntervalMs, saveIntervalMs) {
    this.updater.startPeriodicUpdates(updateIntervalMs, saveIntervalMs);
  }

  /**
   * Stop periodic updates
   */
  stopPeriodicUpdates() {
    this.updater.stopPeriodicUpdates();
  }

  /**
   * Perform manual update cycle
   */
  performManualUpdate() {
    this.updater.performManualUpdate();
  }

  /**
   * Get update statistics
   * @returns {Object} - Update statistics
   */
  getUpdateStats() {
    return this.updater.getUpdateStats();
  }

  // ======================================================================
  // PERSISTENCE (delegated to CountryStateCore)
  // ======================================================================

  /**
   * Save states to Redis
   */
  async saveStatesToRedis() {
    return this.core.saveStatesToRedis();
  }

  /**
   * Load states from Redis
   */
  async loadStatesFromRedis() {
    return this.core.loadStatesFromRedis();
  }

  // ======================================================================
  // UTILITY METHODS
  // ======================================================================

  /**
   * Get last updated timestamp for a room
   * @param {string} roomName - Name of the room
   * @returns {number} - Timestamp
   */
  getLastUpdated(roomName) {
    return this.core.getLastUpdated(roomName);
  }

  /**
   * Get all room names
   * @returns {Array<string>} - Array of room names
   */
  getAllRooms() {
    return this.core.getAllRooms();
  }

  /**
   * Get all country names in a room
   * @param {string} roomName - Name of the room
   * @returns {Array<string>} - Array of country names
   */
  getAllCountriesInRoom(roomName) {
    return this.core.getAllCountriesInRoom(roomName);
  }

  /**
   * Get numeric value from property (utility method)
   * @param {any} property - Property that can be number or object with value
   * @returns {number} - Numeric value
   */
  getNumericValue(property) {
    return this.core.getNumericValue(property);
  }

  /**
   * Check if manager is initialized
   * @returns {boolean} - True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get module instances (for advanced usage)
   * @returns {Object} - Object with module instances
   */
  getModules() {
    return {
      core: this.core,
      economyCalculator: this.economyCalculator,
      updater: this.updater
    };
  }

  // ======================================================================
  // BACKWARD COMPATIBILITY
  // ======================================================================

  /**
   * Backward compatibility: Property access for lastUpdated
   */
  get lastUpdated() {
    return this.core.lastUpdated;
  }

  /**
   * Backward compatibility: Property access for roomStates
   */
  get roomStates() {
    return this.core.roomStates;
  }

  // ======================================================================
  // CLEANUP
  // ======================================================================

  /**
   * Clean up resources when shutting down
   */
  cleanup() {
    console.log('CountryStateManager cleanup starting...');
    
    // Stop periodic updates
    this.updater.cleanup();
    
    // Save final state
    this.core.cleanup();
    
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