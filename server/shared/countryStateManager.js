/**
 * countryStateManager.js
 * Manages country states and indicators in each room context
 */

import redis from './redisClient.js';

// Default values for new country indicators - simplified as specified
const DEFAULT_INDICATORS = {
  // Economy indicators
  economy: {
    gdp: { value: 0, unit: 'bi USD' }, // GDP in billions USD
    treasury: { value: 0, unit: 'bi USD' }, // Treasury in billions USD
  },
  
  // Defense indicators
  defense: {
    navy: 0, // Navy strength percentage
    army: 0, // Army strength percentage
    airforce: 0, // Air force strength percentage
  },
  
  // Commerce indicators
  commerce: {
    exports: 0, // Exports percentage
    imports: 0, // Imports percentage
  },
  
  // Politics indicators
  politics: {
    parliament: 50, // Parliamentary support percentage
    media: 50, // Media support percentage
    opposition: 25, // Opposition strength percentage
  }
};

/**
 * CountryStateManager - Manages country states per room
 */
class CountryStateManager {
  constructor() {
    this.roomStates = new Map(); // Room name -> country states
    this.lastUpdated = new Map(); // Room name -> timestamp
    this.saveInterval = null;
    this.updateInterval = null; // For the test +1 updates
    this.initialized = false;
  }

  /**
   * Initialize the manager and load states from Redis
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Attempt to load states from Redis
      await this.loadStatesFromRedis();
      
      // Set up periodic state saving
      this.saveInterval = setInterval(() => {
        this.saveStatesToRedis();
      }, 60000); // Save every minute
      
      // Set up test increment interval (for testing purposes)
      this.updateInterval = setInterval(() => {
        this.incrementAllIndicators();
      }, 1000); // Update every second for demonstration
      
      this.initialized = true;
      console.log('CountryStateManager initialized successfully');
    } catch (error) {
      console.error('Error initializing CountryStateManager:', error);
    }
  }
  
  /**
   * For testing: Increment all indicators by 1 every interval
   */
  incrementAllIndicators() {
    // Iterate through all rooms
    for (const [roomName, roomState] of this.roomStates.entries()) {
      let updated = false;
      
      // Iterate through all countries in the room
      for (const countryName of Object.keys(roomState)) {
        const countryState = roomState[countryName];
        
        // Economy indicators
        if (countryState.economy) {
          if (countryState.economy.gdp) {
            countryState.economy.gdp.value += 1;
            updated = true;
          }
          if (countryState.economy.treasury) {
            countryState.economy.treasury.value += 1;
            updated = true;
          }
        }
        
        // Defense indicators
        if (countryState.defense) {
          countryState.defense.navy = (countryState.defense.navy + 1) % 101; // Keep under 100%
          countryState.defense.army = (countryState.defense.army + 1) % 101;
          countryState.defense.airforce = (countryState.defense.airforce + 1) % 101;
          updated = true;
        }
        
        // Commerce indicators
        if (countryState.commerce) {
          countryState.commerce.exports = (countryState.commerce.exports + 1) % 101;
          countryState.commerce.imports = (countryState.commerce.imports + 1) % 101;
          updated = true;
        }
        
        // Politics indicators
        if (countryState.politics) {
          countryState.politics.parliament = (countryState.politics.parliament + 1) % 101;
          countryState.politics.media = (countryState.politics.media + 1) % 101;
          countryState.politics.opposition = (countryState.politics.opposition + 1) % 101;
          updated = true;
        }
      }
      
      // Only update timestamp if changes were made
      if (updated) {
        this.lastUpdated.set(roomName, Date.now());
      }
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
        
        // Convert the plain object back to Map
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
      // Convert Map to an object for serialization
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
   * Initialize a new room with country states
   * @param {string} roomName - Name of the room
   * @param {Object} countries - Country data object with country names as keys
   */
  initializeRoom(roomName, countries) {
    if (!this.roomStates.has(roomName)) {
      const countryStates = {};
      
      // Initialize each country with default indicators
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
    // Clone the default indicators to avoid reference issues
    const state = JSON.parse(JSON.stringify(DEFAULT_INDICATORS));
    
    // Apply country-specific data if available
    if (countryData) {
      // Set economy values
      if (countryData.economy) {
        if (countryData.economy.gdp) {
          state.economy.gdp = countryData.economy.gdp;
        } else {
          state.economy.gdp = { value: 100, unit: 'bi USD' };
        }
        // Treasury set to 10% of GDP
        state.economy.treasury = { 
          value: state.economy.gdp.value * 0.1, 
          unit: 'bi USD' 
        };
      }
      
      // Set defense values
      if (countryData.defense) {
        state.defense.navy = countryData.defense.navy || 20;
        state.defense.army = countryData.defense.army || 20;
        state.defense.airforce = countryData.defense.airforce || 20;
      }
      
      // Set politics values
      if (countryData.politics) {
        state.politics.parliament = countryData.politics.parliamentSupport || 50;
        state.politics.media = countryData.politics.mediaSupport || 50;
        state.politics.opposition = countryData.politics.opposition?.strength || 25;
      }
      
      // Set commerce values
      state.commerce.exports = 15;
      state.commerce.imports = 15;
    }
    
    return state;
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
    
    // If room doesn't exist, return null
    if (!roomStates) return null;
    
    // If country doesn't exist in this room, return null
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
   * Clean up resources when shutting down
   */
  cleanup() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Save states one last time
    this.saveStatesToRedis();
  }
}

// Create a singleton instance
const countryStateManager = new CountryStateManager();

// Initialize on first import
countryStateManager.initialize();

export default countryStateManager;