/**
 * Handlers relacionados à autenticação de usuários
 */

const { getUsernameFromSocketId } = require('../../utils/gameStateUtils');

/**
 * Configura os eventos relacionados à autenticação
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupAuthHandlers(io, socket, gameState) {
  console.log('Auth handlers inicializados');
  
  // Evento de autenticação
  socket.on('authenticate', (username) => {
    // Valida o nome de usuário
    if (!username || typeof username !== 'string' || username.trim() === '') {
      socket.emit('error', 'Nome de usuário inválido');
      return;
    }
    
    // Limita o tamanho do nome de usuário
    if (username.length > 30) {
      socket.emit('error', 'Nome de usuário muito longo (máximo 30 caracteres)');
      return;
    }
    
    // Verifica se o nome de usuário já está em uso por um socket conectado
    let isUsernameInUse = false;
    for (const [socketId, existingUsername] of gameState.socketIdToUsername.entries()) {
      if (existingUsername === username && socketId !== socket.id) {
        // Verifica se o socket ainda está conectado
        const existingSocket = io.sockets.sockets.get(socketId);
        if (existingSocket && existingSocket.connected) {
          isUsernameInUse = true;
          break;
        }
      }
    }
    
    if (isUsernameInUse) {
      socket.emit('error', 'Este nome de usuário já está em uso');
      return;
    }
    
    console.log(`Usuário ${username} autenticado`);
    socket.username = username;
    
    // Associa o socketId ao username
    gameState.socketIdToUsername.set(socket.id, username);
    
    // Não marca o usuário como online aqui - isso será feito quando entrar em uma sala
    
    socket.emit('authenticated', { 
      success: true,
      username: username
    });
    
    // Envia lista de salas após autenticação
    const roomsList = Array.from(gameState.rooms.entries()).map(([name, room]) => ({
      name,
      owner: room.owner,
      playerCount: room.players ? room.players.length : 0,
      createdAt: room.createdAt
    }));
    
    socket.emit('roomsList', roomsList);
    
    // Envia lista de jogadores online
    socket.emit('onlinePlayersList', Array.from(gameState.onlinePlayers));
  });
  
  // Verificar se o nome de usuário está disponível
  socket.on('checkUsernameAvailable', (username) => {
    // Valida o nome de usuário
    if (!username || typeof username !== 'string' || username.trim() === '') {
      socket.emit('usernameAvailability', { 
        available: false,
        message: 'Nome de usuário inválido' 
      });
      return;
    }
    
    // Limita o tamanho do nome de usuário
    if (username.length > 30) {
      socket.emit('usernameAvailability', { 
        available: false,
        message: 'Nome de usuário muito longo (máximo 30 caracteres)' 
      });
      return;
    }
    
    // Verifica se o nome de usuário já está em uso por um socket conectado
    let isUsernameInUse = false;
    for (const [socketId, existingUsername] of gameState.socketIdToUsername.entries()) {
      if (existingUsername === username && socketId !== socket.id) {
        // Verifica se o socket ainda está conectado
        const existingSocket = io.sockets.sockets.get(socketId);
        if (existingSocket && existingSocket.connected) {
          isUsernameInUse = true;
          break;
        }
      }
    }
    
    if (isUsernameInUse) {
      socket.emit('usernameAvailability', { 
        available: false,
        message: 'Este nome de usuário já está em uso' 
      });
    } else {
      socket.emit('usernameAvailability', { 
        available: true,
        message: 'Nome de usuário disponível' 
      });
    }
  });
  
  // Alterar nome de usuário
  socket.on('changeUsername', (newUsername) => {
    const currentUsername = socket.username;
    
    // Valida o novo nome de usuário
    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim() === '') {
      socket.emit('error', 'Novo nome de usuário inválido');
      return;
    }
    
    // Limita o tamanho do nome de usuário
    if (newUsername.length > 30) {
      socket.emit('error', 'Nome de usuário muito longo (máximo 30 caracteres)');
      return;
    }
    
    // Verifica se o nome de usuário já está em uso
    let isUsernameInUse = false;
    for (const [socketId, existingUsername] of gameState.socketIdToUsername.entries()) {
      if (existingUsername === newUsername && socketId !== socket.id) {
        // Verifica se o socket ainda está conectado
        const existingSocket = io.sockets.sockets.get(socketId);
        if (existingSocket && existingSocket.connected) {
          isUsernameInUse = true;
          break;
        }
      }
    }
    
    if (isUsernameInUse) {
      socket.emit('error', 'Este nome de usuário já está em uso');
      return;
    }
    
    // Se o usuário não estava autenticado anteriormente
    if (!currentUsername) {
      socket.username = newUsername;
      gameState.socketIdToUsername.set(socket.id, newUsername);
      
      socket.emit('usernameChanged', {
        oldUsername: null,
        newUsername: newUsername
      });
      
      return;
    }
    
    // Atualiza o nome de usuário
    socket.username = newUsername;
    gameState.socketIdToUsername.set(socket.id, newUsername);
    
    // Atualiza o nome de usuário em todas as salas em que o jogador está
    for (const [roomName, room] of gameState.rooms.entries()) {
      if (room.players) {
        const playerIndex = room.players.findIndex(player => {
          if (typeof player === 'object') {
            return player.username === currentUsername;
          }
          return false;
        });
        
        if (playerIndex !== -1) {
          // Atualiza o nome de usuário no objeto do jogador
          if (typeof room.players[playerIndex] === 'object') {
            room.players[playerIndex].username = newUsername;
          }
          
          // Se o jogador era o dono da sala, atualiza o dono
          if (room.owner === currentUsername) {
            room.owner = newUsername;
          }
          
          // Notifica todos na sala sobre a mudança
          io.to(roomName).emit('usernameChanged', {
            oldUsername: currentUsername,
            newUsername: newUsername
          });
        }
      }
    }
    
    // Atualiza o status online
    if (gameState.onlinePlayers.has(currentUsername)) {
      gameState.onlinePlayers.delete(currentUsername);
      gameState.onlinePlayers.add(newUsername);
      
      // Notifica todos sobre o status
      io.emit('playerOnlineStatus', { username: currentUsername, isOnline: false });
      io.emit('playerOnlineStatus', { username: newUsername, isOnline: true });
    }
    
    // Transfere o país atribuído para o novo nome de usuário
    for (const [key, value] of gameState.userRoomCountries.entries()) {
      if (key.startsWith(`${currentUsername}:`)) {
        const roomName = key.split(':')[1];
        const newKey = `${newUsername}:${roomName}`;
        gameState.userRoomCountries.set(newKey, value);
        gameState.userRoomCountries.delete(key);
      }
    }
    
    // Transfere o estado do jogador para o novo nome de usuário
    for (const [key, value] of gameState.playerStates.entries()) {
      if (key.startsWith(`${currentUsername}:`)) {
        const roomName = key.split(':')[1];
        const newKey = `${newUsername}:${roomName}`;
        gameState.playerStates.set(newKey, value);
        gameState.playerStates.delete(key);
      }
    }
    
    // Transfere a associação de usuário para sala
    if (gameState.userToRoom.has(currentUsername)) {
      const roomName = gameState.userToRoom.get(currentUsername);
      gameState.userToRoom.set(newUsername, roomName);
      gameState.userToRoom.delete(currentUsername);
    }
    
    console.log(`Usuário ${currentUsername} mudou o nome para ${newUsername}`);
    
    // Confirma a mudança para o cliente
    socket.emit('usernameChanged', {
      oldUsername: currentUsername,
      newUsername: newUsername
    });
  });
  
  // Evento de desconexão
  socket.on('disconnect', () => {
    const username = getUsernameFromSocketId(gameState, socket.id);
    
    if (username) {
      console.log(`Usuário ${username} desconectado`);
      
      // Remove usuário da lista de online
      gameState.onlinePlayers.delete(username);
      
      // Atualiza status online em todas as salas
      for (const [roomName, room] of gameState.rooms.entries()) {
        if (room.players) {
          const playerIndex = room.players.findIndex(player => {
            if (typeof player === 'object') {
              return player.username === username;
            }
            return false;
          });
          
          if (playerIndex !== -1) {
            // Marca o jogador como offline
            if (typeof room.players[playerIndex] === 'object') {
              room.players[playerIndex].isOnline = false;
            }
            
            // Notifica todos na sala
            io.to(roomName).emit('playerOnlineStatus', { 
              username, 
              isOnline: false 
            });
          }
        }
      }
      
      // Notifica todos sobre o status offline
      io.emit('playerOnlineStatus', { username, isOnline: false });
      
      // Remove do mapeamento de socketIdToUsername
      gameState.socketIdToUsername.delete(socket.id);
    }
  });
}

module.exports = { setupAuthHandlers };