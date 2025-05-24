/**
 * index.js (Simplificado)
 * Entry point for the economy module - DELEGADO para countryStateManager
 */

import { setupEconomyHandlers } from './economyHandlers.js';
import { 
  setupPeriodicTradeUpdates, 
  createTradeAgreement, 
  cancelTradeAgreement
} from './tradeAgreementService.js';
import {
  calculateTradeAgreementsImpact
} from './economyUpdateService.js';

// Export apenas funcionalidades que não estão duplicadas no countryStateManager
export {
  // Main socket handler setup
  setupEconomyHandlers,
  
  // Trade agreement services (mantidos pois gerenciam agreements, não economia)
  setupPeriodicTradeUpdates,
  createTradeAgreement,
  cancelTradeAgreement,
  
  // Trade impact calculation (usado pelo countryStateManager)
  calculateTradeAgreementsImpact
};