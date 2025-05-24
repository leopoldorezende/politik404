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

// REMOVIDO: calculateTradeAgreementsImpact - agora está integrado no countryEconomyCalculator
// Evita duplicação e centraliza lógica no countryStateManager

// Export apenas funcionalidades que não estão duplicadas no countryStateManager
export {
  // Main socket handler setup
  setupEconomyHandlers,
  
  // Trade agreement services (mantidos pois gerenciam agreements, não economia)
  setupPeriodicTradeUpdates,
  createTradeAgreement,
  cancelTradeAgreement
};