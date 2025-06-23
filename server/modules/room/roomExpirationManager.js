/**
 * roomExpirationManager.js - ATUALIZADO para usar EconomyService
 * Gerencia a expiração automática de salas
 */

// Mapa para armazenar os timers de expiração
const roomExpirationTimers = new Map();

/**
 * Configura a expiração automática de uma sala
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {number} duration - Duração em milissegundos
 */
function setupRoomExpiration(io, gameState, roomName, duration) {
  // Limpar timer existente se houver
  if (roomExpirationTimers.has(roomName)) {
    clearTimeout(roomExpirationTimers.get(roomName));
  }
  
// Timer: Remover a sala 1 minuto APÓS o tempo oficial acabar
  const timer = setTimeout(() => {
    expireRoom(io, gameState, roomName);
  }, duration + 60000); // +1 minuto extra
  
  roomExpirationTimers.set(roomName, timer);
  
  console.log(`[EXPIRATION] Timer configurado para sala ${roomName}: ${duration / 60000} minutos`);
}

/**
 * Expira uma sala automaticamente
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala a expirar
 */
function expireRoom(io, gameState, roomName) {
  const room = gameState.rooms.get(roomName);
  
  if (!room) {
    console.log(`[EXPIRATION] Sala ${roomName} não encontrada para expiração`);
    return;
  }
  
  console.log(`[EXPIRATION] Expirando sala: ${roomName}`);
  
  // Notificar todos os jogadores na sala
  // io.to(roomName).emit('roomDeleted', {
  //   message: `A sala '${roomName}' expirou e foi removida automaticamente.`,
  //   reason: 'expired'
  // });
  
  // ===== CORREÇÃO: Usar economyService em vez de countryStateManager =====
  if (global.economyService) {
    global.economyService.removeRoom(roomName);
    console.log(`[EXPIRATION] Dados econômicos da sala ${roomName} removidos`);
  }
  // ===== FIM DA CORREÇÃO =====
  
  // Remover a sala do gameState
  gameState.rooms.delete(roomName);
  
  // Limpar o timer
  roomExpirationTimers.delete(roomName);
  
  // Atualizar lista de salas para todos os clientes
  const roomsList = Array.from(gameState.rooms.entries()).map(([name, rm]) => ({
    name,
    owner: rm.owner,
    playerCount: rm.players.length,
    createdAt: rm.createdAt,
    duration: rm.duration || 30 * 60000,
    expiresAt: rm.expiresAt || (Date.now() + 30 * 60000)
  }));
  
  io.emit('roomsList', roomsList);
}

/**
 * Cancela a expiração de uma sala (quando ela é deletada manualmente)
 * @param {string} roomName - Nome da sala
 */
function cancelRoomExpiration(roomName) {
  if (roomExpirationTimers.has(roomName)) {
    clearTimeout(roomExpirationTimers.get(roomName));
    roomExpirationTimers.delete(roomName);
    console.log(`[EXPIRATION] Timer cancelado para sala ${roomName}`);
  }
}

/**
 * Limpa todos os timers (para shutdown do servidor)
 */
function cleanup() {
  for (const [roomName, timer] of roomExpirationTimers.entries()) {
    clearTimeout(timer);
    console.log(`[EXPIRATION] Timer limpo para sala ${roomName}`);
  }
  roomExpirationTimers.clear();
  console.log('[EXPIRATION] Cleanup concluído');
}

export {
  setupRoomExpiration,
  expireRoom,
  cancelRoomExpiration,
  cleanup
};