/**
 * socketServerMiddleware.js
 * Middleware para validação e processamento de conexões Socket.io
 */

import { 
  cleanupDisconnectedSockets
} from '../shared/utils/gameStateUtils.js';

/**
 * Cria middleware para Socket.io
 * @param {Object} io - Instância do Socket.io
 * @returns {Function} - Função middleware
 */
export function createSocketMiddleware(io) {
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