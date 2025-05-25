/**
 * index.js (Simplificado)
 * Entry point para sistema de gerenciamento de estado de países
 */

// Core modules
import CountryStateCore from './countryStateCore.js';
import CountryEconomyCalculator from './countryEconomyCalculator.js';
import CountryStateUpdater from './countryStateUpdater.js';

// Main manager (singleton)
import countryStateManager from './countryStateManager.js';

// Configuration
import CONFIG from './countryStateConfig.js';

// ======================================================================
// MODULE EXPORTS
// ======================================================================

// Individual modules
export {
  CountryStateCore,
  CountryEconomyCalculator,
  CountryStateUpdater
};

// Configuration
export { CONFIG };

// Main manager
export { countryStateManager };
export default countryStateManager;

// ======================================================================
// INITIALIZATION
// ======================================================================

// Auto-initialize in non-test environments
if (process.env.NODE_ENV !== 'test') {
  countryStateManager.initialize().catch(error => {
    console.error('Auto-initialization failed:', error);
  });
}

// ======================================================================
// GRACEFUL SHUTDOWN
// ======================================================================

if (typeof process !== 'undefined') {
  const cleanup = () => {
    console.log('Country state system shutting down...');
    try {
      countryStateManager.cleanup();
      console.log('Country state system shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('beforeExit', cleanup);
}