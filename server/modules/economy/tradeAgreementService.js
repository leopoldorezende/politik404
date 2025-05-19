/**
 * tradeAgreementService.js
 * Service for managing trade agreements between countries
 */

import { updateCountryEconomiesWithTradeAgreement } from './economyUpdateService.js';

/**
 * Setup periodic updates for trade-related economic calculations
 * @param {Object} io - Socket.io instance
 * @param {Object} gameState - Global game state
 */
function setupPeriodicTradeUpdates(io, gameState) {
  // Check if updates are already running
  if (gameState.tradeUpdateInterval) {
    clearInterval(gameState.tradeUpdateInterval);
  }
  
  // Setup interval for periodic updates (every 5 seconds)
  gameState.tradeUpdateInterval = setInterval(() => {
    // Process each room
    for (const [roomName, room] of gameState.rooms.entries()) {
      // Skip if no trade agreements
      if (!room.tradeAgreements || room.tradeAgreements.length === 0) {
        continue;
      }
      
      // Get all unique countries involved in trade agreements
      const tradingCountries = new Set();
      
      for (const agreement of room.tradeAgreements) {
        tradingCountries.add(agreement.originCountry);
        tradingCountries.add(agreement.country);
      }
      
      // Notify players in the room about updated trade agreements
      io.to(roomName).emit('tradeAgreementUpdated', {
        agreements: room.tradeAgreements,
        timestamp: Date.now()
      });
    }
  }, 5000); // Run every 5 seconds
  
  console.log('Periodic trade updates scheduled (every 5 seconds)');
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
  
  // Atualizar economias dos países envolvidos
  updateCountryEconomiesWithTradeAgreement(gameState, roomName, originAgreement);
  
  // Broadcast to all players in the room about the new agreements
  io.to(roomName).emit('tradeAgreementUpdated', {
    agreements: room.tradeAgreements,
    timestamp: Date.now()
  });
  
  // Notificar o criador especificamente que o acordo foi criado
  const originSocketId = gameState.usernameToSocketId?.get(originPlayer);
  if (originSocketId) {
    const originSocket = io.sockets.sockets.get(originSocketId);
    if (originSocket && originSocket.connected) {
      originSocket.emit('tradeAgreementCreated', originAgreement);
    }
  }
  
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
  
  // Atualizar economias dos países envolvidos (com impacto inverso)
  updateCountryEconomiesAfterAgreementCancellation(gameState, roomName, removedAgreement);
  
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

/**
 * Atualiza as economias dos países após cancelamento de um acordo
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {Object} agreement - Acordo cancelado
 */
function updateCountryEconomiesAfterAgreementCancellation(gameState, roomName, agreement) {
  const { originCountry, country: targetCountry } = agreement;
  
  // Atualizar economia do país de origem
  updateCountryEconomyForTrade(gameState, roomName, originCountry);
  
  // Atualizar economia do país de destino
  updateCountryEconomyForTrade(gameState, roomName, targetCountry);
}

/**
 * Atualiza a economia de um país com base em seus acordos comerciais
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 */
function updateCountryEconomyForTrade(gameState, roomName, countryName) {
  const room = gameState.rooms.get(roomName);
  if (!room) return;
  
  // Importa do módulo economy de forma mais específica
  // para evitar dependência cíclica
  const countryStateManager = global.countryStateManager; 
  if (!countryStateManager) return;
  
  // Atualizar economia através do countryStateManager
  const countryState = countryStateManager.getCountryState(roomName, countryName);
  if (!countryState) return;
  
  // Todas as atualizações de economia são gerenciadas através do countryStateManager
  countryStateManager.updateCountryStateForTrade(roomName, countryName, room.tradeAgreements || []);
}

export { 
  setupPeriodicTradeUpdates, 
  createTradeAgreement, 
  cancelTradeAgreement, 
  updateCountryEconomyForTrade
};