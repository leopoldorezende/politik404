import { setupAuthHandlers } from './auth/authHandlers.js';
import { setupRoomManagement } from './room/roomManagement.js';
import { setupRoomNotifications } from './room/roomNotifications.js';
import { setupPlayerRoomHandlers } from './player/playerRoomHandlers.js';
import { setupPlayerStateManager } from './player/playerStateManager.js';
import { setupCountryAssignment } from './country/countryAssignment.js';
import { setupChatHandlers } from './chat/chatHandlers.js';
import { setupEconomyHandlers } from './economy/economyHandlers.js'; // Simplificado

/**
 * Inicializa todos os handlers de socket - ARQUITETURA SIMPLIFICADA
 * Removido: countryStateHandlers (integrado ao economyHandlers)
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function initializeSocketHandlers(io, socket, gameState) {
  console.log('Inicializando handlers de socket - Arquitetura Simplificada');
  
  // Configura os handlers essenciais (TODOS SÃO NECESSÁRIOS)
  setupAuthHandlers(io, socket, gameState);
  setupRoomManagement(io, socket, gameState);
  setupRoomNotifications(io, socket, gameState);
  setupPlayerRoomHandlers(io, socket, gameState);
  setupPlayerStateManager(io, socket, gameState);
  setupCountryAssignment(io, socket, gameState);
  setupChatHandlers(io, socket, gameState);
  setupEconomyHandlers(io, socket, gameState);
  
  console.log('✅ ALL handlers initialized - Economy + Country Assignment working');
}

export { initializeSocketHandlers };