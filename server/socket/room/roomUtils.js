/**
 * Utilitários para gerenciamento de salas
 */

/**
 * Cria uma nova sala com estrutura padrão
 * @param {string} roomName - Nome da sala
 * @param {string} ownerUsername - Nome do dono da sala
 * @returns {Object} - Objeto da sala criada
 */
function createRoomStructure(roomName, ownerUsername) {
  return {
    name: roomName,
    owner: ownerUsername,
    players: [],
    eligibleCountries: [],
    chatHistory: {
      public: [],
      private: new Map()
    },
    createdAt: new Date().toISOString()
  };
}

/**
 * Verifica se um usuário é dono de uma sala
 * @param {Object} room - Sala a verificar
 * @param {string} username - Nome do usuário
 * @returns {boolean} - Verdadeiro se for dono, falso caso contrário
 */
function isRoomOwner(room, username) {
  if (!room || !username) return false;
  return room.owner === username;
}

/**
 * Verifica se um usuário está na sala
 * @param {Object} room - Sala a verificar
 * @param {string} username - Nome do usuário
 * @returns {boolean} - Verdadeiro se estiver na sala, falso caso contrário
 */
function isUserInRoom(room, username) {
  if (!room || !room.players || !username) return false;
  
  return room.players.some(player => {
    if (typeof player === 'object') {
      return player.username === username;
    }
    if (typeof player === 'string') {
      return player.startsWith(username + ' ');
    }
    return false;
  });
}

/**
 * Formata a lista de salas para enviar ao cliente
 * @param {Map} rooms - Mapa de salas
 * @returns {Array} - Lista formatada de salas
 */
function formatRoomsList(rooms) {
  if (!rooms) return [];
  
  return Array.from(rooms.entries()).map(([name, room]) => ({
    name,
    owner: room.owner,
    playerCount: room.players.length,
    createdAt: room.createdAt
  }));
}

/**
 * Limpa dados relacionados a uma sala
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala a limpar
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
}

/**
 * Obter uma chave única para chat privado
 * @param {string} user1 - Primeiro usuário
 * @param {string} user2 - Segundo usuário
 * @returns {string} - Chave única para o par de usuários
 */
function getPrivateChatKey(user1, user2) {
  // Ordenar os nomes para garantir consistência
  const sortedUsers = [user1, user2].sort();
  return `${sortedUsers[0]}:${sortedUsers[1]}`;
}

module.exports = {
  createRoomStructure,
  isRoomOwner,
  isUserInRoom,
  formatRoomsList,
  cleanupRoomData,
  getPrivateChatKey
};
