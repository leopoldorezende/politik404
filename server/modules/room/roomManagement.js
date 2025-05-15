/**
 * Room management functionality
 */

import redis from '../../shared/redisClient.js';
import countryStateManager from '../../shared/countryStateManager.js';
import { 
  sendUpdatedRoomsList, 
  sendUpdatedPlayersList 
} from './roomNotifications.js';
import { 
  scheduleRoomExpiration, 
  cancelRoomExpiration 
} from './roomExpirationManager.js';

/**
 * Configures event handlers related to room management
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Client socket
 * @param {Object} gameState - Global game state
 */
function setupRoomManagement(io, socket, gameState) {
  console.log('Room management initialized');
  
  // Centralized function to verify user authentication
  const verifyAuth = () => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return null;
    }
    return username;
  };
  
  // Centralized function to verify room existence
  const verifyRoom = (roomName) => {
    if (!roomName) {
      socket.emit('error', 'Invalid room name');
      return null;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Room does not exist');
      return null;
    }
    
    return room;
  };
  
  // Centralized function to verify room ownership
  const verifyRoomOwnership = (roomName) => {
    const username = verifyAuth();
    if (!username) return null;
    
    const room = verifyRoom(roomName);
    if (!room) return null;
    
    if (room.owner !== username) {
      socket.emit('error', 'Only the room owner can perform this action');
      return null;
    }
    
    return { username, room };
  };
  
  // Function to save rooms state to Redis
  const saveRoomsToRedis = async () => {
    try {
      await redis.set('rooms', JSON.stringify(Object.fromEntries(gameState.rooms)));
    } catch (error) {
      console.error('Error saving rooms to Redis:', error);
    }
  };

  // Get room list
  socket.on('getRooms', () => {
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Create room
  socket.on('createRoom', (roomData) => {
    // Mantém compatibilidade - se receber string, converte para objeto
    if (typeof roomData === 'string') {
      roomData = { name: roomData, duration: 30 * 60000 }; // 30 minutos padrão em milissegundos
    }
    
    const { name: roomName, duration = 30 * 60000 } = roomData;
    
    console.log(`Request to create room: ${roomName} with duration: ${duration/1000} seconds`);
    const username = verifyAuth();
    if (!username) return;
    
    if (!roomName || typeof roomName !== 'string' || roomName.trim() === '') {
      socket.emit('error', 'Invalid room name');
      return;
    }
    
    if (gameState.rooms.has(roomName)) {
      socket.emit('error', 'Room with this name already exists');
      return;
    }
    
    // Validar duração (entre 1 minuto e 2 horas)
    if (duration < 60000 || duration > 120 * 60000) {
      socket.emit('error', 'Room duration must be between 1 minute and 2 hours');
      return;
    }
    
    // Create room with standardized structure using helper function
    const newRoom = gameState.createRoom(roomName, username);
    
    // Adicionar informações de tempo
    newRoom.duration = duration;
    newRoom.createdTimestamp = Date.now();
    newRoom.expiresAt = Date.now() + duration;
    
    // Store room in the map
    gameState.rooms.set(roomName, newRoom);
    console.log(`Room "${roomName}" created by ${username}`);
    
    // Inicializar estados dos países para esta sala
    countryStateManager.initializeRoom(roomName, gameState.countriesData);
    console.log(`Initialized country states for room ${roomName}`);
    
    // Agendar expiração da sala
    scheduleRoomExpiration(io, gameState, roomName, newRoom.expiresAt);
    
    // Save to Redis
    saveRoomsToRedis();

    // Notify client that created the room
    socket.emit('roomCreated', { name: roomName, success: true });
    
    // Update room list for all connected clients
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Delete room (owner only)
  socket.on('deleteRoom', (roomName) => {
    const result = verifyRoomOwnership(roomName);
    if (!result) return;
    
    const { username, room } = result;
    
    // Cancela o timer de expiração se existir
    cancelRoomExpiration(roomName);
    
    // Notify all players in the room
    io.to(roomName).emit('roomDeleted', { 
      name: roomName, 
      message: 'This room has been removed by the owner',
      reason: 'manual_deletion'
    });
    
    // Remove all players from the room
    const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
    if (socketsInRoom) {
      for (const socketId of socketsInRoom) {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket) {
          clientSocket.leave(roomName);
          // Remove user-room association
          const clientUsername = clientSocket.username;
          if (clientUsername) {
            gameState.userToRoom.delete(clientUsername);
          }
        }
      }
    }
    
    // Clean up room-related data
    cleanupRoomData(gameState, roomName);
    
    console.log(`Room "${roomName}" deleted by ${username}`);
    
    // Save to Redis
    saveRoomsToRedis();

    // Update room list for everyone
    sendUpdatedRoomsList(io, gameState);
  });
}

/**
 * Cleans up data related to a room
 * @param {Object} gameState - Global game state
 * @param {string} roomName - Name of the room to clean up
 */
function cleanupRoomData(gameState, roomName) {
  // Remove the room
  gameState.rooms.delete(roomName);
  
  // Remove country states for this room
  if (countryStateManager) {
    countryStateManager.removeRoom(roomName);
    console.log(`Removed country states for room ${roomName}`);
  }
  
  // Clean up user associations for this room
  for (const [key, value] of gameState.userRoomCountries.entries()) {
    if (key.includes(`:${roomName}`)) {
      gameState.userRoomCountries.delete(key);
    }
  }
  
  // Clean up player states for this room
  for (const [key, value] of gameState.playerStates.entries()) {
    if (key.includes(`:${roomName}`)) {
      gameState.playerStates.delete(key);
    }
  }
  
  // Clean up ships in this room (if any)
  for (const [shipId, ship] of gameState.ships.entries()) {
    if (ship.roomName === roomName) {
      gameState.ships.delete(shipId);
    }
  }
}

export { 
  setupRoomManagement,
  cleanupRoomData
};