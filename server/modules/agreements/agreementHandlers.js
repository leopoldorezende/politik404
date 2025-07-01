// Local: server/modules/agreements/agreementHandlers.js

import agreementEngine from './agreementEngine.js';
import { mapLegacyType } from '../../shared/config/agreementTypeRegistry.js';
import { getCurrentRoom } from '../../shared/utils/gameStateUtils.js';

/**
 * Handler único que centraliza todo o processamento através do AgreementEngine
 */
function setupAgreementHandlers(io, socket, gameState) {
  console.log('🎯 Agreement Engine handlers initialized - UNIFIED SYSTEM');

  /**
   * Evento principal para envio de propostas de acordo
   * Substitui sendTradeProposal, sendAllianceProposal, sendCooperationProposal
   */
  socket.on('sendAgreementProposal', async (proposalData) => {
    console.log('📤 Unified proposal received:', proposalData);
    await agreementEngine.processProposal(socket, gameState, io, proposalData);
  });

  /**
   * Evento principal para resposta a propostas
   * Substitui respondToTradeProposal, respondToAllianceProposal, respondToCooperationProposal
   */
  socket.on('respondToAgreementProposal', async (response) => {
    console.log('📥 Unified response received:', response);
    await agreementEngine.handleResponse(socket, gameState, io, response);
  });

  /**
   * Evento principal para cancelamento de acordos
   * Substitui cancelTradeAgreement, cancelMilitaryAlliance, cancelStrategicCooperation
   */
  socket.on('cancelAgreement', async (cancellationData) => {
    console.log('🗑️ Unified cancellation received:', cancellationData);
    await agreementEngine.cancelAgreement(socket, gameState, io, cancellationData);
  });

  /**
   * Tentativa de criação de acordo interno
   * Não requer proposta - criação direta com probabilidade
   */
  socket.on('attemptInternalAgreement', async (data) => {
    console.log('🏛️ Internal agreement attempt:', data);
    
    const proposalData = {
      type: data.type, // political_pact, business_partnership, media_control
      agreementType: data.type
    };
    
    await agreementEngine.processProposal(socket, gameState, io, proposalData);
  });

  // =====================================================================
  // EVENTOS DE CONSULTA
  // =====================================================================

  /**
   * Obter acordos ativos por tipo
   */
  socket.on('getActiveAgreements', (data) => {
    const { type } = data || {};
    
    try {
      const roomName = socket.currentRoom;
      const username = socket.username;
      
      if (!roomName || !username || !global.cardService) {
        socket.emit('activeAgreements', { agreements: [] });
        return;
      }

      // Obter país do usuário
      const userCountry = agreementEngine.getUserCountry(gameState, roomName, username);
      if (!userCountry) {
        socket.emit('activeAgreements', { agreements: [] });
        return;
      }

      // Obter cards do usuário
      let cards = global.cardService.getCardsByOwner(roomName, userCountry);
      
      // Filtrar por tipo se especificado
      if (type) {
        const normalizedType = mapLegacyType(type);
        cards = cards.filter(card => 
          card.type === normalizedType || 
          card.type === normalizedType.replace('-', '_')
        );
      }

      socket.emit('activeAgreements', { 
        agreements: cards,
        country: userCountry 
      });

    } catch (error) {
      console.error('Erro ao obter acordos ativos:', error);
      socket.emit('activeAgreements', { agreements: [] });
    }
  });

  // =====================================================================
  // EVENTOS DE SISTEMA
  // =====================================================================

  /**
   * Obter configurações disponíveis de acordo
   */
  socket.on('getAgreementTypes', () => {
    try {
      const types = Object.keys(AGREEMENT_TYPES).map(key => ({
        id: key,
        ...AGREEMENT_TYPES[key],
        validation: undefined, // Remover funções do cliente
        creation: undefined
      }));

      socket.emit('agreementTypes', { types });
    } catch (error) {
      console.error('Erro ao obter tipos de acordo:', error);
      socket.emit('agreementTypes', { types: [] });
    }
  });

  /**
   * Limpeza quando socket desconectar
   */
  socket.on('disconnect', () => {
    console.log('🧹 Cleaning up agreement data for disconnected socket:', socket.id);
  });

  /**
   * Handler para buscar cards do jogador (integrado ao sistema unificado)
   */
  socket.on('getPlayerCards', async () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = agreementEngine.getUserCountry(gameState, roomName, username);
  
    if (!username || !roomName || !userCountry) {
      console.error('[UNIFIED-CARDS] getPlayerCards: Missing data');
      return;
    }

    try {
      if (!global.cardService || !global.cardService.initialized) {
        console.error('[UNIFIED-CARDS] CardService not initialized');
        socket.emit('playerCardsResponse', {
          roomName,
          country: userCountry,
          cards: [],
          timestamp: Date.now()
        });
        return;
      }

      const cards = global.cardService.getCardsByOwner(roomName, userCountry);
      console.log(`[UNIFIED-CARDS] Sending ${cards.length} cards for ${userCountry} in ${roomName}`);
      
      socket.emit('playerCardsResponse', {
        roomName,
        country: userCountry,
        cards: cards,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('[UNIFIED-CARDS] Error getting player cards:', error);
      socket.emit('playerCardsResponse', {
        roomName,
        country: userCountry,
        cards: [],
        timestamp: Date.now()
      });
    }
  });

  /**
   * Handler para buscar pontuação do jogador (integrado ao sistema unificado)
   */
  socket.on('getPlayerPoints', async () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = agreementEngine.getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      console.error('[UNIFIED-CARDS] getPlayerPoints: Missing data');
      return;
    }

    try {
      if (!global.cardService || !global.cardService.initialized) {
        console.error('[UNIFIED-CARDS] CardService not initialized');
        socket.emit('playerPointsResponse', {
          roomName,
          country: userCountry,
          totalPoints: 0,
          cardsByType: {},
          timestamp: Date.now()
        });
        return;
      }

      const totalPoints = global.cardService.calculatePlayerPoints(roomName, userCountry);
      const cards = global.cardService.getCardsByOwner(roomName, userCountry);
      
      // Calcular cards por tipo
      const cardsByType = {};
      cards.forEach(card => {
        if (card.status === 'active') {
          cardsByType[card.type] = (cardsByType[card.type] || 0) + 1;
        }
      });

      console.log(`[UNIFIED-CARDS] Sending ${totalPoints} points for ${userCountry} in ${roomName}`);
      
      socket.emit('playerPointsResponse', {
        roomName,
        country: userCountry,
        totalPoints: totalPoints,
        cardsByType: cardsByType,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('[UNIFIED-CARDS] Error getting player points:', error);
      socket.emit('playerPointsResponse', {
        roomName,
        country: userCountry,
        totalPoints: 0,
        cardsByType: {},
        timestamp: Date.now()
      });
    }
  });

  socket.on('getPlayerRanking', async () => {
    const roomName = getCurrentRoom(socket, gameState);
    
    if (!roomName) {
      console.error('[UNIFIED-CARDS] getPlayerRanking: Missing room name');
      return;
    }
    try {
      if (!global.cardService || !global.cardService.initialized) {
        console.error('[UNIFIED-CARDS] CardService not initialized');
        socket.emit('playerRankingResponse', {
          roomName,
          ranking: [],
          timestamp: Date.now()
        });
        return;
      }

      const ranking = global.cardService.getPlayerRanking(roomName);
      console.log(`[UNIFIED-CARDS] Sending ranking with ${ranking.length} players for ${roomName}`);
      
      socket.emit('playerRankingResponse', {
        roomName,
        ranking: ranking,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('[UNIFIED-CARDS] Error getting player ranking:', error);
      socket.emit('playerRankingResponse', {
        roomName,
        ranking: [],
        timestamp: Date.now()
      });
    }
  });
  
  // =====================================================================
  // MIDDLEWARE E INTERCEPTADORES
  // =====================================================================

  /**
   * Interceptar eventos antigos e dar warning de depreciação
   */
  const deprecatedEvents = [
    'sendTradeProposal', 'sendAllianceProposal', 'sendCooperationProposal',
    'respondToTradeProposal', 'respondToAllianceProposal', 'respondToCooperationProposal',
    'cancelTradeAgreement', 'cancelMilitaryAlliance', 'cancelStrategicCooperation'
  ];

  deprecatedEvents.forEach(eventName => {
    const originalHandler = socket.listeners(eventName)[0];
    if (originalHandler) {
      socket.off(eventName, originalHandler);
      socket.on(eventName, (...args) => {
        console.warn(`⚠️  DEPRECATED: Event '${eventName}' is deprecated. Use unified agreement events instead.`);
        originalHandler(...args);
      });
    }
  });

  /**
   * Handler específico para cancelar aliança militar
   */
  socket.on('cancelMilitaryAlliance', (cardId) => {
    console.log('🗑️ cancelMilitaryAlliance received:', cardId);
    
    try {
      const username = socket.username;
      const roomName = getCurrentRoom(socket, gameState);
      
      if (!username || !roomName) {
        console.log('❌ Missing auth data');
        socket.emit('error', 'Dados de sessão inválidos');
        return;
      }

      // Obter país do usuário
      const room = gameState.rooms.get(roomName);
      const player = room?.players?.find(p => 
        typeof p === 'object' && p.username === username
      );
      
      if (!player?.country) {
        console.log('❌ Player/country not found');
        socket.emit('error', 'Jogador não encontrado');
        return;
      }

      if (!global.cardService) {
        console.log('❌ CardService not available');
        socket.emit('error', 'Serviço de cards não disponível');
        return;
      }

      // Obter o card
      const card = global.cardService.getCardById(roomName, cardId);
      if (!card) {
        console.log('❌ Card not found:', cardId);
        socket.emit('error', 'Aliança militar não encontrada');
        return;
      }

      // Verificar se é realmente uma aliança militar
      if (card.type !== 'military_alliance' && card.type !== 'military-alliance') {
        console.log('❌ Not a military alliance:', card.type);
        socket.emit('error', 'Este não é um card de aliança militar');
        return;
      }

      // Verificar permissão
      if (card.owner !== player.country) {
        console.log('❌ Permission denied:', card.owner, 'vs', player.country);
        socket.emit('error', 'Sem permissão para cancelar esta aliança');
        return;
      }

      console.log('✅ Cancelling military alliance:', cardId, card.owner, '↔', card.target);

      // Remover AMBOS os cards da aliança (bilateral) - aceitar ambos os formatos
      const removedCount = global.cardService.removeAgreementCards(
        roomName, 
        'military-alliance', 
        card.owner, 
        card.target
      ) || global.cardService.removeAgreementCards(
        roomName, 
        'military_alliance', 
        card.owner, 
        card.target
      );

      if (removedCount > 0) {
        console.log('✅ Military alliance cancelled successfully:', removedCount, 'cards removed');
        
        // Notificar toda a sala
        io.to(roomName).emit('cardsUpdated', {
          roomName,
          action: 'military_alliance_cancelled',
          cardId,
          owner: card.owner,
          target: card.target,
          timestamp: Date.now()
        });
        
        // Notificar específico para alianças militares
        io.to(roomName).emit('militaryAllianceCancelled', {
          cardId,
          owner: card.owner,
          target: card.target,
          timestamp: Date.now()
        });
        
        console.log('✅ Military alliance cancellation events emitted');
      } else {
        console.log('❌ Failed to remove military alliance cards');
        socket.emit('error', 'Falha ao cancelar aliança militar');
      }

    } catch (error) {
      console.error('❌ Error in cancelMilitaryAlliance:', error);
      socket.emit('error', 'Erro interno ao cancelar aliança');
    }
  });

  /**
   * Handler específico para cancelar cooperação estratégica
   */
  socket.on('cancelStrategicCooperation', (cardId) => {
    console.log('🗑️ cancelStrategicCooperation received:', cardId);
    
    try {
      const username = socket.username;
      const roomName = getCurrentRoom(socket, gameState);
      
      if (!username || !roomName) {
        socket.emit('error', 'Dados de sessão inválidos');
        return;
      }

      const room = gameState.rooms.get(roomName);
      const player = room?.players?.find(p => 
        typeof p === 'object' && p.username === username
      );
      
      if (!player?.country || !global.cardService) {
        socket.emit('error', 'Erro de validação');
        return;
      }

      const card = global.cardService.getCardById(roomName, cardId);
      if (!card || (card.type !== 'strategic_cooperation' && card.type !== 'strategic-cooperation') || card.owner !== player.country) {
        socket.emit('error', 'Cooperação estratégica não encontrada ou sem permissão');
        return;
      }

      console.log('✅ Cancelling strategic cooperation:', cardId, card.owner, '↔', card.target);

      // Remover cards - aceitar ambos os formatos
      const removedCount = global.cardService.removeAgreementCards(
        roomName, 
        'strategic-cooperation', 
        card.owner, 
        card.target
      ) || global.cardService.removeAgreementCards(
        roomName, 
        'strategic_cooperation', 
        card.owner, 
        card.target
      );

      if (removedCount > 0) {
        console.log('✅ Strategic cooperation cancelled:', removedCount, 'cards removed');
        
        io.to(roomName).emit('cardsUpdated', {
          roomName,
          action: 'strategic_cooperation_cancelled',
          cardId,
          owner: card.owner,
          target: card.target,
          timestamp: Date.now()
        });
        
        io.to(roomName).emit('cooperationCancelled', {
          cardId,
          owner: card.owner,
          target: card.target,
          timestamp: Date.now()
        });
      } else {
        socket.emit('error', 'Falha ao cancelar cooperação estratégica');
      }

    } catch (error) {
      console.error('❌ Error in cancelStrategicCooperation:', error);
      socket.emit('error', 'Erro interno');
    }
  });

  /**
   * Handler específico para cancelar acordo comercial
   */
  socket.on('cancelTradeAgreement', (agreementId) => {
    console.log('🗑️ cancelTradeAgreement received:', agreementId);
    
    try {
      const username = socket.username;
      const roomName = getCurrentRoom(socket, gameState);
      
      if (!username || !roomName || !global.cardService) {
        socket.emit('error', 'Dados de sessão inválidos');
        return;
      }

      const room = gameState.rooms.get(roomName);
      const player = room?.players?.find(p => 
        typeof p === 'object' && p.username === username
      );
      
      if (!player?.country) {
        socket.emit('error', 'Jogador não encontrado');
        return;
      }

      console.log('✅ Cancelling trade agreement:', agreementId);

      // Cancelar todos os cards relacionados ao acordo comercial
      const cancelledCount = global.cardService.cancelCardsByAgreement(roomName, agreementId);

      if (cancelledCount > 0) {
        console.log('✅ Trade agreement cancelled:', cancelledCount, 'cards cancelled');
        
        io.to(roomName).emit('cardsUpdated', {
          roomName,
          action: 'trade_agreement_cancelled',
          agreementId,
          timestamp: Date.now()
        });
        
        io.to(roomName).emit('tradeAgreementCancelled', agreementId);
      } else {
        socket.emit('error', 'Acordo comercial não encontrado ou já cancelado');
      }

    } catch (error) {
      console.error('❌ Error in cancelTradeAgreement:', error);
      socket.emit('error', 'Erro interno');
    }
  });


  console.log('✅ Agreement Engine setup complete - All handlers registered');
}

export { setupAgreementHandlers }