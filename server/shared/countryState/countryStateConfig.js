/**
 * countryStateConfig.js
 * Configuration constants and settings for country state management
 * Centralizes all configurable parameters for easy maintenance
 */

import { SYNC_CONFIG } from '../config/syncConfig.js';

// ======================================================================
// TIMING CONFIGURATIONS
// ======================================================================

export const TIMING_CONFIG = {
  // Update intervals 
  ECONOMIC_UPDATE_INTERVAL: SYNC_CONFIG.MASTER_CYCLE,    // 2000ms
  REDIS_SAVE_INTERVAL: SYNC_CONFIG.USER_CLEANUP_INTERVAL, // 60000ms (a cada 30 ciclos)
  
  // Logging intervals 
  LOG_INTERVAL: 60000,                  // 1 minute between detailed logs
  TRADE_LOG_INTERVAL: 60000,            // 1 minute between trade logs
  
  // Update cycle frequencies 
  SECTORAL_UPDATE_FREQUENCY: 6,         // Every 6 cycles (12 seconds)
  NEEDS_UPDATE_FREQUENCY: 3,            // Every 3 cycles (6 seconds)
  STATISTICS_LOG_FREQUENCY: 60,         // Every 60 cycles (2 minutes)
};

// ======================================================================
// ECONOMIC CALCULATION PARAMETERS
// ======================================================================

export const ECONOMIC_CONFIG = {
  // GDP Growth parameters
  GDP_GROWTH_BASE_RATE: 0.02,          // 2% base growth rate
  EMPLOYMENT_GROWTH_FACTOR: 1000000,    // Factor for employment-based growth
  
  // Sectoral distribution limits
  SECTOR_MIN_PERCENTAGE: 15,            // Minimum percentage for any sector
  SECTOR_MAX_PERCENTAGE: 50,            // Maximum percentage for any sector
  
  // Sectoral variation ranges
  SECTOR_VARIATION_RANGE: 1,            // ±1 percentage point variation
  NEEDS_VARIATION_RANGE: 0.2,           // ±0.2 percentage point variation
  
  // Internal needs bounds
  COMMODITIES_NEEDS_MIN: 10,            // Minimum commodities needs (% of GDP)
  COMMODITIES_NEEDS_MAX: 50,            // Maximum commodities needs (% of GDP)
  MANUFACTURES_NEEDS_MIN: 20,           // Minimum manufactures needs (% of GDP)
  MANUFACTURES_NEEDS_MAX: 70,           // Maximum manufactures needs (% of GDP)
  
  // Trade impact calculations
  TRADE_BALANCE_PRECISION: 2,           // Decimal places for trade balance calculations
};

// ======================================================================
// DEFAULT INDICATOR VALUES
// ======================================================================

export const DEFAULT_INDICATORS = {
  // Economy indicators
  economy: {
    gdp: { value: 100, unit: 'bi USD' },
    treasury: { value: 10, unit: 'bi USD' },
    
    // Sectoral distribution (percentages)
    services: { value: 35, unit: '%' },
    commodities: { value: 35, unit: '%' },
    manufactures: { value: 30, unit: '%' },
    
    // Sectoral output (absolute values) - calculated dynamically
    servicesOutput: { value: 0, unit: 'bi USD' },
    commoditiesOutput: { value: 0, unit: 'bi USD' },
    manufacturesOutput: { value: 0, unit: 'bi USD' },
    
    // Internal needs (percentages and absolute values)
    commoditiesNeeds: { value: 30, percentValue: 30, unit: 'bi USD' },
    manufacturesNeeds: { value: 45, percentValue: 45, unit: 'bi USD' },
    
    // Trade balances (calculated dynamically)
    commoditiesBalance: { value: 0, unit: 'bi USD' },
    manufacturesBalance: { value: 0, unit: 'bi USD' },
    
    // Trade statistics (calculated dynamically)
    tradeStats: {
      commodityImports: 0,
      commodityExports: 0,
      manufactureImports: 0,
      manufactureExports: 0
    }
  },
  
  // Defense indicators
  defense: {
    navy: 20,       // Navy strength percentage
    army: 20,       // Army strength percentage
    airforce: 20,   // Air force strength percentage
  },
  
  // Commerce indicators
  commerce: {
    exports: 15,    // Exports percentage
    imports: 15,    // Imports percentage
  },
  
  // Politics indicators
  politics: {
    parliament: 50,   // Parliamentary support percentage
    media: 50,        // Media support percentage
    opposition: 25,   // Opposition strength percentage
  }
};

// ======================================================================
// REDIS CONFIGURATION
// ======================================================================

export const REDIS_CONFIG = {
  // Redis keys
  COUNTRY_STATES_KEY: 'country_states',
  BACKUP_KEY_PREFIX: 'country_states_backup_',
  
  // Backup settings
  BACKUP_RETENTION_DAYS: 7,             // Keep backups for 7 days
  BACKUP_INTERVAL_HOURS: 24,            // Create backup every 24 hours
  
  // Connection settings
  CONNECTION_TIMEOUT: 5000,             // 5 seconds connection timeout
  RETRY_ATTEMPTS: 3,                    // Number of retry attempts
  RETRY_DELAY: 1000,                    // 1 second delay between retries
};

// ======================================================================
// LOGGING CONFIGURATION
// ======================================================================

export const LOGGING_CONFIG = {
  // Log levels
  LEVEL: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  },
  
  // Current log level (can be overridden by environment variable)
  CURRENT_LEVEL: process.env.COUNTRY_STATE_LOG_LEVEL || 2,
  
  // Log message formats
  FORMATS: {
    ECONOMY_UPDATE: '[ECONOMY] Country {country} in room {room}: {message}',
    TRADE_UPDATE: '[TRADE] {message}',
    SYSTEM_UPDATE: '[SYSTEM] {message}',
    ERROR_FORMAT: '[ERROR] {module}: {message}',
  },
  
  // Log filtering
  EXCLUDE_FREQUENT_LOGS: true,          // Filter out frequent repetitive logs
  MAX_LOGS_PER_MINUTE: 10,              // Maximum logs per minute for same type
};

// ======================================================================
// PERFORMANCE CONFIGURATION
// ======================================================================

export const PERFORMANCE_CONFIG = {
  // Batch processing
  BATCH_SIZE: 50,                       // Number of countries to process in one batch
  BATCH_DELAY: 10,                      // Delay between batches (milliseconds)
  
  // Memory management
  MAX_HISTORY_SIZE: 20,                 // Maximum historical data points to keep
  CLEANUP_INTERVAL: 300000,             // 5 minutes between cleanup operations
  
  // Calculation optimizations
  SKIP_CALCULATIONS_WHEN_INACTIVE: true, // Skip calculations for inactive rooms
  CACHE_STATIC_DATA: true,              // Cache static country data
  LAZY_LOAD_INDICATORS: false,          // Load indicators on demand
};

// ======================================================================
// VALIDATION CONFIGURATION
// ======================================================================

export const VALIDATION_CONFIG = {
  // Value ranges
  GDP_MIN: 0.1,                         // Minimum GDP value
  GDP_MAX: 10000,                       // Maximum GDP value
  TREASURY_MIN: -1000,                  // Minimum treasury value (can be negative)
  TREASURY_MAX: 10000,                  // Maximum treasury value
  
  // Percentage ranges
  PERCENTAGE_MIN: 0,                    // Minimum percentage value
  PERCENTAGE_MAX: 100,                  // Maximum percentage value
  
  // Trade agreement validation
  TRADE_VALUE_MIN: 0.1,                 // Minimum trade agreement value
  TRADE_VALUE_MAX: 1000,                // Maximum trade agreement value
  
  // Data integrity checks
  VALIDATE_SECTORAL_TOTALS: true,       // Ensure sectoral percentages sum to 100%
  VALIDATE_BALANCE_CALCULATIONS: true,  // Verify balance calculations
  STRICT_TYPE_CHECKING: false,          // Enable strict type validation
};

// ======================================================================
// FEATURE FLAGS
// ======================================================================

export const FEATURE_FLAGS = {
  // Economic features
  ENABLE_ADVANCED_CALCULATIONS: true,   // Use advanced economic calculations
  ENABLE_SECTORAL_VARIATIONS: true,    // Allow sectoral distribution changes
  ENABLE_TRADE_IMPACT: true,           // Apply trade agreement impacts
  
  // Update features
  ENABLE_PERIODIC_UPDATES: true,       // Enable automatic periodic updates
  ENABLE_MANUAL_UPDATES: true,         // Allow manual update triggers
  ENABLE_BATCH_UPDATES: false,         // Process updates in batches
  
  // Logging features
  ENABLE_DETAILED_LOGGING: true,       // Enable detailed operation logs
  ENABLE_PERFORMANCE_LOGGING: false,   // Log performance metrics
  ENABLE_DEBUG_LOGGING: false,         // Enable debug level logging
  
  // Backup features
  ENABLE_REDIS_BACKUPS: true,          // Create Redis backups
  ENABLE_FILE_BACKUPS: false,          // Create file system backups
  
  // Development features
  ENABLE_DEVELOPMENT_MODE: process.env.NODE_ENV === 'development',
  ENABLE_MOCK_DATA: false,             // Use mock data for testing
  ENABLE_PROFILING: false,             // Enable performance profiling
};

// ======================================================================
// ENVIRONMENT-SPECIFIC OVERRIDES
// ======================================================================

// Override configurations based on environment
if (process.env.NODE_ENV === 'production') {
  // Production optimizations
  TIMING_CONFIG.ECONOMIC_UPDATE_INTERVAL = 5000;  // Slower updates in production
  LOGGING_CONFIG.CURRENT_LEVEL = 1;               // Only warnings and errors
  FEATURE_FLAGS.ENABLE_DEBUG_LOGGING = false;
  FEATURE_FLAGS.ENABLE_PERFORMANCE_LOGGING = true;
} else if (process.env.NODE_ENV === 'development') {
  // Development settings
  TIMING_CONFIG.ECONOMIC_UPDATE_INTERVAL = 1000;  // Faster updates for development
  LOGGING_CONFIG.CURRENT_LEVEL = 3;               // All logs
  FEATURE_FLAGS.ENABLE_DEBUG_LOGGING = true;
} else if (process.env.NODE_ENV === 'test') {
  // Testing settings
  TIMING_CONFIG.ECONOMIC_UPDATE_INTERVAL = 100;   // Very fast updates for tests
  TIMING_CONFIG.REDIS_SAVE_INTERVAL = 1000;       // Frequent saves for tests
  LOGGING_CONFIG.CURRENT_LEVEL = 0;               // Only errors
  FEATURE_FLAGS.ENABLE_MOCK_DATA = true;
}

// ======================================================================
// UTILITY FUNCTIONS
// ======================================================================

/**
 * Get configuration value with fallback
 * @param {Object} config - Configuration object
 * @param {string} key - Configuration key
 * @param {any} defaultValue - Default value if key not found
 * @returns {any} - Configuration value or default
 */
export function getConfigValue(config, key, defaultValue) {
  return config[key] !== undefined ? config[key] : defaultValue;
}

/**
 * Validate configuration value against bounds
 * @param {number} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} - Validated value (clamped to bounds)
 */
export function validateConfigValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check if a feature flag is enabled
 * @param {string} flagName - Name of the feature flag
 * @returns {boolean} - True if feature is enabled
 */
export function isFeatureEnabled(flagName) {
  return FEATURE_FLAGS[flagName] === true;
}

/**
 * Get environment-specific configuration
 * @param {string} env - Environment name
 * @returns {Object} - Environment-specific configuration
 */
export function getEnvironmentConfig(env = process.env.NODE_ENV) {
  const configs = {
    production: {
      updateInterval: 5000,
      logLevel: 1,
      enableDebug: false
    },
    development: {
      updateInterval: 1000,
      logLevel: 3,
      enableDebug: true
    },
    test: {
      updateInterval: 100,
      logLevel: 0,
      enableDebug: false
    }
  };
  
  return configs[env] || configs.development;
}

// Export all configurations as a single object for convenience
export const CONFIG = {
  TIMING: TIMING_CONFIG,
  ECONOMIC: ECONOMIC_CONFIG,
  DEFAULT_INDICATORS,
  REDIS: REDIS_CONFIG,
  LOGGING: LOGGING_CONFIG,
  PERFORMANCE: PERFORMANCE_CONFIG,
  VALIDATION: VALIDATION_CONFIG,
  FEATURE_FLAGS,
  
  // Utility functions
  getConfigValue,
  validateConfigValue,
  isFeatureEnabled,
  getEnvironmentConfig
};

export default CONFIG;