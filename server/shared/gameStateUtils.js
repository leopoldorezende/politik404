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
  
  // Inicializa mapa de socketId para username
  if (!gameState.socketIdToUsername) {
    gameState.socketIdToUsername = new Map();
  }
  
  // Inicializa mapa de username para socketId para facilitar busca
  if (!gameState.usernameToSocketId) {
    gameState.usernameToSocketId = new Map();
  }
  
  // Inicializa mapa de usuário para sala
  if (!gameState.userToRoom) {
    gameState.userToRoom = new Map();
  }
  
  // Inicializa mapa de usuários e seus países em cada sala
  if (!gameState.userRoomCountries) {
    gameState.userRoomCountries = new Map();
  }
  
  // Inicializa mapa para estados dos jogadores
  if (!gameState.playerStates) {
    gameState.playerStates = new Map();
  }
  
  // Inicializa conjunto de jogadores online
  if (!gameState.onlinePlayers) {
    gameState.onlinePlayers = new Set();
  }
  
  // Inicializa timestamp de última atividade por usuário
  if (!gameState.lastActivityTimestamp) {
    gameState.lastActivityTimestamp = new Map();
  }
  
  // Inicializa mapa de salas
  if (!gameState.rooms) {
    gameState.rooms = new Map();
  }
  
  // Inicializa mapa de navios
  if (!gameState.ships) {
    gameState.ships = new Map();
  }
  
  // Inicializa mapa de nomes de exibição
  if (!gameState.displayNames) {
    gameState.displayNames = new Map();
  }
  
  // Inicializa mapas de sessão
  if (!gameState.socketToSessionId) {
    gameState.socketToSessionId = new Map();
  }
  
  if (!gameState.sessionIdToUsername) {
    gameState.sessionIdToUsername = new Map();
  }
  
  // Inicializa constante de histórico máximo de chat
  if (!gameState.MAX_CHAT_HISTORY) {
    gameState.MAX_CHAT_HISTORY = 100;
  }
  
  // Inicializa função de chave de chat privado se não existir
  if (!gameState.getPrivateChatKey) {
    gameState.getPrivateChatKey = function(user1, user2) {
      return [user1, user2].sort().join(':');
    };
  }
  
  // Inicializa função para criar sala se não existir
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
  
  // Inicializa lista de sockets pendentes de remoção
  if (!gameState.pendingSocketsRemoval) {
    gameState.pendingSocketsRemoval = new Set();
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
 * Registra o mapeamento bidirecional entre socketId e username
 * @param {Object} gameState - Estado global do jogo
 * @param {string} socketId - ID do socket
 * @param {string} username - Nome do usuário
 */
function registerSocketUserMapping(gameState, socketId, username) {
  if (!socketId || !username) return;
  
  // Registra o mapeamento de socketId para username
  gameState.socketIdToUsername.set(socketId, username);
  
  // Registra o mapeamento inverso se existir o Map
  if (gameState.usernameToSocketId) {
    gameState.usernameToSocketId.set(username, socketId);
  }
  
  // Atualiza o timestamp de última atividade
  if (gameState.lastActivityTimestamp) {
    gameState.lastActivityTimestamp.set(username, Date.now());
  }
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
  
  // Se não encontrar, verifica nas salas do socket
  for (const room of socket.rooms) {
    if (room !== socket.id && gameState.rooms.has(room)) {
      // Atualiza o mapeamento para futuras verificações
      if (username) {
        gameState.userToRoom.set(username, room);
      }
      return room;
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
 * Limpa sockets desconectados do gameState
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 */
function cleanupDisconnectedSockets(io, gameState) {
  let socketsRemoved = 0;
  
  // Verificar cada socketId registrado
  for (const [socketId, username] of gameState.socketIdToUsername.entries()) {
    // Verificar se o socket realmente existe e está conectado
    if (!isSocketConnected(io, socketId)) {
      // Marcar para remoção se não estiver conectado
      gameState.pendingSocketsRemoval.add(socketId);
      
      // Registrar no log
      console.log(`Socket ${socketId} para usuário ${username} marcado para remoção (desconectado)`);
    }
  }
  
  // Remover sockets marcados para remoção
  for (const socketId of gameState.pendingSocketsRemoval) {
    const username = gameState.socketIdToUsername.get(socketId);
    
    if (username) {
      // Verificar se este é o socket mais recente para o usuário
      const currentSocketId = gameState.usernameToSocketId?.get(username);
      
      if (currentSocketId !== socketId) {
        // Se não for o socket mais recente, pode remover
        gameState.socketIdToUsername.delete(socketId);
        socketsRemoved++;
        
        console.log(`Socket antigo ${socketId} para usuário ${username} removido`);
      } else if (!isSocketConnected(io, socketId)) {
        // Se for o socket mais recente, mas estiver desconectado
        gameState.socketIdToUsername.delete(socketId);
        gameState.usernameToSocketId?.delete(username);
        socketsRemoved++;
        
        console.log(`Socket atual ${socketId} para usuário ${username} removido (desconectado)`);
        
        // Marcar usuário como offline
        gameState.onlinePlayers.delete(username);
      }
    } else {
      // Se não houver usuário associado, pode remover
      gameState.socketIdToUsername.delete(socketId);
      socketsRemoved++;
      
      console.log(`Socket órfão ${socketId} removido (sem usuário associado)`);
    }
  }
  
  // Limpar lista de pendentes
  gameState.pendingSocketsRemoval.clear();
  
  if (socketsRemoved > 0) {
    console.log(`Limpeza concluída: ${socketsRemoved} sockets removidos`);
  }
  
  return socketsRemoved;
}

/**
 * Limpa todos os dados relacionados a um usuário quando ele se desconecta
 * @param {Object} gameState - Estado global do jogo
 * @param {string} socketId - ID do socket
 */
function cleanupDisconnectedUser(gameState, socketId) {
  const username = getUsernameFromSocketId(gameState, socketId);
  if (!username) return;
  
  console.log(`Limpando dados para usuário desconectado: ${username} (Socket ID: ${socketId})`);
  
  // Remove o usuário da lista de online
  gameState.onlinePlayers.delete(username);
  
  // Verificar se este é o socket mais recente do usuário
  const currentSocketId = gameState.usernameToSocketId?.get(username);
  if (currentSocketId === socketId) {
    // Se for o socket atual, remover do mapeamento username -> socketId
    gameState.usernameToSocketId?.delete(username);
  } else {
    console.log(`Mantendo o usuário ${username} mapeado para o socketId mais recente: ${currentSocketId}`);
    // Se não for o socket atual, não remover do mapeamento para evitar perder a sessão ativa
    
    // Apenas remover este socketId específico
    gameState.socketIdToUsername.delete(socketId);
    return;
  }
  
  // Remove do mapeamento de socketId para username
  gameState.socketIdToUsername.delete(socketId);
  
  // Obtém a sala atual (se houver)
  const roomName = gameState.userToRoom.get(username);
  if (roomName) {
    const room = gameState.rooms.get(roomName);
    if (room) {
      // Marca o jogador como offline em vez de removê-lo completamente
      const playerIndex = room.players.findIndex(player => {
        if (typeof player === 'object') {
          return player.username === username;
        }
        if (typeof player === 'string') {
          return player.startsWith(username);
        }
        return false;
      });
      
      if (playerIndex !== -1) {
        // Se o jogador é um objeto, apenas marque-o como offline
        if (typeof room.players[playerIndex] === 'object') {
          room.players[playerIndex].isOnline = false;
        } 
        // Se o jogador é uma string, converta para objeto com status offline
        else if (typeof room.players[playerIndex] === 'string') {
          const playerString = room.players[playerIndex];
          const match = playerString.match(/^(.*?)\s*\((.*)\)$/);
          if (match) {
            room.players[playerIndex] = {
              username: match[1],
              country: match[2],
              isOnline: false
            };
          }
        }
      }
      
      // Se o jogador era o dono da sala e há outros jogadores, transfere a propriedade
      if (room.owner === username && room.players.length > 1) {
        // Encontra outro jogador para ser o dono (preferencialmente online)
        const onlinePlayers = room.players.filter(player => {
          if (typeof player === 'object') {
            return player.username !== username && player.isOnline;
          }
          return false;
        });
        
        if (onlinePlayers.length > 0) {
          room.owner = onlinePlayers[0].username;
        } else {
          // Se não há jogadores online, encontra qualquer outro jogador
          const otherPlayer = room.players.find(player => {
            if (typeof player === 'object') {
              return player.username !== username;
            }
            return false;
          });
          
          if (otherPlayer) {
            room.owner = otherPlayer.username;
          }
        }
      }
      
      // Se não há mais jogadores na sala, remove a sala
      if (room.players.length === 0) {
        gameState.rooms.delete(roomName);
        
        // Remove todos os navios da sala
        for (const [shipId, ship] of gameState.ships.entries()) {
          if (ship.roomName === roomName) {
            gameState.ships.delete(shipId);
          }
        }
      }
    }
    
    // Remove do mapeamento de usuário para sala
    // Não remover para manter o usuário na sala quando reconectar
    // gameState.userToRoom.delete(username);
  }
  
  // Remove todos os navios do jogador
  for (const [shipId, ship] of gameState.ships.entries()) {
    if (ship.owner === username) {
      gameState.ships.delete(shipId);
    }
  }
}

/**
 * Limpeza periódica de usuários inativos e reconexões pendentes
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {number} inactivityTimeout - Tempo máximo de inatividade em ms (padrão: 2 horas)
 * @returns {number} - Número de usuários removidos
 */
function cleanupInactiveUsers(io, gameState, inactivityTimeout = 2 * 60 * 60 * 1000) {
  if (!gameState.lastActivityTimestamp) return 0;
  
  const now = Date.now();
  let removedCount = 0;
  
  // Processar cada usuário com timestamp de atividade
  for (const [username, lastActivity] of gameState.lastActivityTimestamp.entries()) {
    // Verificar se o tempo de inatividade excede o limite
    if (now - lastActivity > inactivityTimeout) {
      console.log(`Removendo usuário inativo: ${username} (inativo por ${Math.floor((now - lastActivity) / 60000)} minutos)`);
      
      // Remover do mapeamento de socketId para username
      const socketId = gameState.usernameToSocketId?.get(username);
      if (socketId) {
        gameState.socketIdToUsername.delete(socketId);
      }
      
      // Remover do mapeamento de username para socketId
      gameState.usernameToSocketId?.delete(username);
      
      // Remover da lista de online
      gameState.onlinePlayers.delete(username);
      
      // Remover o timestamp de atividade
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
  registerSocketUserMapping,
  getCurrentRoom,
  cleanupDisconnectedUser,
  cleanupDisconnectedSockets,
  cleanupInactiveUsers,
  isSocketConnected
};