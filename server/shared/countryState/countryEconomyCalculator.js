/**
 * countryEconomyCalculator.js
 * Advanced economic calculations for country states
 * INTEGRATED WITH ADVANCED CALCULATIONS - No longer needs separate advancedEconomyCalculations.js
 */

// Constantes econômicas integradas
const ECONOMIC_CONSTANTS = {
  HISTORY_SIZE: 20,
  EQUILIBRIUM_INTEREST_RATE: 8.0,
  EQUILIBRIUM_TAX_RATE: 40.0,
  EQUILIBRIUM_INFLATION: 0.04,
  MAX_DEBT_TO_GDP_RATIO: 1.2
};

/**
 * Country Economy Calculator
 * Manages all economic calculations using data from countriesData.json
 * NOW WITH INTEGRATED ADVANCED CALCULATIONS
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
   * Calcula média móvel para um conjunto de valores históricos
   * @param {Array<number>} history - Conjunto de valores históricos
   * @returns {number} - Média móvel
   */
  calculateMovingAverage(history) {
    if (!history || history.length === 0) return 0;
    return history.reduce((a, b) => a + b, 0) / history.length;
  }

  /**
   * Limita um valor dentro de um intervalo com tendência a voltar ao alvo
   * @param {number} value - Valor atual
   * @param {number} min - Limite mínimo
   * @param {number} max - Limite máximo
   * @param {number} targetValue - Valor alvo para o qual o sistema tende a retornar
   * @returns {number} - Valor limitado com tendência
   */
  limitWithCurve(value, min, max, targetValue) {
    if (value < min) value = min;
    if (value > max) value = max;
    
    const distanceFromTarget = Math.abs(value - targetValue);
    
    if (value > targetValue) {
      const correctionFactor = 1 - Math.min(0.2, distanceFromTarget * 0.01);
      return value * correctionFactor + targetValue * (1 - correctionFactor);
    } else if (value < targetValue) {
      const correctionFactor = 1 - Math.min(0.2, distanceFromTarget * 0.01);
      return value * correctionFactor + targetValue * (1 - correctionFactor);
    }
    
    return value;
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
    
    // Initialize additional economic indicators with defaults or JSON data
    economy.inflation = (this.getNumericValue(jsonEconomy.inflation) || 2.8) / 100; // Convert to decimal
    economy.interestRate = this.getNumericValue(jsonEconomy.interestRate) || ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
    economy.taxBurden = this.getNumericValue(jsonEconomy.taxBurden) || ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
    economy.publicServices = this.getNumericValue(jsonEconomy.publicServices) || 30.0;
    economy.unemployment = this.getNumericValue(jsonEconomy.unemployment) || 12.5;
    economy.popularity = this.getNumericValue(jsonEconomy.popularity) || 50;
    economy.publicDebt = this.getNumericValue(jsonEconomy.publicDebt) || 0;
    
    // Initialize histories for moving averages
    economy.gdpHistory = [economy.gdp.value];
    economy.inflationHistory = [economy.inflation];
    economy.popularityHistory = [economy.popularity];
    economy.unemploymentHistory = [economy.unemployment];
    
    // Calculate previous quarter GDP and growth
    economy.previousQuarterGDP = economy.gdp.value;
    economy.quarterlyGrowth = 0.005; // 0.5% default growth
    
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
    
    // Initialize advanced economic indicators with defaults
    economy.inflation = ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION;
    economy.interestRate = ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
    economy.taxBurden = ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
    economy.publicServices = 30.0;
    economy.unemployment = 12.5;
    economy.popularity = 50;
    economy.publicDebt = 0;
    
    // Initialize histories
    economy.gdpHistory = [100];
    economy.inflationHistory = [ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION];
    economy.popularityHistory = [50];
    economy.unemploymentHistory = [12.5];
    
    economy.previousQuarterGDP = 100;
    economy.quarterlyGrowth = 0.005;
    
    this.updateSectoralOutputs(economy);
  }

  /**
   * Calcula o crescimento econômico baseado em parâmetros econômicos
   * @param {Object} economyState - Estado econômico atual
   * @returns {number} - Taxa de crescimento
   */
  calculateEconomicGrowth(economyState) {
    const { interestRate, taxBurden, publicServices, publicDebt, gdp } = economyState;
    
    const interestDiff = interestRate - ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
    
    // Efeito dos juros no crescimento
    let interestEffect;
    if (interestRate <= 10) {
      interestEffect = -interestDiff * 0.0002;
    } else {
      const excessInterest = interestRate - 10;
      interestEffect = -(interestDiff * 0.0002) - (Math.pow(excessInterest, 1.5) * 0.0001);
    }
    
    // Efeito dos impostos no crescimento
    const taxDiff = taxBurden - ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
    const taxEffect = -taxDiff * 0.00015;
    
    // Efeito do investimento público no crescimento
    let investmentEffect = 0;
    if (publicServices >= 30) {
      investmentEffect = publicServices * 0.0001;
    } else {
      const deficit = 30 - publicServices;
      const penaltyFactor = 1 - Math.pow(deficit / 30, 1.5) * 0.5;
      investmentEffect = publicServices * 0.0001 * penaltyFactor;
    }
    
    // Efeito da dívida pública na confiança dos investidores
    let debtEffect = 0;
    const debtToGdpRatio = publicDebt / gdp;
    if (debtToGdpRatio > 0.9) {
      debtEffect = -(debtToGdpRatio - 0.9) * 0.05;
    }
    
    const baseGrowth = interestEffect + taxEffect + investmentEffect + debtEffect;
    return baseGrowth * 0.061; // Fator de ajuste para crescimento mais lento
  }

  /**
   * Calcula a inflação baseada em parâmetros econômicos
   * @param {Object} economyState - Estado econômico atual
   * @returns {Object} - { newInflation, newInflationHistory }
   */
  calculateInflation(economyState) {
    const { 
      inflation, 
      interestRate, 
      taxBurden, 
      quarterlyGrowth, 
      publicDebt, 
      gdp,
      inflationHistory = []
    } = economyState;
    
    let newInflation = inflation;
    
    // Efeito dos juros na inflação
    if (interestRate < ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE) {
      const increaseFactor = 1 + ((ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE - interestRate) * 0.03);
      newInflation *= increaseFactor;
    } else if (interestRate > ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE) {
      if (interestRate <= 10) {
        const reductionFactor = 1 - ((interestRate - ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE) * 0.025);
        newInflation *= Math.max(0.85, reductionFactor);
      } else {
        const normalInterest = 10 - ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
        const excessInterest = interestRate - 10;
        
        const initialReduction = 1 - (normalInterest * 0.025);
        const additionalReduction = Math.pow(1.2, excessInterest) * 0.05;
        
        newInflation *= Math.max(0.65, initialReduction - additionalReduction);
      }
    }
    
    // Efeito dos impostos na inflação
    if (taxBurden > ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE) {
      const reductionFactor = 1 - ((taxBurden - ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE) * 0.003);
      newInflation *= Math.max(0.96, reductionFactor);
    } else if (taxBurden < ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE) {
      const increaseFactor = 1 + ((ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE - taxBurden) * 0.002);
      newInflation *= increaseFactor;
    }
    
    // Efeito do crescimento econômico na inflação
    const equilibriumGrowth = 0.02;
    
    if (quarterlyGrowth > equilibriumGrowth) {
      const excess = quarterlyGrowth - equilibriumGrowth;
      const emphasisFactor = 1 + (excess * 5);
      newInflation += excess * 0.12 * emphasisFactor;
    } else if (quarterlyGrowth > 0 && quarterlyGrowth <= equilibriumGrowth) {
      newInflation += quarterlyGrowth * 0.005;
    } else if (quarterlyGrowth < 0) {
      newInflation -= Math.abs(quarterlyGrowth) * 0.025;
    }
    
    // Efeito da dívida pública na inflação estrutural
    const debtToGdp = publicDebt / gdp;
    if (debtToGdp > 0.7) {
      const excessDebt = debtToGdp - 0.7;
      newInflation += excessDebt * 0.02;
    }
    
    // Variação aleatória e inércia inflacionária
    const randomVariation = (Math.random() - 0.5) * 0.0005;
    newInflation += randomVariation;
    newInflation = inflation * 0.8 + newInflation * 0.2;
    
    // Limita a inflação
    newInflation = this.limitWithCurve(newInflation, -0.02, 0.18, ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION);
    
    // Cria novo histórico para média móvel
    const newInflationHistory = [...inflationHistory, newInflation];
    if (newInflationHistory.length > ECONOMIC_CONSTANTS.HISTORY_SIZE) {
      newInflationHistory.shift();
    }
    
    const averageInflation = this.calculateMovingAverage(newInflationHistory);
    
    return {
      newInflation: newInflation * 0.8 + averageInflation * 0.2,
      newInflationHistory
    };
  }

  /**
   * Calcula o desemprego baseado em parâmetros econômicos
   * @param {Object} economyState - Estado econômico atual
   * @returns {number} - Nova taxa de desemprego
   */
  calculateUnemployment(economyState) {
    const { unemployment = 12.5, quarterlyGrowth, inflation, taxBurden } = economyState;
    
    let newUnemployment = unemployment;
    
    // Efeito do crescimento no desemprego
    if (quarterlyGrowth > 0) {
      // Crescimento reduz desemprego
      newUnemployment -= quarterlyGrowth * 5;
    } else {
      // Recessão aumenta desemprego rapidamente
      newUnemployment += Math.abs(quarterlyGrowth) * 8;
    }
    
    // Efeito da inflação no desemprego (curva de Phillips)
    if (inflation < 0.05) {
      // Inflação baixa tende a manter desemprego alto
      newUnemployment += (0.05 - inflation) * 2;
    } else if (inflation > 0.1) {
      // Inflação muito alta eventualmente também aumenta desemprego
      newUnemployment += (inflation - 0.1) * 3;
    } else {
      // Inflação moderada pode reduzir desemprego
      newUnemployment -= (inflation - 0.05) * 1;
    }
    
    // Efeito dos impostos no desemprego
    const taxReference = 40;
    if (taxBurden > taxReference) {
      // Impostos altos podem aumentar desemprego
      newUnemployment += (taxBurden - taxReference) * 0.05;
    }
    
    // Limites para a taxa de desemprego (entre 3% e 40%)
    newUnemployment = Math.max(3, Math.min(40, newUnemployment));
    
    // Inércia do desemprego (não muda muito rapidamente)
    return unemployment * 0.9 + newUnemployment * 0.1;
  }

  /**
   * Calcula a popularidade do governo
   * @param {Object} economyState - Estado econômico atual
   * @returns {Object} - { newPopularity, newPopularityHistory }
   */
  calculatePopularity(economyState) {
    const { 
      popularity, 
      quarterlyGrowth, 
      inflation, 
      taxBurden, 
      publicServices, 
      gdp, 
      unemployment,
      popularityHistory = []
    } = economyState;
    
    let newPopularity = popularity;
    
    // Efeito do crescimento na popularidade
    if (quarterlyGrowth > 0) {
      newPopularity += quarterlyGrowth * 100 * 0.2;
    } else if (quarterlyGrowth < 0) {
      newPopularity += quarterlyGrowth * 100 * 0.3;
    }
    
    // Efeito da inflação na popularidade
    const idealInflation = ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION;
    const inflationDiff = inflation - idealInflation;
    if (inflationDiff > 0) {
      newPopularity -= inflationDiff * 100 * 0.25;
    } else if (inflationDiff < 0 && inflation > 0) {
      newPopularity += Math.abs(inflationDiff) * 100 * 0.1;
    }
    
    // Efeito dos impostos na popularidade
    const idealTax = ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
    const taxDiff = taxBurden - idealTax;
    if (taxDiff > 0) {
      newPopularity -= taxDiff * 0.2;
    } else if (taxDiff < 0) {
      newPopularity += Math.abs(taxDiff) * 0.1;
    }
    
    // Efeito do investimento público na popularidade
    const investmentReference = Math.round(gdp / 3.33);
    const investmentDiff = publicServices - investmentReference;
    const responseRate = Math.tanh(investmentDiff / 10) * 0.8;
    newPopularity += responseRate * Math.abs(investmentDiff) * 0.15;
    
    // Efeito do desemprego na popularidade
    if (unemployment !== undefined) {
      const idealUnemployment = 15;
      const unemploymentDiff = unemployment - idealUnemployment;
      
      if (unemploymentDiff > 0) {
        // Desemprego acima do ideal reduz popularidade drasticamente
        const penaltyFactor = 1 + Math.pow(unemploymentDiff / 10, 1.5);
        newPopularity -= unemploymentDiff * 0.3 * penaltyFactor;
      } else if (unemploymentDiff < 0) {
        // Desemprego abaixo do ideal aumenta popularidade
        newPopularity += Math.abs(unemploymentDiff) * 0.3;
      }
      
      // Efeito combinado de desemprego alto + inflação alta (miséria econômica)
      if (unemployment > 30 && inflation > 0.08) {
        const miseryIndex = (unemployment - 30) * (inflation - 0.08) * 100;
        newPopularity -= miseryIndex * 0.2;
      }
    }
    
    // Variação aleatória
    const randomVariation = (Math.random() - 0.5) * 0.5;
    newPopularity += randomVariation;
    
    // Força de retorno para o equilíbrio (50%)
    const distanceFrom50 = Math.abs(newPopularity - 50);
    const returnForce = distanceFrom50 * distanceFrom50 * 0.002;
    
    if (newPopularity > 50) {
      newPopularity -= returnForce;
    } else if (newPopularity < 50) {
      newPopularity += returnForce;
    }
    
    // Limite entre 1% e 99%
    newPopularity = Math.max(1, Math.min(99, newPopularity));
    
    // Cria novo histórico para média móvel
    const newPopularityHistory = [...popularityHistory, newPopularity];
    if (newPopularityHistory.length > ECONOMIC_CONSTANTS.HISTORY_SIZE) {
      newPopularityHistory.shift();
    }
    
    const averagePopularity = this.calculateMovingAverage(newPopularityHistory);
    
    return {
      newPopularity: newPopularity * 0.7 + averagePopularity * 0.3,
      newPopularityHistory
    };
  }

  /**
   * Avalia e atualiza a classificação de crédito do país
   * @param {Object} economyState - Estado econômico atual
   * @returns {string} - Nova classificação de crédito
   */
  updateCreditRating(economyState) {
    const { publicDebt, gdp, inflation, quarterlyGrowth, inflationHistory = [] } = economyState;
    
    const debtToGdp = publicDebt / gdp;
    const inflationPercent = inflation * 100;
    const growthPercent = quarterlyGrowth * 100;
    
    // Determinação da nota base com base APENAS na inflação
    let baseRating;
    
    if (inflationPercent <= 2) {
      baseRating = "AAA";
    } else if (inflationPercent <= 3) {
      baseRating = "AA";
    } else if (inflationPercent <= 4) {
      baseRating = "A";
    } else if (inflationPercent <= 5.5) {
      baseRating = "BBB";
    } else if (inflationPercent <= 7) {
      baseRating = "BB";
    } else if (inflationPercent <= 9) {
      baseRating = "B";
    } else if (inflationPercent <= 12) {
      baseRating = "CCC";
    } else if (inflationPercent <= 15) {
      baseRating = "CC";
    } else {
      baseRating = "C";
    }
    
    // Ajuste pela dívida e crescimento
    const levels = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
    let ratingIndex = levels.indexOf(baseRating);
    
    // Impacto da dívida na classificação
    if (debtToGdp > 0.3 && debtToGdp <= 0.6) {
      ratingIndex += 1;
    } else if (debtToGdp > 0.6 && debtToGdp <= 0.9) {
      ratingIndex += 2;
    } else if (debtToGdp > 0.9 && debtToGdp <= 1.2) {
      ratingIndex += 3;
    } else if (debtToGdp > 1.2) {
      ratingIndex += 4;
    }
    
    // Impacto do crescimento negativo na classificação
    if (growthPercent < 0) {
      if (growthPercent >= -1) {
        ratingIndex += 1;
      } else if (growthPercent >= -3) {
        ratingIndex += 2;
      } else if (growthPercent >= -5) {
        ratingIndex += 3;
      } else {
        ratingIndex += 4;
      }
      
      // Caso especial: Estagflação
      if (inflationPercent > 7) {
        ratingIndex += 1;
      }
    }
    
    // Casos especiais para rating D
    if (inflationPercent > 15 && inflationHistory.length >= 3) {
      const last3 = inflationHistory.slice(-3).map(i => i * 100);
      if (last3[2] > last3[0] || Math.abs(last3[2] - last3[1]) > 2) {
        return "D";
      }
    }
    
    if (inflationPercent > 9 && debtToGdp > 0.9 && growthPercent < -3) {
      return "D";
    }
    
    // Garantir que o índice não ultrapasse o tamanho do array
    ratingIndex = Math.min(ratingIndex, levels.length - 1);
    
    return levels[ratingIndex];
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
    
    // Only perform advanced calculations every few cycles to avoid excessive computation
    if (this.updateCounter % 3 === 0) {
      this.performAdvancedEconomicCalculations(economy, countryName);
    }
    
    // Apply basic growth and changes
    this.updateGDP(economy, countryName);
    this.updateTreasury(economy, staticData, countryName);
    this.updateSectoralOutputs(economy);
    this.updateInternalNeeds(economy);
    this.applyTradeImpact(economy, tradeAgreements, countryName);
    
    // Sectoral variations occasionally
    if (this.updateCounter % 15 === 0) {
      this.updateSectoralDistribution(economy);
    }
    
    // Update domestic needs variations occasionally
    if (this.updateCounter % 10 === 0) {
      this.updateDomesticNeedsWithVariation(economy);
    }
    
    // Increment update counter
    this.updateCounter++;
    
    // Log updates for debugging
    this.logUpdate(countryName, economy);
    
    return countryState;
  }

  /**
   * Perform advanced economic calculations (inflation, unemployment, popularity, credit rating)
   * @param {Object} economy - Economy object
   * @param {string} countryName - Country name
   */
  performAdvancedEconomicCalculations(economy, countryName) {
    // Prepare economy state for advanced calculations
    const economyState = {
      gdp: this.getNumericValue(economy.gdp),
      inflation: economy.inflation || ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION,
      interestRate: economy.interestRate || ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE,
      taxBurden: economy.taxBurden || ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE,
      publicServices: economy.publicServices || 30.0,
      publicDebt: economy.publicDebt || 0,
      unemployment: economy.unemployment || 12.5,
      popularity: economy.popularity || 50,
      quarterlyGrowth: economy.quarterlyGrowth || 0.005,
      gdpHistory: economy.gdpHistory || [this.getNumericValue(economy.gdp)],
      inflationHistory: economy.inflationHistory || [economy.inflation || ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION],
      popularityHistory: economy.popularityHistory || [economy.popularity || 50],
      unemploymentHistory: economy.unemploymentHistory || [economy.unemployment || 12.5],
      previousQuarterGDP: economy.previousQuarterGDP || this.getNumericValue(economy.gdp)
    };

    // Calculate economic growth
    const growthRate = this.calculateEconomicGrowth(economyState);
    
    // Update quarterly growth every 30 cycles (representing quarterly updates)
    if (this.updateCounter % 30 === 0) {
      const currentGdp = this.getNumericValue(economy.gdp);
      economy.quarterlyGrowth = (currentGdp - economyState.previousQuarterGDP) / economyState.previousQuarterGDP;
      economy.previousQuarterGDP = currentGdp;
      economyState.quarterlyGrowth = economy.quarterlyGrowth;
    }

    // Calculate inflation
    const inflationResult = this.calculateInflation(economyState);
    economy.inflation = inflationResult.newInflation;
    economy.inflationHistory = inflationResult.newInflationHistory;

    // Calculate unemployment
    economy.unemployment = this.calculateUnemployment({
      ...economyState,
      inflation: economy.inflation,
      quarterlyGrowth: economy.quarterlyGrowth
    });

    // Update unemployment history
    if (!economy.unemploymentHistory) economy.unemploymentHistory = [];
    economy.unemploymentHistory.push(economy.unemployment);
    if (economy.unemploymentHistory.length > ECONOMIC_CONSTANTS.HISTORY_SIZE) {
      economy.unemploymentHistory.shift();
    }

    // Calculate popularity
    const popularityResult = this.calculatePopularity({
      ...economyState,
      inflation: economy.inflation,
      unemployment: economy.unemployment,
      quarterlyGrowth: economy.quarterlyGrowth,
      gdp: this.getNumericValue(economy.gdp)
    });
    economy.popularity = popularityResult.newPopularity;
    economy.popularityHistory = popularityResult.newPopularityHistory;

    // Update credit rating
    economy.creditRating = this.updateCreditRating({
      ...economyState,
      inflation: economy.inflation,
      quarterlyGrowth: economy.quarterlyGrowth,
      inflationHistory: economy.inflationHistory,
      publicDebt: economy.publicDebt || 0,
      gdp: this.getNumericValue(economy.gdp)
    });

    // Update GDP history
    if (!economy.gdpHistory) economy.gdpHistory = [];
    economy.gdpHistory.push(this.getNumericValue(economy.gdp));
    if (economy.gdpHistory.length > ECONOMIC_CONSTANTS.HISTORY_SIZE) {
      economy.gdpHistory.shift();
    }

    // Log advanced calculations occasionally
    if (this.updateCounter % 30 === 0) {
      console.log(`[ECONOMY ADVANCED] ${countryName}: Inflation ${(economy.inflation * 100).toFixed(1)}%, Unemployment ${economy.unemployment.toFixed(1)}%, Popularity ${economy.popularity.toFixed(1)}%, Rating ${economy.creditRating}`);
    }
  }

  /**
   * Update GDP with enhanced growth calculation
   * @param {Object} economy - Economy object
   * @param {string} countryName - Country name
   */
  updateGDP(economy, countryName) {
    const currentGdp = this.getNumericValue(economy.gdp);
    
    // Get unemployment data from the economy state or JSON
    let unemploymentRate = economy.unemployment || 12.5;
    
    // Check if we have unemployment data from JSON as fallback
    const gameState = global.gameState;
    if (!economy.unemployment && gameState && gameState.countriesData && gameState.countriesData[countryName]) {
      const countryData = gameState.countriesData[countryName];
      if (countryData.economy && countryData.economy.unemployment !== undefined) {
        unemploymentRate = this.getNumericValue(countryData.economy.unemployment);
      }
    }

    // Calculate growth based on employment (100 - unemployment) with enhanced factors
    const employmentRate = 100 - unemploymentRate;
    let baseGrowthRate = (employmentRate / 1000000) + (Math.random() * 0.0001 - 0.00005);
    
    // Apply additional economic factors if available
    if (economy.interestRate && economy.taxBurden && economy.publicServices) {
      const advancedGrowthRate = this.calculateEconomicGrowth({
        interestRate: economy.interestRate,
        taxBurden: economy.taxBurden,
        publicServices: economy.publicServices,
        publicDebt: economy.publicDebt || 0,
        gdp: currentGdp
      });
      
      // Blend basic and advanced growth rates
      baseGrowthRate = (baseGrowthRate + advancedGrowthRate) / 2;
    }
    
    const newGdp = currentGdp * (1 + baseGrowthRate);
    economy.gdp.value = Math.round(newGdp * 100) / 100;
  }

  /**
   * Update Treasury using enhanced fiscal calculations
   * @param {Object} economy - Economy object
   * @param {Object} staticData - Static data (may contain JSON data)
   * @param {string} countryName - Country name
   */
  updateTreasury(economy, staticData, countryName) {
    const currentTreasury = this.getNumericValue(economy.treasury);
    const gdp = this.getNumericValue(economy.gdp);
    
    // Use economy state values if available, otherwise fallback to JSON or defaults
    let taxBurden = economy.taxBurden || 25;
    let publicServices = economy.publicServices || 30;
    
    // Try to get tax burden and public services from JSON as fallback
    const gameState = global.gameState;
    if (gameState && gameState.countriesData && gameState.countriesData[countryName]) {
      const countryData = gameState.countriesData[countryName];
      if (countryData.economy) {
        if (!economy.taxBurden && countryData.economy.taxBurden !== undefined) {
          taxBurden = this.getNumericValue(countryData.economy.taxBurden);
          economy.taxBurden = taxBurden; // Store for future use
        }
        if (!economy.publicServices && countryData.economy.publicServices !== undefined) {
          publicServices = this.getNumericValue(countryData.economy.publicServices);
          economy.publicServices = publicServices; // Store for future use
        }
      }
    }
    
    // Enhanced treasury calculation
    const revenue = gdp * (taxBurden / 100) * 0.001;
    let expenses = gdp * (publicServices / 100) * 0.0008;
    
    // Add debt service costs if there's public debt
    if (economy.publicDebt && economy.publicDebt > 0) {
      const debtServiceCost = economy.publicDebt * 0.001; // 0.1% of debt as service cost
      expenses += debtServiceCost;
    }
    
    const netChange = revenue - expenses;
    economy.treasury.value = Math.round((currentTreasury + netChange) * 100) / 100;
    
    // Ensure treasury doesn't go below a minimum threshold
    economy.treasury.value = Math.max(economy.treasury.value, -economy.gdp.value * 0.1);
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
   * Update domestic needs with enhanced variation calculation
   * @param {Object} economy - Economy object
   */
  updateDomesticNeedsWithVariation(economy) {
    const gdp = this.getNumericValue(economy.gdp);
    
    // Enhanced needs variation based on economic conditions
    let commoditiesVariation = (Math.random() * 0.4) - 0.2;
    let manufacturesVariation = (Math.random() * 0.4) - 0.2;
    
    // Adjust variations based on economic health
    if (economy.unemployment && economy.unemployment > 15) {
      // High unemployment reduces consumption
      commoditiesVariation -= 0.1;
      manufacturesVariation -= 0.1;
    }
    
    if (economy.inflation && economy.inflation > 0.06) {
      // High inflation affects different sectors differently
      commoditiesVariation += 0.1; // Essential goods
      manufacturesVariation -= 0.05; // Luxury goods
    }
    
    const newCommoditiesNeedPercent = Math.max(10, Math.min(50, 
      economy.commoditiesNeeds.percentValue + commoditiesVariation
    ));
    
    const newManufacturesNeedPercent = Math.max(20, Math.min(70, 
      economy.manufacturesNeeds.percentValue + manufacturesVariation
    ));
    
    economy.commoditiesNeeds.percentValue = newCommoditiesNeedPercent;
    economy.commoditiesNeeds.value = parseFloat((gdp * newCommoditiesNeedPercent / 100).toFixed(2));
    
    economy.manufacturesNeeds.percentValue = newManufacturesNeedPercent;
    economy.manufacturesNeeds.value = parseFloat((gdp * newManufacturesNeedPercent / 100).toFixed(2));
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
   * Update sectoral distribution with enhanced variation algorithm
   * @param {Object} economy - Economy object
   */
  updateSectoralDistribution(economy) {
    // Enhanced sectoral variation based on economic conditions
    let servicesVariation = Math.floor(Math.random() * 3) - 1;
    let commoditiesVariation = Math.floor(Math.random() * 3) - 1;
    
    // Economic factors affecting sectoral shifts
    if (economy.unemployment && economy.unemployment > 15) {
      // High unemployment may shift towards services
      servicesVariation += 1;
      commoditiesVariation -= 1;
    }
    
    if (economy.inflation && economy.inflation > 0.08) {
      // High inflation may favor commodity production
      commoditiesVariation += 1;
      servicesVariation -= 1;
    }
    
    let services = this.getNumericValue(economy.services) + servicesVariation;
    let commodities = this.getNumericValue(economy.commodities) + commoditiesVariation;
    let manufactures = 100 - services - commodities;
    
    // Enforce enhanced limits with smooth transitions
    services = Math.max(15, Math.min(60, services));
    commodities = Math.max(10, Math.min(50, commodities));
    manufactures = Math.max(15, Math.min(50, manufactures));
    
    // Ensure sum is 100% with proportional adjustment
    const total = services + commodities + manufactures;
    if (total !== 100) {
      const adjustment = (100 - total) / 3;
      services += adjustment;
      commodities += adjustment;
      manufactures += adjustment;
    }
    
    economy.services.value = Math.round(services);
    economy.commodities.value = Math.round(commodities);
    economy.manufactures.value = Math.round(manufactures);
    
    this.updateSectoralOutputs(economy);
  }

  /**
   * Log update for debugging - shows enhanced economic data
   * @param {string} countryName - Country name
   * @param {Object} economy - Economy object
   */
  logUpdate(countryName, economy) {
    const now = Date.now();
    
    // Log every 5 cycles for first country alphabetically with enhanced info
    if (this.updateCounter % 5 === 0 && countryName.charAt(0) <= 'B' && now - this.lastLogTime > this.logInterval) {
      const gdpValue = economy.gdp.value.toFixed(1);
      const treasuryValue = economy.treasury.value.toFixed(1);
      const commoditiesBalance = economy.commoditiesBalance.value.toFixed(1);
      const inflation = economy.inflation ? (economy.inflation * 100).toFixed(1) + '%' : 'N/A';
      const unemployment = economy.unemployment ? economy.unemployment.toFixed(1) + '%' : 'N/A';
      const creditRating = economy.creditRating || 'N/A';
      
      console.log(`[ECONOMY ENHANCED] ${countryName} UPDATE #${this.updateCounter} - GDP: ${gdpValue}, Treasury: ${treasuryValue}, Commodities: ${commoditiesBalance}, Inflation: ${inflation}, Unemployment: ${unemployment}, Rating: ${creditRating}`);
      
      // Show if we're using JSON data
      const gameState = global.gameState;
      if (gameState && gameState.countriesData && gameState.countriesData[countryName]) {
        console.log(`[ECONOMY] ${countryName} has JSON data available with enhanced calculations`);
      } else {
        console.log(`[ECONOMY] ${countryName} using default values with enhanced calculations`);
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