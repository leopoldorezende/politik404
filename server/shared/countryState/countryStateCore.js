/**
 * countryStateCore.js
 * Core functionality for country state management
 * FOCUSED ON PROPER INITIALIZATION FROM countriesData.json
 */

import redis from '../redisClient.js';
import { getNumericValue } from '../utils/economicUtils.js';

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
      console.log('[ECONOMY] CountryStateCore initialized successfully');
    } catch (error) {
      console.error('[ECONOMY] Error initializing CountryStateCore:', error);
    }
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
        
        console.log(`[ECONOMY] Loaded ${this.roomStates.size} room states from Redis`);
      } else {
        console.log('[ECONOMY] No country states found in Redis');
      }
    } catch (error) {
      console.error('[ECONOMY] Error loading country states from Redis:', error);
    }
  }

  /**
   * Save all room country states to Redis
   */
  async saveStatesToRedis() {
    try {
      const serialized = Object.fromEntries(this.roomStates);
      await redis.set('country_states', JSON.stringify(serialized));
      console.log(`[ECONOMY] Saved ${this.roomStates.size} room states to Redis`);
    } catch (error) {
      console.error('[ECONOMY] Error saving country states to Redis:', error);
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
   * Initialize a new room with country states FROM JSON DATA
   * @param {string} roomName - Name of the room
   * @param {Object} countries - Country data object from countriesData.json
   */
  initializeRoom(roomName, countries) {
    if (this.roomStates.has(roomName)) {
      console.log(`[ECONOMY] Room ${roomName} already initialized, skipping`);
      return;
    }
    
    console.log(`[ECONOMY] Initializing room ${roomName} with JSON data`);
    console.log(`[ECONOMY] Available countries in JSON:`, Object.keys(countries));
    
    const countryStates = {};
    let countriesInitialized = 0;
    let countriesWithEconomyData = 0;
    
    for (const [countryName, countryData] of Object.entries(countries)) {
      console.log(`[ECONOMY] Initializing ${countryName}...`);
      
      // Generate country state from JSON data
      const countryState = this.generateCountryStateFromJSON(countryName, countryData);
      countryStates[countryName] = countryState;
      countriesInitialized++;
      
      // Check if this country had economy data
      if (countryData && countryData.economy) {
        countriesWithEconomyData++;
        console.log(`[ECONOMY] ${countryName} initialized with JSON economy data - GDP: ${countryState.economy.gdp.value}`);
      } else {
        console.warn(`[ECONOMY] ${countryName} initialized with default values (no JSON economy data)`);
      }
    }
    
    this.roomStates.set(roomName, countryStates);
    this.lastUpdated.set(roomName, Date.now());
    
    console.log(`[ECONOMY] Room ${roomName} initialized with ${countriesInitialized} countries`);
    console.log(`[ECONOMY] ${countriesWithEconomyData} countries had JSON economy data, ${countriesInitialized - countriesWithEconomyData} used defaults`);
  }

  /**
   * Generate a country state with data from JSON (countriesData.json)
   * @param {string} countryName - Name of the country
   * @param {Object} countryData - Country data from JSON
   * @returns {Object} - Complete country state with indicators
   */
  generateCountryStateFromJSON(countryName, countryData) {
    console.log(`[ECONOMY] Generating state for ${countryName} from JSON data`);
    
    // Start with default structure
    const state = JSON.parse(JSON.stringify(DEFAULT_INDICATORS));
    
    // Check if we have economy data in the JSON
    if (countryData && countryData.economy) {
      console.log(`[ECONOMY] ${countryName} has economy data in JSON:`, Object.keys(countryData.economy));
      
      const jsonEconomy = countryData.economy;
      
      // GDP from JSON
      if (jsonEconomy.gdp !== undefined) {
        state.economy.gdp = { 
          value: getNumericValue(jsonEconomy.gdp), 
          unit: 'bi USD' 
        };
        console.log(`[ECONOMY] ${countryName} GDP from JSON: ${state.economy.gdp.value}`);
      } else {
        state.economy.gdp = { value: 100 + Math.random() * 50, unit: 'bi USD' };
        console.log(`[ECONOMY] ${countryName} using random GDP: ${state.economy.gdp.value}`);
      }
      
      // Treasury from JSON
      if (jsonEconomy.treasury !== undefined) {
        state.economy.treasury = { 
          value: getNumericValue(jsonEconomy.treasury), 
          unit: 'bi USD' 
        };
      } else {
        state.economy.treasury = { 
          value: state.economy.gdp.value * 0.1, 
          unit: 'bi USD' 
        };
      }
      
      // Sectoral distribution from JSON
      this.setSectoralDistributionFromJSON(state.economy, jsonEconomy, countryName);
      
      // Calculate sectoral outputs
      this.updateSectoralOutputs(state);
      
      // Set internal needs from JSON
      this.updateInternalNeedsFromJSON(state, jsonEconomy, countryName);
      
      // Calculate initial balances
      this.updateSectoralBalances(state);
      
    } else {
      console.warn(`[ECONOMY] ${countryName} has no economy data in JSON, using defaults`);
      
      // Use completely default values
      state.economy.gdp = { value: 100 + Math.random() * 50, unit: 'bi USD' };
      state.economy.treasury = { value: state.economy.gdp.value * 0.1, unit: 'bi USD' };
      
      this.updateSectoralOutputs(state);
      this.updateInternalNeeds(state, {});
      this.updateSectoralBalances(state);
    }
    
    // Set defense values from JSON or defaults
    this.setDefenseFromJSON(state, countryData, countryName);
    
    // Set politics values from JSON or defaults
    this.setPoliticsFromJSON(state, countryData, countryName);
    
    // Set commerce values
    state.commerce.exports = 15;
    state.commerce.imports = 15;
    
    console.log(`[ECONOMY] ${countryName} state generated - GDP: ${state.economy.gdp.value}, Treasury: ${state.economy.treasury.value}`);
    
    return state;
  }

  /**
   * Set sectoral distribution from JSON data
   * @param {Object} economy - Economy object
   * @param {Object} jsonEconomy - Economy data from JSON
   * @param {string} countryName - Country name
   */
  setSectoralDistributionFromJSON(economy, jsonEconomy, countryName) {
    // Services
    if (jsonEconomy.services !== undefined) {
      economy.services.value = getNumericValue(jsonEconomy.services);
    }
    
    // Commodities
    if (jsonEconomy.commodities !== undefined) {
      economy.commodities.value = getNumericValue(jsonEconomy.commodities);
    }
    
    // Manufactures (could be 'manufactures' or 'manufacturing')
    if (jsonEconomy.manufactures !== undefined) {
      economy.manufactures.value = getNumericValue(jsonEconomy.manufactures);
    } else if (jsonEconomy.manufacturing !== undefined) {
      economy.manufactures.value = getNumericValue(jsonEconomy.manufacturing);
    }
    
    // Ensure total is 100%
    const total = economy.services.value + economy.commodities.value + economy.manufactures.value;
    if (Math.abs(total - 100) > 1) {
      console.log(`[ECONOMY] ${countryName} sectoral total was ${total}%, adjusting to 100%`);
      const adjustment = (100 - total) / 3;
      economy.services.value += adjustment;
      economy.commodities.value += adjustment;
      economy.manufactures.value += adjustment;
    }
    
    console.log(`[ECONOMY] ${countryName} sectors from JSON: Services ${economy.services.value}%, Commodities ${economy.commodities.value}%, Manufactures ${economy.manufactures.value}%`);
  }

  /**
   * Set defense values from JSON
   * @param {Object} state - Country state
   * @param {Object} countryData - Country data from JSON
   * @param {string} countryName - Country name
   */
  setDefenseFromJSON(state, countryData, countryName) {
    if (countryData && countryData.defense) {
      state.defense.navy = getNumericValue(countryData.defense.navy) || 20;
      state.defense.army = getNumericValue(countryData.defense.army) || 20;
      state.defense.airforce = getNumericValue(countryData.defense.airforce) || 20;
      console.log(`[ECONOMY] ${countryName} defense from JSON: Navy ${state.defense.navy}, Army ${state.defense.army}, Air ${state.defense.airforce}`);
    } else {
      state.defense.navy = 20;
      state.defense.army = 20;
      state.defense.airforce = 20;
    }
  }

  /**
   * Set politics values from JSON
   * @param {Object} state - Country state
   * @param {Object} countryData - Country data from JSON
   * @param {string} countryName - Country name
   */
  setPoliticsFromJSON(state, countryData, countryName) {
    if (countryData && countryData.politics) {
      state.politics.parliament = getNumericValue(countryData.politics.parliamentSupport) || 50;
      state.politics.media = getNumericValue(countryData.politics.mediaSupport) || 50;
      
      if (countryData.politics.opposition !== undefined) {
        if (typeof countryData.politics.opposition === 'object' && countryData.politics.opposition.strength !== undefined) {
          state.politics.opposition = countryData.politics.opposition.strength;
        } else {
          state.politics.opposition = getNumericValue(countryData.politics.opposition);
        }
      }
      
      console.log(`[ECONOMY] ${countryName} politics from JSON: Parliament ${state.politics.parliament}, Media ${state.politics.media}, Opposition ${state.politics.opposition}`);
    }
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
   * Update internal needs from JSON data
   * @param {Object} state - Country state
   * @param {Object} jsonEconomy - Economy data from JSON
   * @param {string} countryName - Country name
   */
  updateInternalNeedsFromJSON(state, jsonEconomy, countryName) {
    const gdpValue = state.economy.gdp.value;
    
    // Commodities needs from JSON
    if (jsonEconomy.commodities && jsonEconomy.commodities.domesticConsumption !== undefined) {
      const domesticConsumption = jsonEconomy.commodities.domesticConsumption;
      state.economy.commoditiesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
      state.economy.commoditiesNeeds.value = domesticConsumption;
      console.log(`[ECONOMY] ${countryName} commodities needs from JSON: ${domesticConsumption} (${state.economy.commoditiesNeeds.percentValue}% of GDP)`);
    } else {
      state.economy.commoditiesNeeds.percentValue = 30;
      state.economy.commoditiesNeeds.value = parseFloat((gdpValue * 0.30).toFixed(2));
    }
    
    // Manufactures needs from JSON
    if (jsonEconomy.manufactures && jsonEconomy.manufactures.domesticConsumption !== undefined) {
      const domesticConsumption = jsonEconomy.manufactures.domesticConsumption;
      state.economy.manufacturesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
      state.economy.manufacturesNeeds.value = domesticConsumption;
      console.log(`[ECONOMY] ${countryName} manufactures needs from JSON: ${domesticConsumption} (${state.economy.manufacturesNeeds.percentValue}% of GDP)`);
    } else if (jsonEconomy.manufacturing && jsonEconomy.manufacturing.domesticConsumption !== undefined) {
      const domesticConsumption = jsonEconomy.manufacturing.domesticConsumption;
      state.economy.manufacturesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
      state.economy.manufacturesNeeds.value = domesticConsumption;
      console.log(`[ECONOMY] ${countryName} manufacturing needs from JSON: ${domesticConsumption} (${state.economy.manufacturesNeeds.percentValue}% of GDP)`);
    } else {
      state.economy.manufacturesNeeds.percentValue = 45;
      state.economy.manufacturesNeeds.value = parseFloat((gdpValue * 0.45).toFixed(2));
    }
  }

  /**
   * Update internal needs with default calculation
   * @param {Object} state - Country state
   * @param {Object} countryData - Country data
   */
  updateInternalNeeds(state, countryData) {
    const gdpValue = state.economy.gdp.value;
    
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
      console.log(`[ECONOMY] Removed room ${roomName} from country states`);
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
    console.log('[ECONOMY] CountryStateCore cleanup completed');
  }
}

export default CountryStateCore;