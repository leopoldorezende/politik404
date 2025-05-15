/**
 * roomExpirationManager.js
 * Gerencia a expiração automática de salas
 */

import redis from '../../shared/redisClient.js';

// Map para armazenar timeouts de expiração de salas
const roomExpirationTimeouts = new Map();

/**
 * Inicia o timeout de expiração para uma sala
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {number} expiresAt - Timestamp de expiração da sala
 */
function scheduleRoomExpiration(io, gameState, roomName, expiresAt) {
  // Cancela timeout existente se houver
  if (roomExpirationTimeouts.has(roomName)) {
    clearTimeout(roomExpirationTimeouts.get(roomName));
  }
  
  const now = Date.now();
  const timeUntilExpiration = expiresAt - now;
  
  // Se a sala já expirou, inicia contagem de 60 segundos imediatamente
  const delay = timeUntilExpiration <= 0 ? 0 : timeUntilExpiration;
  
  console.log(`Agendando expiração da sala ${roomName} em ${delay/1000} segundos`);
  
  // Agenda a execução da função de expiração
  const timeoutId = setTimeout(() => {
    startRoomDeletionCountdown(io, gameState, roomName);
  }, delay);
  
  roomExpirationTimeouts.set(roomName, timeoutId);
}

/**
 * Inicia a contagem regressiva de 60 segundos antes de deletar a sala
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 */
function startRoomDeletionCountdown(io, gameState, roomName) {
  console.log(`Iniciando contagem de 60 segundos para deletar sala ${roomName}`);
  
  // Verifica se a sala ainda existe
  const room = gameState.rooms.get(roomName);
  if (!room) {
    console.log(`Sala ${roomName} já foi removida`);
    roomExpirationTimeouts.delete(roomName);
    return;
  }
  
  // Agenda a remoção da sala em 60 segundos
  const deletionTimeoutId = setTimeout(() => {
    deleteExpiredRoom(io, gameState, roomName);
  }, 60000); // 60 segundos
  
  // Atualiza o timeout no Map
  roomExpirationTimeouts.set(roomName, deletionTimeoutId);
}

/**
 * Salva o estado das salas no Redis
 * @param {Object} gameState - Estado global do jogo
 */
async function saveRoomsToRedis(gameState) {
  try {
    await redis.set('rooms', JSON.stringify(Object.fromEntries(gameState.rooms)));
    console.log('Salas atualizadas no Redis com sucesso');
  } catch (error) {
    console.error('Erro ao salvar salas no Redis:', error);
  }
}

/**
 * Remove uma sala expirada
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 */
async function deleteExpiredRoom(io, gameState, roomName) {
  console.log(`Removendo sala expirada: ${roomName}`);
  
  const room = gameState.rooms.get(roomName);
  if (!room) {
    console.log(`Sala ${roomName} já foi removida`);
    roomExpirationTimeouts.delete(roomName);
    return;
  }
  
  // Notifica todos os jogadores na sala que ela foi removida
  io.to(roomName).emit('roomDeleted', {
    name: roomName,
    message: 'Esta partida expirou e foi removida automaticamente.',
    reason: 'expired'
  });
  
  // Remove todos os jogadores da sala
  const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
  if (socketsInRoom) {
    for (const socketId of socketsInRoom) {
      const clientSocket = io.sockets.sockets.get(socketId);
      if (clientSocket) {
        clientSocket.leave(roomName);
        
        // Remove associação usuário-sala
        const clientUsername = clientSocket.username;
        if (clientUsername) {
          gameState.userToRoom.delete(clientUsername);
        }
      }
    }
  }
  
  // Limpa todos os dados relacionados à sala usando as funções que já existem no gameState
  cleanupExpiredRoomData(gameState, roomName);
  
  // Remove o timeout do Map
  roomExpirationTimeouts.delete(roomName);
  
  // NOVO: Salva o estado atualizado das salas no Redis
  await saveRoomsToRedis(gameState);
  
  console.log(`Sala ${roomName} removida com sucesso (incluindo Redis)`);
  
  // Atualiza a lista de salas para todos os clientes
  sendUpdatedRoomsList(io, gameState);
}

/**
 * Limpa dados de uma sala expirada (versão independente)
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 */
function cleanupExpiredRoomData(gameState, roomName) {
  // Remove a sala
  gameState.rooms.delete(roomName);
  
  // Remove estados dos países para esta sala
  if (global.countryStateManager) {
    global.countryStateManager.removeRoom(roomName);
    console.log(`Removed country states for room ${roomName}`);
  }
  
  // Limpa associações de usuário para esta sala
  for (const [key, value] of gameState.userRoomCountries.entries()) {
    if (key.includes(`:${roomName}`)) {
      gameState.userRoomCountries.delete(key);
    }
  }
  
  // Limpa estados de jogador para esta sala
  for (const [key, value] of gameState.playerStates.entries()) {
    if (key.includes(`:${roomName}`)) {
      gameState.playerStates.delete(key);
    }
  }
  
  // Limpa navios nesta sala (se existirem)
  for (const [shipId, ship] of gameState.ships.entries()) {
    if (ship.roomName === roomName) {
      gameState.ships.delete(shipId);
    }
  }
}

/**
 * Envia lista atualizada de salas para todos os clientes (versão independente)
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 */
function sendUpdatedRoomsList(io, gameState) {
  const roomsList = Array.from(gameState.rooms.entries()).map(([name, room]) => ({
    name,
    owner: room.owner,
    playerCount: room.players.length,
    createdAt: room.createdAt,
    duration: room.duration,
    createdTimestamp: room.createdTimestamp,
    expiresAt: room.expiresAt
  }));
  
  io.emit('roomsList', roomsList);
}

/**
 * Cancela o timeout de expiração de uma sala
 * @param {string} roomName - Nome da sala
 */
function cancelRoomExpiration(roomName) {
  if (roomExpirationTimeouts.has(roomName)) {
    clearTimeout(roomExpirationTimeouts.get(roomName));
    roomExpirationTimeouts.delete(roomName);
    console.log(`Cancelado timeout de expiração para sala ${roomName}`);
  }
}

/**
 * Verifica e agenda expiração para todas as salas existentes
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 */
function initializeExistingRoomsExpiration(io, gameState) {
  console.log('Inicializando timers de expiração para salas existentes...');
  
  for (const [roomName, room] of gameState.rooms.entries()) {
    if (room.expiresAt) {
      scheduleRoomExpiration(io, gameState, roomName, room.expiresAt);
    }
  }
  
  console.log(`Inicializados ${roomExpirationTimeouts.size} timers de expiração`);
}

/**
 * Limpa todos os timeouts de expiração
 */
function cleanup() {
  console.log('Limpando todos os timeouts de expiração de salas...');
  
  for (const [roomName, timeoutId] of roomExpirationTimeouts.entries()) {
    clearTimeout(timeoutId);
  }
  
  roomExpirationTimeouts.clear();
  console.log('Cleanup de timeouts de expiração concluído');
}

export {
  scheduleRoomExpiration,
  cancelRoomExpiration,
  initializeExistingRoomsExpiration,
  cleanup
};