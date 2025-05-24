/**
 * formatUtils.js
 * Shared formatting utilities for the frontend
 * Centralizes formatting functions to avoid duplication
 */

/**
 * Format currency value for display
 * @param {number} value - Numeric value
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (value, decimals = 1) => {
  if (value === undefined || value === null || isNaN(value)) return '0.0';
  return Number(value).toFixed(decimals);
};

/**
 * Format percentage value for display
 * @param {number} value - Numeric value
 * @returns {string} - Formatted percentage string
 */
export const formatPercent = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0.0%';
  return Number(value).toFixed(1) + '%';
};

/**
 * Format value with sign for display
 * @param {number} value - Numeric value
 * @returns {string} - Formatted value with sign
 */
export const formatValueWithSign = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0.0';
  const num = Number(value);
  return (num >= 0 ? '+' : '') + num.toFixed(1);
};

/**
 * Get credit rating color
 * @param {string} rating - Credit rating
 * @returns {string} - CSS color value
 */
export const getCreditRatingColor = (rating) => {
  if (['AAA', 'AA', 'A'].includes(rating)) return '#28a745';
  if (rating === 'BBB') return '#ffc107';
  if (['BB', 'B'].includes(rating)) return '#fd7e14';
  return '#dc3545';
};

/**
 * Extract numeric value from various property formats
 * @param {any} property - Property that can be number or object with value
 * @returns {number} - Numeric value
 */
export const getNumericValue = (property) => {
  if (property === undefined || property === null) return 0;
  if (typeof property === 'number') return property;
  if (typeof property === 'object' && property.value !== undefined) return property.value;
  return 0;
};