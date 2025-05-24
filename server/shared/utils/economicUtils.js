/**
 * economicUtils.js
 * Shared utility functions for economic calculations
 * Centralizes common functions to avoid duplication
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