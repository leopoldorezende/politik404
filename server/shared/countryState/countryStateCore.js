/**
 * countryStateCore.js
 * Core functionality for country state management
 * Handles basic state structure and persistence
 */

import redis from '../redisClient.js';

// Default values for new country indicators
const DEFAULT_INDICATORS = {
  // Economy indicators
  economy: {
    gdp: { value: 0, unit: 'bi USD' },
    treasury: { value: 0, unit: 'bi USD' },
    
    // Sectoral distribution (percentages)
    services: { value: 35, unit: '%' },
    commodities: { value: 35, unit: '%' },
    manufactures: { value: 30, unit: '%' },
    
    // Sectoral output (absolute values)
    servicesOutput: { value: 0, unit: 'bi USD' },
    commoditiesOutput: { value: 0, unit: 'bi USD' },
    manufacturesOutput: { value: 0, unit: 'bi USD' },
    
    // Internal needs
    commoditiesNeeds: { value: 30, percentValue: 30, unit: 'bi USD' },
    manufacturesNeeds: { value: 45, percentValue: 45, unit: 'bi USD' },
    
    // Balances
    commoditiesBalance: { value: 0, unit: 'bi USD' },
    manufacturesBalance: { value: 0, unit: 'bi USD' },
  },
  
  // Defense indicators
  defense: {
    navy: 0,
    army: 0,
    airforce: 0,
  },
  
  // Commerce indicators
  commerce: {
    exports: 0,
    imports: 0,
  },
  
  // Politics indicators
  politics: {
    parliament: 50,
    media: 50,
    opposition: 25,
  }
};

/**
 * Core country state manager
 */
class CountryStateCore {
  constructor() {
    this.roomStates = new Map(); // Room name -> country states
    this.lastUpdated = new Map(); // Room name -> timestamp
    this.initialized = false;
  }

  /**
   * Initialize the core manager
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.loadStatesFromRedis();
      this.initialized = true;
      console.log('CountryStateCore initialized successfully');
    } catch (error) {
      console.error('Error initializing CountryStateCore:', error);
    }
  }

  /**
   * Get numeric value from property that can be in different formats
   * @param {any} property - Property that can be number or object with value
   * @returns {number} - Numeric value
   */
  getNumericValue(property) {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  }

  /**
   * Load all room country states from Redis
   */
  async loadStatesFromRedis() {
    try {
      const data = await redis.get('country_states');
      if (data) {
        const parsed = JSON.parse(data);
        
        for (const [roomName, roomData] of Object.entries(parsed)) {
          this.roomStates.set(roomName, roomData);
          this.lastUpdated.set(roomName, Date.now());
        }
        
        console.log(`Loaded ${this.roomStates.size} room states from Redis`);
      } else {
        console.log('No country states found in Redis');
      }
    } catch (error) {
      console.error('Error loading country states from Redis:', error);
    }
  }

  /**
   * Save all room country states to Redis
   */
  async saveStatesToRedis() {
    try {
      const serialized = Object.fromEntries(this.roomStates);
      await redis.set('country_states', JSON.stringify(serialized));
      console.log(`Saved ${this.roomStates.size} room states to Redis`);
    } catch (error) {
      console.error('Error saving country states to Redis:', error);
    }
  }

  /**
   * Get all country states for a specific room
   * @param {string} roomName - Name of the room
   * @returns {Object} - Country states for the room or empty object
   */
  getRoomCountryStates(roomName) {
    return this.roomStates.get(roomName) || {};
  }

  /**
   * Get a specific country's state in a room
   * @param {string} roomName - Name of the room
   * @param {string} countryName - Name of the country
   * @returns {Object} - Country state or null if not found
   */
  getCountryState(roomName, countryName) {
    const roomStates = this.getRoomCountryStates(roomName);
    return roomStates[countryName] || null;
  }

  /**
   * Set a country's state in a room
   * @param {string} roomName - Name of the room
   * @param {string} countryName - Name of the country
   * @param {Object} state - Country state
   */
  setCountryState(roomName, countryName, state) {
    if (!this.roomStates.has(roomName)) {
      this.roomStates.set(roomName, {});
    }
    
    this.roomStates.get(roomName)[countryName] = state;
    this.lastUpdated.set(roomName, Date.now());
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
    const roomStates = this.getRoomCountryStates(roomName);
    
    if (!roomStates) return null;
    if (!roomStates[countryName]) return null;
    
    // Make sure the category exists
    if (!roomStates[countryName][category]) {
      roomStates[countryName][category] = {};
    }
    
    // Apply updates to the category
    Object.assign(roomStates[countryName][category], updates);
    
    // Update timestamp
    this.lastUpdated.set(roomName, Date.now());
    
    return roomStates[countryName];
  }

  /**
   * Initialize a new room with country states
   * @param {string} roomName - Name of the room
   * @param {Object} countries - Country data object with country names as keys
   */
  initializeRoom(roomName, countries) {
    if (!this.roomStates.has(roomName)) {
      const countryStates = {};
      
      for (const countryName of Object.keys(countries)) {
        countryStates[countryName] = this.generateCountryState(countryName, countries[countryName]);
      }
      
      this.roomStates.set(roomName, countryStates);
      this.lastUpdated.set(roomName, Date.now());
      
      console.log(`Initialized room ${roomName} with ${Object.keys(countryStates).length} countries`);
    }
  }

  /**
   * Generate a country state with default values based on country data
   * @param {string} countryName - Name of the country
   * @param {Object} countryData - Base country data
   * @returns {Object} - Complete country state with indicators
   */
  generateCountryState(countryName, countryData) {
    const state = JSON.parse(JSON.stringify(DEFAULT_INDICATORS));
    
    if (countryData && countryData.economy) {
      // GDP
      if (countryData.economy.gdp) {
        state.economy.gdp = { 
          value: this.getNumericValue(countryData.economy.gdp), 
          unit: 'bi USD' 
        };
      } else {
        state.economy.gdp = { value: 100, unit: 'bi USD' };
      }
      
      // Treasury
      if (countryData.economy.treasury !== undefined) {
        state.economy.treasury = { 
          value: this.getNumericValue(countryData.economy.treasury), 
          unit: 'bi USD' 
        };
      } else {
        state.economy.treasury = { 
          value: state.economy.gdp.value * 0.1, 
          unit: 'bi USD' 
        };
      }
      
      // Sectoral distribution
      if (countryData.economy.services !== undefined) {
        if (typeof countryData.economy.services === 'object' && countryData.economy.services.gdpShare !== undefined) {
          state.economy.services.value = countryData.economy.services.gdpShare;
        } else if (typeof countryData.economy.services === 'object' && countryData.economy.services.value !== undefined) {
          state.economy.services.value = countryData.economy.services.value;
        } else if (typeof countryData.economy.services === 'number') {
          state.economy.services.value = countryData.economy.services;
        }
      }
      
      if (countryData.economy.commodities) {
        if (typeof countryData.economy.commodities === 'object' && countryData.economy.commodities.gdpShare !== undefined) {
          state.economy.commodities.value = countryData.economy.commodities.gdpShare;
        } else if (typeof countryData.economy.commodities === 'object' && countryData.economy.commodities.value !== undefined) {
          state.economy.commodities.value = countryData.economy.commodities.value;
        } else if (typeof countryData.economy.commodities === 'number') {
          state.economy.commodities.value = countryData.economy.commodities;
        }
      }
      
      if (countryData.economy.manufactures) {
        if (typeof countryData.economy.manufactures === 'object' && countryData.economy.manufactures.gdpShare !== undefined) {
          state.economy.manufactures.value = countryData.economy.manufactures.gdpShare;
        } else if (typeof countryData.economy.manufactures === 'object' && countryData.economy.manufactures.value !== undefined) {
          state.economy.manufactures.value = countryData.economy.manufactures.value;
        } else if (typeof countryData.economy.manufactures === 'number') {
          state.economy.manufactures.value = countryData.economy.manufactures;
        }
      } else if (countryData.economy.manufacturing) {
        // Compatibility with previous structure
        if (typeof countryData.economy.manufacturing === 'object' && countryData.economy.manufacturing.gdpShare !== undefined) {
          state.economy.manufactures.value = countryData.economy.manufacturing.gdpShare;
        } else if (typeof countryData.economy.manufacturing === 'object' && countryData.economy.manufacturing.value !== undefined) {
          state.economy.manufactures.value = countryData.economy.manufacturing.value;
        } else if (typeof countryData.economy.manufacturing === 'number') {
          state.economy.manufactures.value = countryData.economy.manufacturing;
        }
      }
      
      // Ensure total is 100%
      if (countryData.economy.services === undefined) {
        state.economy.services.value = 100 - state.economy.commodities.value - state.economy.manufactures.value;
      }
      
      const total = state.economy.services.value + state.economy.commodities.value + state.economy.manufactures.value;
      if (total !== 100) {
        state.economy.services.value += (100 - total);
      }
      
      // Calculate absolute values
      this.updateSectoralOutputs(state);
      this.updateInternalNeeds(state, countryData);
      this.updateSectoralBalances(state);
    }
    
    // Set defense values
    if (countryData.defense) {
      state.defense.navy = this.getNumericValue(countryData.defense.navy) || 20;
      state.defense.army = this.getNumericValue(countryData.defense.army) || 20;
      state.defense.airforce = this.getNumericValue(countryData.defense.airforce) || 20;
    }
    
    // Set politics values
    if (countryData.politics) {
      state.politics.parliament = this.getNumericValue(countryData.politics.parliamentSupport) || 50;
      state.politics.media = this.getNumericValue(countryData.politics.mediaSupport) || 50;
      
      if (countryData.politics.protests !== undefined) {
        state.politics.protests = this.getNumericValue(countryData.politics.protests);
      }
      
      if (countryData.politics.opposition !== undefined) {
        if (typeof countryData.politics.opposition === 'object' && countryData.politics.opposition.strength !== undefined) {
          state.politics.opposition = countryData.politics.opposition.strength;
        } else {
          state.politics.opposition = this.getNumericValue(countryData.politics.opposition);
        }
      }
    }
    
    // Set commerce values
    state.commerce.exports = 15;
    state.commerce.imports = 15;
    
    return state;
  }

  /**
   * Update sectoral outputs based on GDP and sectoral percentages
   * @param {Object} state - Country state
   */
  updateSectoralOutputs(state) {
    const gdpValue = state.economy.gdp.value;
    
    state.economy.servicesOutput.value = parseFloat((gdpValue * state.economy.services.value / 100).toFixed(2));
    state.economy.commoditiesOutput.value = parseFloat((gdpValue * state.economy.commodities.value / 100).toFixed(2));
    state.economy.manufacturesOutput.value = parseFloat((gdpValue * state.economy.manufactures.value / 100).toFixed(2));
  }

  /**
   * Update internal needs based on country data
   * @param {Object} state - Country state
   * @param {Object} countryData - Original country data
   */
  updateInternalNeeds(state, countryData) {
    const gdpValue = state.economy.gdp.value;
    
    // Update commodities needs
    if (countryData.economy.commodities && countryData.economy.commodities.domesticConsumption !== undefined) {
      const domesticConsumption = countryData.economy.commodities.domesticConsumption;
      state.economy.commoditiesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
      state.economy.commoditiesNeeds.value = domesticConsumption;
    } else if (countryData.economy.commoditiesNeeds) {
      state.economy.commoditiesNeeds.percentValue = this.getNumericValue(countryData.economy.commoditiesNeeds);
    }
    
    // Update manufactures needs
    if (countryData.economy.manufactures && countryData.economy.manufactures.domesticConsumption !== undefined) {
      const domesticConsumption = countryData.economy.manufactures.domesticConsumption;
      state.economy.manufacturesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
      state.economy.manufacturesNeeds.value = domesticConsumption;
    } else if (countryData.economy.manufacturing && countryData.economy.manufacturing.domesticConsumption !== undefined) {
      const domesticConsumption = countryData.economy.manufacturing.domesticConsumption;
      state.economy.manufacturesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
      state.economy.manufacturesNeeds.value = domesticConsumption;
    } else if (countryData.economy.manufacturesNeeds) {
      state.economy.manufacturesNeeds.percentValue = this.getNumericValue(countryData.economy.manufacturesNeeds);
    }
    
    // Calculate absolute values of needs
    state.economy.commoditiesNeeds.value = parseFloat((gdpValue * state.economy.commoditiesNeeds.percentValue / 100).toFixed(2));
    state.economy.manufacturesNeeds.value = parseFloat((gdpValue * state.economy.manufacturesNeeds.percentValue / 100).toFixed(2));
  }

  /**
   * Update sectoral balances (production - needs)
   * @param {Object} state - Country state
   */
  updateSectoralBalances(state) {
    state.economy.commoditiesBalance.value = parseFloat((state.economy.commoditiesOutput.value - state.economy.commoditiesNeeds.value).toFixed(2));
    state.economy.manufacturesBalance.value = parseFloat((state.economy.manufacturesOutput.value - state.economy.manufacturesNeeds.value).toFixed(2));
  }

  /**
   * Remove a room and all its country states
   * @param {string} roomName - Name of the room to remove
   * @returns {boolean} - True if removed, false if not found
   */
  removeRoom(roomName) {
    const removed = this.roomStates.delete(roomName);
    this.lastUpdated.delete(roomName);
    
    if (removed) {
      console.log(`Removed room ${roomName} from country states`);
    }
    
    return removed;
  }

  /**
   * Get last updated timestamp for a room
   * @param {string} roomName - Name of the room
   * @returns {number} - Timestamp
   */
  getLastUpdated(roomName) {
    return this.lastUpdated.get(roomName) || null;
  }

  /**
   * Get all room names
   * @returns {Array<string>} - Array of room names
   */
  getAllRooms() {
    return Array.from(this.roomStates.keys());
  }

  /**
   * Get all country names in a room
   * @param {string} roomName - Name of the room
   * @returns {Array<string>} - Array of country names
   */
  getAllCountriesInRoom(roomName) {
    const roomStates = this.getRoomCountryStates(roomName);
    return Object.keys(roomStates);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.saveStatesToRedis();
    console.log('CountryStateCore cleanup completed');
  }
}

export default CountryStateCore;