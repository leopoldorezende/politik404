/**
 * Socket.io - Inicialização e coordenação de todos os handlers
 */

const { setupAuthHandlers } = require('./auth/authHandlers');
const { setupRoomManagement } = require('./room/roomManagement');
const { setupRoomNotifications } = require('./room/roomNotifications');
const { setupPlayerRoomHandlers } = require('./player/playerRoomHandlers');
const { setupPlayerStateManager } = require('./player/playerStateManager');
const { setupCountryAssignment } = require('./country/countryAssignment');
const { setupEconomyHandlers } = require('./economy/economyHandlers');
const { setupChatHandlers } = require('./chat/chatHandlers');
const { setupShipHandlers } = require('./ship/shipHandlers');
const { initializeGameState } = require('../shared/gameStateUtils');

/**
 * Inicializa todos os handlers de socket
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function initializeSocketHandlers(io, socket, gameState) {
  console.log('Inicializando todos os handlers de socket');
  
  // Inicializa as estruturas de dados do gameState se não existirem
  initializeGameState(gameState);
  
  // Configura os vários handlers
  setupAuthHandlers(io, socket, gameState);
  setupRoomManagement(io, socket, gameState);
  setupRoomNotifications(io, socket, gameState);
  setupPlayerRoomHandlers(io, socket, gameState);
  setupPlayerStateManager(io, socket, gameState);
  setupCountryAssignment(io, socket, gameState);
  setupChatHandlers(io, socket, gameState);
  setupShipHandlers(io, socket, gameState);
  
  // Configura os handlers de economia
  setupEconomyHandlers(io, socket, gameState);
  
  console.log('Todos os handlers inicializados com sucesso');
}

module.exports = { initializeSocketHandlers };