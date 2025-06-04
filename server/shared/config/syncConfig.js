/**
 * syncConfig.js
 * Configuração central de sincronização para todos os ciclos do jogo
 */

export const SYNC_CONFIG = {
  MASTER_CYCLE: 500,
  
  // Economia
  get ECONOMY_UPDATE_INTERVAL() { return this.MASTER_CYCLE * 1 },
  get ECONOMY_BROADCAST_INTERVAL() { return this.MASTER_CYCLE * 1 },
  get ECONOMY_SAVE_INTERVAL() { return this.MASTER_CYCLE * 100 },

  // Offsets dentro do ciclo
  get TRADE_CALCULATION() { return this.MASTER_CYCLE / 10 },
  get BROADCAST() { return this.MASTER_CYCLE / 4 },
  get REDIS_SAVE() { return this.MASTER_CYCLE / 100 },
  
  // Ciclos múltiplos
  get TRADE_PROCESSING_INTERVAL() { return this.MASTER_CYCLE * 1.2 },
  get USER_CLEANUP_INTERVAL() { return this.MASTER_CYCLE * 40 },

  // CICLOS
  get MONTHLY_CYCLE() { return 10 },
  get QUARTERLY_CYCLE() { return 30 },
  
  get SAVE_INTERVAL() { return 10000 },
};

export default SYNC_CONFIG;