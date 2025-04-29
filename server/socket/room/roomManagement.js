/**
 * Gerenciamento de salas
 */

const { 
  sendUpdatedRoomsList, 
  sendUpdatedPlayersList 
} = require('./roomNotifications');

/**
 * Configura os handlers relacionados ao gerenciamento de salas
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupRoomManagement(io, socket, gameState) {
  console.log('Room management inicializado');
  
  // Obter lista de salas
  socket.on('getRooms', () => {
    console.log('Enviando lista de salas');
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Criar sala
  socket.on('createRoom', (roomName) => {
    console.log(`Requisição para criar sala: ${roomName}`);
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    if (!roomName || typeof roomName !== 'string' || roomName.trim() === '') {
      socket.emit('error', 'Nome de sala inválido');
      return;
    }
    
    if (gameState.rooms.has(roomName)) {
      socket.emit('error', 'Sala com este nome já existe');
      return;
    }
    
    // Criar sala com estrutura padronizada usando a função auxiliar
    const newRoom = gameState.createRoom(roomName, username);
    
    // Armazena a sala no mapa de salas
    gameState.rooms.set(roomName, newRoom);
    console.log(`Sala "${roomName}" criada por ${username}`);
    
    // Notificar o cliente que criou a sala
    socket.emit('roomCreated', { name: roomName, success: true });
    
    // Atualizar lista de salas para todos os clientes conectados
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Excluir sala (apenas o dono pode excluir)
  socket.on('deleteRoom', (roomName) => {
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
    
    if (room.owner !== username) {
      socket.emit('error', 'Apenas o dono da sala pode excluí-la');
      return;
    }
    
    // Notificar todos os jogadores na sala
    io.to(roomName).emit('roomDeleted', { 
      name: roomName, 
      message: 'Esta sala foi removida pelo dono' 
    });
    
    // Remover todos os jogadores da sala
    const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
    if (socketsInRoom) {
      for (const socketId of socketsInRoom) {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket) {
          clientSocket.leave(roomName);
          // Remove a associação do usuário com a sala
          const clientUsername = clientSocket.username;
          if (clientUsername) {
            gameState.userToRoom.delete(clientUsername);
          }
        }
      }
    }
    
    // Limpar dados relacionados à sala
    cleanupRoomData(gameState, roomName);
    
    console.log(`Sala "${roomName}" excluída por ${username}`);
    
    // Atualizar lista de salas para todos
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Transferir propriedade da sala
  socket.on('transferOwnership', ({ roomName, newOwner }) => {
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
    
    if (room.owner !== username) {
      socket.emit('error', 'Apenas o dono da sala pode transferir a propriedade');
      return;
    }
    
    // Verificar se o novo dono está na sala
    const newOwnerExists = room.players.some(player => {
      if (typeof player === 'object') {
        return player.username === newOwner;
      }
      return false;
    });
    
    if (!newOwnerExists) {
      socket.emit('error', 'Usuário especificado não está na sala');
      return;
    }
    
    // Transferir propriedade
    room.owner = newOwner;
    
    // Notificar todos na sala
    io.to(roomName).emit('ownershipTransferred', {
      roomName,
      newOwner,
      previousOwner: username
    });
    
    console.log(`Propriedade da sala "${roomName}" transferida de ${username} para ${newOwner}`);
    
    // Atualizar lista de salas para todos
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Configurar sala
  socket.on('configureRoom', ({ roomName, settings }) => {
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
    
    if (room.owner !== username) {
      socket.emit('error', 'Apenas o dono da sala pode configurá-la');
      return;
    }
    
    // Validar as configurações
    if (!settings || typeof settings !== 'object') {
      socket.emit('error', 'Configurações inválidas');
      return;
    }
    
    // Aplicar configurações permitidas
    const allowedSettings = [
      'maxPlayers', 'isPrivate', 'password', 'description', 
      'gameMode', 'turnTime', 'visibleCountries'
    ];
    
    // Inicializa o objeto de configurações se não existir
    if (!room.settings) {
      room.settings = {};
    }
    
    // Aplica as configurações permitidas
    for (const setting of allowedSettings) {
      if (settings[setting] !== undefined) {
        // Valida configurações específicas
        if (setting === 'maxPlayers' && (
            !Number.isInteger(settings.maxPlayers) || 
            settings.maxPlayers < 2 || 
            settings.maxPlayers > 30)) {
          continue;
        }
        
        if (setting === 'turnTime' && (
            !Number.isInteger(settings.turnTime) || 
            settings.turnTime < 30 || 
            settings.turnTime > 3600)) {
          continue;
        }
        
        // Aplica a configuração
        room.settings[setting] = settings[setting];
      }
    }
    
    // Notificar todos na sala sobre as novas configurações
    io.to(roomName).emit('roomConfigurationUpdated', {
      roomName,
      settings: room.settings
    });
    
    console.log(`Configurações da sala "${roomName}" atualizadas por ${username}`);
    
    // Atualizar lista de salas para todos (para refletir mudanças como privacidade)
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Obter configurações da sala
  socket.on('getRoomSettings', (roomName) => {
    const room = gameState.rooms.get(roomName);
    
    if (!room) {
      socket.emit('error', 'Sala não existe');
      return;
    }
    
    // Retorna as configurações da sala (ou objeto vazio se não existirem)
    socket.emit('roomSettings', {
      roomName,
      settings: room.settings || {}
    });
  });
  
  // Banir jogador (apenas dono da sala)
  socket.on('banPlayer', ({ roomName, playerUsername }) => {
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
    
    if (room.owner !== username) {
      socket.emit('error', 'Apenas o dono da sala pode banir jogadores');
      return;
    }
    
    if (playerUsername === username) {
      socket.emit('error', 'Não é possível banir-se a si mesmo');
      return;
    }
    
    // Verificar se o jogador está na sala
    const playerIndex = room.players.findIndex(player => {
      if (typeof player === 'object') {
        return player.username === playerUsername;
      }
      return false;
    });
    
    if (playerIndex === -1) {
      socket.emit('error', 'Jogador não encontrado na sala');
      return;
    }
    
    // Remove o jogador da lista
    room.players.splice(playerIndex, 1);
    
    // Inicializa lista de banidos se não existir
    if (!room.bannedPlayers) {
      room.bannedPlayers = [];
    }
    
    // Adiciona o jogador à lista de banidos
    if (!room.bannedPlayers.includes(playerUsername)) {
      room.bannedPlayers.push(playerUsername);
    }
    
    // Encontra o socket do jogador banido
    let bannedPlayerSocketId = null;
    for (const [socketId, name] of gameState.socketIdToUsername.entries()) {
      if (name === playerUsername) {
        bannedPlayerSocketId = socketId;
        break;
      }
    }
    
    // Se o jogador estiver online, remove-o da sala
    if (bannedPlayerSocketId) {
      const bannedPlayerSocket = io.sockets.sockets.get(bannedPlayerSocketId);
      if (bannedPlayerSocket) {
        // Remove associação com a sala
        gameState.userToRoom.delete(playerUsername);
        
        // Remove da sala
        bannedPlayerSocket.leave(roomName);
        
        // Notifica o jogador
        bannedPlayerSocket.emit('banned', { 
          roomName, 
          message: `Você foi banido da sala ${roomName} pelo dono` 
        });
        
        // Emite evento de saída da sala
        bannedPlayerSocket.emit('roomLeft');
      }
    }
    
    // Limpa dados do jogador nessa sala
    const userRoomKey = `${playerUsername}:${roomName}`;
    gameState.userRoomCountries.delete(userRoomKey);
    gameState.playerStates.delete(userRoomKey);
    
    // Remove os navios do jogador nessa sala
    for (const [shipId, ship] of gameState.ships.entries()) {
      if (ship.owner === playerUsername && ship.roomName === roomName) {
        gameState.ships.delete(shipId);
      }
    }
    
    // Notifica todos na sala
    io.to(roomName).emit('playerBanned', {
      roomName,
      bannedPlayer: playerUsername,
      bannedBy: username
    });
    
    // Atualiza lista de jogadores para todos na sala
    sendUpdatedPlayersList(io, roomName, gameState);
    
    console.log(`Jogador ${playerUsername} banido da sala "${roomName}" por ${username}`);
  });
}

/**
 * Limpa todos os dados relacionados a uma sala
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala a ser limpa
 */
function cleanupRoomData(gameState, roomName) {
  // Remove a sala
  gameState.rooms.delete(roomName);
  
  // Remove países atribuídos para esta sala
  for (const [key, value] of gameState.userRoomCountries.entries()) {
    if (key.includes(`:${roomName}`)) {
      gameState.userRoomCountries.delete(key);
    }
  }
  
  // Remove estados de jogadores para esta sala
  for (const [key, value] of gameState.playerStates.entries()) {
    if (key.includes(`:${roomName}`)) {
      gameState.playerStates.delete(key);
    }
  }
  
  // Remove navios nesta sala
  for (const [shipId, ship] of gameState.ships.entries()) {
    if (ship.roomName === roomName) {
      gameState.ships.delete(shipId);
    }
  }
}

module.exports = { 
  setupRoomManagement,
  cleanupRoomData
};