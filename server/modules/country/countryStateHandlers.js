/**
 * countryStateHandlers.js
 * Socket.io handlers for country state management
 */

import countryStateManager from '../../shared/countryStateManager.js';

// Maps for tracking client subscriptions and broadcasting intervals
const roomSubscriptions = new Map(); // roomName -> Set of socket IDs
const roomIntervals = new Map(); // roomName -> interval ID

// Default broadcast interval in milliseconds
const DEFAULT_BROADCAST_INTERVAL = 1000; // 1 second for testing

/**
 * Setup country state handlers for a socket
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Client socket
 * @param {Object} gameState - Global game state
 */
export function setupCountryStateHandlers(io, socket, gameState) {
  console.log('Country state handlers initialized');
  
  // Subscribe to country state updates for a room
  socket.on('subscribeToCountryStates', (roomName) => {
       const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return;
    }
    
    if (roomSubscriptions.has(roomName) && roomSubscriptions.get(roomName).has(socket.id)) {
      console.log(`User ${username} already subscribed to country states for room ${roomName}`);
      return;
    }
    
    // Verify if room exists
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Room does not exist');
      return;
    }
    
    console.log(`User ${username} subscribing to country states for room ${roomName}`);
    
    // Add socket to room subscriptions
    if (!roomSubscriptions.has(roomName)) {
      roomSubscriptions.set(roomName, new Set());
      
      // Initialize country states for this room if not already done
      if (gameState.countriesData) {
        countryStateManager.initializeRoom(roomName, gameState.countriesData);
      }
      
      // Start broadcasting updates for this room if not already broadcasting
      startBroadcastingUpdates(io, roomName);
    }
    
    roomSubscriptions.get(roomName).add(socket.id);
    
    // Join the specialized room for country state updates
    socket.join(`countryStates:${roomName}`);
    
    // Get the current country states for the room
    const roomStates = countryStateManager.getRoomCountryStates(roomName);
    
    // Send initial states to the client
    socket.emit('countryStatesInitialized', {
      roomName,
      states: roomStates,
      timestamp: Date.now()
    });
    
    console.log(`Sent initial country states for room ${roomName} to user ${username}`);
  });
  
  // Unsubscribe from country state updates for a room
  socket.on('unsubscribeFromCountryStates', (roomName) => {
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return;
    }
    
    console.log(`User ${username} unsubscribing from country states for room ${roomName}`);
    
    // Remove socket from room subscriptions
    if (roomSubscriptions.has(roomName)) {
      roomSubscriptions.get(roomName).delete(socket.id);
      
      // If no more subscribers, stop broadcasting updates
      if (roomSubscriptions.get(roomName).size === 0) {
        stopBroadcastingUpdates(roomName);
        roomSubscriptions.delete(roomName);
      }
    }
    
    // Leave the specialized room for country state updates
    socket.leave(`countryStates:${roomName}`);
  });
  
  // Update a country state from client (for authorized users)
  socket.on('updateCountryState', (data) => {
    const { roomName, countryName, category, updates } = data;
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return;
    }
    
    // Verify if room exists
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Room does not exist');
      return;
    }
    
    // Check if user is authorized (owner or assigned to the country)
    const isOwner = room.owner === username;
    const userCountry = getUserCountry(gameState, roomName, username);
    const isAssignedToCountry = userCountry === countryName;
    
    if (!isOwner && !isAssignedToCountry) {
      socket.emit('error', 'Not authorized to update this country');
      return;
    }
    
    // Apply the updates
    const updatedState = countryStateManager.updateCountryState(
      roomName, 
      countryName, 
      category, 
      updates
    );
    
    if (updatedState) {
      // Notify only the client who made the change (confirmation)
      socket.emit('countryStateUpdated', {
        roomName,
        countryName,
        category,
        state: updatedState,
        timestamp: Date.now()
      });
      
      console.log(`Country state updated for ${countryName} in room ${roomName} by user ${username}`);
    } else {
      socket.emit('error', 'Failed to update country state');
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    // Unsubscribe from all rooms
    for (const [roomName, subscribers] of roomSubscriptions.entries()) {
      if (subscribers.has(socket.id)) {
        subscribers.delete(socket.id);
        
        // If no more subscribers, stop broadcasting updates
        if (subscribers.size === 0) {
          stopBroadcastingUpdates(roomName);
          roomSubscriptions.delete(roomName);
        }
      }
    }
  });
  
  // When a user leaves a room
  socket.on('leaveRoom', () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    
    if (roomName) {
      // Unsubscribe from country state updates for this room
      socket.emit('unsubscribeFromCountryStates', roomName);
      
      console.log(`User ${username} automatically unsubscribed from country states for room ${roomName}`);
    }
  });
}

/**
 * Start broadcasting country state updates for a room
 * @param {Object} io - Socket.io server instance
 * @param {string} roomName - Name of the room
 */
function startBroadcastingUpdates(io, roomName) {
  // Check if already broadcasting
  if (roomIntervals.has(roomName)) return;
  
  console.log(`Starting country state broadcasts for room ${roomName}`);
  
  // Create an interval to broadcast updates
  const intervalId = setInterval(() => {
    // Get the current states
    const states = countryStateManager.getRoomCountryStates(roomName);
    const timestamp = countryStateManager.lastUpdated.get(roomName) || Date.now();
    
    // Broadcast to all subscribers
    io.to(`countryStates:${roomName}`).emit('countryStatesUpdated', {
      roomName,
      states,
      timestamp
    });
  }, DEFAULT_BROADCAST_INTERVAL);
  
  // Store the interval ID
  roomIntervals.set(roomName, intervalId);
}

/**
 * Stop broadcasting country state updates for a room
 * @param {string} roomName - Name of the room
 */
function stopBroadcastingUpdates(roomName) {
  // Check if broadcasting
  if (!roomIntervals.has(roomName)) return;
  
  console.log(`Stopping country state broadcasts for room ${roomName}`);
  
  // Clear the interval
  clearInterval(roomIntervals.get(roomName));
  
  // Remove the interval ID
  roomIntervals.delete(roomName);
}

/**
 * Get a user's assigned country in a room
 * @param {Object} gameState - Global game state
 * @param {string} roomName - Name of the room
 * @param {string} username - Username
 * @returns {string|null} - Country name or null if not assigned
 */
function getUserCountry(gameState, roomName, username) {
  const userRoomKey = `${username}:${roomName}`;
  return gameState.userRoomCountries.get(userRoomKey) || null;
}

/**
 * Get the current room for a socket
 * @param {Object} socket - Client socket
 * @param {Object} gameState - Global game state
 * @returns {string|null} - Room name or null if not in a room
 */
function getCurrentRoom(socket, gameState) {
  const username = socket.username;
  if (!username) return null;
  
  return gameState.userToRoom.get(username) || null;
}