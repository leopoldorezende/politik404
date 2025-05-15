/**
 * Handlers centralizados para gerenciamento de jogadores
 * ARQUIVO SIMPLIFICADO - Remove delegação desnecessária
 */

/**
 * Configura todos os handlers relacionados a jogadores
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupPlayerHandlers(io, socket, gameState) {
  console.log('Player handlers inicializados');
  
  // Inicializa o conjunto de jogadores online se não existir
  if (!gameState.onlinePlayers) {
    gameState.onlinePlayers = new Set();
  }
  
  // Evento de desconexão para marcar o jogador como offline
  socket.on('disconnect', () => {
    const username = socket.username;
    if (username) {
      // Remover da lista de jogadores online
      gameState.onlinePlayers.delete(username);
      
      // Notificar todos os clientes conectados que este jogador está offline
      io.emit('playerOnlineStatus', { username, isOnline: false });
      
      console.log(`Jogador ${username} está offline. Jogadores online:`, [...gameState.onlinePlayers]);
      
      // Atualizar o status nos cômodos
      for (const [roomName, room] of gameState.rooms.entries()) {
        if (room.players) {
          const playerIndex = room.players.findIndex(player => {
            if (typeof player === 'object') {
              return player.username === username;
            }
            return false;
          });
          
          if (playerIndex !== -1) {
            if (typeof room.players[playerIndex] === 'object') {
              room.players[playerIndex].isOnline = false;
            }
            
            // Notificar atualizações de status para todos os clientes na sala
            io.to(roomName).emit('playerOnlineStatus', { username, isOnline: false });
            
            // Atualizar lista de jogadores na sala
            io.to(roomName).emit('playersList', room.players);
          }
        }
      }
    }
  });
}

export { setupPlayerHandlers };