/**
 * socketServerMiddleware.js - ATUALIZADO
 * Middleware para validação e processamento de conexões Socket.io
 */

import { 
  cleanupDisconnectedSockets, 
  cleanupInactiveUsers,
  getUsernameFromSocketId 
} from '../shared/utils/gameStateUtils.js';

/**
 * Cria middleware para Socket.io
 * @param {Object} io - Instância do Socket.io
 * @returns {Function} - Função middleware
 */
function createSocketMiddleware(io) {
  return (socket, next) => {
    // Validação básica da conexão
    if (!socket.id) {
      console.error('[MIDDLEWARE] Socket sem ID válido');
      return next(new Error('Invalid socket connection'));
    }
    
    console.log(`[MIDDLEWARE] Nova conexão socket: ${socket.id}`);
    
    // Configurar eventos de lifecycle do socket
    socket.on('connect', () => {
      console.log(`[MIDDLEWARE] Socket conectado: ${socket.id}`);
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`[MIDDLEWARE] Socket desconectado: ${socket.id}, razão: ${reason}`);
      
      // Cleanup automático quando socket desconecta
      const gameState = global.gameState;
      if (gameState) {
        // Limpar dados do socket desconectado
        setTimeout(() => {
          cleanupDisconnectedSockets(io, gameState);
        }, 1000); // Pequeno delay para permitir reconexões
      }
    });
    
    // Continuar para o próximo middleware
    next();
  };
}

/**
 * Configurar limpeza periódica (chamado do server.js)
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 */
function setupPeriodicCleanup(io, gameState) {
  // Limpeza de usuários inativos a cada 5 minutos
  setInterval(() => {
    const removedUsers = cleanupInactiveUsers(io, gameState);
    if (removedUsers > 0) {
      console.log(`[CLEANUP] Removidos ${removedUsers} usuários inativos`);
    }
  }, 5 * 60 * 1000); // 5 minutos
  
  // Limpeza de sockets desconectados a cada 2 minutos
  setInterval(() => {
    const removedSockets = cleanupDisconnectedSockets(io, gameState);
    if (removedSockets > 0) {
      console.log(`[CLEANUP] Removidos ${removedSockets} sockets desconectados`);
    }
  }, 2 * 60 * 1000); // 2 minutos
  
  console.log('[MIDDLEWARE] Periodic cleanup initialized');
}

/**
 * Middleware para rate limiting (futuro)
 * @param {Object} socket - Socket do cliente
 * @param {Function} next - Próximo middleware
 */
function rateLimitingMiddleware(socket, next) {
  // Implementação futura de rate limiting
  // Por enquanto, apenas passa adiante
  next();
}

/**
 * Middleware para autenticação (futuro)
 * @param {Object} socket - Socket do cliente
 * @param {Function} next - Próximo middleware
 */
function authenticationMiddleware(socket, next) {
  // Implementação futura de autenticação avançada
  // Por enquanto, apenas passa adiante
  next();
}

export { 
  createSocketMiddleware,
  setupPeriodicCleanup,
  rateLimitingMiddleware,
  authenticationMiddleware
};