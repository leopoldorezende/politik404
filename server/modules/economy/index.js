/**
 * index.js (Corrigido)
 * Entry point for the economy module - DELEGADO para countryStateManager
 */

import { setupEconomyHandlers } from './economyHandlers.js';
import { 
  setupPeriodicTradeUpdates, 
  createTradeAgreement, 
  cancelTradeAgreement
} from './tradeAgreementService.js';

// Export funcionalidades centralizadas
export {
  // Main socket handler setup
  setupEconomyHandlers,
  
  // Trade agreement services (mantidos pois gerenciam agreements, não economia)
  setupPeriodicTradeUpdates,
  createTradeAgreement,
  cancelTradeAgreement
};