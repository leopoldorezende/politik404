/**
 * Middleware for handling and processing Socket.io events
 */

import { 
  initializeGameState, 
  cleanupInactiveUsers
} from '../shared/utils/gameStateUtils.js';
import { simulateAICountryActions } from '../modules/ai/aiCountryController.js';

/**
 * Creates a middleware for registration, monitoring, and processing of Socket.io events
 * @param {Object} io - Socket.io instance
 * @returns {Function} Middleware for use with Socket.io
 */
function createSocketMiddleware(io) {
  // Use the existing global gameState to avoid creating duplicate state
  const gameState = global.gameState || initializeGameState();
  
  // Set up a periodic simulation for AI-controlled countries
  const setupAISimulationInterval = () => {
    // Time in ms between AI simulation operations
    const AI_SIMULATION_INTERVAL = 60000; // Cada 1 minuto (era 10 segundos antes)
    const AI_TRADE_PROPOSAL_INTERVAL = 180000; // Cada 3 minutos para propostas comerciais
    
    // Intervalo principal para simulações de IA
    const simulationInterval = setInterval(() => {
      // Verificar se há salas ativas
      if (gameState.rooms.size === 0) return;
      
      // Executar simulação para cada sala
      for (const [roomName, room] of gameState.rooms.entries()) {
        // Verificar se há jogadores humanos online na sala
        const hasOnlinePlayers = room.players && 
          room.players.some(p => typeof p === 'object' && p.isOnline);
        
        // Apenas simular salas com jogadores humanos online
        if (hasOnlinePlayers) {
          simulateAICountryActions(io, gameState, roomName);
        }
      }
    }, AI_SIMULATION_INTERVAL);
    
    // Intervalo específico para propostas comerciais da IA
    // Este intervalo separado permite controlar melhor a frequência das propostas
    const tradeProposalInterval = setInterval(() => {
      // Verifica se há salas ativas
      if (gameState.rooms.size === 0) return;
      
      // Para cada sala ativa
      for (const [roomName, room] of gameState.rooms.entries()) {
        // Verificar se há jogadores humanos online
        const onlinePlayers = room.players ? 
          room.players.filter(p => typeof p === 'object' && p.isOnline) : [];
        
        if (onlinePlayers.length > 0) {
          // Se houver jogadores online, há uma chance de a IA fazer uma proposta comercial
          // A função simulateAICountryActions já controla internamente quais países IA farão propostas
          if (Math.random() < 0.6) { // 60% de chance a cada intervalo
            console.log(`[AI Trade Proposals] Iniciando simulação para sala ${roomName}`);
            simulateAICountryActions(io, gameState, roomName);
          }
        }
      }
    }, AI_TRADE_PROPOSAL_INTERVAL);
    
    return [simulationInterval, tradeProposalInterval];
  };

  // Start the AI simulation intervals
  const aiIntervals = setupAISimulationInterval();

  // Store the intervals for potential cleanup
  if (!gameState.cleanupIntervals) {
    gameState.cleanupIntervals = new Set();
  }
  
  // Adicionar todos os intervalos ao conjunto de limpeza
  aiIntervals.forEach(interval => {
    gameState.cleanupIntervals.add(interval);
  });

  // Set up a periodic cleanup to prevent resource leaks
  const setupCleanupInterval = () => {
    // Time in ms between cleanup operations - reduced frequency
    const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes instead of 10
    
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
    console.log(`Socket connected: ${socket.id}`);
    
    // Track client session ID if provided (but don't use it for complex logic)
    const clientSessionId = socket.handshake.query.clientSessionId;
    if (clientSessionId) {
      console.log(`Socket ${socket.id} associated with client session: ${clientSessionId}`);
    }
    
    // Error handling
    socket.on('error', (error) => {
      console.error(`Error on socket ${socket.id}:`, error);
      socket.emit('error', 'Internal server error');
    });
    
    // Simplified authentication handler
    const originalOn = socket.on;
    socket.on = function(event, handler) {
      if (event === 'authenticate') {
        // Simplified authentication without complex session tracking
        return originalOn.call(socket, event, function(username) {
          // Call original handler
          handler.apply(socket, [username]);
        });
      }
      
      // Default behavior for other events
      return originalOn.apply(socket, arguments);
    };
    
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