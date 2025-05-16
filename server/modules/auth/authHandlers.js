/**
 * Handlers relacionados à autenticação de usuários
 */

import { getUsernameFromSocketId } from '../../shared/gameStateUtils.js';

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
    if (socket.username) {
      console.log(`Socket ${socket.id} já está autenticado como ${socket.username}, ignorando nova autenticação`);
      return;
    }
    
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
    let existingSocketId = null;
    
    for (const [socketId, existingUsername] of gameState.socketIdToUsername.entries()) {
      if (existingUsername === username && socketId !== socket.id) {
        // Verifica se o socket ainda está conectado
        const existingSocket = io.sockets.sockets.get(socketId);
        if (existingSocket && existingSocket.connected) {
          isUsernameInUse = true;
          existingSocketId = socketId;
          
          // Desconectar o socket anterior automaticamente
          console.log(`Desconectando socket anterior ${existingSocketId} para ${username}`);
          existingSocket.emit('forcedDisconnect', { 
            reason: 'Nova sessão iniciada',
            reconnect: false
          });
          existingSocket.disconnect(true);
          
          // Marcar para limpeza
          if (gameState.pendingSocketsRemoval) {
            gameState.pendingSocketsRemoval.add(existingSocketId);
          }
          break;
        } else {
          // Socket antigo não está mais conectado, remover do mapa
          gameState.socketIdToUsername.delete(socketId);
          if (gameState.usernameToSocketId && gameState.usernameToSocketId.get(username) === socketId) {
            gameState.usernameToSocketId.delete(username);
          }
          console.log(`Removendo socketId desconectado: ${socketId} para usuário ${existingUsername}`);
        }
      }
    }
    
    // Registrar o novo socket
    console.log(`Usuário ${username} autenticado com socket ${socket.id}`);
    socket.username = username;
    
    // Associa o socketId ao username
    gameState.socketIdToUsername.set(socket.id, username);
    
    // Associa o username ao socketId (mapeamento bidirecional)
    if (gameState.usernameToSocketId) {
      gameState.usernameToSocketId.set(username, socket.id);
    }
    
    // Atualiza o timestamp de atividade
    if (gameState.lastActivityTimestamp) {
      gameState.lastActivityTimestamp.set(username, Date.now());
    }
    
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
    
    // Marca o usuário como online
    gameState.onlinePlayers.add(username);
    
    // Se o usuário pertence a uma sala, rejunte automaticamente
    const existingRoom = gameState.userToRoom.get(username);
    if (existingRoom) {
      // Verificar se o usuário saiu intencionalmente da sala
      const userRoomKey = `${username}:${existingRoom}`;
      const playerState = gameState.playerStates.get(userRoomKey);
      
      // Se o usuário saiu intencionalmente, não reconectar automaticamente
      if (playerState && playerState.intentionalLeave === true) {
        console.log(`Usuário ${username} saiu intencionalmente da sala ${existingRoom}, não reconectando automaticamente`);
        
        // Remover a associação do usuário com a sala para evitar reconexão automática futura
        gameState.userToRoom.delete(username);
      } else {
        console.log(`Rejuntando automaticamente o usuário ${username} à sala ${existingRoom}`);
        socket.join(existingRoom);
        
        // Emite evento para restaurar o estado da sala
        const room = gameState.rooms.get(existingRoom);
        if (room) {
          socket.emit('roomJoined', room);
          
          // Emite o país atribuído ao usuário nesta sala
          const userRoomKey = `${username}:${existingRoom}`;
          const country = gameState.userRoomCountries.get(userRoomKey);
          
          if (country) {
            socket.emit('countryAssigned', country);
          }
          
          // Restaura estado do jogador
          const playerState = gameState.playerStates.get(userRoomKey);
          if (playerState) {
            socket.emit('stateRestored', playerState);
          }
          
          // Atualiza o status online para todos na sala
          const playerIndex = room.players.findIndex(player => {
            if (typeof player === 'object') {
              return player.username === username;
            }
            return false;
          });
          
          if (playerIndex !== -1) {
            // Marca o jogador como online
            if (typeof room.players[playerIndex] === 'object') {
              room.players[playerIndex].isOnline = true;
            }
            
            // Notifica todos na sala
            io.to(existingRoom).emit('playersList', room.players);
            io.to(existingRoom).emit('playerOnlineStatus', {
              username,
              isOnline: true
            });
          }
        }
      }
    }
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
    let existingSocketId = null;
    
    for (const [socketId, existingUsername] of gameState.socketIdToUsername.entries()) {
      if (existingUsername === username && socketId !== socket.id) {
        const existingSocket = io.sockets.sockets.get(socketId);
        if (existingSocket && existingSocket.connected) {
          // Ao invés de desconectar imediatamente, marcar para limpeza
          console.log(`Marcando socket anterior ${socketId} para limpeza para ${username}`);
          gameState.pendingSocketsRemoval.add(socketId);
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
      
      // Atualiza o mapeamento bidirecional
      if (gameState.usernameToSocketId) {
        gameState.usernameToSocketId.set(newUsername, socket.id);
      }
      
      socket.emit('usernameChanged', {
        oldUsername: null,
        newUsername: newUsername
      });
      
      return;
    }
    
    // Atualiza o nome de usuário
    socket.username = newUsername;
    gameState.socketIdToUsername.set(socket.id, newUsername);
    
    // Atualiza o mapeamento bidirecional
    if (gameState.usernameToSocketId) {
      gameState.usernameToSocketId.delete(currentUsername);
      gameState.usernameToSocketId.set(newUsername, socket.id);
    }
    
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
    
    // Atualiza o timestamp de atividade
    if (gameState.lastActivityTimestamp) {
      if (gameState.lastActivityTimestamp.has(currentUsername)) {
        const timestamp = gameState.lastActivityTimestamp.get(currentUsername);
        gameState.lastActivityTimestamp.set(newUsername, timestamp);
        gameState.lastActivityTimestamp.delete(currentUsername);
      } else {
        gameState.lastActivityTimestamp.set(newUsername, Date.now());
      }
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
            // ✅ CORREÇÃO: Apenas marca como offline, NÃO remove o player
            if (typeof room.players[playerIndex] === 'object') {
              room.players[playerIndex].isOnline = false;
            }
            
            console.log(`${username} marcado como offline na sala ${roomName}, país ${room.players[playerIndex].country} mantido`);
            
            // Notifica todos na sala sobre o status offline
            io.to(roomName).emit('playerOnlineStatus', { 
              username, 
              isOnline: false 
            });
            
            // ✅ IMPORTANTE: Enviar lista atualizada mantendo o player
            io.to(roomName).emit('playersList', room.players);
          }
        }
      }
      
      // Notifica todos sobre o status offline
      io.emit('playerOnlineStatus', { username, isOnline: false });
      
      // ✅ CORREÇÃO: NÃO deletar o mapeamento usuário-sala
      // Apenas remove o socket mapping se for o socket atual
      const currentSocketId = gameState.usernameToSocketId?.get(username);
      if (currentSocketId === socket.id) {
        gameState.socketIdToUsername.delete(socket.id);
        gameState.usernameToSocketId?.delete(username);
      } else {
        gameState.socketIdToUsername.delete(socket.id);
      }
    }
  });
}

export { setupAuthHandlers };