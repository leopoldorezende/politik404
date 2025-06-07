import { setupAuthHandlers } from './auth/authHandlers.js';
import { setupRoomManagement } from './room/roomManagement.js';
import { setupRoomNotifications } from './room/roomNotifications.js';
import { setupPlayerRoomHandlers } from './player/playerRoomHandlers.js';
import { setupPlayerStateManager } from './player/playerStateManager.js';
import { setupCountryAssignment } from './country/countryAssignment.js';
import { setupChatHandlers } from './chat/chatHandlers.js';
import { setupEconomyHandlers } from './economy/economyHandlers.js'; // Reduzido
import { setupTradeHandlers } from './trade/tradeHandlers.js'; // Novo
import { setupAllianceHandlers } from './alliance/allianceHandlers.js'; // Novo
import { setupCardHandlers } from './cards/cardHandlers.js'; // Novo

/**
 * Inicializa todos os handlers de socket - ARQUITETURA MODULARIZADA
 * Agora com separação de responsabilidades por domínio
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function initializeSocketHandlers(io, socket, gameState) {
  console.log('Inicializando handlers de socket - Arquitetura Modularizada');
  
  // Configura os handlers essenciais (TODOS SÃO NECESSÁRIOS)
  setupAuthHandlers(io, socket, gameState);
  setupRoomManagement(io, socket, gameState);
  setupRoomNotifications(io, socket, gameState);
  setupPlayerRoomHandlers(io, socket, gameState);
  setupPlayerStateManager(io, socket, gameState);
  setupCountryAssignment(io, socket, gameState);
  setupChatHandlers(io, socket, gameState);
  
  // Handlers modulares por domínio
  setupEconomyHandlers(io, socket, gameState); // Apenas economia pura
  setupTradeHandlers(io, socket, gameState); // Sistema de comércio
  setupAllianceHandlers(io, socket, gameState); // Sistema de alianças
  setupCardHandlers(io, socket, gameState); // Sistema de cards/pontuação
  
  console.log('✅ ALL modular handlers initialized - Economy + Trade + Alliance + Cards');
}

export { initializeSocketHandlers };