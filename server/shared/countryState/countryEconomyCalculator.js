/**
 * countryEconomyCalculator.js
 * Advanced economic calculations for country states
 * Handles GDP growth, inflation, sectoral changes, and trade impacts
 */

/**
 * Country Economy Calculator
 * Manages all economic calculations for country states
 */
class CountryEconomyCalculator {
  constructor() {
    this.updateCounter = 0;
    this.lastLogTime = 0;
    this.logInterval = 60000; // 1 minute between logs
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
   * Perform economic calculations for a country
   * @param {Object} countryState - Current country state
   * @param {Object} staticData - Static country data
   * @param {Array} tradeAgreements - Active trade agreements
   * @returns {Object} - Updated economy object
   */
  calculateEconomy(countryState, staticData, tradeAgreements = []) {
    const countryName = staticData?.name || staticData?.countryName || 'Unknown';
    
    // Use the existing economy calculations instead of importing
    // This avoids circular dependency issues
    let updatedEconomy = { ...countryState.economy };
    
    // Calculate trade impact
    const tradeImpact = this.calculateTradeImpact(updatedEconomy, tradeAgreements, countryName);
    
    // Apply trade impact to balances
    this.applyTradeImpactToBalances(updatedEconomy, tradeImpact);
    
    return updatedEconomy;
  }

  /**
   * Update derived economic indicators based on GDP and other factors
   * @param {Object} countryState - Country state to update
   * @returns {Object} - Updated country state
   */
  updateDerivedEconomicIndicators(countryState) {
    const economy = countryState.economy;
    const gdp = this.getNumericValue(economy.gdp);
    
    // Ensure sectoral percentages exist
    if (!economy.services || typeof economy.services.value !== 'number') {
      economy.services = { value: 35, unit: '%' };
    }
    
    if (!economy.commodities || typeof economy.commodities.value !== 'number') {
      economy.commodities = { value: 35, unit: '%' };
    }
    
    if (!economy.manufactures || typeof economy.manufactures.value !== 'number') {
      economy.manufactures = { value: 30, unit: '%' };
    }
    
    // Calculate sectoral outputs (absolute values)
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
    
    // Initialize needs structures if they don't exist
    if (!economy.commoditiesNeeds || typeof economy.commoditiesNeeds !== 'object') {
      economy.commoditiesNeeds = { value: 0, percentValue: 30, unit: 'bi USD' };
    }
    
    if (!economy.manufacturesNeeds || typeof economy.manufacturesNeeds !== 'object') {
      economy.manufacturesNeeds = { value: 0, percentValue: 45, unit: 'bi USD' };
    }
    
    // Initialize balance structures if they don't exist
    if (!economy.commoditiesBalance || typeof economy.commoditiesBalance !== 'object') {
      economy.commoditiesBalance = { value: 0, unit: 'bi USD' };
    }
    
    if (!economy.manufacturesBalance || typeof economy.manufacturesBalance !== 'object') {
      economy.manufacturesBalance = { value: 0, unit: 'bi USD' };
    }
    
    // Update need percentages with random variation every 3 cycles
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
    
    // Calculate needs in absolute values
    economy.commoditiesNeeds.value = parseFloat((gdp * economy.commoditiesNeeds.percentValue / 100).toFixed(2));
    economy.manufacturesNeeds.value = parseFloat((gdp * economy.manufacturesNeeds.percentValue / 100).toFixed(2));
    
    // Calculate balances if not already calculated by trade agreements
    if (!economy.tradeStats) {
      // Calculate balances without trade agreements
      economy.commoditiesBalance.value = parseFloat((economy.commoditiesOutput.value - economy.commoditiesNeeds.value).toFixed(2));
      economy.manufacturesBalance.value = parseFloat((economy.manufacturesOutput.value - economy.manufacturesNeeds.value).toFixed(2));
    }
    
    // Update sectoral distribution with small variation every 6 cycles
    if (this.updateCounter % 6 === 0) {
      this.updateSectoralDistribution(economy);
    }
    
    return countryState;
  }

  /**
   * Update sectoral distribution with random variations
   * @param {Object} economy - Economy object to update
   */
  updateSectoralDistribution(economy) {
    // Variation of -1 to +1 percentage point
    const servicesVariation = Math.floor(Math.random() * 3) - 1;
    const commoditiesVariation = Math.floor(Math.random() * 3) - 1;
    
    // Adjust percentages maintaining sum at 100%
    let services = economy.services.value + servicesVariation;
    let commodities = economy.commodities.value + commoditiesVariation;
    let manufactures = 100 - services - commodities;
    
    // Correct extreme values
    if (services < 15) services = 15;
    if (commodities < 15) commodities = 15;
    if (manufactures < 15) {
      const excess = 15 - manufactures;
      services -= Math.floor(excess / 2);
      commodities -= Math.ceil(excess / 2);
      manufactures = 15;
    }
    
    // Ensure sum is 100%
    const total = services + commodities + manufactures;
    if (total !== 100) {
      const adjustment = 100 - total;
      services += adjustment;
    }
    
    // Update values
    economy.services.value = services;
    economy.commodities.value = commodities;
    economy.manufactures.value = manufactures;
  }

  /**
   * Calculate GDP growth based on economic policies and external factors
   * @param {Object} economy - Economy object
   * @param {Object} staticData - Static country data
   * @returns {number} - GDP growth rate
   */
  calculateGdpGrowth(economy, staticData) {
    const currentGdp = this.getNumericValue(economy.gdp);
    const unemployment = staticData.economy?.unemployment || 12.5;
    
    // Employment rate = 100 - unemployment
    const employmentRate = 100 - unemployment;
    
    // Growth percentage = employment rate / 1000000
    const growthRate = employmentRate / 1000000;
    
    // New GDP = current GDP + (current GDP * growth rate)
    const gdpIncrease = currentGdp * growthRate;
    const newGdp = currentGdp + gdpIncrease;
    
    return Math.round(newGdp * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate trade agreements impact on country economy
   * @param {Object} economy - Economy object
   * @param {Array} tradeAgreements - List of trade agreements
   * @param {string} countryName - Name of the country
   * @returns {Object} - Trade impact details
   */
  calculateTradeImpact(economy, tradeAgreements = [], countryName) {
    if (!tradeAgreements || tradeAgreements.length === 0 || !countryName) {
      return {
        commodityImports: 0,
        commodityExports: 0,
        manufactureImports: 0,
        manufactureExports: 0,
        balanceAdjustments: {}
      };
    }

    // Initial totals
    let commodityImports = 0;
    let commodityExports = 0;
    let manufactureImports = 0;
    let manufactureExports = 0;

    // Filter only agreements where this country is the originator
    const ownAgreements = tradeAgreements.filter(agreement => 
      agreement.originCountry === countryName
    );
    
    // Process only agreements originated by this country
    ownAgreements.forEach(agreement => {
      if (agreement.type === 'export') {
        // Export from current country
        if (agreement.product === 'commodity') {
          commodityExports += agreement.value;
        } else if (agreement.product === 'manufacture') {
          manufactureExports += agreement.value;
        }
      } else if (agreement.type === 'import') {
        // Import to current country
        if (agreement.product === 'commodity') {
          commodityImports += agreement.value;
        } else if (agreement.product === 'manufacture') {
          manufactureImports += agreement.value;
        }
      }
    });

    // Calculate balance adjustments - exports DECREASE, imports increase
    const commoditiesBalanceAdjustment = -commodityExports + commodityImports;
    const manufacturesBalanceAdjustment = -manufactureExports + manufactureImports;

    // Log only when there's real trade impact and with minimum interval between logs
    if (commodityExports > 0 || commodityImports > 0 || manufactureExports > 0 || manufactureImports > 0) {
      const now = Date.now();
      if (now - this.lastLogTime > this.logInterval) {
        console.log(`Trade adjustments for ${countryName}:`, {
          commodityExports,
          commodityImports,
          manufactureExports, 
          manufactureImports,
          commoditiesBalanceAdjustment,
          manufacturesBalanceAdjustment
        });
        this.lastLogTime = now;
      }
    }

    return {
      commodityImports,
      commodityExports,
      manufactureImports,
      manufactureExports,
      balanceAdjustments: {
        commodities: commoditiesBalanceAdjustment,
        manufactures: manufacturesBalanceAdjustment
      }
    };
  }

  /**
   * Apply trade agreements impact to economy balances
   * @param {Object} economy - Economy object to update
   * @param {Object} tradeImpact - Trade impact data
   */
  applyTradeImpactToBalances(economy, tradeImpact) {
    if (economy.commoditiesBalance) {
      // Base production
      const baseProduction = economy.commoditiesOutput?.value || 0;
      // Internal needs
      const internalNeeds = economy.commoditiesNeeds?.value || 0;
      
      // Exports (negative) - what leaves the country
      const exports = tradeImpact.commodityExports || 0;
      // Imports (positive) - what enters the country
      const imports = tradeImpact.commodityImports || 0;
      
      // Final balance = Production - Exports + Imports - Needs
      const newBalance = baseProduction - exports + imports - internalNeeds;
      
      economy.commoditiesBalance.value = Math.round(newBalance * 100) / 100;
    }
    
    if (economy.manufacturesBalance) {
      // Base production
      const baseProduction = economy.manufacturesOutput?.value || 0;
      // Internal needs
      const internalNeeds = economy.manufacturesNeeds?.value || 0;
      
      // Exports (negative) - what leaves the country
      const exports = tradeImpact.manufactureExports || 0;
      // Imports (positive) - what enters the country
      const imports = tradeImpact.manufactureImports || 0;
      
      // Final balance = Production - Exports + Imports - Needs
      const newBalance = baseProduction - exports + imports - internalNeeds;
      
      economy.manufacturesBalance.value = Math.round(newBalance * 100) / 100;
    }
    
    // Store trade statistics in economy state for future use
    economy.tradeStats = {
      commodityImports: tradeImpact.commodityImports,
      commodityExports: tradeImpact.commodityExports,
      manufactureImports: tradeImpact.manufactureImports,
      manufactureExports: tradeImpact.manufactureExports
    };
  }

  /**
   * Perform comprehensive economic update for a country
   * @param {Object} countryState - Country state
   * @param {Object} staticData - Static country data
   * @param {Array} tradeAgreements - Trade agreements
   * @returns {Object} - Updated country state
   */
  performEconomicUpdate(countryState, staticData, tradeAgreements = []) {
    const countryName = staticData?.name || staticData?.countryName || 'Unknown';
    
    // Perform advanced economic calculations
    const updatedEconomy = this.calculateEconomy(countryState, staticData, tradeAgreements);
    
    // Update country state with new economy
    countryState.economy = updatedEconomy;
    
    // Update derived indicators
    this.updateDerivedEconomicIndicators(countryState);
    
    // Increment update counter
    this.updateCounter++;
    
    return countryState;
  }

  /**
   * Reset update counter (useful for testing or reinitialization)
   */
  resetUpdateCounter() {
    this.updateCounter = 0;
  }

  /**
   * Get current update counter
   * @returns {number} - Current update counter
   */
  getUpdateCounter() {
    return this.updateCounter;
  }
}

export default CountryEconomyCalculator;