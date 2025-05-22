/**
 * countryEconomyCalculator.js
 * Advanced economic calculations for country states
 * FOCUSED ON READING DATA FROM countriesData.json CORRECTLY
 */

/**
 * Country Economy Calculator
 * Manages all economic calculations using data from countriesData.json
 */
class CountryEconomyCalculator {
  constructor() {
    this.updateCounter = 0;
    this.lastLogTime = 0;
    this.logInterval = 10000; // 10 seconds between logs for debugging
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
   * Initialize economy with data from countriesData.json
   * @param {Object} economy - Economy object
   * @param {Object} countryData - Data from countriesData.json
   * @param {string} countryName - Country name
   */
  initializeEconomyFromJSON(economy, countryData, countryName) {
    console.log(`[ECONOMY] Initializing ${countryName} with JSON data:`, countryData?.economy ? 'Has economy data' : 'No economy data');
    
    if (!countryData || !countryData.economy) {
      console.warn(`[ECONOMY] No economy data found in JSON for ${countryName}`);
      this.initializeWithDefaults(economy);
      return;
    }
    
    const jsonEconomy = countryData.economy;
    
    // GDP from JSON
    if (jsonEconomy.gdp) {
      economy.gdp = { 
        value: this.getNumericValue(jsonEconomy.gdp), 
        unit: 'bi USD' 
      };
      console.log(`[ECONOMY] ${countryName} GDP from JSON: ${economy.gdp.value}`);
    } else {
      economy.gdp = { value: 100, unit: 'bi USD' };
    }
    
    // Treasury from JSON
    if (jsonEconomy.treasury !== undefined) {
      economy.treasury = { 
        value: this.getNumericValue(jsonEconomy.treasury), 
        unit: 'bi USD' 
      };
    } else {
      economy.treasury = { value: economy.gdp.value * 0.1, unit: 'bi USD' };
    }
    
    // Sectoral distribution from JSON
    if (jsonEconomy.services) {
      economy.services = { 
        value: this.getNumericValue(jsonEconomy.services), 
        unit: '%' 
      };
    } else {
      economy.services = { value: 35, unit: '%' };
    }
    
    if (jsonEconomy.commodities) {
      economy.commodities = { 
        value: this.getNumericValue(jsonEconomy.commodities), 
        unit: '%' 
      };
    } else {
      economy.commodities = { value: 35, unit: '%' };
    }
    
    if (jsonEconomy.manufactures || jsonEconomy.manufacturing) {
      const manufacturesData = jsonEconomy.manufactures || jsonEconomy.manufacturing;
      economy.manufactures = { 
        value: this.getNumericValue(manufacturesData), 
        unit: '%' 
      };
    } else {
      economy.manufactures = { value: 30, unit: '%' };
    }
    
    // Ensure sectoral distribution adds up to 100%
    const total = economy.services.value + economy.commodities.value + economy.manufactures.value;
    if (Math.abs(total - 100) > 1) {
      console.log(`[ECONOMY] ${countryName} sectoral total was ${total}%, adjusting to 100%`);
      const adjustment = (100 - total) / 3;
      economy.services.value += adjustment;
      economy.commodities.value += adjustment;
      economy.manufactures.value += adjustment;
    }
    
    // Log what we found in the JSON
    console.log(`[ECONOMY] ${countryName} initialized from JSON - GDP: ${economy.gdp.value}, Treasury: ${economy.treasury.value}, Sectors: ${economy.services.value}/${economy.commodities.value}/${economy.manufactures.value}`);
    
    // Initialize output values
    this.updateSectoralOutputs(economy);
    
    // Initialize needs from JSON if available
    this.initializeNeedsFromJSON(economy, jsonEconomy, countryName);
    
    // Initialize balances
    if (!economy.commoditiesBalance) {
      economy.commoditiesBalance = { value: 0, unit: 'bi USD' };
    }
    if (!economy.manufacturesBalance) {
      economy.manufacturesBalance = { value: 0, unit: 'bi USD' };
    }
  }
  
  /**
   * Initialize needs from JSON data
   * @param {Object} economy - Economy object
   * @param {Object} jsonEconomy - Economy data from JSON
   * @param {string} countryName - Country name
   */
  initializeNeedsFromJSON(economy, jsonEconomy, countryName) {
    const gdp = economy.gdp.value;
    
    // Commodities needs
    if (jsonEconomy.commodities && jsonEconomy.commodities.domesticConsumption !== undefined) {
      const domesticConsumption = jsonEconomy.commodities.domesticConsumption;
      economy.commoditiesNeeds = {
        value: domesticConsumption,
        percentValue: Math.round((domesticConsumption / gdp) * 100),
        unit: 'bi USD'
      };
      console.log(`[ECONOMY] ${countryName} commodities needs from JSON: ${domesticConsumption} (${economy.commoditiesNeeds.percentValue}% of GDP)`);
    } else {
      economy.commoditiesNeeds = { value: gdp * 0.3, percentValue: 30, unit: 'bi USD' };
    }
    
    // Manufactures needs
    if (jsonEconomy.manufactures && jsonEconomy.manufactures.domesticConsumption !== undefined) {
      const domesticConsumption = jsonEconomy.manufactures.domesticConsumption;
      economy.manufacturesNeeds = {
        value: domesticConsumption,
        percentValue: Math.round((domesticConsumption / gdp) * 100),
        unit: 'bi USD'
      };
      console.log(`[ECONOMY] ${countryName} manufactures needs from JSON: ${domesticConsumption} (${economy.manufacturesNeeds.percentValue}% of GDP)`);
    } else if (jsonEconomy.manufacturing && jsonEconomy.manufacturing.domesticConsumption !== undefined) {
      const domesticConsumption = jsonEconomy.manufacturing.domesticConsumption;
      economy.manufacturesNeeds = {
        value: domesticConsumption,
        percentValue: Math.round((domesticConsumption / gdp) * 100),
        unit: 'bi USD'
      };
      console.log(`[ECONOMY] ${countryName} manufacturing needs from JSON: ${domesticConsumption} (${economy.manufacturesNeeds.percentValue}% of GDP)`);
    } else {
      economy.manufacturesNeeds = { value: gdp * 0.45, percentValue: 45, unit: 'bi USD' };
    }
  }

  /**
   * Initialize with default values when JSON data is not available
   * @param {Object} economy - Economy object
   */
  initializeWithDefaults(economy) {
    economy.gdp = { value: 100, unit: 'bi USD' };
    economy.treasury = { value: 10, unit: 'bi USD' };
    economy.services = { value: 35, unit: '%' };
    economy.commodities = { value: 35, unit: '%' };
    economy.manufactures = { value: 30, unit: '%' };
    economy.commoditiesNeeds = { value: 30, percentValue: 30, unit: 'bi USD' };
    economy.manufacturesNeeds = { value: 45, percentValue: 45, unit: 'bi USD' };
    economy.commoditiesBalance = { value: 0, unit: 'bi USD' };
    economy.manufacturesBalance = { value: 0, unit: 'bi USD' };
    
    this.updateSectoralOutputs(economy);
  }

  /**
   * Perform comprehensive economic update for a country
   * @param {Object} countryState - Country state
   * @param {Object} staticData - Static country data from JSON
   * @param {Array} tradeAgreements - Trade agreements
   * @returns {Object} - Updated country state
   */
  performEconomicUpdate(countryState, staticData, tradeAgreements = []) {
    const countryName = staticData?.name || staticData?.countryName || 'Unknown';
    
    // Ensure economy structure exists
    if (!countryState.economy) {
      countryState.economy = {};
    }
    
    const economy = countryState.economy;
    
    // Initialize economy from JSON data if this is the first time
    if (!economy.gdp || this.updateCounter === 0) {
      console.log(`[ECONOMY] First-time initialization for ${countryName}`);
      
      // Check if we have access to global gameState and countriesData
      const gameState = global.gameState;
      if (gameState && gameState.countriesData && gameState.countriesData[countryName]) {
        const countryData = gameState.countriesData[countryName];
        console.log(`[ECONOMY] Found JSON data for ${countryName}:`, Object.keys(countryData));
        this.initializeEconomyFromJSON(economy, countryData, countryName);
      } else {
        console.warn(`[ECONOMY] No JSON data available for ${countryName}, using defaults`);
        this.initializeWithDefaults(economy);
      }
    }
    
    // Apply small growth and changes
    this.updateGDP(economy, countryName);
    this.updateTreasury(economy, staticData, countryName);
    this.updateSectoralOutputs(economy);
    this.updateInternalNeeds(economy);
    this.applyTradeImpact(economy, tradeAgreements, countryName);
    
    // Sectoral variations occasionally
    if (this.updateCounter % 15 === 0) {
      this.updateSectoralDistribution(economy);
    }
    
    // Increment update counter
    this.updateCounter++;
    
    // Log updates for debugging
    this.logUpdate(countryName, economy);
    
    return countryState;
  }

  /**
   * Update GDP with small growth
   * @param {Object} economy - Economy object
   * @param {string} countryName - Country name
   */
  updateGDP(economy, countryName) {
    const currentGdp = this.getNumericValue(economy.gdp);
    
    // Check if we have unemployment data from JSON
    const gameState = global.gameState;
    let unemploymentRate = 12.5; // default
    
    if (gameState && gameState.countriesData && gameState.countriesData[countryName]) {
      const countryData = gameState.countriesData[countryName];
      if (countryData.economy && countryData.economy.unemployment !== undefined) {
        unemploymentRate = this.getNumericValue(countryData.economy.unemployment);
        
        // Log unemployment data found
        if (this.updateCounter % 30 === 0) {
          console.log(`[ECONOMY] ${countryName} using unemployment rate from JSON: ${unemploymentRate}%`);
        }
      }
    }
    
    // Calculate growth based on employment (100 - unemployment)
    const employmentRate = 100 - unemploymentRate;
    const growthRate = (employmentRate / 1000000) + (Math.random() * 0.0001 - 0.00005);
    const newGdp = currentGdp * (1 + growthRate);
    
    economy.gdp.value = Math.round(newGdp * 100) / 100;
  }

  /**
   * Update Treasury using JSON data
   * @param {Object} economy - Economy object
   * @param {Object} staticData - Static data (may contain JSON data)
   * @param {string} countryName - Country name
   */
  updateTreasury(economy, staticData, countryName) {
    const currentTreasury = this.getNumericValue(economy.treasury);
    const gdp = this.getNumericValue(economy.gdp);
    
    // Try to get tax burden and public services from JSON
    const gameState = global.gameState;
    let taxBurden = 25; // default
    let publicServices = 30; // default
    
    if (gameState && gameState.countriesData && gameState.countriesData[countryName]) {
      const countryData = gameState.countriesData[countryName];
      if (countryData.economy) {
        if (countryData.economy.taxBurden !== undefined) {
          taxBurden = this.getNumericValue(countryData.economy.taxBurden);
        }
        if (countryData.economy.publicServices !== undefined) {
          publicServices = this.getNumericValue(countryData.economy.publicServices);
        }
        
        // Log fiscal data found
        if (this.updateCounter % 30 === 0) {
          console.log(`[ECONOMY] ${countryName} using fiscal data from JSON - Tax: ${taxBurden}%, Services: ${publicServices}%`);
        }
      }
    }
    
    // Calculate fiscal flows
    const revenue = gdp * (taxBurden / 100) * 0.001;
    const expenses = gdp * (publicServices / 100) * 0.0008;
    const netChange = revenue - expenses;
    
    economy.treasury.value = Math.round((currentTreasury + netChange) * 100) / 100;
  }

  /**
   * Update sectoral outputs based on GDP and sectoral percentages
   * @param {Object} economy - Economy object
   */
  updateSectoralOutputs(economy) {
    const gdpValue = this.getNumericValue(economy.gdp);
    
    economy.servicesOutput = { 
      value: parseFloat((gdpValue * this.getNumericValue(economy.services) / 100).toFixed(2)), 
      unit: 'bi USD' 
    };
    
    economy.commoditiesOutput = { 
      value: parseFloat((gdpValue * this.getNumericValue(economy.commodities) / 100).toFixed(2)), 
      unit: 'bi USD' 
    };
    
    economy.manufacturesOutput = { 
      value: parseFloat((gdpValue * this.getNumericValue(economy.manufactures) / 100).toFixed(2)), 
      unit: 'bi USD' 
    };
  }

  /**
   * Update internal needs with small variations
   * @param {Object} economy - Economy object
   */
  updateInternalNeeds(economy) {
    const gdp = this.getNumericValue(economy.gdp);
    
    // Small variations every few cycles
    if (this.updateCounter % 5 === 0) {
      const commoditiesVariation = (Math.random() * 0.6) - 0.3;
      const manufacturesVariation = (Math.random() * 0.6) - 0.3;
      
      economy.commoditiesNeeds.percentValue = Math.max(15, Math.min(45, 
        economy.commoditiesNeeds.percentValue + commoditiesVariation
      ));
      
      economy.manufacturesNeeds.percentValue = Math.max(25, Math.min(65, 
        economy.manufacturesNeeds.percentValue + manufacturesVariation
      ));
    }
    
    // Recalculate absolute values
    economy.commoditiesNeeds.value = parseFloat((gdp * economy.commoditiesNeeds.percentValue / 100).toFixed(2));
    economy.manufacturesNeeds.value = parseFloat((gdp * economy.manufacturesNeeds.percentValue / 100).toFixed(2));
  }

  /**
   * Apply trade agreements impact
   * @param {Object} economy - Economy object
   * @param {Array} tradeAgreements - Trade agreements
   * @param {string} countryName - Country name
   */
  applyTradeImpact(economy, tradeAgreements, countryName) {
    const tradeImpact = this.calculateTradeImpact(tradeAgreements, countryName);
    
    // Calculate balances
    economy.commoditiesBalance.value = parseFloat((
      economy.commoditiesOutput.value + tradeImpact.commodityImports - 
      tradeImpact.commodityExports - economy.commoditiesNeeds.value
    ).toFixed(2));
    
    economy.manufacturesBalance.value = parseFloat((
      economy.manufacturesOutput.value + tradeImpact.manufactureImports - 
      tradeImpact.manufactureExports - economy.manufacturesNeeds.value
    ).toFixed(2));
    
    // Store trade statistics
    economy.tradeStats = {
      commodityImports: tradeImpact.commodityImports,
      commodityExports: tradeImpact.commodityExports,
      manufactureImports: tradeImpact.manufactureImports,
      manufactureExports: tradeImpact.manufactureExports
    };
  }

  /**
   * Calculate trade impact from agreements
   * @param {Array} tradeAgreements - Trade agreements
   * @param {string} countryName - Country name
   * @returns {Object} - Trade impact
   */
  calculateTradeImpact(tradeAgreements, countryName) {
    let commodityImports = 0, commodityExports = 0;
    let manufactureImports = 0, manufactureExports = 0;

    if (!tradeAgreements || tradeAgreements.length === 0) {
      return { commodityImports, commodityExports, manufactureImports, manufactureExports };
    }

    const ownAgreements = tradeAgreements.filter(agreement => 
      agreement.originCountry === countryName
    );
    
    ownAgreements.forEach(agreement => {
      if (agreement.type === 'export') {
        if (agreement.product === 'commodity') {
          commodityExports += agreement.value;
        } else if (agreement.product === 'manufacture') {
          manufactureExports += agreement.value;
        }
      } else if (agreement.type === 'import') {
        if (agreement.product === 'commodity') {
          commodityImports += agreement.value;
        } else if (agreement.product === 'manufacture') {
          manufactureImports += agreement.value;
        }
      }
    });

    return { commodityImports, commodityExports, manufactureImports, manufactureExports };
  }

  /**
   * Update sectoral distribution with random variations
   * @param {Object} economy - Economy object
   */
  updateSectoralDistribution(economy) {
    const servicesVariation = Math.floor(Math.random() * 3) - 1;
    const commoditiesVariation = Math.floor(Math.random() * 3) - 1;
    
    let services = this.getNumericValue(economy.services) + servicesVariation;
    let commodities = this.getNumericValue(economy.commodities) + commoditiesVariation;
    let manufactures = 100 - services - commodities;
    
    // Enforce limits
    services = Math.max(20, Math.min(60, services));
    commodities = Math.max(15, Math.min(50, commodities));
    manufactures = Math.max(15, Math.min(50, manufactures));
    
    // Ensure sum is 100%
    const total = services + commodities + manufactures;
    if (total !== 100) {
      services += (100 - total);
    }
    
    economy.services.value = services;
    economy.commodities.value = commodities;
    economy.manufactures.value = manufactures;
    
    this.updateSectoralOutputs(economy);
  }

  /**
   * Log update for debugging - shows JSON data usage
   * @param {string} countryName - Country name
   * @param {Object} economy - Economy object
   */
  logUpdate(countryName, economy) {
    const now = Date.now();
    
    // Log every 5 cycles for first country alphabetically
    if (this.updateCounter % 5 === 0 && countryName.charAt(0) <= 'B' && now - this.lastLogTime > this.logInterval) {
      console.log(`[ECONOMY] ${countryName} UPDATE #${this.updateCounter} - GDP: ${economy.gdp.value.toFixed(1)}, Treasury: ${economy.treasury.value.toFixed(1)}, Commodities: ${economy.commoditiesBalance.value.toFixed(1)}`);
      
      // Show if we're using JSON data
      const gameState = global.gameState;
      if (gameState && gameState.countriesData && gameState.countriesData[countryName]) {
        console.log(`[ECONOMY] ${countryName} has JSON data available`);
      } else {
        console.log(`[ECONOMY] ${countryName} using default values (no JSON data)`);
      }
      
      this.lastLogTime = now;
    }
  }

  resetUpdateCounter() {
    this.updateCounter = 0;
  }

  getUpdateCounter() {
    return this.updateCounter;
  }
}

export default CountryEconomyCalculator;