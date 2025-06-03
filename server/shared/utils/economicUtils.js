/**
 * economicUtils.js - VERSÃO CONSOLIDADA
 * Remove duplicações entre economicUtils.js e economicCalculations.js
 * Mantém apenas UMA implementação de cada função utilitária
 */

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
 * Função utilitária para limitar valores com tendência de retorno
 * Baseada no sistema sofisticado dos arquivos anexados
 * @param {number} value - Valor atual
 * @param {number} min - Limite mínimo
 * @param {number} max - Limite máximo
 * @param {number} target - Valor alvo para o qual o sistema tende a retornar
 * @returns {number} - Valor limitado com tendência
 */
export function limitarComCurva(value, min, max, target) {
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
export function calcularMediaMovel(history) {
  if (history.length === 0) return 0;
  return history.reduce((a, b) => a + b, 0) / history.length;
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