/**
 * Handlers relacionados à gestão de salas
 */

const { getCurrentRoom } = require('../../utils/gameStateUtils');
const { setupRoomManagement } = require('./roomManagement');
const { setupRoomNotifications, sendUpdatedPlayersList, sendUpdatedRoomsList } = require('./roomNotifications');

/**
 * Configura todos os handlers relacionados a salas
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupRoomHandlers(io, socket, gameState) {
  console.log('Room handlers inicializados');
  
  // Configura os handlers específicos de gestão de salas e notificações
  setupRoomManagement(io, socket, gameState);
  setupRoomNotifications(io, socket, gameState);
  
  // Obter lista de salas
  socket.on('getRooms', () => {
    console.log('Enviando lista de salas');
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Entrar em uma sala (não associa país - isso é feito em countryAssignment.js)
  socket.on('joinRoomOnly', (roomName) => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Sala não existe');
      return;
    }
    
    // Adiciona o jogador à sala no Socket.io
    socket.join(roomName);
    
    // Marca o jogador como online
    gameState.onlinePlayers.add(username);
    
    // Associa o usuário à sala
    gameState.userToRoom.set(username, roomName);
    
    // Atualiza o status online
    io.emit('playerOnlineStatus', { username, isOnline: true });
    
    // Inicializa o histórico de chat se não existir
    if (!room.chatHistory) {
      room.chatHistory = {
        public: [],
        private: new Map()
      };
    }
    
    if (!room.players) {
      room.players = [];
    }
    
    // Adiciona o jogador à lista de jogadores se ainda não estiver lá
    const existingPlayerIndex = room.players.findIndex(player => {
      if (typeof player === 'object') {
        return player.username === username;
      }
      return false;
    });
    
    if (existingPlayerIndex === -1) {
      const playerObject = {
        username: username,
        id: socket.id,
        isOnline: true
      };
      room.players.push(playerObject);
    } else {
      // Atualiza o status online do jogador existente
      if (typeof room.players[existingPlayerIndex] === 'object') {
        room.players[existingPlayerIndex].isOnline = true;
        room.players[existingPlayerIndex].id = socket.id;
      }
    }
    
    console.log(`${username} entrou na sala ${roomName}`);
    
    // Envia informações da sala para o jogador
    socket.emit('roomJoined', {
      name: roomName,
      owner: room.owner,
      playerCount: room.players.length,
      createdAt: room.createdAt
    });
    
    // Atualiza a lista de jogadores para todos na sala
    sendUpdatedPlayersList(io, roomName, gameState);
    
    // Envia o histórico de mensagens públicas para o cliente
    socket.emit('chatHistory', { 
      type: 'public', 
      messages: room.chatHistory.public 
    });
  });
  
  // Sair da sala - marca o jogador como offline
  socket.on('leaveRoom', () => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Encontra a sala em que o jogador está
    const roomName = getCurrentRoom(socket, gameState);
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
        return player.startsWith(username);
      }
      return false;
    });
    
    // Atualiza o jogador para marcá-lo como offline
    if (playerIndex !== -1) {
      if (typeof room.players[playerIndex] === 'object') {
        room.players[playerIndex].isOnline = false;
      }
    }
    
    // Sai da sala do socket.io
    socket.leave(roomName);
    
    // Remove a associação do usuário com a sala
    gameState.userToRoom.delete(username);
    
    console.log(`${username} saiu da sala ${roomName} mas permanece na lista de jogadores como offline`);
    
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
  
  // Remove o jogador completamente de uma sala
  socket.on('leaveRoomCompletely', () => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Encontra a sala em que o jogador está
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    
    // Remove o jogador da lista de jogadores da sala
    if (room.players) {
      room.players = room.players.filter(player => {
        if (typeof player === 'object') {
          return player.username !== username;
        }
        if (typeof player === 'string') {
          return !player.startsWith(username);
        }
        return true;
      });
    }
    
    // Sai da sala do socket.io
    socket.leave(roomName);
    
    // Remove o usuário da lista de online
    gameState.onlinePlayers.delete(username);
    
    // Remove a associação do usuário com a sala
    gameState.userToRoom.delete(username);
    
    // Remove o país atribuído para este usuário nesta sala
    const userRoomKey = `${username}:${roomName}`;
    gameState.userRoomCountries.delete(userRoomKey);
    
    // Remove o estado do jogador para esta sala
    gameState.playerStates.delete(userRoomKey);
    
    // Remove os navios do jogador nesta sala
    for (const [shipId, ship] of gameState.ships.entries()) {
      if (ship.owner === username && ship.roomName === roomName) {
        gameState.ships.delete(shipId);
      }
    }
    
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

module.exports = { setupRoomHandlers };