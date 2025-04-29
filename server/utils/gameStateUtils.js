/**
 * Utilitários para manipulação do estado global do jogo
 */

/**
 * Inicializa as estruturas de dados necessárias no gameState
 * @param {Object} gameState - Estado global do jogo
 */
function initializeGameState(gameState) {
  // Inicializa mapa de socketId para username
  if (!gameState.socketIdToUsername) {
    gameState.socketIdToUsername = new Map();
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
  
  // Inicializa mapa de salas
  if (!gameState.rooms) {
    gameState.rooms = new Map();
  }
  
  // Inicializa mapa de navios
  if (!gameState.ships) {
    gameState.ships = new Map();
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
          private: new Map() // Mapa para mensagens privadas
        },
        createdAt: new Date().toISOString()
      };
    };
  }
  
  console.log('Estruturas de dados do gameState inicializadas');
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
 * Limpa todos os dados relacionados a um usuário quando ele se desconecta
 * @param {Object} gameState - Estado global do jogo
 * @param {string} socketId - ID do socket
 */
function cleanupDisconnectedUser(gameState, socketId) {
  const username = getUsernameFromSocketId(gameState, socketId);
  if (!username) return;
  
  console.log(`Limpando dados para usuário desconectado: ${username}`);
  
  // Remove do mapeamento de socketId para username
  gameState.socketIdToUsername.delete(socketId);
  
  // Remove do conjunto de jogadores online
  gameState.onlinePlayers.delete(username);
  
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
    gameState.userToRoom.delete(username);
  }
  
  // Remove todos os navios do jogador
  for (const [shipId, ship] of gameState.ships.entries()) {
    if (ship.owner === username) {
      gameState.ships.delete(shipId);
    }
  }
}

module.exports = {
  initializeGameState,
  getUsernameFromSocketId,
  getCurrentRoom,
  cleanupDisconnectedUser
};