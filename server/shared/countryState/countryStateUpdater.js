/**
 * countryStateUpdater.js
 * Manages periodic updates for country states
 * FOCUSED ON CORRECTLY READING AND USING DATA FROM countriesData.json
 */

import CountryEconomyCalculator from './countryEconomyCalculator.js';

/**
 * Country State Updater
 * Ensures data from countriesData.json is properly loaded and used
 */
class CountryStateUpdater {
  constructor(core) {
    this.core = core;
    this.economyCalculator = new CountryEconomyCalculator();
    this.updateInterval = null;
    this.saveInterval = null;
    this.updateCounter = 0;
    this.lastLogTime = 0;
    this.logInterval = 10000; // 10 seconds between summary logs
    this.lastDataCheckTime = 0;
    this.dataCheckInterval = 30000; // 30 seconds between data availability checks
  }

  /**
   * Start periodic updates
   * @param {number} updateIntervalMs - Update interval in milliseconds (default: 2000)
   * @param {number} saveIntervalMs - Save interval in milliseconds (default: 60000)
   */
  startPeriodicUpdates(updateIntervalMs = 2000, saveIntervalMs = 60000) {
    // Stop existing intervals
    this.stopPeriodicUpdates();
    
    console.log(`[ECONOMY] Starting periodic updates every ${updateIntervalMs}ms`);
    
    // First, check if we have access to countriesData
    this.checkDataAvailability();
    
    // Set up economic calculation interval
    this.updateInterval = setInterval(() => {
      this.performPeriodicEconomicUpdates();
    }, updateIntervalMs);
    
    // Set up periodic state saving
    this.saveInterval = setInterval(() => {
      this.core.saveStatesToRedis();
    }, saveIntervalMs);
    
    console.log(`[ECONOMY] CountryStateUpdater started - Updates: ${updateIntervalMs}ms, Saves: ${saveIntervalMs}ms`);
  }

  /**
   * Check if countriesData.json is available and log its contents
   */
  checkDataAvailability() {
    const gameState = global.gameState;
    
    if (!gameState) {
      console.error('[ECONOMY] Global gameState is not available!');
      return;
    }
    
    if (!gameState.countriesData) {
      console.error('[ECONOMY] gameState.countriesData is not available!');
      return;
    }
    
    const countries = Object.keys(gameState.countriesData);
    console.log(`[ECONOMY] Found ${countries.length} countries in JSON data:`, countries);
    
    // Check a few countries for economy data
    let countriesWithEconomy = 0;
    const sampleCountries = countries.slice(0, 3);
    
    sampleCountries.forEach(countryName => {
      const countryData = gameState.countriesData[countryName];
      if (countryData && countryData.economy) {
        countriesWithEconomy++;
        console.log(`[ECONOMY] ${countryName} economy data:`, {
          gdp: countryData.economy.gdp,
          unemployment: countryData.economy.unemployment,
          taxBurden: countryData.economy.taxBurden,
          publicServices: countryData.economy.publicServices,
          hasServices: !!countryData.economy.services,
          hasCommodities: !!countryData.economy.commodities,
          hasManufactures: !!(countryData.economy.manufactures || countryData.economy.manufacturing)
        });
      } else {
        console.warn(`[ECONOMY] ${countryName} has no economy data in JSON`);
      }
    });
    
    console.log(`[ECONOMY] ${countriesWithEconomy} out of ${sampleCountries.length} sample countries have economy data`);
  }

  /**
   * Stop periodic updates
   */
  stopPeriodicUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('[ECONOMY] Update interval stopped');
    }
    
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
      console.log('[ECONOMY] Save interval stopped');
    }
  }

  /**
   * Perform periodic economic updates for all countries in all rooms
   */
  performPeriodicEconomicUpdates() {
    const startTime = Date.now();
    
    // Check if global game state exists
    const gameState = global.gameState;
    if (!gameState) {
      console.warn('[ECONOMY] Global gameState not available');
      return;
    }
    
    if (!gameState.countriesData) {
      console.warn('[ECONOMY] gameState.countriesData not available');
      return;
    }
    
    let totalUpdates = 0;
    let totalCountries = 0;
    let roomsWithPlayers = 0;
    let countriesWithJSON = 0;
    let countriesWithoutJSON = 0;
    
    const roomNames = this.core.getAllRooms();
    
    // Process each room
    for (const roomName of roomNames) {
      const room = gameState.rooms.get(roomName);
      
      // Check if room has online players
      const hasOnlinePlayers = room && room.players && 
        room.players.some(p => typeof p === 'object' && p.isOnline);
      
      if (!hasOnlinePlayers) {
        continue;
      }
      
      roomsWithPlayers++;
      const countryNames = this.core.getAllCountriesInRoom(roomName);
      totalCountries += countryNames.length;
      
      // Update each country in the room
      for (const countryName of countryNames) {
        const countryState = this.core.getCountryState(roomName, countryName);
        
        if (!countryState) {
          continue;
        }
        
        // Check if we have JSON data for this country
        const countryJSONData = gameState.countriesData[countryName];
        if (countryJSONData && countryJSONData.economy) {
          countriesWithJSON++;
        } else {
          countriesWithoutJSON++;
          // Log missing data occasionally
          if (this.updateCounter % 30 === 0) {
            console.warn(`[ECONOMY] No JSON economy data for ${countryName}`);
          }
        }
        
        try {
          // Get trade agreements for this room
          const tradeAgreements = room.tradeAgreements || [];
          
          // Perform economic update - pass the JSON data explicitly
          const updatedCountryState = this.economyCalculator.performEconomicUpdate(
            countryState,
            countryJSONData || { name: countryName }, // Pass JSON data or minimal fallback
            tradeAgreements
          );
          
          // Update the country state in core
          this.core.setCountryState(roomName, countryName, updatedCountryState);
          
          totalUpdates++;
          
        } catch (error) {
          console.error(`[ECONOMY] Error updating ${countryName} in ${roomName}:`, error.message);
        }
      }
      
      // Update room timestamp
      if (countryNames.length > 0) {
        this.core.lastUpdated.set(roomName, Date.now());
      }
    }
    
    // Increment global update counter
    this.updateCounter++;
    
    // Log summary periodically
    const now = Date.now();
    if (now - this.lastLogTime > this.logInterval) {
      const processingTime = now - startTime;
      console.log(`[ECONOMY] Update #${this.updateCounter}: ${totalUpdates} countries updated in ${roomsWithPlayers} rooms (${processingTime}ms)`);
      console.log(`[ECONOMY] Data status: ${countriesWithJSON} countries with JSON data, ${countriesWithoutJSON} without`);
      console.log(`[ECONOMY] Calculator counter: ${this.economyCalculator.getUpdateCounter()}`);
      this.lastLogTime = now;
    }
    
    // Periodic data availability check
    if (now - this.lastDataCheckTime > this.dataCheckInterval) {
      this.checkDataAvailability();
      this.lastDataCheckTime = now;
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
    const countryState = this.core.getCountryState(roomName, countryName);
    
    if (!countryState) {
      console.error(`[ECONOMY] No country state for ${countryName} in ${roomName}`);
      return null;
    }
    
    // Get JSON data for this country
    const gameState = global.gameState;
    let countryJSONData = { name: countryName };
    
    if (gameState && gameState.countriesData && gameState.countriesData[countryName]) {
      countryJSONData = gameState.countriesData[countryName];
      console.log(`[ECONOMY] Manual update for ${countryName} using JSON data`);
    } else {
      console.warn(`[ECONOMY] Manual update for ${countryName} - no JSON data available`);
    }
    
    try {
      // Perform economic update
      const updatedCountryState = this.economyCalculator.performEconomicUpdate(
        countryState,
        countryJSONData,
        tradeAgreements
      );
      
      // Update the country state in core
      this.core.setCountryState(roomName, countryName, updatedCountryState);
      
      console.log(`[ECONOMY] Manual update for ${countryName} completed`);
      return updatedCountryState;
      
    } catch (error) {
      console.error(`[ECONOMY] Error in manual update for ${countryName}:`, error.message);
      return null;
    }
  }

  /**
   * Update economy for trade agreement changes
   * @param {string} roomName - Name of the room
   * @param {string} countryName - Name of the country
   * @param {Array} tradeAgreements - Updated trade agreements
   * @returns {Object|null} - Updated country state or null if error
   */
  updateCountryEconomyForTrade(roomName, countryName, tradeAgreements) {
    console.log(`[TRADE] Updating ${countryName} economy for trade changes`);
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
    
    console.log(`[TRADE] Updating economies for agreement: ${originCountry} <-> ${targetCountry}`);
    
    // Update both countries
    this.updateCountryEconomyForTrade(roomName, originCountry, tradeAgreements);
    this.updateCountryEconomyForTrade(roomName, targetCountry, tradeAgreements);
  }

  /**
   * Perform manual update cycle
   */
  performManualUpdate() {
    console.log('[ECONOMY] Manual update triggered');
    this.performPeriodicEconomicUpdates();
  }

  /**
   * Get detailed status including JSON data availability
   * @returns {Object} - Detailed status
   */
  getDetailedStatus() {
    const gameState = global.gameState;
    let jsonDataStatus = 'Not available';
    let countryCount = 0;
    let economyDataCount = 0;
    
    if (gameState && gameState.countriesData) {
      const countries = Object.keys(gameState.countriesData);
      countryCount = countries.length;
      economyDataCount = countries.filter(name => 
        gameState.countriesData[name] && gameState.countriesData[name].economy
      ).length;
      jsonDataStatus = `${countryCount} countries, ${economyDataCount} with economy data`;
    }
    
    return {
      updateCounter: this.updateCounter,
      economyCalculatorCounter: this.economyCalculator.getUpdateCounter(),
      isUpdating: this.updateInterval !== null,
      isSaving: this.saveInterval !== null,
      totalRooms: this.core.getAllRooms().length,
      jsonDataStatus,
      countryCount,
      economyDataCount,
      lastLogTime: this.lastLogTime,
      lastDataCheckTime: this.lastDataCheckTime
    };
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
      totalRooms: this.core.getAllRooms().length,
      lastLogTime: this.lastLogTime
    };
  }

  /**
   * Reset update counters
   */
  resetCounters() {
    this.updateCounter = 0;
    this.economyCalculator.resetUpdateCounter();
    this.lastLogTime = 0;
    this.lastDataCheckTime = 0;
    console.log('[ECONOMY] Counters reset');
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
    console.log('[ECONOMY] CountryStateUpdater cleanup completed');
  }
}

export default CountryStateUpdater;