/**
 * roomUtils.js
 * Funções utilitárias para operações com salas
 */

function createRoom(name, owner) {
  return {
    name,
    owner,
    players: [],
    eligibleCountries: [],
    chatHistory: {
      public: [],
      private: new Map()
    },
    createdAt: new Date().toISOString(),
    settings: {},
    bannedPlayers: []
  };
}

function formatRoomList(gameState) {
  return Array.from(gameState.rooms.entries()).map(([name, room]) => ({
    name,
    owner: room.owner,
    playerCount: room.players.length,
    createdAt: room.createdAt
  }));
}

function isRoomNameValid(name) {
  return typeof name === 'string' && name.trim().length > 0;
}

function isUserRoomOwner(gameState, roomName, username) {
  const room = gameState.rooms.get(roomName);
  return room && room.owner === username;
}

module.exports = {
  createRoom,
  formatRoomList,
  isRoomNameValid,
  isUserRoomOwner
};