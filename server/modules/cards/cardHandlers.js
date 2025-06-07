/**
 * cardHandlers.js - Handlers para sistema de cards
 * Código movido EXATAMENTE de economyHandlers.js sem modificações
 */

import { getCurrentRoom } from '../../shared/utils/gameStateUtils.js';

/**
 * Setup card-related socket event handlers
 */
function setupCardHandlers(io, socket, gameState) {
  console.log('Card handlers initialized');

  // ======================================================================
  // Endpoints para Cards
  // ======================================================================

  /**
   * Obter todos os cards de um jogador
   */
  socket.on('getPlayerCards', () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    if (!global.cardService || !global.cardService.initialized) {
      socket.emit('error', 'Card service not available');
      return;
    }
    
    try {
      const playerCards = global.cardService.getCardsByOwner(roomName, userCountry);
      const totalPoints = global.cardService.calculatePlayerPoints(roomName, userCountry);
      
      socket.emit('playerCardsResponse', {
        roomName: roomName,
        country: userCountry,
        cards: playerCards,
        totalPoints: totalPoints,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[CARDS] Error getting player cards:', error);
      socket.emit('error', 'Failed to get player cards');
    }
  });

  /**
   * Obter pontuação de um jogador
   */
  socket.on('getPlayerPoints', () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    if (!global.cardService || !global.cardService.initialized) {
      socket.emit('error', 'Card service not available');
      return;
    }
    
    try {
      const totalPoints = global.cardService.calculatePlayerPoints(roomName, userCountry);
      const cardsByType = {};
      
      // Contar cards por tipo
      const playerCards = global.cardService.getCardsByOwner(roomName, userCountry);
      playerCards.forEach(card => {
        if (!cardsByType[card.type]) {
          cardsByType[card.type] = 0;
        }
        cardsByType[card.type]++;
      });
      
      socket.emit('playerPointsResponse', {
        roomName: roomName,
        country: userCountry,
        totalPoints: totalPoints,
        cardsByType: cardsByType,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[CARDS] Error getting player points:', error);
      socket.emit('error', 'Failed to get player points');
    }
  });

  /**
   * Obter ranking de jogadores
   */
  socket.on('getPlayerRanking', () => {
    const roomName = getCurrentRoom(socket, gameState);
    
    if (!roomName) {
      socket.emit('error', 'Not in a room');
      return;
    }
    
    if (!global.cardService || !global.cardService.initialized) {
      socket.emit('error', 'Card service not available');
      return;
    }
    
    try {
      const ranking = global.cardService.getPlayerRanking(roomName);
      
      // Enriquecer ranking com informações dos jogadores
      const room = gameState.rooms.get(roomName);
      const enrichedRanking = ranking.map(playerScore => {
        const player = room?.players?.find(p => 
          typeof p === 'object' && p.country === playerScore.owner
        );
        
        return {
          ...playerScore,
          playerName: player?.username || null,
          isHuman: !player || !player.isOnline ? false : true,
          isOnline: player?.isOnline || false
        };
      });
      
      socket.emit('playerRankingResponse', {
        roomName: roomName,
        ranking: enrichedRanking,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[CARDS] Error getting player ranking:', error);
      socket.emit('error', 'Failed to get player ranking');
    }
  });

  /**
   * Obter estatísticas do serviço de cards (debug)
   */
  socket.on('getCardServiceStats', () => {
    if (process.env.NODE_ENV !== 'development') {
      socket.emit('error', 'Card service stats only available in development');
      return;
    }
    
    if (!global.cardService || !global.cardService.initialized) {
      socket.emit('error', 'Card service not available');
      return;
    }
    
    try {
      const stats = global.cardService.getStats();
      socket.emit('cardServiceStatsResponse', stats);
    } catch (error) {
      console.error('[CARDS] Error getting card service stats:', error);
      socket.emit('error', 'Failed to get card service stats');
    }
  });
}

/**
 * Função auxiliar para obter país do usuário (PRESERVADA)
 */
function getUserCountry(gameState, roomName, username) {
  if (!roomName || !username) return null;
  
  const room = gameState.rooms.get(roomName);
  if (!room || !room.players) return null;
  
  const player = room.players.find(p => {
    if (typeof p === 'object') {
      return p.username === username;
    }
    return false;
  });
  
  const country = player?.country || null;
  return country;
}

export { setupCardHandlers };