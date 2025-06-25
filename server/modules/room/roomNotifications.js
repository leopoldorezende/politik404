/**
 * Handlers para notificações relacionadas a salas
 */

/**
 * Configura os handlers relacionados a notificações em salas
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupRoomNotifications(io, socket, gameState) {
  console.log('Room notifications inicializados');
}

/**
 * Envia lista atualizada de jogadores para todos na sala
 * @param {Object} io - Instância do Socket.io
 * @param {string} roomName - Nome da sala
 * @param {Object} gameState - Estado global do jogo
 */
function sendUpdatedPlayersList(io, roomName, gameState) {
  const room = gameState.rooms.get(roomName);
  if (!room) return;
  
  // Cria uma nova lista de jogadores com informações de status online
  const playersWithStatus = room.players.map(player => {
    // Extrai username do objeto player ou string
    let username;
    let country;
    
    if (typeof player === 'object') {
      username = player.username;
      country = player.country;
    } else if (typeof player === 'string') {
      const match = player.match(/^(.*?)\s*\((.*)\)$/);
      if (match) {
        username = match[1];
        country = match[2];
      } else {
        username = player;
      }
    }
    
    // Verifica se jogador está online
    const isOnline = gameState.onlinePlayers.has(username);
    
    // Retorna jogador com status online
    return {
      username,
      country,
      isOnline,
      id: typeof player === 'object' ? player.id : null
    };
  });
  
  // Envia lista atualizada para todos na sala
  io.to(roomName).emit('playersList', playersWithStatus);
}

/**
 * Envia lista atualizada de salas para todos os clientes
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

export { 
  setupRoomNotifications,
  sendUpdatedPlayersList,
  sendUpdatedRoomsList
};