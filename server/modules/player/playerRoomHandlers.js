/**
 * Gerencia entrada e saída de jogadores das salas
 */

import { 
  sendUpdatedPlayersList, 
  sendUpdatedRoomsList 
} from '../room/roomNotifications.js';
import { getCurrentRoom } from '../../shared/gameStateUtils.js';

/**
 * Configura os handlers relacionados a entrada e saída de jogadores das salas
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupPlayerRoomHandlers(io, socket, gameState) {
  console.log('Player room handlers inicializados');
  
  // Sair da sala - MODIFICADO para manter o jogador na lista de jogadores mas marcá-lo como offline
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
    
    // Encontra o jogador na lista de jogadores da sala
    const playerIndex = room.players.findIndex(player => {
      if (typeof player === 'object') {
        return player.username === username;
      }
      if (typeof player === 'string') {
        return player.startsWith(username + ' ');
      }
      return false;
    });
    
    // Atualiza o jogador para marcá-lo como offline
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      if (typeof player === 'object') {
        player.isOnline = false;
      }
    }
    
    // Sai da sala do socket.io
    socket.leave(roomName);
    
    // *** CORREÇÃO IMPORTANTE: Remover a associação do usuário com a sala ***
    // Esta linha é crucial para evitar a reconexão automática
    gameState.userToRoom.delete(username);
    
    // Marcar no estado do jogador que a saída foi intencional
    const userRoomKey = `${username}:${roomName}`;
    
    // Obter ou criar o estado do jogador
    let playerState = gameState.playerStates.get(userRoomKey);
    if (!playerState) {
      playerState = {
        country: gameState.userRoomCountries.get(userRoomKey),
        customData: {}
      };
    }
    
    // Verificar se a saída foi intencional a partir do parâmetro recebido
    playerState.intentionalLeave = !!options.intentional;
    
    // Salvar o estado atualizado
    gameState.playerStates.set(userRoomKey, playerState);
    
    console.log(`${username} saiu da sala ${roomName} - Saída intencional: ${playerState.intentionalLeave}`);
    
    // Se o jogador era dono da sala e há outros jogadores, transfere a propriedade
    if (room.owner === username && room.players.length > 1) {
      // Encontra outro jogador online para se tornar o dono
      const onlinePlayers = room.players.filter(player => {
        if (typeof player === 'object') {
          return player.username !== username && player.isOnline;
        }
        return false;
      });
      
      if (onlinePlayers.length > 0) {
        room.owner = onlinePlayers[0].username;
        console.log(`Novo dono da sala ${roomName} é ${room.owner}`);
      } else {
        // Se não há jogadores online, encontra qualquer jogador
        const anyPlayer = room.players.find(player => {
          if (typeof player === 'object') {
            return player.username !== username;
          }
          return false;
        });
        
        if (anyPlayer) {
          room.owner = anyPlayer.username;
          console.log(`Novo dono da sala ${roomName} é ${room.owner} (offline)`);
        }
      }
    }
    
    // Atualiza listas de jogadores para todos os clientes na sala com status offline
    sendUpdatedPlayersList(io, roomName, gameState);
    
    // Transmite status offline do jogador para todos os clientes
    io.emit('playerOnlineStatus', { username, isOnline: false });
    
    // Notifica o jogador que saiu
    socket.emit('roomLeft');
    
    // Atualiza lista de salas para todos os clientes
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Remove o jogador completamente de uma sala (não apenas desconecta)
  socket.on('leaveRoomCompletely', () => {
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
    
    // Remove o jogador da lista de jogadores da sala
    const playerIndex = room.players.findIndex(player => {
      if (typeof player === 'object') {
        return player.username === username;
      }
      if (typeof player === 'string') {
        return player.startsWith(username + ' ');
      }
      return false;
    });
    
    if (playerIndex !== -1) {
      room.players.splice(playerIndex, 1);
    }
    
    // Sai da sala do socket.io
    socket.leave(roomName);
    
    // Remove o usuário da lista de online
    gameState.onlinePlayers.delete(username);
    
    // Remove o país atribuído para este usuário nesta sala
    const userRoomKey = `${username}:${roomName}`;
    gameState.userRoomCountries.delete(userRoomKey);
    
    // Remove o estado do jogador para esta sala
    gameState.playerStates.delete(userRoomKey);
    
    // *** CORREÇÃO IMPORTANTE: Remover a associação do usuário com a sala ***
    gameState.userToRoom.delete(username);
    
    console.log(`${username} removido completamente da sala ${roomName}`);
    
    // Se o jogador era o dono da sala e há outros jogadores, transfere a propriedade
    if (room.owner === username && room.players.length > 0) {
      // Transfere para o primeiro jogador online
      const onlinePlayers = room.players.filter(player => {
        if (typeof player === 'object') {
          return player.isOnline;
        }
        return false;
      });
      
      if (onlinePlayers.length > 0) {
        room.owner = onlinePlayers[0].username;
      } else if (room.players.length > 0) {
        // Se não há jogadores online, transfere para qualquer jogador
        if (typeof room.players[0] === 'object') {
          room.owner = room.players[0].username;
        }
      }
      
      console.log(`Novo dono da sala ${roomName} é ${room.owner}`);
    }
    
    // Se a sala ficou vazia, remove a sala
    if (room.players.length === 0) {
      console.log(`Sala ${roomName} removida por estar vazia`);
      gameState.rooms.delete(roomName);
    } else {
      // Atualiza lista de jogadores para todos na sala
      sendUpdatedPlayersList(io, roomName, gameState);
    }
    
    // Notifica o jogador que saiu
    socket.emit('roomLeft');
    
    // Atualiza lista de salas para todos
    sendUpdatedRoomsList(io, gameState);
  });
}

export { setupPlayerRoomHandlers };