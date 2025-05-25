/**
 * syncConfig.js
 * Configuração central de sincronização para todos os ciclos do jogo
 */

export const SYNC_CONFIG = {
  MASTER_CYCLE: 2000,
  
  // Offsets dentro do ciclo
  get TRADE_CALCULATION() { return this.MASTER_CYCLE / 10; },    // 200ms
  get BROADCAST() { return this.MASTER_CYCLE / 4; },             // 500ms  
  get REDIS_SAVE() { return this.MASTER_CYCLE / 1.2; },          // 1667ms
  
  // Ciclos múltiplos
  get TRADE_PROCESSING_INTERVAL() { return this.MASTER_CYCLE * 1.2; },  // 2400ms
  get USER_CLEANUP_INTERVAL() { return this.MASTER_CYCLE * 30; },       // 60000ms
};

export default SYNC_CONFIG;

// Manter compatibilidade com código existente
export const TIMING_CONFIG = {
  ECONOMIC_UPDATE_INTERVAL: SYNC_CONFIG.MASTER_CYCLE,
  REDIS_SAVE_INTERVAL: SYNC_CONFIG.MASTER_CYCLE * 30, // A cada 30 ciclos como especificado
  LOG_INTERVAL: 60000,
  TRADE_LOG_INTERVAL: 60000,
  SECTORAL_UPDATE_FREQUENCY: 6,
  NEEDS_UPDATE_FREQUENCY: 3,
  STATISTICS_LOG_FREQUENCY: 60,
};