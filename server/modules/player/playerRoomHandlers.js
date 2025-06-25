/**
 * Gerencia entrada e saída de jogadores das salas
 */
import { sendUpdatedPlayersList, sendUpdatedRoomsList } from '../room/roomNotifications.js';
import { getCurrentRoom } from '../../shared/utils/gameStateUtils.js';

/**
 * Configura os handlers relacionados a entrada e saída de jogadores das salas
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupPlayerRoomHandlers(io, socket, gameState) {
  console.log('Player room handlers inicializados');
  
  // Sair da sala - versão simplificada
  socket.on('leaveRoom', (options = {}) => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Encontra a sala em que o jogador está
    let roomName = getCurrentRoom(socket, gameState);
    
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    
    // Marca o jogador como offline
    gameState.onlinePlayers.delete(username);
    
    // ✅ CORREÇÃO: Remove associação do usuário com a sala ANTES de modificar players
    gameState.userToRoom.delete(username);
    
    // Remove o player da lista (saída intencional)
    if (room.players) {
      const playerIndex = room.players.findIndex(player => {
        if (typeof player === 'object') {
          return player.username === username;
        }
        return false;
      });
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
      }
    }

    // Sai da sala do socket.io
    socket.leave(roomName);
    
    console.log(`${username} saiu da sala ${roomName}`);
    
    // Transferir propriedade da sala se necessário
    if (room.owner === username && room.players.length > 0) { 
      // Encontra o próximo jogador para se tornar dono (preferencialmente online)
      const onlinePlayer = room.players.find(player => {
        if (typeof player === 'object') {
          return player.isOnline;
        }
        return false;
      });
      
      if (onlinePlayer) {
        room.owner = onlinePlayer.username;
        console.log(`Propriedade da sala ${roomName} transferida para ${room.owner} (online)`);
      } else {
        // Se não há jogadores online, encontra qualquer outro jogador
        const anyPlayer = room.players.find(player => {
          if (typeof player === 'object') {
            return true;
          }
          return false;
        });
        
        if (anyPlayer) {
          room.owner = anyPlayer.username;
          console.log(`Propriedade da sala ${roomName} transferida para ${room.owner} (offline)`);
        } else {
          // Se não há outros jogadores, a sala será deletada automaticamente
          console.log(`Sala ${roomName} ficará sem dono`);
        }
      }
    }
    
    // Atualiza listas de jogadores para todos os clientes na sala
    sendUpdatedPlayersList(io, roomName, gameState);
    
    // Transmite status offline do jogador para todos os clientes
    io.emit('playerOnlineStatus', { username, isOnline: false });
    
    // Notifica o jogador que saiu
    socket.emit('roomLeft');
    
    // Se a sala ficou vazia, remove ela
    if (room.players.length === 0) { 
      console.log(`Sala ${roomName} vazia, será removida automaticamente pelo sistema de limpeza`);
    }
    
    // Atualiza lista de salas para todos os clientes
    sendUpdatedRoomsList(io, gameState);
  });
}

export { setupPlayerRoomHandlers };