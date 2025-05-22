/**
 * countryStateUpdater.js
 * Manages periodic updates for country states
 * Handles economic cycles, trade impacts, and scheduled calculations
 */

import CountryEconomyCalculator from './countryEconomyCalculator.js';

/**
 * Country State Updater
 * Manages periodic updates and economic cycles for all countries
 */
class CountryStateUpdater {
  constructor(core) {
    this.core = core;
    this.economyCalculator = new CountryEconomyCalculator();
    this.updateInterval = null;
    this.saveInterval = null;
    this.updateCounter = 0;
    this.lastLogTime = 0;
    this.logInterval = 60000; // 1 minute between logs
    this.countryLogHistory = new Map(); // Store last log per country to avoid duplication
  }

  /**
   * Start periodic updates
   * @param {number} updateIntervalMs - Update interval in milliseconds (default: 2000)
   * @param {number} saveIntervalMs - Save interval in milliseconds (default: 60000)
   */
  startPeriodicUpdates(updateIntervalMs = 2000, saveIntervalMs = 60000) {
    // Stop existing intervals
    this.stopPeriodicUpdates();
    
    // Set up economic calculation interval
    this.updateInterval = setInterval(() => {
      this.performPeriodicEconomicUpdates();
    }, updateIntervalMs);
    
    // Set up periodic state saving
    this.saveInterval = setInterval(() => {
      this.core.saveStatesToRedis();
    }, saveIntervalMs);
    
    console.log(`CountryStateUpdater started with ${updateIntervalMs}ms update interval and ${saveIntervalMs}ms save interval`);
  }

  /**
   * Stop periodic updates
   */
  stopPeriodicUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    
    console.log('CountryStateUpdater stopped');
  }

  /**
   * Perform periodic economic updates for all countries in all rooms
   */
  performPeriodicEconomicUpdates() {
    const gameState = global.gameState;
    if (!gameState || !gameState.countriesData) return;
    
    let totalUpdates = 0;
    const roomNames = this.core.getAllRooms();
    
    // Iterate through all rooms
    for (const roomName of roomNames) {
      // Check if there are online players in the room
      const room = gameState.rooms.get(roomName);
      const hasOnlinePlayers = room && room.players && 
        room.players.some(p => typeof p === 'object' && p.isOnline);
      
      if (!hasOnlinePlayers) {
        continue;
      }
      
      let roomUpdates = 0;
      const countryNames = this.core.getAllCountriesInRoom(roomName);
      
      // Iterate through all countries in the room
      for (const countryName of countryNames) {
        const countryState = this.core.getCountryState(roomName, countryName);
        const staticData = gameState.countriesData[countryName];
        
        if (staticData && staticData.economy) {
          // Check if there are trade agreements to consider in calculations
          let tradeAgreements = [];
          if (room && room.tradeAgreements && room.tradeAgreements.length > 0) {
            tradeAgreements = room.tradeAgreements;
          }
          
          // Perform economic calculations
          const updatedCountryState = this.economyCalculator.performEconomicUpdate(
            countryState,
            staticData,
            tradeAgreements
          );
          
          // Update the country state in core
          this.core.setCountryState(roomName, countryName, updatedCountryState);
          
          roomUpdates++;
          totalUpdates++;
          
          // Log detailed info only when there are agreements and only for countries with active trade
          if (tradeAgreements.length > 0 && 
              (countryState.economy.tradeStats?.commodityImports > 0 || 
              countryState.economy.tradeStats?.commodityExports > 0 || 
              countryState.economy.tradeStats?.manufactureImports > 0 || 
              countryState.economy.tradeStats?.manufactureExports > 0)) {
            
            // Limit logs to not overwhelm console
            const now = Date.now();
            if (now - this.lastLogTime > this.logInterval) {
              console.log(`[ECONOMY] Country ${countryName} trade balances updated:`, {
                manufacturesBalance: countryState.economy.manufacturesBalance?.value,
                commoditiesBalance: countryState.economy.commoditiesBalance?.value,
                tradeStats: countryState.economy.tradeStats
              });
              this.lastLogTime = now;
            }
          }
        }
      }
      
      if (roomUpdates > 0) {
        // Update room timestamp
        this.core.lastUpdated.set(roomName, Date.now());
      }
    }
    
    // Simplified log - only every 60 seconds
    this.updateCounter++;
    
    if (this.updateCounter % 60 === 0) { // Every 60 cycles (2 minutes with 2s interval)
      if (totalUpdates > 0) {
        console.log(`[ECONOMY] 2-minute update: ${totalUpdates} total country updates across all rooms`);
      }
    }
  }

  /**
   * Update a specific country's economy (for immediate updates)
   * @param {string} roomName - Name of the room
   * @param {string} countryName - Name of the country
   * @param {Array} tradeAgreements - Trade agreements (optional)
   * @returns {Object|null} - Updated country state or null if error
   */
  updateCountryEconomy(roomName, countryName, tradeAgreements = []) {
    const gameState = global.gameState;
    if (!gameState || !gameState.countriesData) return null;
    
    const countryState = this.core.getCountryState(roomName, countryName);
    const staticData = gameState.countriesData[countryName];
    
    if (!countryState || !staticData) {
      console.error(`Country data missing for ${countryName} in room ${roomName}`);
      return null;
    }
    
    // Perform economic update
    const updatedCountryState = this.economyCalculator.performEconomicUpdate(
      countryState,
      staticData,
      tradeAgreements
    );
    
    // Update the country state in core
    this.core.setCountryState(roomName, countryName, updatedCountryState);
    
    console.log(`Updated economy state for ${countryName} in room ${roomName}`);
    return updatedCountryState;
  }

  /**
   * Update economy for trade agreement changes
   * @param {string} roomName - Name of the room
   * @param {string} countryName - Name of the country
   * @param {Array} tradeAgreements - Updated trade agreements
   * @returns {Object|null} - Updated country state or null if error
   */
  updateCountryEconomyForTrade(roomName, countryName, tradeAgreements) {
    return this.updateCountryEconomy(roomName, countryName, tradeAgreements);
  }

  /**
   * Update economies of countries involved in a trade agreement
   * @param {string} roomName - Name of the room
   * @param {Object} agreement - Trade agreement data
   */
  updateCountriesForTradeAgreement(roomName, agreement) {
    const gameState = global.gameState;
    if (!gameState) return;
    
    const room = gameState.rooms.get(roomName);
    if (!room) return;
    
    const tradeAgreements = room.tradeAgreements || [];
    const { originCountry, country: targetCountry } = agreement;
    
    // Update origin country economy
    this.updateCountryEconomyForTrade(roomName, originCountry, tradeAgreements);
    
    // Update target country economy
    this.updateCountryEconomyForTrade(roomName, targetCountry, tradeAgreements);
  }

  /**
   * Perform manual update cycle (useful for testing or immediate updates)
   */
  performManualUpdate() {
    this.performPeriodicEconomicUpdates();
  }

  /**
   * Get update statistics
   * @returns {Object} - Update statistics
   */
  getUpdateStats() {
    return {
      updateCounter: this.updateCounter,
      economyCalculatorCounter: this.economyCalculator.getUpdateCounter(),
      isUpdating: this.updateInterval !== null,
      isSaving: this.saveInterval !== null,
      totalRooms: this.core.getAllRooms().length
    };
  }

  /**
   * Reset update counters
   */
  resetCounters() {
    this.updateCounter = 0;
    this.economyCalculator.resetUpdateCounter();
    this.lastLogTime = 0;
    this.countryLogHistory.clear();
  }

  /**
   * Get economy calculator instance
   * @returns {CountryEconomyCalculator} - Economy calculator
   */
  getEconomyCalculator() {
    return this.economyCalculator;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopPeriodicUpdates();
    console.log('CountryStateUpdater cleanup completed');
  }
}

export default CountryStateUpdater;