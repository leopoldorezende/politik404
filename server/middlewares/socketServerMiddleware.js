/**
 * Middleware for handling and processing Socket.io events
 */

import { 
  createDefaultGameState, 
  initializeGameState, 
  cleanupDisconnectedUser,
  cleanupInactiveUsers
} from '../shared/gameStateUtils.js';

/**
 * Creates a middleware for registration, monitoring, and processing of Socket.io events
 * @param {Object} io - Socket.io instance
 * @returns {Function} Middleware for use with Socket.io
 */
function createSocketMiddleware(io) {
  // Use the existing global gameState to avoid creating duplicate state
  const gameState = global.gameState || createDefaultGameState();
  
  // Make sure all required data structures are initialized
  initializeGameState(gameState);

  // Set up a periodic cleanup to prevent resource leaks
  const setupCleanupInterval = () => {
    // Time in ms between cleanup operations
    const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
    
    // Create the interval and return it for potential cancellation
    const interval = setInterval(() => {
      const now = new Date();
      console.log(`[${now.toISOString()}] Running socket middleware cleanup...`);
      
      // Clean up inactive users and disconnected sockets
      const removedCount = cleanupInactiveUsers(io, gameState);
      
      console.log(`[${now.toISOString()}] Cleanup completed: ${removedCount} items removed`);
    }, CLEANUP_INTERVAL);
    
    return interval;
  };
  
  // Start the cleanup interval
  const cleanupInterval = setupCleanupInterval();
  
  // Store the interval for potential cleanup
  if (!gameState.cleanupIntervals) {
    gameState.cleanupIntervals = new Set();
  }
  gameState.cleanupIntervals.add(cleanupInterval);
  
  // The actual middleware function
  return function(socket, next) {
    const transport = socket.conn?.transport?.name;
    console.log(`Socket connected: ${socket.id} via ${transport || 'unknown transport'}`);
    
    // Register transport upgrade
    socket.conn.on('upgrade', () => {
      console.log(`Socket ${socket.id} upgraded transport to ${socket.conn.transport.name}`);
    });
    
    // Track client session ID
    const clientSessionId = socket.handshake.query.clientSessionId;
    if (clientSessionId) {
      console.log(`Socket ${socket.id} associated with client session: ${clientSessionId}`);
      gameState.socketToSessionId.set(socket.id, clientSessionId);
      
      // Check if a username is already associated with this session
      const existingUsername = gameState.sessionIdToUsername.get(clientSessionId);
      if (existingUsername) {
        console.log(`Session ${clientSessionId} already associated with user ${existingUsername}`);
        
        // Automatically handle reconnection if possible
        if (gameState.usernameToSocketId) {
          gameState.usernameToSocketId.set(existingUsername, socket.id);
        }
        gameState.socketIdToUsername.set(socket.id, existingUsername);
        socket.username = existingUsername;
        
        // Update activity timestamp
        if (gameState.lastActivityTimestamp) {
          gameState.lastActivityTimestamp.set(existingUsername, Date.now());
        }
      }
    }
    
    // Monitor and log socket events (excluding frequent ping/pong)
    const originalEmit = socket.emit;
    socket.emit = function(event, ...args) {
      if (event !== 'ping' && event !== 'pong') {
        console.log(`[EMIT to ${socket.id}] ${event}`);
      }
      return originalEmit.apply(socket, [event, ...args]);
    };
    
    // Error handling
    socket.on('error', (error) => {
      console.error(`Error on socket ${socket.id}:`, error);
      socket.emit('error', 'Internal server error');
    });
    
    // Handle disconnection with proper cleanup
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      
      // Get client session ID
      const clientSessionId = gameState.socketToSessionId.get(socket.id);
      
      // Perform immediate cleanup for critical resources
      gameState.socketToSessionId.delete(socket.id);
      
      // Mark for cleanup in the next cycle
      if (!gameState.pendingSocketsRemoval) {
        gameState.pendingSocketsRemoval = new Set();
      }
      gameState.pendingSocketsRemoval.add(socket.id);
      
      // Clean up user-related data
      cleanupDisconnectedUser(gameState, socket.id);
      
      // Update room list for all clients
      const roomsList = Array.from(gameState.rooms.entries()).map(([name, room]) => ({
        name,
        owner: room.owner,
        playerCount: room.players ? room.players.length : 0,
        createdAt: room.createdAt
      }));
      
      io.emit('roomsList', roomsList);
    });
    
    // Inactivity detection
    let inactivityTimeout;
    
    // Reset inactivity timer
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimeout);
      
      // Set up a new timeout (2 hours of inactivity)
      inactivityTimeout = setTimeout(() => {
        const username = socket.username;
        if (username) {
          console.log(`Disconnecting ${username} due to inactivity`);
          socket.emit('inactivityDisconnect', { message: 'Disconnected due to inactivity' });
          socket.disconnect(true);
        }
      }, 2 * 60 * 60 * 1000);
    };
    
    // Reset timer on every event
    socket.use((packet, next) => {
      resetInactivityTimer();
      
      // Update activity timestamp
      const username = socket.username;
      if (username && gameState.lastActivityTimestamp) {
        gameState.lastActivityTimestamp.set(username, Date.now());
      }
      
      next();
    });
    
    // Initial timer
    resetInactivityTimer();
    
    // Latency tracking
    socket.on('ping', (callback) => {
      const startTime = Date.now();
      if (typeof callback === 'function') {
        callback();
        const latency = Date.now() - startTime;
        socket.emit('pong', { latency });
      }
    });
    
    // Custom authentication handler
    const originalOn = socket.on;
    socket.on = function(event, handler) {
      if (event === 'authenticate') {
        // Enhanced authentication with session tracking
        return originalOn.call(socket, event, function(username, options = {}) {
          const clientSessionId = (options && options.clientSessionId) || 
                                gameState.socketToSessionId.get(socket.id);
          
          if (clientSessionId) {
            // Associate session with username
            gameState.sessionIdToUsername.set(clientSessionId, username);
            
            // Check for existing socket with same username
            let existingSocketId = null;
            let isSameSession = false;
            
            for (const [socketId, existingUsername] of gameState.socketIdToUsername.entries()) {
              if (existingUsername === username && socketId !== socket.id) {
                existingSocketId = socketId;
                
                // Check if same session
                const existingSessionId = gameState.socketToSessionId.get(socketId);
                if (existingSessionId && existingSessionId === clientSessionId) {
                  isSameSession = true;
                  console.log(`Detected reconnection from same device for ${username}`);
                }
                break;
              }
            }
            
            // Handle multiple connections from same user
            if (existingSocketId && isSameSession) {
              const existingSocket = io.sockets.sockets.get(existingSocketId);
              if (existingSocket) {
                console.log(`Disconnecting old socket ${existingSocketId} from same device`);
                
                // Notify old socket about disconnection
                existingSocket.emit('forcedDisconnect', { 
                  reason: 'New session started elsewhere',
                  reconnect: false,
                  sameBrowser: true
                });
                
                // Mark for cleanup
                if (!gameState.pendingSocketsRemoval) {
                  gameState.pendingSocketsRemoval = new Set();
                }
                gameState.pendingSocketsRemoval.add(existingSocketId);
              }
            }
          }
          
          // Call original handler
          handler.apply(socket, [username]);
        });
      }
      
      // Default behavior for other events
      return originalOn.apply(socket, arguments);
    };
    
    // Cleanup resources when socket instance is destroyed
    socket.on('close', () => {
      // Clear the inactivity timeout to prevent memory leaks
      if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = null;
      }
    });
    
    // Continue to next middleware
    next();
  };
}

// Ensure all resources are properly cleaned up when the module is unloaded
process.on('beforeExit', () => {
  // Clean up any intervals that were created
  if (global.gameState && global.gameState.cleanupIntervals) {
    for (const interval of global.gameState.cleanupIntervals) {
      clearInterval(interval);
    }
    global.gameState.cleanupIntervals.clear();
  }
});

export { createSocketMiddleware };