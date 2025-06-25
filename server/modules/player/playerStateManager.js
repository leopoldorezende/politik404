/**
 * Gerenciamento básico do estado dos jogadores
 */
import { getCurrentRoom } from '../../shared/utils/gameStateUtils.js';

/**
 * Configura handlers básicos de estado dos jogadores
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupPlayerStateManager(io, socket, gameState) {
  console.log('Player state manager inicializado');
  
  // Solicita o estado atual do jogador
  socket.on('getState', () => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    const stateKey = `${username}:${roomName}`;
    const playerState = gameState.playerStates.get(stateKey);
    
    if (playerState) {
      socket.emit('stateRestored', playerState);
    } else {
      socket.emit('error', 'Estado não encontrado');
    }
  });

  // Evento de desconexão
  socket.on('disconnect', () => {
    const username = socket.username;
    if (username) {
      gameState.onlinePlayers.delete(username);
      io.emit('playerOnlineStatus', { username, isOnline: false });
      
      // Atualizar status nas salas
      for (const [roomName, room] of gameState.rooms.entries()) {
        if (room.players) {
          const playerIndex = room.players.findIndex(player => {
            return typeof player === 'object' && player.username === username;
          });
          
          if (playerIndex !== -1 && typeof room.players[playerIndex] === 'object') {
            room.players[playerIndex].isOnline = false;
            io.to(roomName).emit('playerOnlineStatus', { username, isOnline: false });
            io.to(roomName).emit('playersList', room.players);
          }
        }
      }
    }
  });
}

export { setupPlayerStateManager };