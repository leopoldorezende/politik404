const { loadEconomyFromRedis, saveEconomyToRedis } = require('./economyUtils');
const { setupEconomyHandlers } = require('./economyHandlers');

let economicState = {
  treasury: 1000,
  gdp: 5000,
  gdpGrowth: 0.02,
  debt: 100,
  inflation: 0.03,
  unemployment: 0.07,
  interestRate: 0.05,
  taxRate: 0.3,
  publicServices: 0.5,
  lastUpdate: new Date().toISOString()
};

/**
 * Inicializa o sistema econômico, restaurando do Redis e configurando ciclo.
 * @param {Object} io - Instância do socket.io
 * @param {Object} gameState - Estado global do jogo
 */
async function initializeEconomySystem(io, gameState) {
  console.log('[ECONOMY] Inicializando sistema econômico...');

  // Carrega dados persistidos (se houver)
  const restored = await loadEconomyFromRedis();
  if (restored) {
    economicState = { ...economicState, ...restored };
    console.log('[ECONOMY] Estado econômico restaurado do Redis');
  }

  gameState.economy = economicState;

  // Ciclo automático de atualização (ex: a cada 15s)
  setInterval(async () => {
    updateEconomyState(gameState);
    io.emit('economyUpdated', gameState.economy);
    await saveEconomyToRedis(gameState.economy);
  }, 15000);

  console.log('[ECONOMY] Sistema econômico inicializado com sucesso!');
}

/**
 * Aplica mudanças no estado econômico com base em políticas.
 * @param {Object} economy - Estado econômico
 */
function updateEconomyState(economy) {
  // Simples modelo de crescimento, dívida e inflação
  economy.gdp *= 1 + economy.gdpGrowth;
  economy.debt += economy.treasury < 0 ? Math.abs(economy.treasury) : 0;
  economy.inflation *= 1 + (0.05 - economy.interestRate);

  economy.lastUpdate = new Date().toISOString();
}

module.exports = {
  initializeEconomySystem,
  updateEconomyState
};