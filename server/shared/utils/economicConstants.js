/**
 * economicConstants.js
 * Constantes econômicas centralizadas - FONTE ÚNICA DE VERDADE
 * Remove duplicações entre economyService.js e economicCalculations.js
 */

export const ECONOMIC_CONSTANTS = {
  // Taxas de equilíbrio
  EQUILIBRIUM_INTEREST_RATE: 8.0,
  EQUILIBRIUM_TAX_RATE: 40.0,
  EQUILIBRIUM_INFLATION: 0.04, // 4%
  IDEAL_UNEMPLOYMENT: 15.0,
  IDEAL_POPULARITY: 50.0,
  MAX_DEBT_TO_GDP_RATIO: 1.2,

  // Fatores de sensibilidade para cálculos avançados
  INFLATION_SENSITIVITY: 0.001,
  UNEMPLOYMENT_SENSITIVITY: 0.1,
  POPULARITY_SENSITIVITY: 0.5,
  GROWTH_SENSITIVITY: 0.0001,

  // Limites realistas
  MIN_INFLATION: -0.02, // -2%
  MAX_INFLATION: 0.18,  // 18%
  MIN_UNEMPLOYMENT: 3,   // 3%
  MAX_UNEMPLOYMENT: 40,  // 40%
  MIN_POPULARITY: 1,     // 1%
  MAX_POPULARITY: 99,    // 99%

  // Ciclos temporais
  MONTHLY_CYCLE: 60,    // 60 ciclos = 1 mês
  QUARTERLY_CYCLE: 180, // 180 ciclos = 1 trimestre
  
  // Fatores de inércia
  INFLATION_INERTIA: 0.8,
  UNEMPLOYMENT_INERTIA: 0.9,
  POPULARITY_INERTIA: 0.7,

  // Configurações de tempo e sistema
  UPDATE_INTERVAL: 500,
  SAVE_INTERVAL: 10000,
  MAX_HISTORY_SIZE: 20,

  // Limites setoriais
  MIN_SECTOR_PERCENT: 20,
  MAX_SECTOR_PERCENT: 50,

  // Sistema de dívidas
  DEBT_DURATION_YEARS: 10,
  DEBT_DURATION_MONTHS: 120,
};