/**
 * countryStateConfig.js (Simplificado)
 * Configurações essenciais para gerenciamento de estado de países
 */

import { SYNC_CONFIG } from '../config/syncConfig.js';

// ======================================================================
// CONFIGURAÇÕES DE TIMING
// ======================================================================

export const TIMING_CONFIG = {
  ECONOMIC_UPDATE_INTERVAL: SYNC_CONFIG.MASTER_CYCLE,
  REDIS_SAVE_INTERVAL: SYNC_CONFIG.USER_CLEANUP_INTERVAL,
  LOG_INTERVAL: 60000,
  SECTORAL_UPDATE_FREQUENCY: 6,
  NEEDS_UPDATE_FREQUENCY: 3,
};

// ======================================================================
// PARÂMETROS ECONÔMICOS
// ======================================================================

export const ECONOMIC_CONFIG = {
  GDP_GROWTH_BASE_RATE: 0.02,
  SECTOR_MIN_PERCENTAGE: 15,
  SECTOR_MAX_PERCENTAGE: 50,
  SECTOR_VARIATION_RANGE: 1,
  COMMODITIES_NEEDS_MIN: 10,
  COMMODITIES_NEEDS_MAX: 50,
  MANUFACTURES_NEEDS_MIN: 20,
  MANUFACTURES_NEEDS_MAX: 70,
};

// ======================================================================
// INDICADORES PADRÃO
// ======================================================================

export const DEFAULT_INDICATORS = {
  economy: {
    gdp: { value: 100, unit: 'bi USD' },
    treasury: { value: 10, unit: 'bi USD' },
    services: { value: 35, unit: '%' },
    commodities: { value: 35, unit: '%' },
    manufactures: { value: 30, unit: '%' },
    servicesOutput: { value: 0, unit: 'bi USD' },
    commoditiesOutput: { value: 0, unit: 'bi USD' },
    manufacturesOutput: { value: 0, unit: 'bi USD' },
    commoditiesNeeds: { value: 30, percentValue: 30, unit: 'bi USD' },
    manufacturesNeeds: { value: 45, percentValue: 45, unit: 'bi USD' },
    commoditiesBalance: { value: 0, unit: 'bi USD' },
    manufacturesBalance: { value: 0, unit: 'bi USD' },
    tradeStats: {
      commodityImports: 0,
      commodityExports: 0,
      manufactureImports: 0,
      manufactureExports: 0
    }
  },
  defense: {
    navy: 20,
    army: 20,
    airforce: 20,
  },
  commerce: {
    exports: 15,
    imports: 15,
  },
  politics: {
    parliament: 50,
    media: 50,
    opposition: 25,
  }
};

// Configuração consolidada
export const CONFIG = {
  TIMING: TIMING_CONFIG,
  ECONOMIC: ECONOMIC_CONFIG,
  DEFAULT_INDICATORS
};

export default CONFIG;