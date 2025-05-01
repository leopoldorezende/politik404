const redis = require('../../shared/redisClient');
const { calcularProximoEstadoEconomico } = require('./economyUtils');

/**
 * Handlers de eventos econômicos recebidos via socket.
 * @param {Object} io - Instância do Socket.IO
 * @param {Object} socket - Conexão atual
 * @param {Object} gameState - Estado global do jogo
 */
function setupEconomyHandlers(io, socket, gameState) {
  console.log('Economy handlers inicializados');

  socket.on('getEconomyData', () => {
    const username = socket.username;
    const roomName = gameState.userToRoom.get(username);
    if (!roomName) return;

    const playerKey = `${username}:${roomName}`;
    const state = gameState.playerStates.get(playerKey);
    if (!state || !state.economy) return;

    socket.emit('economyData', state.economy);
  });

  socket.on('adjustInterestRate', async (value) => {
    applyEconomicPolicyChange(socket, gameState, 'interestRate', value);
  });

  socket.on('adjustTaxBurden', async (value) => {
    applyEconomicPolicyChange(socket, gameState, 'taxRate', value);
  });

  socket.on('adjustPublicServices', async (value) => {
    applyEconomicPolicyChange(socket, gameState, 'publicServices', value);
  });

  socket.on('createEconomicEvent', async (event) => {
    // Apenas para admins/testes
    const username = socket.username;
    const roomName = gameState.userToRoom.get(username);
    if (!roomName) return;

    const playerKey = `${username}:${roomName}`;
    const state = gameState.playerStates.get(playerKey);
    if (!state) return;

    if (!state.economicEvents) state.economicEvents = [];
    state.economicEvents.push(event);

    io.to(roomName).emit('economicEvent', event);
    persistEconomyState(roomName, gameState);
  });
}

/**
 * Aplica uma mudança de política econômica (juros, impostos, serviços).
 */
function applyEconomicPolicyChange(socket, gameState, policyKey, value) {
  const username = socket.username;
  const roomName = gameState.userToRoom.get(username);
  if (!roomName) return;

  const playerKey = `${username}:${roomName}`;
  const state = gameState.playerStates.get(playerKey);
  if (!state || !state.economy) return;

  // Atualiza a política
  state.economy[policyKey] = value;

  // Recalcula o novo estado econômico
  const novoEstado = calcularProximoEstadoEconomico(state.economy);
  state.economy = { ...state.economy, ...novoEstado };

  // Envia para o jogador o novo estado
  socket.emit('economyUpdated', state.economy);

  // Notifica a sala inteira
  socket.to(roomName).emit('economyUpdated', state.economy);

  // Persiste no Redis
  persistEconomyState(roomName, gameState);
}

/**
 * Persiste o estado econômico da sala no Redis.
 */
async function persistEconomyState(roomName, gameState) {
  const economySnapshot = {};

  for (const [key, value] of gameState.playerStates.entries()) {
    if (key.endsWith(`:${roomName}`) && value.economy) {
      economySnapshot[key] = value.economy;
    }
  }

  await redis.set(`economy:${roomName}`, JSON.stringify(economySnapshot));
}

module.exports = { setupEconomyHandlers };