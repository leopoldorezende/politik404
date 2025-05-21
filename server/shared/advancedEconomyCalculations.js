/**
 * advancedEconomyCalculations.js
 * Funções puras para cálculos econômicos avançados
 * Adaptado do simulador econômico para uso com Redux
 */

// Constantes econômicas
export const ECONOMIC_CONSTANTS = {
  HISTORY_SIZE: 20,
  DEBT_DURATION_YEARS: 10,
  DEBT_DURATION_MONTHS: 120,
  EQUILIBRIUM_INTEREST_RATE: 8.0,
  EQUILIBRIUM_TAX_RATE: 40.0,
  EQUILIBRIUM_INFLATION: 0.04,
  MAX_DEBT_TO_GDP_RATIO: 1.2
};

/**
 * Calcula média móvel para um conjunto de valores históricos
 * @param {Array<number>} history - Conjunto de valores históricos
 * @returns {number} - Média móvel
 */
export function calculateMovingAverage(history) {
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
export function limitWithCurve(value, min, max, targetValue) {
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
 * Calcula o crescimento econômico baseado em parâmetros econômicos
 * @param {Object} economyState - Estado econômico atual
 * @returns {number} - Taxa de crescimento
 */
export function calculateEconomicGrowth(economyState) {
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
export function calculateInflation(economyState) {
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
  newInflation = limitWithCurve(newInflation, -0.02, 0.18, ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION);
  
  // Cria novo histórico para média móvel
  const newInflationHistory = [...inflationHistory, newInflation];
  if (newInflationHistory.length > ECONOMIC_CONSTANTS.HISTORY_SIZE) {
    newInflationHistory.shift();
  }
  
  const averageInflation = calculateMovingAverage(newInflationHistory);
  
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
export function calculateUnemployment(economyState) {
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
 * Calcula a arrecadação e gastos para atualizar o caixa
 * @param {Object} economyState - Estado econômico atual
 * @returns {number} - Novo valor de caixa
 */
export function calculateTreasury(economyState) {
  const { treasury, gdp, taxBurden, publicServices } = economyState;
  
  // Arrecadação via impostos
  const revenue = gdp * (taxBurden / 100) * 0.017;
  
  // Gastos com investimento público
  let investmentExpense = 0;
  
  if (publicServices > 0) {
    if (publicServices <= 15) {
      investmentExpense = gdp * (publicServices / 100) * 0.015;
    } else {
      const baseExpense = gdp * (15 / 100) * 0.015;
      const extraFactor = 2.0;
      const excessInvestment = publicServices - 15;
      const excessExpense = gdp * (excessInvestment / 100) * 0.015 * extraFactor;
      
      investmentExpense = baseExpense + excessExpense;
    }
  }
  
  return treasury + revenue - investmentExpense;
}

/**
 * Calcula a popularidade do governo
 * @param {Object} economyState - Estado econômico atual
 * @returns {Object} - { newPopularity, newPopularityHistory }
 */
export function calculatePopularity(economyState) {
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
  
  const averagePopularity = calculateMovingAverage(newPopularityHistory);
  
  return {
    newPopularity: newPopularity * 0.7 + averagePopularity * 0.3,
    newPopularityHistory
  };
}

/**
 * Atualiza a distribuição setorial do PIB
 * @param {Object} economyState - Estado econômico atual
 * @returns {Object} - Estado econômico com distribuição setorial atualizada
 */
export function updateSectoralDistribution(economyState) {
  const { services, commodities, manufactures, gdp } = economyState;
  
  // Variação mensal aleatória na distribuição setorial
  const commoditiesVariation = Math.floor(Math.random() * 3) - 1; // -1, 0, ou 1
  const manufacturesVariation = Math.floor(Math.random() * 3) - 1; // -1, 0, ou 1
  
  let newCommodities = commodities + commoditiesVariation;
  let newManufactures = manufactures + manufacturesVariation;
  
  // Recalcula serviços para manter o total em 100%
  let newServices = 100 - newCommodities - newManufactures;
  
  // Ajusta os limites setoriais
  const adjusted = adjustSectoralLimits({
    commodities: newCommodities,
    manufactures: newManufactures,
    services: newServices
  });
  
  return {
    ...economyState,
    commodities: adjusted.commodities,
    manufactures: adjusted.manufactures,
    services: adjusted.services,
    // Atualiza valores absolutos dos setores
    commoditiesOutput: gdp * adjusted.commodities / 100,
    manufacturesOutput: gdp * adjusted.manufactures / 100,
    servicesOutput: gdp * adjusted.services / 100
  };
}

/**
 * Função auxiliar que ajusta os limites da distribuição setorial
 * @param {Object} sectors - Objeto com percentuais de setores
 * @returns {Object} - Setores ajustados
 */
export function adjustSectoralLimits(sectors) {
  const adjusted = { ...sectors };
  
  // Limites para commodities (20-50%)
  if (adjusted.commodities < 20) { 
    const adjustment = 20 - adjusted.commodities;
    adjusted.commodities = 20;
    adjusted.services -= adjustment / 2;
    adjusted.manufactures -= adjustment / 2;
  } else if (adjusted.commodities > 50) {
    const adjustment = adjusted.commodities - 50;
    adjusted.commodities = 50;
    adjusted.services += adjustment / 2;
    adjusted.manufactures += adjustment / 2;
  }
  
  // Limites para manufaturas (20-50%)
  if (adjusted.manufactures < 20) {
    const adjustment = 20 - adjusted.manufactures;
    adjusted.manufactures = 20;
    adjusted.services -= adjustment / 2;
    adjusted.commodities -= adjustment / 2;
  } else if (adjusted.manufactures > 50) {
    const adjustment = adjusted.manufactures - 50;
    adjusted.manufactures = 50;
    adjusted.services += adjustment / 2;
    adjusted.commodities += adjustment / 2;
  }
  
  // Limites para serviços (20-50%)
  if (adjusted.services < 20) {
    const adjustment = 20 - adjusted.services;
    adjusted.services = 20;
    adjusted.commodities -= adjustment / 2;
    adjusted.manufactures -= adjustment / 2;
  } else if (adjusted.services > 50) {
    const adjustment = adjusted.services - 50;
    adjusted.services = 50;
    adjusted.commodities += adjustment / 2;
    adjusted.manufactures += adjustment / 2;
  }
  
  // Arredonda para inteiros e garante total de 100%
  adjusted.commodities = Math.round(adjusted.commodities);
  adjusted.manufactures = Math.round(adjusted.manufactures);
  adjusted.services = 100 - adjusted.commodities - adjusted.manufactures;
  
  return adjusted;
}

/**
 * Avalia e atualiza a classificação de crédito do país
 * @param {Object} economyState - Estado econômico atual
 * @returns {string} - Nova classificação de crédito
 */
export function updateCreditRating(economyState) {
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
 * Calcula as necessidades internas do país
 * @param {Object} economyState - Estado econômico atual
 * @returns {Object} - Estado econômico com necessidades atualizadas
 */
export function updateDomesticNeeds(economyState) {
  const { 
    gdp, 
    commoditiesNeedPercent = 30, 
    manufacturesNeedPercent = 45 
  } = economyState;
  
  // Atualiza as percentagens das necessidades com pequena variação aleatória
  const commoditiesVariation = (Math.random() * 0.4) - 0.2; // -0.2 a +0.2
  const manufacturesVariation = (Math.random() * 0.4) - 0.2; // -0.2 a +0.2
  
  const newCommoditiesNeedPercent = Math.max(25, Math.min(40, 
    commoditiesNeedPercent + commoditiesVariation
  ));
  
  const newManufacturesNeedPercent = Math.max(25, Math.min(40, 
    manufacturesNeedPercent + manufacturesVariation
  ));
  
  return {
    ...economyState,
    commoditiesNeedPercent: newCommoditiesNeedPercent,
    manufacturesNeedPercent: newManufacturesNeedPercent,
    commoditiesNeeds: gdp * (newCommoditiesNeedPercent / 100),
    manufacturesNeeds: gdp * (newManufacturesNeedPercent / 100)
  };
}