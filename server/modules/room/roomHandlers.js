/**
 * roomHandlers.js
 * Eventos de entrada e saída de salas
 */

const redis = require('../../infra/redisClient');
const { sendUpdatedPlayersList, sendUpdatedRoomsList } = require('./roomNotifications');

/**
 * Lida com eventos de entrada/saída de salas
 */
function setupRoomHandlers(io, socket, gameState) {
  // Entrar em uma sala
  socket.on('joinRoom', (roomName) => {
    const username = socket.username;
    const room = gameState.rooms.get(roomName);

    if (!username || !room) {
      socket.emit('error', 'Usuário ou sala inválida');
      return;
    }

    // Verifica se o jogador está banido
    if (room.bannedPlayers?.includes(username)) {
      socket.emit('error', 'Você está banido desta sala');
      return;
    }

    // Entra na sala e registra a associação
    socket.join(roomName);
    socket.currentRoom = roomName;
    gameState.userToRoom.set(username, roomName);

    // Evita duplicatas
    if (!room.players.find(p => typeof p === 'object' && p.username === username)) {
      room.players.push({ username });
    }

    // Salva estado no Redis
    redis.set('rooms', JSON.stringify(Object.fromEntries(gameState.rooms)));

    // Atualiza lista de jogadores
    sendUpdatedPlayersList(io, roomName, gameState);
    sendUpdatedRoomsList(io, gameState);

    // Notifica o jogador
    socket.emit('roomJoined', room);
  });

  // Sair da sala
  socket.on('leaveRoom', () => {
    const username = socket.username;
    const roomName = gameState.userToRoom.get(username);

    if (!roomName) return;

    const room = gameState.rooms.get(roomName);
    if (!room) return;

    // Remove jogador da lista
    room.players = room.players.filter(p => typeof p === 'object' ? p.username !== username : p !== username);

    // Sair da sala
    socket.leave(roomName);
    socket.currentRoom = null;
    gameState.userToRoom.delete(username);

    // Salva no Redis
    redis.set('rooms', JSON.stringify(Object.fromEntries(gameState.rooms)));

    // Atualiza todos
    sendUpdatedPlayersList(io, roomName, gameState);
    sendUpdatedRoomsList(io, gameState);

    // Notifica quem saiu
    socket.emit('roomLeft');
  });
}

module.exports = { setupRoomHandlers };