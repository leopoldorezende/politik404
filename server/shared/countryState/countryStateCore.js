/**
 * countryStateCore.js (Simplificado)
 * Core essencial para gerenciamento de estado de países
 */

import redis from '../redisClient.js';
import { getNumericValue } from '../utils/economicUtils.js';
import { DEFAULT_INDICATORS } from './countryStateConfig.js';

/**
 * Core country state manager
 */
class CountryStateCore {
  constructor() {
    this.roomStates = new Map();
    this.lastUpdated = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.loadStatesFromRedis();
      this.initialized = true;
      console.log('[ECONOMY] CountryStateCore initialized');
    } catch (error) {
      console.error('[ECONOMY] Error initializing CountryStateCore:', error);
    }
  }

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
      }
    } catch (error) {
      console.error('[ECONOMY] Error loading country states from Redis:', error);
    }
  }

  async saveStatesToRedis() {
    try {
      const serialized = Object.fromEntries(this.roomStates);
      await redis.set('country_states', JSON.stringify(serialized));
      console.log(`[ECONOMY] Saved ${this.roomStates.size} room states to Redis`);
    } catch (error) {
      console.error('[ECONOMY] Error saving country states to Redis:', error);
    }
  }

  getRoomCountryStates(roomName) {
    return this.roomStates.get(roomName) || {};
  }

  getCountryState(roomName, countryName) {
    const roomStates = this.getRoomCountryStates(roomName);
    return roomStates[countryName] || null;
  }

  setCountryState(roomName, countryName, state) {
    if (!this.roomStates.has(roomName)) {
      this.roomStates.set(roomName, {});
    }
    
    this.roomStates.get(roomName)[countryName] = state;
    this.lastUpdated.set(roomName, Date.now());
  }

  updateCountryState(roomName, countryName, category, updates) {
    const roomStates = this.getRoomCountryStates(roomName);
    
    if (!roomStates || !roomStates[countryName]) return null;
    
    if (!roomStates[countryName][category]) {
      roomStates[countryName][category] = {};
    }
    
    Object.assign(roomStates[countryName][category], updates);
    this.lastUpdated.set(roomName, Date.now());
    
    return roomStates[countryName];
  }

  initializeRoom(roomName, countries) {
    if (this.roomStates.has(roomName)) {
      console.log(`[ECONOMY] Room ${roomName} already initialized`);
      return;
    }
    
    console.log(`[ECONOMY] Initializing room ${roomName}`);
    
    const countryStates = {};
    let countriesInitialized = 0;
    
    for (const [countryName, countryData] of Object.entries(countries)) {
      const countryState = this.generateCountryStateFromJSON(countryName, countryData);
      countryStates[countryName] = countryState;
      countriesInitialized++;
    }
    
    this.roomStates.set(roomName, countryStates);
    this.lastUpdated.set(roomName, Date.now());
    
    console.log(`[ECONOMY] Room ${roomName} initialized with ${countriesInitialized} countries`);
  }

  generateCountryStateFromJSON(countryName, countryData) {
    const state = JSON.parse(JSON.stringify(DEFAULT_INDICATORS));
    
    if (countryData && countryData.economy) {
      const jsonEconomy = countryData.economy;
      
      // GDP from JSON
      if (jsonEconomy.gdp !== undefined) {
        state.economy.gdp = { 
          value: getNumericValue(jsonEconomy.gdp), 
          unit: 'bi USD' 
        };
      } else {
        state.economy.gdp = { value: 100 + Math.random() * 50, unit: 'bi USD' };
      }
      
      // Treasury
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
      
      // Sectoral distribution
      this.setSectoralDistributionFromJSON(state.economy, jsonEconomy);
      this.updateSectoralOutputs(state);
      this.updateInternalNeedsFromJSON(state, jsonEconomy);
      this.updateSectoralBalances(state);
      
      // Defense from JSON
      if (countryData.defense) {
        state.defense.navy = getNumericValue(countryData.defense.navy) || 20;
        state.defense.army = getNumericValue(countryData.defense.army) || 20;
        state.defense.airforce = getNumericValue(countryData.defense.airforce) || 20;
      }
      
      // Politics from JSON  
      if (countryData.politics) {
        state.politics.parliament = getNumericValue(countryData.politics.parliamentSupport) || 50;
        state.politics.media = getNumericValue(countryData.politics.mediaSupport) || 50;
        state.politics.opposition = getNumericValue(countryData.politics.opposition?.strength || countryData.politics.opposition) || 25;
      }
    } else {
      // Default values
      state.economy.gdp = { value: 100 + Math.random() * 50, unit: 'bi USD' };
      state.economy.treasury = { value: state.economy.gdp.value * 0.1, unit: 'bi USD' };
      this.updateSectoralOutputs(state);
      this.updateInternalNeeds(state);
      this.updateSectoralBalances(state);
    }
    
    return state;
  }

  setSectoralDistributionFromJSON(economy, jsonEconomy) {
    if (jsonEconomy.services !== undefined) {
      economy.services.value = getNumericValue(jsonEconomy.services);
    }
    
    if (jsonEconomy.commodities !== undefined) {
      economy.commodities.value = getNumericValue(jsonEconomy.commodities);
    }
    
    if (jsonEconomy.manufactures !== undefined) {
      economy.manufactures.value = getNumericValue(jsonEconomy.manufactures);
    } else if (jsonEconomy.manufacturing !== undefined) {
      economy.manufactures.value = getNumericValue(jsonEconomy.manufacturing);
    }
    
    // Ensure total is 100%
    const total = economy.services.value + economy.commodities.value + economy.manufactures.value;
    if (Math.abs(total - 100) > 1) {
      const adjustment = (100 - total) / 3;
      economy.services.value += adjustment;
      economy.commodities.value += adjustment;
      economy.manufactures.value += adjustment;
    }
  }

  updateSectoralOutputs(state) {
    const gdpValue = state.economy.gdp.value;
    
    state.economy.servicesOutput.value = parseFloat((gdpValue * state.economy.services.value / 100).toFixed(2));
    state.economy.commoditiesOutput.value = parseFloat((gdpValue * state.economy.commodities.value / 100).toFixed(2));
    state.economy.manufacturesOutput.value = parseFloat((gdpValue * state.economy.manufactures.value / 100).toFixed(2));
  }

  updateInternalNeedsFromJSON(state, jsonEconomy) {
    const gdpValue = state.economy.gdp.value;
    
    // Commodities needs
    if (jsonEconomy.commodities && jsonEconomy.commodities.domesticConsumption !== undefined) {
      const domesticConsumption = jsonEconomy.commodities.domesticConsumption;
      state.economy.commoditiesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
      state.economy.commoditiesNeeds.value = domesticConsumption;
    } else {
      state.economy.commoditiesNeeds.percentValue = 30;
      state.economy.commoditiesNeeds.value = parseFloat((gdpValue * 0.30).toFixed(2));
    }
    
    // Manufactures needs
    if (jsonEconomy.manufactures && jsonEconomy.manufactures.domesticConsumption !== undefined) {
      const domesticConsumption = jsonEconomy.manufactures.domesticConsumption;
      state.economy.manufacturesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
      state.economy.manufacturesNeeds.value = domesticConsumption;
    } else if (jsonEconomy.manufacturing && jsonEconomy.manufacturing.domesticConsumption !== undefined) {
      const domesticConsumption = jsonEconomy.manufacturing.domesticConsumption;
      state.economy.manufacturesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
      state.economy.manufacturesNeeds.value = domesticConsumption;
    } else {
      state.economy.manufacturesNeeds.percentValue = 45;
      state.economy.manufacturesNeeds.value = parseFloat((gdpValue * 0.45).toFixed(2));
    }
  }

  updateInternalNeeds(state) {
    const gdpValue = state.economy.gdp.value;
    
    state.economy.commoditiesNeeds.value = parseFloat((gdpValue * state.economy.commoditiesNeeds.percentValue / 100).toFixed(2));
    state.economy.manufacturesNeeds.value = parseFloat((gdpValue * state.economy.manufacturesNeeds.percentValue / 100).toFixed(2));
  }

  updateSectoralBalances(state) {
    state.economy.commoditiesBalance.value = parseFloat((state.economy.commoditiesOutput.value - state.economy.commoditiesNeeds.value).toFixed(2));
    state.economy.manufacturesBalance.value = parseFloat((state.economy.manufacturesOutput.value - state.economy.manufacturesNeeds.value).toFixed(2));
  }

  removeRoom(roomName) {
    const removed = this.roomStates.delete(roomName);
    this.lastUpdated.delete(roomName);
    if (removed) {
      console.log(`[ECONOMY] Removed room ${roomName}`);
    }
    return removed;
  }

  getLastUpdated(roomName) {
    return this.lastUpdated.get(roomName) || null;
  }

  getAllRooms() {
    return Array.from(this.roomStates.keys());
  }

  getAllCountriesInRoom(roomName) {
    const roomStates = this.getRoomCountryStates(roomName);
    return Object.keys(roomStates);
  }

  cleanup() {
    this.saveStatesToRedis();
    console.log('[ECONOMY] CountryStateCore cleanup completed');
  }
}

export default CountryStateCore;