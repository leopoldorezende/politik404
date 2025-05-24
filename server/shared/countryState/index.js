/**
 * index.js
 * Entry point for country state management system
 * Exports all modules and provides convenient access to the system
 */

// Core modules
import CountryStateCore from './countryStateCore.js';
import CountryEconomyCalculator from './countryEconomyCalculator.js';
import CountryStateUpdater from './countryStateUpdater.js';

// Main manager (singleton)
import countryStateManager from './countryStateManager.js';

// Configuration
import CONFIG, {
  TIMING_CONFIG,
  ECONOMIC_CONFIG,
  DEFAULT_INDICATORS,
  REDIS_CONFIG,
  LOGGING_CONFIG,
  PERFORMANCE_CONFIG,
  VALIDATION_CONFIG,
  FEATURE_FLAGS,
  getConfigValue,
  validateConfigValue,
  isFeatureEnabled,
  getEnvironmentConfig
} from './countryStateConfig.js';

// ======================================================================
// MODULE EXPORTS
// ======================================================================

// Individual modules (for advanced usage)
export {
  CountryStateCore,
  CountryEconomyCalculator,
  CountryStateUpdater
};

// Configuration exports
export {
  CONFIG,
  TIMING_CONFIG,
  ECONOMIC_CONFIG,
  DEFAULT_INDICATORS,
  REDIS_CONFIG,
  LOGGING_CONFIG,
  PERFORMANCE_CONFIG,
  VALIDATION_CONFIG,
  FEATURE_FLAGS,
  getConfigValue,
  validateConfigValue,
  isFeatureEnabled,
  getEnvironmentConfig
};

// Main manager (default export for backward compatibility)
export { countryStateManager };
export default countryStateManager;

// ======================================================================
// FACTORY FUNCTIONS
// ======================================================================

/**
 * Create a new CountryStateCore instance
 * @param {Object} options - Configuration options
 * @returns {CountryStateCore} - New core instance
 */
export function createCountryStateCore(options = {}) {
  const core = new CountryStateCore();
  
  // Apply any custom options
  if (options.redisKey) {
    core.redisKey = options.redisKey;
  }
  
  return core;
}

/**
 * Create a new CountryEconomyCalculator instance
 * @param {Object} options - Configuration options
 * @returns {CountryEconomyCalculator} - New calculator instance
 */
export function createCountryEconomyCalculator(options = {}) {
  const calculator = new CountryEconomyCalculator();
  
  // Apply any custom options
  if (options.logInterval) {
    calculator.logInterval = options.logInterval;
  }
  
  return calculator;
}

/**
 * Create a new CountryStateUpdater instance
 * @param {CountryStateCore} core - Core instance to use
 * @param {Object} options - Configuration options
 * @returns {CountryStateUpdater} - New updater instance
 */
export function createCountryStateUpdater(core, options = {}) {
  const updater = new CountryStateUpdater(core);
  
  // Apply any custom options and start if requested
  if (options.autoStart) {
    updater.startPeriodicUpdates(
      options.updateInterval || TIMING_CONFIG.ECONOMIC_UPDATE_INTERVAL,
      options.saveInterval || TIMING_CONFIG.REDIS_SAVE_INTERVAL
    );
  }
  
  return updater;
}

/**
 * Create a complete country state management system
 * @param {Object} options - Configuration options
 * @returns {Object} - Object containing all system components
 */
export function createCountryStateSystem(options = {}) {
  const core = createCountryStateCore(options.core);
  const calculator = createCountryEconomyCalculator(options.calculator);
  const updater = createCountryStateUpdater(core, options.updater);
  
  return {
    core,
    calculator,
    updater,
    
    // Convenience methods
    async initialize() {
      await core.initialize();
      if (options.autoStart !== false) {
        updater.startPeriodicUpdates();
      }
    },
    
    cleanup() {
      updater.cleanup();
      core.cleanup();
    },
    
    getStats() {
      return {
        ...updater.getUpdateStats(),
        totalRooms: core.getAllRooms().length,
        isInitialized: core.initialized
      };
    }
  };
}

// ======================================================================
// UTILITY FUNCTIONS
// ======================================================================

/**
 * Initialize the default country state manager with custom options
 * @param {Object} options - Initialization options
 * @returns {Promise} - Promise that resolves when initialization is complete
 */
export async function initializeCountryStateManager(options = {}) {
  if (countryStateManager.isInitialized()) {
    console.log('CountryStateManager already initialized');
    return countryStateManager;
  }
  
  try {
    await countryStateManager.initialize();
    
    // Apply custom timing if provided
    if (options.updateInterval || options.saveInterval) {
      countryStateManager.startPeriodicUpdates(
        options.updateInterval || TIMING_CONFIG.ECONOMIC_UPDATE_INTERVAL,
        options.saveInterval || TIMING_CONFIG.REDIS_SAVE_INTERVAL
      );
    }
    
    console.log('CountryStateManager initialized successfully with options:', options);
    return countryStateManager;
  } catch (error) {
    console.error('Failed to initialize CountryStateManager:', error);
    throw error;
  }
}

/**
 * Get system health status
 * @returns {Object} - Health status information
 */
export function getSystemHealth() {
  const stats = countryStateManager.getUpdateStats();
  const modules = countryStateManager.getModules();
  
  return {
    status: countryStateManager.isInitialized() ? 'healthy' : 'initializing',
    uptime: Date.now() - (global.countryStateStartTime || Date.now()),
    modules: {
      core: {
        initialized: modules.core.initialized,
        totalRooms: modules.core.getAllRooms().length
      },
      updater: {
        isUpdating: stats.isUpdating,
        isSaving: stats.isSaving,
        updateCounter: stats.updateCounter
      },
      calculator: {
        updateCounter: stats.economyCalculatorCounter
      }
    },
    configuration: {
      environment: process.env.NODE_ENV || 'development',
      updateInterval: TIMING_CONFIG.ECONOMIC_UPDATE_INTERVAL,
      saveInterval: TIMING_CONFIG.REDIS_SAVE_INTERVAL,
      featuresEnabled: Object.keys(FEATURE_FLAGS).filter(key => FEATURE_FLAGS[key])
    }
  };
}

/**
 * Perform system diagnostics
 * @returns {Object} - Diagnostic information
 */
export function runDiagnostics() {
  const health = getSystemHealth();
  const diagnostics = {
    ...health,
    tests: {}
  };
  
  // Test Redis connection
  try {
    diagnostics.tests.redis = {
      status: 'pass',
      message: 'Redis connection available'
    };
  } catch (error) {
    diagnostics.tests.redis = {
      status: 'fail',
      message: error.message
    };
  }
  
  // Test configuration validity
  try {
    const requiredConfigs = ['ECONOMIC_UPDATE_INTERVAL', 'REDIS_SAVE_INTERVAL'];
    const missingConfigs = requiredConfigs.filter(key => !TIMING_CONFIG[key]);
    
    if (missingConfigs.length === 0) {
      diagnostics.tests.configuration = {
        status: 'pass',
        message: 'All required configurations present'
      };
    } else {
      diagnostics.tests.configuration = {
        status: 'warn',
        message: `Missing configurations: ${missingConfigs.join(', ')}`
      };
    }
  } catch (error) {
    diagnostics.tests.configuration = {
      status: 'fail',
      message: error.message
    };
  }
  
  // Test module initialization
  try {
    const modules = countryStateManager.getModules();
    const uninitializedModules = [];
    
    if (!modules.core.initialized) uninitializedModules.push('core');
    if (!countryStateManager.isInitialized()) uninitializedModules.push('manager');
    
    if (uninitializedModules.length === 0) {
      diagnostics.tests.modules = {
        status: 'pass',
        message: 'All modules initialized'
      };
    } else {
      diagnostics.tests.modules = {
        status: 'fail',
        message: `Uninitialized modules: ${uninitializedModules.join(', ')}`
      };
    }
  } catch (error) {
    diagnostics.tests.modules = {
      status: 'fail',
      message: error.message
    };
  }
  
  return diagnostics;
}

/**
 * Get version information
 * @returns {Object} - Version information
 */
export function getVersionInfo() {
  return {
    version: '2.0.0', // Modular version
    components: {
      core: '1.0.0',
      calculator: '1.0.0',
      updater: '1.0.0',
      config: '1.0.0'
    },
    compatibility: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch
    },
    buildInfo: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }
  };
}

// ======================================================================
// INITIALIZATION
// ======================================================================

// Set global start time for uptime calculation
if (!global.countryStateStartTime) {
  global.countryStateStartTime = Date.now();
}

// Auto-initialize in non-test environments
if (process.env.NODE_ENV !== 'test' && isFeatureEnabled('ENABLE_AUTO_INITIALIZATION')) {
  initializeCountryStateManager().catch(error => {
    console.error('Auto-initialization failed:', error);
  });
}

// ======================================================================
// GRACEFUL SHUTDOWN
// ======================================================================

// Register cleanup handlers
if (typeof process !== 'undefined') {
  const cleanup = () => {
    console.log('Country state system shutting down...');
    try {
      countryStateManager.cleanup();
      console.log('Country state system shutdown complete');
    } catch (error) {
      console.error('Error during country state system shutdown:', error);
    }
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('beforeExit', cleanup);
}

// ======================================================================
// DEVELOPMENT HELPERS
// ======================================================================

// Development utilities (only functional in development mode)
export const DevUtils = process.env.NODE_ENV === 'development' ? {
  getSystemHealth,
  runDiagnostics,
  getVersionInfo,
  
  // Development-only functions
  forceUpdate: () => countryStateManager.performManualUpdate(),
  resetCounters: () => {
    const modules = countryStateManager.getModules();
    modules.updater.resetCounters();
  },
  
  // Direct module access (use with caution)
  getModules: () => countryStateManager.getModules(),
  
  // Configuration helpers
  overrideConfig: (configPath, value) => {
    const pathParts = configPath.split('.');
    let current = CONFIG;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]];
    }
    
    current[pathParts[pathParts.length - 1]] = value;
    console.log(`Configuration ${configPath} overridden to:`, value);
  }
} : {
  // Provide empty stubs in non-development environments
  getSystemHealth: () => ({ status: 'production', message: 'DevUtils disabled in production' }),
  runDiagnostics: () => ({ status: 'production', message: 'DevUtils disabled in production' }),
  getVersionInfo: () => ({ version: 'production', message: 'DevUtils disabled in production' }),
  forceUpdate: () => console.warn('DevUtils.forceUpdate() is disabled in production'),
  resetCounters: () => console.warn('DevUtils.resetCounters() is disabled in production'),
  getModules: () => console.warn('DevUtils.getModules() is disabled in production'),
  overrideConfig: () => console.warn('DevUtils.overrideConfig() is disabled in production')
};