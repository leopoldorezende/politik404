/**
 * Socket.io - Inicialização e coordenação de todos os handlers
 */

import { setupAuthHandlers } from './auth/authHandlers.js';
import { setupRoomManagement } from './room/roomManagement.js';
import { setupRoomNotifications } from './room/roomNotifications.js';
import { setupPlayerRoomHandlers } from './player/playerRoomHandlers.js';
import { setupPlayerStateManager } from './player/playerStateManager.js';
import { setupCountryAssignment } from './country/countryAssignment.js';
import { setupChatHandlers } from './chat/chatHandlers.js';

/**
 * Inicializa todos os handlers de socket
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function initializeSocketHandlers(io, socket, gameState) {
  console.log('Inicializando todos os handlers de socket');
  
  // Não é mais necessário inicializar o gameState aqui, pois já é inicializado 
  // em server.js e disponibilizado como global.gameState
  
  // Se gameState não for fornecido como parâmetro, usa o global
  const state = gameState || global.gameState;
  
  if (!state) {
    console.error('ERRO: gameState não encontrado em initializeSocketHandlers');
    return;
  }
  
  // Configura os vários handlers
  setupAuthHandlers(io, socket, state);
  setupRoomManagement(io, socket, state);
  setupRoomNotifications(io, socket, state);
  setupPlayerRoomHandlers(io, socket, state);
  setupPlayerStateManager(io, socket, state);
  setupCountryAssignment(io, socket, state);
  setupChatHandlers(io, socket, state);
  
  console.log('Todos os handlers inicializados com sucesso');
}

export { initializeSocketHandlers };