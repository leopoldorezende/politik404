/**
 * Socket.io - Inicialização e coordenação de todos os handlers
 */

import { setupAuthHandlers } from './auth/authHandlers.js';
import { setupRoomManagement } from './room/roomManagement.js';
import { setupRoomNotifications } from './room/roomNotifications.js';
import { setupPlayerRoomHandlers } from './player/playerRoomHandlers.js';
import { setupPlayerStateManager } from './player/playerStateManager.js';
import { setupCountryAssignment } from './country/countryAssignment.js';
import { setupCountryStateHandlers } from './country/countryStateHandlers.js';
import { setupChatHandlers } from './chat/chatHandlers.js';
import { setupEconomyHandlers } from './economy/economyHandlers.js';

/**
 * Inicializa todos os handlers de socket
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function initializeSocketHandlers(io, socket, gameState) {
  console.log('Inicializando todos os handlers de socket');
  
  // Configura os vários handlers
  setupAuthHandlers(io, socket, gameState);
  setupRoomManagement(io, socket, gameState);
  setupRoomNotifications(io, socket, gameState);
  setupPlayerRoomHandlers(io, socket, gameState);
  setupPlayerStateManager(io, socket, gameState);
  setupCountryAssignment(io, socket, gameState);
  setupCountryStateHandlers(io, socket, gameState); 
  setupChatHandlers(io, socket, gameState);
  setupEconomyHandlers(io, socket, gameState);
  
  console.log('Todos os handlers inicializados com sucesso');
}

export { initializeSocketHandlers };