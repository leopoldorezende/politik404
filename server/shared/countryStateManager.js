/**
 * countryStateManager.js
 * Manages country states and indicators in each room context
 */

import redis from './redisClient.js';
import { performEconomicCalculations } from '../modules/economy/economyCalculations.js';

// Default values for new country indicators - simplified as specified
const DEFAULT_INDICATORS = {
  // Economy indicators
  economy: {
    gdp: { value: 0, unit: 'bi USD' }, // GDP in billions USD
    treasury: { value: 0, unit: 'bi USD' }, // Treasury in billions USD
    
    // Novos indicadores derivados do PIB
    services: { value: 35, unit: '%' }, // Percentual de serviços no PIB
    commodities: { value: 35, unit: '%' }, // Percentual de commodities no PIB
    manufactures: { value: 30, unit: '%' }, // Percentual de manufaturas no PIB
    
    servicesOutput: { value: 0, unit: 'bi USD' }, // Produção de serviços em valor absoluto
    commoditiesOutput: { value: 0, unit: 'bi USD' }, // Produção de commodities em valor absoluto
    manufacturesOutput: { value: 0, unit: 'bi USD' }, // Produção de manufaturas em valor absoluto
    
    commoditiesNeeds: { value: 30, percentValue: 30, unit: 'bi USD' }, // Necessidade interna de commodities
    manufacturesNeeds: { value: 45, percentValue: 45, unit: 'bi USD' }, // Necessidade interna de manufaturas
    
    commoditiesBalance: { value: 0, unit: 'bi USD' }, // Saldo de commodities
    manufacturesBalance: { value: 0, unit: 'bi USD' }, // Saldo de manufaturas
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
    this.updateInterval = null; // For the economic updates
    this.initialized = false;
    this.lastLogTime = 0;
    this.logInterval = 3000; // Log apenas a cada 3 segundos
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
      
      // ✅ VERIFICAR: Set up economic calculation interval
      this.updateInterval = setInterval(() => {
        this.performPeriodicEconomicUpdates();
      }, 2000);
      
      this.initialized = true;
      console.log('CountryStateManager initialized successfully with economic updates');
    } catch (error) {
      console.error('Error initializing CountryStateManager:', error);
    }
  }
  
  /**
   * Perform periodic economic updates for all countries in all rooms
   */
  performPeriodicEconomicUpdates() {
    const gameState = global.gameState;
    if (!gameState || !gameState.countriesData) return;
    
    let totalUpdates = 0;
    
    // Iterate through all rooms
    for (const [roomName, roomState] of this.roomStates.entries()) {
      // Verificar se há jogadores online na sala
      const room = gameState.rooms.get(roomName);
      const hasOnlinePlayers = room && room.players && 
        room.players.some(p => typeof p === 'object' && p.isOnline);
      
      if (!hasOnlinePlayers) {
        continue;
      }
      
      let roomUpdates = 0;
      
      // Iterate through all countries in the room
      for (const countryName of Object.keys(roomState)) {
        const countryState = roomState[countryName];
        const staticData = gameState.countriesData[countryName];
        
        if (staticData && staticData.economy) {
          // MODIFICAÇÃO: Verificar se existem acordos comerciais para considerar nos cálculos
          let tradeAgreements = [];
          if (room && room.tradeAgreements && room.tradeAgreements.length > 0) {
            // Obter todos os acordos disponíveis na sala - tanto os que envolvem este país diretamente
            // quanto os outros acordos que podem afetar indiretamente
            tradeAgreements = room.tradeAgreements;
          }
          
          // Realizar os cálculos econômicos, incluindo acordos comerciais se existirem
          const calculationResult = performEconomicCalculations(
            countryState,
            staticData,
            { tradeAgreements } // Passar os acordos comerciais para serem considerados
          );
          
          countryState.economy = calculationResult.economy;
          
          // Calcular os indicadores derivados do PIB
          this.updateDerivedEconomicIndicators(countryState);
          
          roomUpdates++;
          totalUpdates++;
          
          // Log detalhado para debug do cálculo de balanços comerciais
          if (tradeAgreements.length > 0) {
            console.log(`[ECONOMY] Country ${countryName} trade balances updated:`, {
              manufacturesBalance: countryState.economy.manufacturesBalance?.value,
              commoditiesBalance: countryState.economy.commoditiesBalance?.value,
              tradeStats: countryState.economy.tradeStats
            });
          }
        }
      }
      
      if (roomUpdates > 0) {
        this.lastUpdated.set(roomName, Date.now());
      }
    }
    
    // ✅ Log simplificado - apenas a cada 30 segundos
    this.updateCounter = (this.updateCounter || 0) + 1;
    
    if (this.updateCounter % 30 === 0) { // A cada 30 ciclos (30 segundos)
      if (totalUpdates > 0) {
        console.log(`[ECONOMY] 30-second update: ${totalUpdates} total country updates across all rooms`);
      }
    }
  }

  /**
   * Atualiza os indicadores econômicos derivados do PIB
   * @param {Object} countryState - Estado atual do país
   */
  updateDerivedEconomicIndicators(countryState) {
    const economy = countryState.economy;
    const gdp = economy.gdp.value;
    
    // Garantir que os percentuais setoriais existam
    if (!economy.services || typeof economy.services.value !== 'number') {
      economy.services = { value: 35, unit: '%' };
    }
    
    if (!economy.commodities || typeof economy.commodities.value !== 'number') {
      economy.commodities = { value: 35, unit: '%' };
    }
    
    if (!economy.manufactures || typeof economy.manufactures.value !== 'number') {
      economy.manufactures = { value: 30, unit: '%' };
    }
    
    // Produção nos setores (valor absoluto)
    economy.servicesOutput = { 
      value: parseFloat((gdp * economy.services.value / 100).toFixed(2)), 
      unit: 'bi USD' 
    };
    
    economy.commoditiesOutput = { 
      value: parseFloat((gdp * economy.commodities.value / 100).toFixed(2)), 
      unit: 'bi USD' 
    };
    
    economy.manufacturesOutput = { 
      value: parseFloat((gdp * economy.manufactures.value / 100).toFixed(2)), 
      unit: 'bi USD' 
    };
    
    // Inicializar estruturas das necessidades se não existirem
    if (!economy.commoditiesNeeds || typeof economy.commoditiesNeeds !== 'object') {
      economy.commoditiesNeeds = { value: 0, percentValue: 30, unit: 'bi USD' };
    }
    
    if (!economy.manufacturesNeeds || typeof economy.manufacturesNeeds !== 'object') {
      economy.manufacturesNeeds = { value: 0, percentValue: 45, unit: 'bi USD' };
    }
    
    // Inicializar estruturas dos saldos se não existirem
    if (!economy.commoditiesBalance || typeof economy.commoditiesBalance !== 'object') {
      economy.commoditiesBalance = { value: 0, unit: 'bi USD' };
    }
    
    if (!economy.manufacturesBalance || typeof economy.manufacturesBalance !== 'object') {
      economy.manufacturesBalance = { value: 0, unit: 'bi USD' };
    }
    
    // Atualizar percentuais de necessidade com variação aleatória a cada 3 ciclos
    if (this.updateCounter % 3 === 0) {
      const commoditiesVariation = (Math.random() * 0.4) - 0.2;
      const manufacturesVariation = (Math.random() * 0.4) - 0.2;
      
      economy.commoditiesNeeds.percentValue = Math.max(10, Math.min(50, 
        economy.commoditiesNeeds.percentValue + commoditiesVariation
      ));
      
      economy.manufacturesNeeds.percentValue = Math.max(20, Math.min(70, 
        economy.manufacturesNeeds.percentValue + manufacturesVariation
      ));
    }
    
    // Cálculo das necessidades em valores absolutos
    economy.commoditiesNeeds.value = parseFloat((gdp * economy.commoditiesNeeds.percentValue / 100).toFixed(2));
    economy.manufacturesNeeds.value = parseFloat((gdp * economy.manufacturesNeeds.percentValue / 100).toFixed(2));
    
    // MODIFICAÇÃO: Verificar se já temos valores de balanço calculados por acordos comerciais
    // Se não, calcular o balanço básico (sem acordos)
    if (!economy.tradeStats) {
      // Cálculo dos saldos sem acordos comerciais
      economy.commoditiesBalance.value = parseFloat((economy.commoditiesOutput.value - economy.commoditiesNeeds.value).toFixed(2));
      economy.manufacturesBalance.value = parseFloat((economy.manufacturesOutput.value - economy.manufacturesNeeds.value).toFixed(2));
    }
    
    // Atualizar distribuição setorial com pequena variação a cada 6 ciclos
    if (this.updateCounter % 6 === 0) {
      // Variação de -1 a +1 ponto percentual
      const servicesVariation = Math.floor(Math.random() * 3) - 1;
      const commoditiesVariation = Math.floor(Math.random() * 3) - 1;
      
      // Ajustar percentuais mantendo a soma em 100%
      let services = economy.services.value + servicesVariation;
      let commodities = economy.commodities.value + commoditiesVariation;
      let manufactures = 100 - services - commodities;
      
      // Corrigir valores extremos
      if (services < 15) services = 15;
      if (commodities < 15) commodities = 15;
      if (manufactures < 15) {
        const excess = 15 - manufactures;
        services -= Math.floor(excess / 2);
        commodities -= Math.ceil(excess / 2);
        manufactures = 15;
      }
      
      // Garantir que a soma seja 100%
      const total = services + commodities + manufactures;
      if (total !== 100) {
        const adjustment = 100 - total;
        services += adjustment;
      }
      
      // Atualizar os valores
      economy.services.value = services;
      economy.commodities.value = commodities;
      economy.manufactures.value = manufactures;
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
        
        // Inicializar valores para a distribuição setorial
        // Usar services como complemento se não estiver definido diretamente
        
        // Ler commodities.gdpShare se disponível
        if (countryData.economy.commodities && countryData.economy.commodities.gdpShare !== undefined) {
          state.economy.commodities.value = countryData.economy.commodities.gdpShare;
        } else if (countryData.economy.commodities && typeof countryData.economy.commodities === 'number') {
          state.economy.commodities.value = countryData.economy.commodities;
        }
        
        // Ler manufacturing.gdpShare se disponível (para manufaturas)
        if (countryData.economy.manufacturing && countryData.economy.manufacturing.gdpShare !== undefined) {
          state.economy.manufactures.value = countryData.economy.manufacturing.gdpShare;
        } else if (countryData.economy.manufactures && typeof countryData.economy.manufactures === 'number') {
          state.economy.manufactures.value = countryData.economy.manufactures;
        }
        
        // Calcular serviços como residual (complemento para 100%)
        state.economy.services.value = 100 - state.economy.commodities.value - state.economy.manufactures.value;
        
        // Garantir que a soma seja 100%
        const total = state.economy.services.value + state.economy.commodities.value + state.economy.manufactures.value;
        if (total !== 100) {
          // Ajustar o serviço para garantir soma 100%
          state.economy.services.value += (100 - total);
        }
        
        // Calcular os valores absolutos iniciais
        state.economy.servicesOutput.value = parseFloat((state.economy.gdp.value * state.economy.services.value / 100).toFixed(2));
        state.economy.commoditiesOutput.value = parseFloat((state.economy.gdp.value * state.economy.commodities.value / 100).toFixed(2));
        state.economy.manufacturesOutput.value = parseFloat((state.economy.gdp.value * state.economy.manufactures.value / 100).toFixed(2));
        
        // Inicializar necessidades
        // Usar consumo doméstico se disponível, caso contrário usar valores padrão
        if (countryData.economy.commodities && countryData.economy.commodities.domesticConsumption !== undefined) {
          // Calcular como porcentagem do PIB
          const gdpValue = state.economy.gdp.value;
          const domesticConsumption = countryData.economy.commodities.domesticConsumption;
          state.economy.commoditiesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
          state.economy.commoditiesNeeds.value = domesticConsumption;
        } else if (countryData.economy.commoditiesNeeds) {
          state.economy.commoditiesNeeds.percentValue = countryData.economy.commoditiesNeeds;
        }
        
        if (countryData.economy.manufacturing && countryData.economy.manufacturing.domesticConsumption !== undefined) {
          // Calcular como porcentagem do PIB
          const gdpValue = state.economy.gdp.value;
          const domesticConsumption = countryData.economy.manufacturing.domesticConsumption;
          state.economy.manufacturesNeeds.percentValue = Math.round((domesticConsumption / gdpValue) * 100);
          state.economy.manufacturesNeeds.value = domesticConsumption;
        } else if (countryData.economy.manufacturesNeeds) {
          state.economy.manufacturesNeeds.percentValue = countryData.economy.manufacturesNeeds;
        }
        
        // Calcular valores absolutos de necessidades
        state.economy.commoditiesNeeds.value = parseFloat((state.economy.gdp.value * state.economy.commoditiesNeeds.percentValue / 100).toFixed(2));
        state.economy.manufacturesNeeds.value = parseFloat((state.economy.gdp.value * state.economy.manufacturesNeeds.percentValue / 100).toFixed(2));
        
        // Calcular saldos iniciais
        state.economy.commoditiesBalance.value = parseFloat((state.economy.commoditiesOutput.value - state.economy.commoditiesNeeds.value).toFixed(2));
        state.economy.manufacturesBalance.value = parseFloat((state.economy.manufacturesOutput.value - state.economy.manufacturesNeeds.value).toFixed(2));
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
    
    // If the updates are for the economy, recalculate derived indicators
    if (category === 'economy') {
      this.updateDerivedEconomicIndicators(roomStates[countryName]);
      
      // MODIFICAÇÃO: Log para depuração dos valores de balanços comerciais
      const economy = roomStates[countryName].economy;
      
      // Apenas log se tivermos estatísticas de comércio
      if (economy.tradeStats) {
        console.log(`[CountryStateManager] Trade balance updated for ${countryName} in room ${roomName}:`, {
          manufacturesBalance: economy.manufacturesBalance?.value,
          commoditiesBalance: economy.commoditiesBalance?.value,
          tradeStats: economy.tradeStats
        });
      }
    }
    
    // Update timestamp
    this.lastUpdated.set(roomName, Date.now());
    
    return roomStates[countryName];
  }
  
  /**
   * Atualiza o estado econômico de um país com base nos acordos comerciais
   * @param {string} roomName - Nome da sala
   * @param {string} countryName - Nome do país
   * @param {Array} tradeAgreements - Lista de acordos comerciais
   * @returns {Object|null} - Estado atualizado ou null se não encontrado
   */
  updateCountryStateForTrade(roomName, countryName, tradeAgreements) {
    // Obter o estado atual do país
    const roomStates = this.getRoomCountryStates(roomName);
    
    // Se a sala não existe, retornar null
    if (!roomStates) return null;
    
    // Se o país não existe nesta sala, retornar null
    if (!roomStates[countryName]) return null;
    
    // Obter dados estáticos
    const gameState = global.gameState;
    if (!gameState || !gameState.countriesData || !gameState.countriesData[countryName]) {
      return null;
    }
    
    // Usar a função performEconomicCalculations que já deve estar importada no topo do arquivo
    const staticData = { 
      ...gameState.countriesData[countryName],
      countryName // Garantir que o nome do país está disponível
    };
    
    const calculationResult = performEconomicCalculations(
      roomStates[countryName],
      staticData,
      { tradeAgreements }
    );
    
    // Atualizar o estado do país com os resultados do cálculo
    if (calculationResult.economy) {
      roomStates[countryName].economy = calculationResult.economy;
      
      // Atualizar o timestamp
      this.lastUpdated.set(roomName, Date.now());
      
      console.log(`Updated economy state for ${countryName} in room ${roomName} based on trade agreements`);
    }
    
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