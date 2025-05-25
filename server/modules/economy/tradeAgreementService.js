/**
 * tradeAgreementService.js (Corrigido)
 * Service for managing trade agreements between countries
 * ECONOMIA DELEGADA para countryStateManager
 */

import { SYNC_CONFIG } from '../../shared/config/syncConfig.js';
import intervalManager from '../../shared/utils/intervalManager.js';

/**
 * Setup periodic updates for trade-related economic calculations
 * @param {Object} io - Socket.io instance
 * @param {Object} gameState - Global game state
 */
function setupPeriodicTradeUpdates(io, gameState) {
  // Clear any existing trade update intervals
  intervalManager.clearByType('tradeUpdate');
  
  // Register new interval with proper management
  const intervalId = intervalManager.register(
    () => {
      // Process each room
      for (const [roomName, room] of gameState.rooms.entries()) {
        // Skip if no trade agreements
        if (!room.tradeAgreements || room.tradeAgreements.length === 0) {
          continue;
        }
        
        // Notify players in the room about updated trade agreements
        io.to(roomName).emit('tradeAgreementUpdated', {
          agreements: room.tradeAgreements,
          timestamp: Date.now()
        });
      }
    },
    SYNC_CONFIG.TRADE_PROCESSING_INTERVAL,
    'tradeUpdate',
    { scope: 'global', description: 'Trade agreements periodic broadcast' }
  );
  
  // Store reference for cleanup (optional - intervalManager handles it)
  gameState.tradeUpdateIntervalId = intervalId;
  
  console.log(`Periodic trade updates registered with ID: ${intervalId}`);
}

/**
 * Função auxiliar para criar acordo comercial
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {Object} agreementData - Dados do acordo
 * @returns {Object|null} - Acordo criado ou null em caso de erro
 */
function createTradeAgreement(io, gameState, roomName, agreementData) {
  const room = gameState.rooms.get(roomName);
  if (!room) return null;
  
  const { type, product, country, value, originCountry, originPlayer } = agreementData;
  
  // Create agreement object for the origin country
  const originAgreement = {
    id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    type,
    product,
    country,
    value,
    originCountry,
    originPlayer
  };
  
  // Create a mirrored agreement for the target country
  // If origin is import, target is export and vice versa
  const targetAgreement = {
    id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    type: type === 'import' ? 'export' : 'import', // Invert the type for the target country
    product,
    country: originCountry, // The target sees the origin country
    value,
    originCountry: country, // For the target, the origin is itself
    originPlayer: null // No player assigned for target country's perspective
  };
  
  // Inicializar array de acordos comerciais se não existir
  if (!room.tradeAgreements) {
    room.tradeAgreements = [];
  }
  
  // Remover acordos existentes conflitantes (mesmo tipo, produto e países)
  room.tradeAgreements = room.tradeAgreements.filter(existing => 
    !(existing.type === type && 
      existing.product === product && 
      existing.country === country && 
      existing.originCountry === originCountry) &&
    !(existing.type === targetAgreement.type && 
      existing.product === product && 
      existing.country === originCountry && 
      existing.originCountry === country)
  );
  
  // Adicionar os dois acordos (origem e destino)
  room.tradeAgreements.push(originAgreement);
  room.tradeAgreements.push(targetAgreement);
  
  console.log(`Created trade agreement:`, originAgreement);
  console.log(`Created mirrored trade agreement:`, targetAgreement);
  
  // DELEGADO: Atualizar economias usando countryStateManager
  const countryStateManager = global.countryStateManager;
  if (countryStateManager) {
    countryStateManager.performCompleteEconomicCalculation(roomName, originCountry);
    countryStateManager.performCompleteEconomicCalculation(roomName, country);
  }
  
  // Broadcast to all players in the room about the new agreements
  io.to(roomName).emit('tradeAgreementUpdated', {
    agreements: room.tradeAgreements,
    timestamp: Date.now()
  });
  
  return originAgreement;
}

/**
 * Cancela um acordo comercial existente
 * @param {Object} io - Instância do Socket.io 
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} agreementId - ID do acordo a ser cancelado
 * @param {string} userCountry - País do usuário que está cancelando
 * @param {Object} socket - Socket do cliente
 * @returns {boolean} - Verdadeiro se o acordo foi cancelado com sucesso
 */
function cancelTradeAgreement(io, gameState, roomName, agreementId, userCountry, socket) {
  const room = gameState.rooms.get(roomName);
  
  // Localizar o acordo
  const agreementIndex = room.tradeAgreements.findIndex(a => a.id === agreementId);
  
  if (agreementIndex === -1) {
    socket.emit('error', 'Trade agreement not found');
    return false;
  }
  
  const agreement = room.tradeAgreements[agreementIndex];
  
  // Verificar apenas se o usuário está envolvido no acordo de alguma forma
  // Se é originador ou destino
  const isInvolved = (agreement.originCountry === userCountry || 
                       agreement.country === userCountry);
  
  if (!isInvolved) {
    socket.emit('error', 'You are not involved in this trade agreement');
    return false;
  }
  
  // Remover o acordo
  const removedAgreement = room.tradeAgreements.splice(agreementIndex, 1)[0];
  
  // Encontrar e remover o acordo espelhado
  const mirroredType = agreement.type === 'import' ? 'export' : 'import';
  const mirroredCountry = agreement.originCountry;
  const mirroredOriginCountry = agreement.country;
  
  // Encontrar o acordo espelhado
  const mirroredIndex = room.tradeAgreements.findIndex(a => 
    a.type === mirroredType && 
    a.product === agreement.product && 
    a.country === mirroredCountry && 
    a.originCountry === mirroredOriginCountry
  );
  
  // Se encontrou, remove também
  if (mirroredIndex !== -1) {
    room.tradeAgreements.splice(mirroredIndex, 1);
  }
  
  // DELEGADO: Atualizar economias usando countryStateManager
  const countryStateManager = global.countryStateManager;
  if (countryStateManager) {
    countryStateManager.performCompleteEconomicCalculation(roomName, agreement.originCountry);
    countryStateManager.performCompleteEconomicCalculation(roomName, agreement.country);
  }
  
  console.log(`Trade agreement cancelled: ${removedAgreement.type} ${removedAgreement.product} with ${removedAgreement.country}`);
  
  // Send success response
  socket.emit('tradeAgreementCancelled', agreementId);
  
  // Broadcast to all players in the room
  io.to(roomName).emit('tradeAgreementUpdated', {
    agreements: room.tradeAgreements,
    timestamp: Date.now()
  });
  
  return true;
}

export { 
  setupPeriodicTradeUpdates, 
  createTradeAgreement, 
  cancelTradeAgreement
};