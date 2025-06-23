/**
 * Utilitários para manipulação do estado global do jogo
 */

/**
 * Cria um objeto gameState padrão com todas as propriedades necessárias
 * @returns {Object} - Um novo objeto gameState inicializado
 */
function createDefaultGameState() {
  return {
    rooms: new Map(),
    socketIdToUsername: new Map(),
    usernameToSocketId: new Map(),
    userToRoom: new Map(),
    userRoomCountries: new Map(),
    playerStates: new Map(),
    ships: new Map(),
    onlinePlayers: new Set(),
    lastActivityTimestamp: new Map(),
    pendingSocketsRemoval: new Set(),
    displayNames: new Map(),
    socketToSessionId: new Map(),
    sessionIdToUsername: new Map(),
    countriesData: {},
    MAX_CHAT_HISTORY: 100,
    
    // Função auxiliar para criar uma sala
    createRoom: function(name, owner) {
      return {
        name,
        owner,
        players: [],
        eligibleCountries: [],
        chatHistory: {
          public: [],
          private: new Map()
        },
        createdAt: new Date().toISOString()
      };
    },
    
    // Função auxiliar para gerar chave para chat privado
    getPrivateChatKey: function(user1, user2) {
      return [user1, user2].sort().join(':');
    }
  };
}

/**
 * Inicializa as estruturas de dados necessárias no gameState
 * @param {Object} gameState - Estado global do jogo
 */
function initializeGameState(gameState) {
  // Se o gameState não for fornecido, retorna um novo
  if (!gameState) {
    return createDefaultGameState();
  }
  
  // Inicializa mapas básicos
  if (!gameState.socketIdToUsername) gameState.socketIdToUsername = new Map();
  if (!gameState.usernameToSocketId) gameState.usernameToSocketId = new Map();
  if (!gameState.userToRoom) gameState.userToRoom = new Map();
  if (!gameState.userRoomCountries) gameState.userRoomCountries = new Map();
  if (!gameState.playerStates) gameState.playerStates = new Map();
  if (!gameState.onlinePlayers) gameState.onlinePlayers = new Set();
  if (!gameState.lastActivityTimestamp) gameState.lastActivityTimestamp = new Map();
  if (!gameState.rooms) gameState.rooms = new Map();
  if (!gameState.ships) gameState.ships = new Map();
  if (!gameState.displayNames) gameState.displayNames = new Map();
  if (!gameState.socketToSessionId) gameState.socketToSessionId = new Map();
  if (!gameState.sessionIdToUsername) gameState.sessionIdToUsername = new Map();
  if (!gameState.pendingSocketsRemoval) gameState.pendingSocketsRemoval = new Set();
  
  // Inicializa constantes e funções se não existirem
  if (!gameState.MAX_CHAT_HISTORY) gameState.MAX_CHAT_HISTORY = 100;
  
  if (!gameState.getPrivateChatKey) {
    gameState.getPrivateChatKey = function(user1, user2) {
      return [user1, user2].sort().join(':');
    };
  }
  
  if (!gameState.createRoom) {
    gameState.createRoom = function(name, owner) {
      return {
        name,
        owner,
        players: [],
        eligibleCountries: [],
        chatHistory: {
          public: [],
          private: new Map()
        },
        createdAt: new Date().toISOString()
      };
    };
  }
  
  console.log('Estruturas de dados do gameState inicializadas');
  return gameState;
}

/**
 * Obtém o nome de usuário a partir do id do socket
 * @param {Object} gameState - Estado global do jogo
 * @param {string} socketId - ID do socket
 * @returns {string|null} - Nome do usuário ou null se não encontrado
 */
function getUsernameFromSocketId(gameState, socketId) {
  return gameState.socketIdToUsername.get(socketId) || null;
}

/**
 * Obtém o ID do socket a partir do nome de usuário
 * @param {Object} gameState - Estado global do jogo
 * @param {string} username - Nome do usuário
 * @returns {string|null} - ID do socket ou null se não encontrado
 */
function getSocketIdFromUsername(gameState, username) {
  return gameState.usernameToSocketId?.get(username) || null;
}

/**
 * Obtém a sala atual de um socket
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 * @returns {string|null} - Nome da sala ou null se não estiver em nenhuma sala
 */
function getCurrentRoom(socket, gameState) {
  // Primeiro, verifica no mapeamento de usuário para sala
  const username = socket.username || getUsernameFromSocketId(gameState, socket.id);
  if (username && gameState.userToRoom.has(username)) {
    return gameState.userToRoom.get(username);
  }
  
  // Verificação segura das salas do socket
  if (socket.rooms && typeof socket.rooms[Symbol.iterator] === 'function') {
    try {
      for (const room of socket.rooms) {
        if (room !== socket.id && gameState.rooms.has(room)) {
          // Atualiza o mapeamento para futuras verificações
          if (username) {
            gameState.userToRoom.set(username, room);
          }
          return room;
        }
      }
    } catch (error) {
      console.error('Error iterating socket.rooms:', error);
    }
  }
  
  // Fallback: busca nas salas do gameState
  if (username) {
    for (const [roomName, room] of gameState.rooms.entries()) {
      if (room.players && room.players.some(player => {
        if (typeof player === 'object') {
          return player.username === username;
        }
        return false;
      })) {
        // Atualiza o mapeamento
        gameState.userToRoom.set(username, roomName);
        return roomName;
      }
    }
  }
  
  return null;
}

/**
 * Verifica se um socket está realmente conectado
 * @param {Object} io - Instância do Socket.io
 * @param {string} socketId - ID do socket a verificar
 * @returns {boolean} - Verdadeiro se o socket estiver conectado
 */
function isSocketConnected(io, socketId) {
  if (!socketId) return false;
  
  const socket = io.sockets.sockets.get(socketId);
  return socket && socket.connected;
}

/**
 * Limpa sockets desconectados do gameState (versão simplificada)
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 */
function cleanupDisconnectedSockets(io, gameState) {
  let socketsRemoved = 0;
  
  // Processar sockets marcados para remoção
  for (const socketId of gameState.pendingSocketsRemoval) {
    const username = gameState.socketIdToUsername.get(socketId);
    
    if (username) {
      // Verificar se este é o socket mais recente para o usuário
      const currentSocketId = gameState.usernameToSocketId?.get(username);
      
      if (currentSocketId !== socketId || !isSocketConnected(io, socketId)) {
        // Remover socket antigo ou desconectado
        gameState.socketIdToUsername.delete(socketId);
        if (currentSocketId === socketId) {
          gameState.usernameToSocketId?.delete(username);
          gameState.onlinePlayers.delete(username);
        }
        socketsRemoved++;
        console.log(`Socket ${socketId} removido para usuário ${username}`);
      }
    } else {
      // Socket órfão, remover
      gameState.socketIdToUsername.delete(socketId);
      socketsRemoved++;
    }
  }
  
  // Limpar lista de pendentes
  gameState.pendingSocketsRemoval.clear();
  
  // Verificar sockets não conectados no mapeamento principal
  for (const [socketId, username] of gameState.socketIdToUsername.entries()) {
    if (!isSocketConnected(io, socketId)) {
      gameState.pendingSocketsRemoval.add(socketId);
    }
  }
  
  if (socketsRemoved > 0) {
    console.log(`Limpeza concluída: ${socketsRemoved} sockets removidos`);
  }
  
  return socketsRemoved;
}

/**
 * Limpa dados relacionados a um usuário desconectado (versão simplificada)
 * @param {Object} gameState - Estado global do jogo
 * @param {string} socketId - ID do socket
 */
function cleanupDisconnectedUser(gameState, socketId) {
  const username = getUsernameFromSocketId(gameState, socketId);
  if (!username) return;
  
  console.log(`Limpando dados para usuário desconectado: ${username}`);
  
  // Remove o usuário da lista de online
  gameState.onlinePlayers.delete(username);
  
  // Verificar se este é o socket atual do usuário
  const currentSocketId = gameState.usernameToSocketId?.get(username);
  if (currentSocketId === socketId) {
    // Remove do mapeamento bidirecional
    gameState.socketIdToUsername.delete(socketId);
    gameState.usernameToSocketId?.delete(username);
  } else {
    // Apenas remove este socketId específico
    gameState.socketIdToUsername.delete(socketId);
    return;
  }
  
  // Obtém a sala atual
  const roomName = gameState.userToRoom.get(username);
  if (roomName) {
    const room = gameState.rooms.get(roomName);
    if (room && room.players) {
      // Marca o jogador como offline
      const playerIndex = room.players.findIndex(player => {
        return typeof player === 'object' && player.username === username;
      });
      
      if (playerIndex !== -1 && typeof room.players[playerIndex] === 'object') {
        room.players[playerIndex].isOnline = false;
      }
      
      // Transfere propriedade se necessário
      if (room.owner === username && room.players.length > 1) {
        const onlinePlayer = room.players.find(player => 
          typeof player === 'object' && 
          player.username !== username && 
          player.isOnline
        );
        
        if (onlinePlayer) {
          room.owner = onlinePlayer.username;
        } else {
          const anyPlayer = room.players.find(player => 
            typeof player === 'object' && player.username !== username
          );
          if (anyPlayer) {
            room.owner = anyPlayer.username;
          }
        }
      }
    }
  }
  
  // Remove navios do jogador
  for (const [shipId, ship] of gameState.ships.entries()) {
    if (ship.owner === username) {
      gameState.ships.delete(shipId);
    }
  }
}

/**
 * Limpeza de usuários inativos (versão simplificada)
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {number} inactivityTimeout - Tempo máximo de inatividade em ms (padrão: 2 horas)
 * @returns {number} - Número de usuários removidos
 */
function cleanupInactiveUsers(io, gameState, inactivityTimeout = 2 * 60 * 60 * 1000) {
  if (!gameState.lastActivityTimestamp) return 0;
  
  const now = Date.now();
  let removedCount = 0;
  
  // Processar usuários inativos
  for (const [username, lastActivity] of gameState.lastActivityTimestamp.entries()) {
    if (now - lastActivity > inactivityTimeout) {
      console.log(`Removendo usuário inativo: ${username}`);
      
      // Remove do mapeamento
      const socketId = gameState.usernameToSocketId?.get(username);
      if (socketId) {
        gameState.socketIdToUsername.delete(socketId);
      }
      gameState.usernameToSocketId?.delete(username);
      
      // Remove da lista de online
      gameState.onlinePlayers.delete(username);
      
      // Remove o timestamp de atividade
      gameState.lastActivityTimestamp.delete(username);
      
      removedCount++;
    }
  }
  
  // Também limpar sockets desconectados
  removedCount += cleanupDisconnectedSockets(io, gameState);
  
  return removedCount;
}

export {
  createDefaultGameState,
  initializeGameState,
  getUsernameFromSocketId,
  getSocketIdFromUsername,
  getCurrentRoom,
  cleanupDisconnectedUser,
  cleanupDisconnectedSockets,
  cleanupInactiveUsers,
  isSocketConnected
};