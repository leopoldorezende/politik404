/**
 * Room management functionality
 */

import redis from '../../shared/redisClient.js';
import { 
  sendUpdatedRoomsList, 
  sendUpdatedPlayersList 
} from './roomNotifications.js';

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
    console.log('Sending room list');
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Create room
  socket.on('createRoom', (roomName) => {
    console.log(`Request to create room: ${roomName}`);
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
    
    // Create room with standardized structure using helper function
    const newRoom = gameState.createRoom(roomName, username);
    
    // Store room in the map
    gameState.rooms.set(roomName, newRoom);
    console.log(`Room "${roomName}" created by ${username}`);
    
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
    
    // Notify all players in the room
    io.to(roomName).emit('roomDeleted', { 
      name: roomName, 
      message: 'This room has been removed by the owner' 
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
  
  // Transfer room ownership
  socket.on('transferOwnership', ({ roomName, newOwner }) => {
    const result = verifyRoomOwnership(roomName);
    if (!result) return;
    
    const { username, room } = result;
    
    // Check if new owner is in the room
    const newOwnerExists = room.players.some(player => {
      if (typeof player === 'object') {
        return player.username === newOwner;
      }
      return false;
    });
    
    if (!newOwnerExists) {
      socket.emit('error', 'Specified user is not in the room');
      return;
    }
    
    // Transfer ownership
    room.owner = newOwner;
    
    // Notify everyone in the room
    io.to(roomName).emit('ownershipTransferred', {
      roomName,
      newOwner,
      previousOwner: username
    });
    
    console.log(`Room "${roomName}" ownership transferred from ${username} to ${newOwner}`);

    // Save to Redis
    saveRoomsToRedis();

    // Update room list for everyone
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Configure room
  socket.on('configureRoom', ({ roomName, settings }) => {
    const result = verifyRoomOwnership(roomName);
    if (!result) return;
    
    const { username, room } = result;
    
    // Validate settings
    if (!settings || typeof settings !== 'object') {
      socket.emit('error', 'Invalid settings');
      return;
    }
    
    // List of allowed settings
    const allowedSettings = [
      'maxPlayers', 'isPrivate', 'password', 'description', 
      'gameMode', 'turnTime', 'visibleCountries'
    ];
    
    // Initialize settings object if it doesn't exist
    if (!room.settings) {
      room.settings = {};
    }
    
    // Apply allowed settings with validation
    for (const setting of allowedSettings) {
      if (settings[setting] !== undefined) {
        // Validate specific settings
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
        
        // Apply the setting
        room.settings[setting] = settings[setting];
      }
    }
    
    // Notify everyone in the room about the new settings
    io.to(roomName).emit('roomConfigurationUpdated', {
      roomName,
      settings: room.settings
    });
    
    // Save to Redis
    saveRoomsToRedis();

    console.log(`Room "${roomName}" settings updated by ${username}`);
    
    // Update room list for everyone (to reflect changes like privacy)
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Get room settings
  socket.on('getRoomSettings', (roomName) => {
    const room = verifyRoom(roomName);
    if (!room) return;
    
    // Return room settings (or empty object if none exist)
    socket.emit('roomSettings', {
      roomName,
      settings: room.settings || {}
    });
  });
  
  // Ban player (owner only)
  socket.on('banPlayer', ({ roomName, playerUsername }) => {
    const result = verifyRoomOwnership(roomName);
    if (!result) return;
    
    const { username, room } = result;
    
    if (playerUsername === username) {
      socket.emit('error', 'You cannot ban yourself');
      return;
    }
    
    // Check if player is in the room
    const playerIndex = room.players.findIndex(player => {
      if (typeof player === 'object') {
        return player.username === playerUsername;
      }
      return false;
    });
    
    if (playerIndex === -1) {
      socket.emit('error', 'Player not found in room');
      return;
    }
    
    // Remove player from list
    room.players.splice(playerIndex, 1);
    
    // Initialize banned players list if it doesn't exist
    if (!room.bannedPlayers) {
      room.bannedPlayers = [];
    }
    
    // Add player to banned list
    if (!room.bannedPlayers.includes(playerUsername)) {
      room.bannedPlayers.push(playerUsername);
    }
    
    // Find banned player's socket
    let bannedPlayerSocketId = null;
    for (const [socketId, name] of gameState.socketIdToUsername.entries()) {
      if (name === playerUsername) {
        bannedPlayerSocketId = socketId;
        break;
      }
    }
    
    // If player is online, remove them from the room
    if (bannedPlayerSocketId) {
      const bannedPlayerSocket = io.sockets.sockets.get(bannedPlayerSocketId);
      if (bannedPlayerSocket) {
        // Remove room association
        gameState.userToRoom.delete(playerUsername);
        
        // Remove from room
        bannedPlayerSocket.leave(roomName);
        
        // Notify player
        bannedPlayerSocket.emit('banned', { 
          roomName, 
          message: `You have been banned from room ${roomName} by the owner` 
        });
        
        // Emit room leave event
        bannedPlayerSocket.emit('roomLeft');
      }
    }
    
    // Clear player data for this room
    const userRoomKey = `${playerUsername}:${roomName}`;
    gameState.userRoomCountries.delete(userRoomKey);
    gameState.playerStates.delete(userRoomKey);
    
    // Remove player's ships in this room
    for (const [shipId, ship] of gameState.ships.entries()) {
      if (ship.owner === playerUsername && ship.roomName === roomName) {
        gameState.ships.delete(shipId);
      }
    }
    
    // Notify everyone in the room
    io.to(roomName).emit('playerBanned', {
      roomName,
      bannedPlayer: playerUsername,
      bannedBy: username
    });
  
    // Save to Redis
    saveRoomsToRedis();

    // Update player list for everyone in the room
    sendUpdatedPlayersList(io, roomName, gameState);
    
    console.log(`Player ${playerUsername} banned from room "${roomName}" by ${username}`);
  });
}

/**
 * Cleans up all data related to a room
 * @param {Object} gameState - Global game state
 * @param {string} roomName - Name of the room to clean up
 */
function cleanupRoomData(gameState, roomName) {
  // Remove the room
  gameState.rooms.delete(roomName);
  
  // Remove country assignments for this room
  for (const [key, value] of gameState.userRoomCountries.entries()) {
    if (key.includes(`:${roomName}`)) {
      gameState.userRoomCountries.delete(key);
    }
  }
  
  // Remove player states for this room
  for (const [key, value] of gameState.playerStates.entries()) {
    if (key.includes(`:${roomName}`)) {
      gameState.playerStates.delete(key);
    }
  }
  
  // Remove ships in this room
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