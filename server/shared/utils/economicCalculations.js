/**
 * economicCalculations.js - Módulo específico para cálculos econômicos dinâmicos
 * VERSÃO EXPANDIDA COM CÁLCULOS SOFISTICADOS MIGRADOS
 * Localização: server/shared/utils/economicCalculations.js
 */

/**
 * Constantes econômicas baseadas no sistema original
 */
const ECONOMIC_CONSTANTS = {
  EQUILIBRIUM_INTEREST_RATE: 8.0,
  EQUILIBRIUM_TAX_RATE: 40.0,
  EQUILIBRIUM_INFLATION: 0.04, // 4%
  IDEAL_UNEMPLOYMENT: 15.0,
  IDEAL_POPULARITY: 50.0,
  
  // Fatores de sensibilidade para cálculos avançados
  INFLATION_SENSITIVITY: 0.001,
  UNEMPLOYMENT_SENSITIVITY: 0.1,
  POPULARITY_SENSITIVITY: 0.5,
  GROWTH_SENSITIVITY: 0.0001,
  
  // Limites realistas
  MIN_INFLATION: -0.02, // -2%
  MAX_INFLATION: 0.18,  // 18%
  MIN_UNEMPLOYMENT: 3,   // 3%
  MAX_UNEMPLOYMENT: 40,  // 40%
  MIN_POPULARITY: 1,     // 1%
  MAX_POPULARITY: 99,    // 99%
  
  // Ciclos temporais
  MONTHLY_CYCLE: 60,
  QUARTERLY_CYCLE: 180,
  
  // Fatores de inércia
  INFLATION_INERTIA: 0.8,
  UNEMPLOYMENT_INERTIA: 0.9,
  POPULARITY_INERTIA: 0.7,
};

/**
 * Get numeric value from property that can be in different formats
 * @param {any} property - Property that can be number or object with value
 * @returns {number} - Numeric value
 */
export function getNumericValue(property) {
  if (property === undefined || property === null) return 0;
  if (typeof property === 'number') return property;
  if (typeof property === 'object' && property.value !== undefined) return property.value;
  return 0;
}

/**
 * Format currency value for display
 * @param {number} value - Numeric value
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(value, decimals = 1) {
  if (value === undefined || value === null || isNaN(value)) return '0.0';
  return Number(value).toFixed(decimals);
}

/**
 * Format percentage value for display
 * @param {number} value - Numeric value
 * @returns {string} - Formatted percentage string
 */
export function formatPercent(value) {
  if (value === undefined || value === null || isNaN(value)) return '0.0%';
  return Number(value).toFixed(1) + '%';
}

/**
 * Format value with sign for display
 * @param {number} value - Numeric value
 * @returns {string} - Formatted value with sign
 */
export function formatValueWithSign(value) {
  if (value === undefined || value === null || isNaN(value)) return '0.0';
  const num = Number(value);
  return (num >= 0 ? '+' : '') + num.toFixed(1);
}

/**
 * Calcula o crescimento econômico trimestral avançado
 * Implementação baseada no sistema original com múltiplos fatores
 * @param {Object} economy - Estado econômico
 * @returns {number} - Taxa de crescimento (como decimal, ex: 0.025 = 2.5%)
 */
export function calculateAdvancedGrowth(economy) {
  // Efeito dos juros no crescimento
  const interestDiff = economy.interestRate - ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
  let interestEffect;
  
  if (economy.interestRate <= 10) {
    interestEffect = -interestDiff * 0.0002;
  } else {
    const excessInterest = economy.interestRate - 10;
    interestEffect = -(interestDiff * 0.0002) - (Math.pow(excessInterest, 1.5) * 0.0001);
  }
  
  // Efeito dos impostos no crescimento
  const taxDiff = economy.taxBurden - ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
  const taxEffect = -taxDiff * 0.00015;
  
  // Efeito do investimento público no crescimento
  let investmentEffect = 0;
  if (economy.publicServices >= 30) {
    investmentEffect = economy.publicServices * 0.0001;
  } else {
    const deficit = 30 - economy.publicServices;
    const penaltyFactor = 1 - Math.pow(deficit / 30, 1.5) * 0.5;
    investmentEffect = economy.publicServices * 0.0001 * penaltyFactor;
  }
  
  // Efeito da dívida pública na confiança dos investidores
  let debtEffect = 0;
  const debtToGDP = economy.publicDebt / economy.gdp;
  if (debtToGDP > 0.9) {
    debtEffect = -(debtToGDP - 0.9) * 0.05;
  }
  
  // Efeito do comércio no crescimento
  const tradeBalance = Math.abs(economy.commoditiesBalance || 0) + Math.abs(economy.manufacturesBalance || 0);
  const tradeEffect = (tradeBalance / economy.gdp) * 0.1;
  
  const baseGrowth = interestEffect + taxEffect + investmentEffect + debtEffect + tradeEffect;
  
  // Crescimento base + efeitos + variação aleatória
  let finalGrowth = 2.5 + (baseGrowth * 0.061 * 100); // Converter para percentual
  
  const randomVariation = (Math.random() - 0.5) * 0.5;
  finalGrowth += randomVariation;
  
  // Limites realistas (-8% a +12%)
  finalGrowth = Math.max(-8, Math.min(12, finalGrowth));
  
  return finalGrowth / 100; // Retornar como decimal para compatibilidade
}

/**
 * Calcula a inflação dinâmica baseada nas políticas econômicas
 * Implementação fiel ao sistema original com todas as variáveis
 * @param {Object} economy - Estado econômico
 * @returns {number} - Nova taxa de inflação
 */
export function calculateDynamicInflation(economy) {
  let currentInflation = economy.inflation || ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION;
  
  // Se inflação for 0, inicializar com valor base
  if (currentInflation === 0) {
    currentInflation = ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION;
  }
  
  // Efeito da taxa de juros na inflação
  let inflationEffect = 0;
  const equilibriumRate = ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
  
  if (economy.interestRate < equilibriumRate) {
    // Juros baixos aumentam inflação
    const factor = 1 + ((equilibriumRate - economy.interestRate) * 0.03);
    inflationEffect = currentInflation * factor - currentInflation;
  } else if (economy.interestRate > equilibriumRate) {
    // Juros altos reduzem inflação
    if (economy.interestRate <= 10) {
      const factor = 1 - ((economy.interestRate - equilibriumRate) * 0.025);
      inflationEffect = currentInflation * Math.max(0.85, factor) - currentInflation;
    } else {
      // Juros muito altos reduzem drasticamente
      const normalReduction = 1 - ((10 - equilibriumRate) * 0.025);
      const excessReduction = Math.pow(1.2, economy.interestRate - 10) * 0.05;
      const factor = Math.max(0.65, normalReduction - excessReduction);
      inflationEffect = currentInflation * factor - currentInflation;
    }
  }
  
  // Efeito dos impostos na inflação
  const equilibriumTax = ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
  let taxEffect = 0;
  
  if (economy.taxBurden > equilibriumTax) {
    const factor = 1 - ((economy.taxBurden - equilibriumTax) * 0.003);
    taxEffect = currentInflation * Math.max(0.96, factor) - currentInflation;
  } else if (economy.taxBurden < equilibriumTax) {
    const factor = 1 + ((equilibriumTax - economy.taxBurden) * 0.002);
    taxEffect = currentInflation * factor - currentInflation;
  }
  
  // Efeito do crescimento econômico na inflação
  const gdpGrowth = economy.gdpGrowth || 0;
  let growthEffect = 0;
  const growthEquilibrium = 2.0;
  
  if (gdpGrowth > growthEquilibrium) {
    const excess = gdpGrowth - growthEquilibrium;
    const emphasis = 1 + (excess * 5);
    growthEffect = (excess / 100) * 0.12 * emphasis;
  } else if (gdpGrowth > 0 && gdpGrowth <= growthEquilibrium) {
    growthEffect = (gdpGrowth / 100) * 0.005;
  } else if (gdpGrowth < 0) {
    growthEffect = (gdpGrowth / 100) * 0.025;
  }
  
  // Efeito da dívida pública na inflação estrutural
  const debtToGDP = economy.publicDebt / economy.gdp;
  let debtEffect = 0;
  
  if (debtToGDP > 0.7) {
    const excessDebt = debtToGDP - 0.7;
    debtEffect = excessDebt * 0.02;
  }
  
  const randomVariation = (Math.random() - 0.5) * 0.0005;
  
  // Aplicar todos os efeitos
  let newInflation = currentInflation + inflationEffect + taxEffect + growthEffect + debtEffect + randomVariation;
  
  // Inércia inflacionária
  newInflation = currentInflation * ECONOMIC_CONSTANTS.INFLATION_INERTIA + newInflation * (1 - ECONOMIC_CONSTANTS.INFLATION_INERTIA);
  
  // Limites realistas
  newInflation = Math.max(ECONOMIC_CONSTANTS.MIN_INFLATION, Math.min(ECONOMIC_CONSTANTS.MAX_INFLATION, newInflation));
  
  return newInflation;
}

/**
 * Calcula o desemprego dinâmico com Curva de Phillips
 * Implementação baseada no sistema original
 * @param {Object} economy - Estado econômico
 * @returns {number} - Nova taxa de desemprego
 */
export function calculateDynamicUnemployment(economy) {
  let currentUnemployment = economy.unemployment || 12.5;
  
  // Efeito do crescimento econômico (Lei de Okun adaptada)
  const gdpGrowth = economy.gdpGrowth || 0;
  let growthEffect = 0;
  
  if (gdpGrowth > 0) {
    // Crescimento reduz desemprego
    growthEffect = -(gdpGrowth * 5);
  } else if (gdpGrowth < 0) {
    // Recessão aumenta desemprego mais rapidamente
    growthEffect = Math.abs(gdpGrowth) * 8;
  }
  
  // Efeito da inflação (Curva de Phillips modificada)
  const inflationPercent = (economy.inflation || ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION) * 100;
  let inflationEffect = 0;
  
  if (inflationPercent < 5) {
    // Inflação muito baixa mantém desemprego alto
    inflationEffect = (5 - inflationPercent) * 2;
  } else if (inflationPercent > 10) {
    // Inflação muito alta também prejudica emprego (estagflação)
    inflationEffect = (inflationPercent - 10) * 3;
  } else if (inflationPercent >= 5 && inflationPercent <= 10) {
    // Faixa moderada de inflação pode reduzir desemprego
    inflationEffect = -((inflationPercent - 5) * 1);
  }
  
  // Efeito do investimento público (mais significativo)
  let investmentEffect = 0;
  if (economy.publicServices > 35) {
    // Investimento público alto reduz desemprego
    investmentEffect = -((economy.publicServices - 35) * 0.3);
  } else if (economy.publicServices < 25) {
    // Investimento muito baixo aumenta desemprego
    investmentEffect = (25 - economy.publicServices) * 0.25;
  }
  
  // Efeito da carga tributária
  let taxEffect = 0;
  if (economy.taxBurden > 50) {
    // Impostos muito altos podem desencorajar contratações
    taxEffect = (economy.taxBurden - 50) * 0.12;
  } else if (economy.taxBurden < 30) {
    // Impostos muito baixos podem reduzir serviços públicos
    taxEffect = (30 - economy.taxBurden) * 0.08;
  }
  
  // Efeito da taxa de juros
  let interestEffect = 0;
  if (economy.interestRate > 12) {
    // Juros muito altos desencorajam investimento
    interestEffect = (economy.interestRate - 12) * 0.4;
  } else if (economy.interestRate < 5) {
    // Juros muito baixos estimulam investimento e emprego
    interestEffect = -(5 - economy.interestRate) * 0.3;
  }
  
  // Aplicar todos os efeitos
  let newUnemployment = currentUnemployment + growthEffect + inflationEffect + investmentEffect + taxEffect + interestEffect;
  
  // Inércia do desemprego (muda mais lentamente)
  newUnemployment = currentUnemployment * ECONOMIC_CONSTANTS.UNEMPLOYMENT_INERTIA + newUnemployment * (1 - ECONOMIC_CONSTANTS.UNEMPLOYMENT_INERTIA);
  
  // Limites realistas
  newUnemployment = Math.max(ECONOMIC_CONSTANTS.MIN_UNEMPLOYMENT, Math.min(ECONOMIC_CONSTANTS.MAX_UNEMPLOYMENT, newUnemployment));
  
  return newUnemployment;
}

/**
 * Calcula a popularidade dinâmica baseada nos indicadores
 * Implementação completa do sistema original com força de retorno
 * @param {Object} economy - Estado econômico
 * @returns {number} - Nova taxa de popularidade
 */
export function calculateDynamicPopularity(economy) {
  let currentPopularity = economy.popularity || ECONOMIC_CONSTANTS.IDEAL_POPULARITY;
  
  // Se popularidade está artificialmente baixa sem justificativa, ajustar
  if (currentPopularity < 25 && economy.unemployment < 10 && (economy.inflation * 100) < 8) {
    currentPopularity = 45; // Resetar para valor mais realista
  }
  
  // Efeito do crescimento econômico
  const gdpGrowth = economy.gdpGrowth || 0;
  let growthEffect = 0;
  
  if (gdpGrowth > 0) {
    growthEffect = gdpGrowth * 100 * 0.2; // Crescimento positivo aumenta popularidade
  } else if (gdpGrowth < 0) {
    growthEffect = gdpGrowth * 100 * 0.3; // Recessão reduz mais a popularidade
  }
  
  // Efeito da inflação
  const idealInflation = ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION;
  const inflationDiff = economy.inflation - idealInflation;
  let inflationEffect = 0;
  
  if (inflationDiff > 0) {
    // Inflação alta prejudica popularidade
    inflationEffect = -(inflationDiff * 100 * 0.25);
  } else if (inflationDiff < 0 && economy.inflation > 0) {
    // Inflação baixa (mas positiva) ajuda popularidade
    inflationEffect = Math.abs(inflationDiff) * 100 * 0.1;
  } else if (economy.inflation <= 0) {
    // Deflação é prejudicial
    inflationEffect = economy.inflation * 100 * 10;
  }
  
  // Efeito do desemprego (impacto maior)
  const unemploymentDiff = economy.unemployment - ECONOMIC_CONSTANTS.IDEAL_UNEMPLOYMENT;
  let unemploymentEffect = 0;
  
  if (unemploymentDiff > 0) {
    // Desemprego alto reduz popularidade drasticamente
    const penalty = 1 + Math.pow(unemploymentDiff / 10, 1.5);
    unemploymentEffect = -unemploymentDiff * 0.3 * penalty;
  } else if (unemploymentDiff < 0) {
    // Desemprego baixo aumenta popularidade significativamente
    unemploymentEffect = Math.abs(unemploymentDiff) * 0.3;
  }
  
  // Efeito dos impostos
  const taxDiff = economy.taxBurden - ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
  let taxEffect = 0;
  
  if (taxDiff > 0) {
    taxEffect = -taxDiff * 0.2; // Impostos altos reduzem popularidade
  } else if (taxDiff < 0) {
    taxEffect = Math.abs(taxDiff) * 0.1; // Impostos baixos aumentam popularidade
  }
  
  // Efeito do investimento público
  const investmentRef = Math.round(economy.gdp / 3.33);
  const investmentDiff = economy.publicServices - investmentRef;
  const responseRate = Math.tanh(investmentDiff / 10) * 0.8;
  let investmentEffect = responseRate * Math.abs(investmentDiff) * 0.15;
  
  // Índice de miséria (desemprego alto + inflação alta)
  let miseryEffect = 0;
  const inflationPercent = economy.inflation * 100;
  if (economy.unemployment > 30 && inflationPercent > 8) {
    const miseryIndex = (economy.unemployment - 30) * (inflationPercent - 8);
    miseryEffect = -miseryIndex * 0.2;
  }
  
  // Variação aleatória pequena
  const randomVariation = (Math.random() - 0.5) * 0.5;
  
  // Aplicar todos os efeitos
  let newPopularity = currentPopularity + growthEffect + inflationEffect + unemploymentEffect + 
                     taxEffect + investmentEffect + miseryEffect + randomVariation;
  
  // Força de retorno para o equilíbrio (50%)
  const distanceFrom50 = Math.abs(newPopularity - ECONOMIC_CONSTANTS.IDEAL_POPULARITY);
  const returnForce = distanceFrom50 * distanceFrom50 * 0.002;
  
  if (newPopularity > ECONOMIC_CONSTANTS.IDEAL_POPULARITY) {
    newPopularity -= returnForce;
  } else if (newPopularity < ECONOMIC_CONSTANTS.IDEAL_POPULARITY) {
    newPopularity += returnForce;
  }
  
  // Inércia da popularidade (mais responsiva)
  newPopularity = currentPopularity * ECONOMIC_CONSTANTS.POPULARITY_INERTIA + newPopularity * (1 - ECONOMIC_CONSTANTS.POPULARITY_INERTIA);
  
  // Limites realistas
  newPopularity = Math.max(ECONOMIC_CONSTANTS.MIN_POPULARITY, Math.min(ECONOMIC_CONSTANTS.MAX_POPULARITY, newPopularity));
  
  return newPopularity;
}

/**
 * Calcula o rating de crédito dinamicamente
 * Implementação fiel ao sistema original com análise contextual
 * @param {Object} economy - Estado econômico
 * @returns {string} - Rating de crédito
 */
export function calculateCreditRating(economy) {
  const debtToGdpRatio = economy.publicDebt / economy.gdp;
  const inflationPercent = (economy.inflation || ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION) * 100;
  const growthPercent = economy.gdpGrowth || 0;
  
  // Análise contextual: país em crescimento com inflação controlada merece nota melhor
  let baseRating;
  
  if (growthPercent > 2 && inflationPercent <= 6) {
    // País em crescimento saudável
    if (inflationPercent <= 2) {
      baseRating = "AAA";
    } else if (inflationPercent <= 4) {
      baseRating = "AA";
    } else if (inflationPercent <= 6) {
      baseRating = "A";
    }
  } else {
    // Análise padrão baseada na inflação
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
  }
  
  const levels = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
  let ratingIndex = levels.indexOf(baseRating);
  
  // Ajuste pela dívida (mais equilibrado)
  if (debtToGdpRatio > 0.3 && debtToGdpRatio <= 0.6) {
    ratingIndex += 1;
  } else if (debtToGdpRatio > 0.6 && debtToGdpRatio <= 0.9) {
    ratingIndex += 2;
  } else if (debtToGdpRatio > 0.9 && debtToGdpRatio <= 1.2) {
    ratingIndex += 3;
  } else if (debtToGdpRatio > 1.2) {
    ratingIndex += 4;
  }
  
  // Ajuste pelo crescimento (mais contextual)
  if (growthPercent < -5) {
    ratingIndex += 4; // Recessão profunda
  } else if (growthPercent < -3) {
    ratingIndex += 3; // Recessão forte
  } else if (growthPercent < -1) {
    ratingIndex += 2; // Recessão moderada
  } else if (growthPercent < 0) {
    ratingIndex += 1; // Recessão leve
  } else if (growthPercent > 4) {
    // Crescimento forte pode compensar outros problemas
    ratingIndex = Math.max(0, ratingIndex - 1);
  }
  
  // Casos especiais
  if (inflationPercent > 15 && economy._historicInflation && economy._historicInflation.length >= 3) {
    const last3 = economy._historicInflation.slice(-3).map(i => i * 100);
    if (last3[2] > last3[0] || Math.abs(last3[2] - last3[1]) > 2) {
      return "D"; // Inflação descontrolada
    }
  }
  
  // Tripla ameaça
  if (inflationPercent > 9 && debtToGdpRatio > 0.9 && growthPercent < -3) {
    return "D"; // Crise severa
  }
  
  // Garantir limites
  ratingIndex = Math.min(ratingIndex, levels.length - 1);
  
  return levels[ratingIndex];
}

/**
 * Processa pagamentos de dívida de forma proporcional
 * @param {Object} economy - Estado econômico
 * @param {Array} debtContracts - Contratos de dívida
 * @param {number} cycleFactor - Fator do ciclo (ex: 1/60 para mensal)
 * @returns {number} - Total pago no ciclo
 */
export function processDeptPayments(economy, debtContracts, cycleFactor = 1) {
  if (!debtContracts || debtContracts.length === 0) return 0;
  
  let totalPayment = 0;
  let totalInterest = 0;
  let totalPrincipal = 0;
  
  // Calcular pagamentos proporcionais
  debtContracts.forEach(contract => {
    if (contract.remainingInstallments > 0) {
      const fractionalPayment = contract.monthlyPayment * cycleFactor;
      const monthlyRate = contract.interestRate / 100 / 12;
      const interestPayment = contract.remainingValue * monthlyRate * cycleFactor;
      const principalPayment = fractionalPayment - interestPayment;
      
      totalInterest += interestPayment;
      totalPrincipal += principalPayment;
      totalPayment += fractionalPayment;
      
      // Atualizar contrato gradualmente
      contract.remainingValue -= principalPayment;
      if (contract.remainingValue < 0.01) {
        contract.remainingValue = 0;
        contract.remainingInstallments = 0;
      }
    }
  });
  
  // Deduzir pagamento do tesouro
  economy.treasury -= totalPayment;
  
  // Se tesouro insuficiente, emitir títulos de emergência
  if (economy.treasury < 0) {
    const shortfall = Math.abs(economy.treasury);
    economy.treasury = 0;
    
    // Emitir títulos para cobrir déficit (com juros mais altos)
    const emergencyAmount = shortfall * 1.2; // 20% a mais devido aos juros altos
    economy.treasury += emergencyAmount;
    economy.publicDebt += emergencyAmount;
  }
  
  // Atualizar dívida total
  const remainingDebt = debtContracts.reduce((sum, contract) => sum + contract.remainingValue, 0);
  economy.publicDebt = remainingDebt;
  
  return totalPayment;
}

/**
 * Função principal para aplicar todos os cálculos econômicos avançados
 * Esta é a função principal que integra todos os cálculos
 * @param {Object} economy - Estado econômico
 * @param {Array} debtContracts - Contratos de dívida (opcional)
 * @param {Object} options - Opções de processamento
 * @returns {Object} - Estado econômico atualizado
 */
export function applyAdvancedEconomicCalculations(economy, debtContracts = [], options = {}) {
  const {
    cycleType = 'regular', // 'regular', 'monthly', 'quarterly'
    cycleFactor = 1,
    skipGrowthCalculation = false
  } = options;
  
  // ===== CÁLCULOS BÁSICOS A CADA CICLO =====
  
  // 1. Calcular nova inflação
  economy.inflation = calculateDynamicInflation(economy);
  
  // 2. Calcular novo desemprego
  economy.unemployment = calculateDynamicUnemployment(economy);
  
  // 3. Calcular nova popularidade
  economy.popularity = calculateDynamicPopularity(economy);
  
  // 4. Atualizar rating de crédito
  economy.creditRating = calculateCreditRating(economy);
  
  // ===== CÁLCULOS TRIMESTRAIS =====
  if (cycleType === 'quarterly' && !skipGrowthCalculation) {
    // 5. Calcular novo crescimento
    const newGrowthRate = calculateAdvancedGrowth(economy);
    economy.gdpGrowth = newGrowthRate * 100; // Converter para percentual
    
    // 6. Aplicar crescimento ao PIB
    economy.gdp *= (1 + newGrowthRate);
    
    // 7. Atualizar PIB anterior do trimestre
    economy._lastQuarterGdp = economy.gdp;
  }
  
  // ===== PROCESSAMENTO DE DÍVIDAS =====
  if (debtContracts.length > 0 && cycleFactor > 0) {
    processDeptPayments(economy, debtContracts, cycleFactor);
  }
  
  // ===== RECEITAS E GASTOS DO TESOURO =====
  if (cycleFactor > 0) {
    // Receitas proporcionais
    const revenue = economy.gdp * (economy.taxBurden / 100) * 0.01 * cycleFactor;
    
    // Gastos proporcionais
    const expenses = economy.gdp * (economy.publicServices / 100) * 0.008 * cycleFactor;
    
    economy.treasury += revenue - expenses;
    
    // Garantir que tesouro não fique muito negativo
    if (economy.treasury < -economy.gdp * 0.1) {
      economy.treasury = -economy.gdp * 0.1;
    }
  }
  
  // ===== EFEITOS DA INFLAÇÃO NO PIB =====
  if (economy.inflation > 0.1) { // Inflação acima de 10%
    const excess = economy.inflation - 0.1;
    const penaltyFactor = 1 - (excess * 0.01 * (cycleFactor || 1));
    economy.gdp *= Math.max(0.999, penaltyFactor);
  }
  
  return economy;
}

/**
 * Função utilitária para limitar valores com tendência de retorno
 * @param {number} value - Valor atual
 * @param {number} min - Limite mínimo
 * @param {number} max - Limite máximo
 * @param {number} target - Valor alvo para o qual o sistema tende a retornar
 * @returns {number} - Valor limitado com tendência
 */
export function limitWithCurve(value, min, max, target) {
  if (value < min) value = min;
  if (value > max) value = max;
  
  const distanceFromTarget = Math.abs(value - target);
  
  if (value > target) {
    const correctionFactor = 1 - Math.min(0.2, distanceFromTarget * 0.01);
    return value * correctionFactor + target * (1 - correctionFactor);
  } else if (value < target) {
    const correctionFactor = 1 - Math.min(0.2, distanceFromTarget * 0.01);
    return value * correctionFactor + target * (1 - correctionFactor);
  }
  
  return value;
}

/**
 * Calcula média móvel para históricos
 * @param {Array<number>} history - Array de valores históricos
 * @returns {number} - Média móvel
 */
export function calculateMovingAverage(history) {
  if (history.length === 0) return 0;
  return history.reduce((a, b) => a + b, 0) / history.length;
}

/**
 * Função para resetar indicadores irreais (chamada na inicialização)
 * @param {Object} economy - Estado econômico
 * @returns {Object} - Estado econômico corrigido
 */
export function resetUnrealisticIndicators(economy) {
  // Inflação travada em 0
  if (economy.inflation === 0 || economy.inflation === undefined) {
    economy.inflation = ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION;
  }
  
  // Desemprego muito baixo
  if (economy.unemployment < 5 || economy.unemployment === undefined) {
    economy.unemployment = 12.5; // Valor mais realista
  }
  
  // Popularidade artificialmente baixa
  if (economy.popularity < 20 || economy.popularity === undefined) {
    economy.popularity = ECONOMIC_CONSTANTS.IDEAL_POPULARITY; // Começar neutro
  }
  
  // Crescimento indefinido
  if (economy.gdpGrowth === undefined) {
    economy.gdpGrowth = 2.5; // 2.5% crescimento inicial
  }
  
  // Históricos vazios
  if (!economy.historicoPIB || economy.historicoPIB.length === 0) {
    economy.historicoPIB = [economy.gdp || 100];
  }
  
  if (!economy.historicoInflacao || economy.historicoInflacao.length === 0) {
    economy.historicoInflacao = [economy.inflation];
  }
  
  if (!economy.historicoPopularidade || economy.historicoPopularidade.length === 0) {
    economy.historicoPopularidade = [economy.popularity];
  }
  
  if (!economy.historicoDesemprego || economy.historicoDesemprego.length === 0) {
    economy.historicoDesemprego = [economy.unemployment];
  }
  
  // Históricos avançados
  if (!economy._historicGdp || economy._historicGdp.length === 0) {
    economy._historicGdp = [economy.gdp || 100];
  }
  
  if (!economy._historicInflation || economy._historicInflation.length === 0) {
    economy._historicInflation = [economy.inflation];
  }
  
  if (!economy._historicPopularity || economy._historicPopularity.length === 0) {
    economy._historicPopularity = [economy.popularity];
  }
  
  if (!economy._historicUnemployment || economy._historicUnemployment.length === 0) {
    economy._historicUnemployment = [economy.unemployment];
  }
  
  return economy;
}

/**
 * Função de debug para mostrar status dos cálculos avançados
 * @param {string} countryName - Nome do país
 * @param {Object} economy - Estado econômico
 */
export function debugAdvancedEconomicCalculations(countryName, economy) {
  console.log(`[ADVANCED-ECON] ${countryName} Status:`, {
    // Indicadores principais
    gdp: economy.gdp.toFixed(2),
    growth: `${(economy.gdpGrowth || 0).toFixed(2)}%`,
    inflation: `${(economy.inflation * 100).toFixed(2)}%`,
    unemployment: `${economy.unemployment.toFixed(1)}%`,
    popularity: `${economy.popularity.toFixed(1)}%`,
    rating: economy.creditRating,
    
    // Ciclos e controles
    cycles: economy._cycleCount || 0,
    interestRate: `${economy.interestRate}%`,
    taxBurden: `${economy.taxBurden}%`,
    publicServices: `${economy.publicServices}%`,
    
    // Financeiro
    treasury: economy.treasury.toFixed(2),
    debt: economy.publicDebt.toFixed(2),
    debtRatio: `${((economy.publicDebt / economy.gdp) * 100).toFixed(1)}%`,
    
    // Setorial
    sectors: `C:${economy.commodities}% M:${economy.manufactures}% S:${economy.services}%`,
    balances: `CB:${(economy.commoditiesBalance || 0).toFixed(1)} MB:${(economy.manufacturesBalance || 0).toFixed(1)}`,
    
    // Históricos
    historyLengths: {
      inflation: economy._historicInflation?.length || 0,
      unemployment: economy._historicUnemployment?.length || 0,
      popularity: economy._historicPopularity?.length || 0,
      gdp: economy._historicGdp?.length || 0
    }
  });
}

/**
 * Função para validar a integridade dos cálculos econômicos
 * @param {Object} economy - Estado econômico
 * @returns {Object} - Resultado da validação
 */
export function validateEconomicCalculations(economy) {
  const errors = [];
  const warnings = [];
  
  // Validar valores numéricos
  const numericFields = ['gdp', 'inflation', 'unemployment', 'popularity', 'gdpGrowth'];
  numericFields.forEach(field => {
    if (!isFinite(economy[field]) || isNaN(economy[field])) {
      errors.push(`Invalid ${field}: ${economy[field]}`);
    }
  });
  
  // Validar ranges
  if (economy.inflation < -0.05 || economy.inflation > 0.5) {
    warnings.push(`Inflation out of realistic range: ${(economy.inflation * 100).toFixed(2)}%`);
  }
  
  if (economy.unemployment < 0 || economy.unemployment > 50) {
    warnings.push(`Unemployment out of realistic range: ${economy.unemployment.toFixed(1)}%`);
  }
  
  if (economy.popularity < 0 || economy.popularity > 100) {
    warnings.push(`Popularity out of realistic range: ${economy.popularity.toFixed(1)}%`);
  }
  
  // Validar setores
  if (economy.commodities !== undefined && economy.manufactures !== undefined && economy.services !== undefined) {
    const sectorSum = economy.commodities + economy.manufactures + economy.services;
    if (Math.abs(sectorSum - 100) > 1) {
      errors.push(`Sectors don't sum to 100%: ${sectorSum.toFixed(1)}%`);
    }
  }
  
  // Validar históricos
  const historyFields = ['_historicInflation', '_historicUnemployment', '_historicPopularity', '_historicGdp'];
  historyFields.forEach(field => {
    if (economy[field] && (!Array.isArray(economy[field]) || economy[field].length === 0)) {
      warnings.push(`Invalid history for ${field}`);
    }
    if (economy[field] && economy[field].length > 25) {
      warnings.push(`History too long for ${field}: ${economy[field].length} entries`);
    }
  });
  
  // Validar rating de crédito
  const validRatings = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
  if (!validRatings.includes(economy.creditRating)) {
    errors.push(`Invalid credit rating: ${economy.creditRating}`);
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    score: Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5))
  };
}

/**
 * Função para aplicar variação setorial dinâmica
 * @param {Object} economy - Estado econômico
 * @returns {Object} - Estado econômico com setores atualizados
 */
export function applySectoralVariation(economy) {
  // Se não existem setores base, salvar os atuais como base
  if (!economy._servicesBase) {
    economy._servicesBase = economy.services;
    economy._commoditiesBase = economy.commodities;
    economy._manufacturesBase = economy.manufactures;
  }
  
  // Gerar variações aleatórias pequenas (±1 por ciclo mensal)
  const commoditiesVariation = Math.floor(Math.random() * 3) - 1; // -1, 0, ou 1
  const manufacturesVariation = Math.floor(Math.random() * 3) - 1;
  
  // Aplicar variações aos setores
  let newCommodities = economy.commodities + commoditiesVariation;
  let newManufactures = economy.manufactures + manufacturesVariation;
  let newServices = 100 - newCommodities - newManufactures;
  
  // Garantir limites mínimos e máximos para cada setor (20-50%)
  newCommodities = Math.max(20, Math.min(50, newCommodities));
  newManufactures = Math.max(20, Math.min(50, newManufactures));
  newServices = Math.max(20, Math.min(50, newServices));
  
  // Rebalancear para garantir soma = 100%
  const currentTotal = newCommodities + newManufactures + newServices;
  newCommodities = (newCommodities / currentTotal) * 100;
  newManufactures = (newManufactures / currentTotal) * 100;
  newServices = (newServices / currentTotal) * 100;
  
  // Aplicar força de retorno aos valores base (evita deriva excessiva)
  const returnForce = 0.02; // 2% de força de retorno por ciclo
  newCommodities = newCommodities * (1 - returnForce) + economy._commoditiesBase * returnForce;
  newManufactures = newManufactures * (1 - returnForce) + economy._manufacturesBase * returnForce;
  newServices = newServices * (1 - returnForce) + economy._servicesBase * returnForce;
  
  // Rebalancear novamente após força de retorno
  const finalTotal = newCommodities + newManufactures + newServices;
  economy.commodities = Math.round((newCommodities / finalTotal) * 100);
  economy.manufactures = Math.round((newManufactures / finalTotal) * 100);
  economy.services = 100 - economy.commodities - economy.manufactures;
  
  return economy;
}

/**
 * Função para calcular prêmio de risco baseado no rating
 * @param {string} creditRating - Rating de crédito
 * @param {number} debtToGdpRatio - Relação dívida/PIB
 * @returns {number} - Prêmio de risco em pontos percentuais
 */
export function calculateRiskPremium(creditRating, debtToGdpRatio) {
  const riskPremiums = {
    "AAA": 0.0,
    "AA": 0.5,
    "A": 1.0,
    "BBB": 2.0,
    "BB": 3.5,
    "B": 5.0,
    "CCC": 8.0,
    "CC": 12.0,
    "C": 18.0,
    "D": 25.0
  };
  
  let premium = riskPremiums[creditRating] || 5.0;
  
  // Prêmio adicional pela alta dívida
  if (debtToGdpRatio > 0.6) {
    premium += (debtToGdpRatio - 0.6) * 20;
  }
  
  return premium;
}

export default {
  calculateAdvancedGrowth,
  calculateDynamicInflation,
  calculateDynamicUnemployment,
  calculateDynamicPopularity,
  calculateCreditRating,
  processDeptPayments,
  applyAdvancedEconomicCalculations,
  limitWithCurve,
  calculateMovingAverage,
  resetUnrealisticIndicators,
  debugAdvancedEconomicCalculations,
  validateEconomicCalculations,
  applySectoralVariation,
  calculateRiskPremium,
  getNumericValue,
  formatCurrency,
  formatPercent,
  formatValueWithSign
};