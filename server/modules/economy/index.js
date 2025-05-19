/**
 * index.js
 * Entry point for the economy module - exports all related functionality
 */

import { setupEconomyHandlers } from './economyHandlers.js';
import { 
  setupPeriodicTradeUpdates, 
  createTradeAgreement, 
  cancelTradeAgreement, 
  updateCountryEconomyForTrade 
} from './tradeAgreementService.js';
import {
  updateCountryEconomiesWithTradeAgreement,
  calculateTradeAgreementsImpact
} from './economyUpdateService.js';
import {
  calculateGdpGrowth,
  issueDebtBonds,
  performEconomicCalculations
} from './economyCalculations.js';

// Export all functionality for easy access from other modules
export {
  // Main socket handler setup
  setupEconomyHandlers,
  
  // Trade agreement services
  setupPeriodicTradeUpdates,
  createTradeAgreement,
  cancelTradeAgreement,
  updateCountryEconomyForTrade,
  
  // Economy update services
  updateCountryEconomiesWithTradeAgreement,
  calculateTradeAgreementsImpact,
  
  // Economic calculations
  calculateGdpGrowth,
  issueDebtBonds,
  performEconomicCalculations
};