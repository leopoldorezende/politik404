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

  /**
   * Verificar status de cooldown
   */
  socket.on('checkCooldownStatus', (data) => {
    const { agreementType } = data || {};
    
    if (!agreementType) {
      socket.emit('cooldownStatus', { inCooldown: false });
      return;
    }

    try {
      const normalizedType = mapLegacyType(agreementType);
      const config = getAgreementTypeConfig(normalizedType);
      
      if (!config) {
        socket.emit('cooldownStatus', { inCooldown: false });
        return;
      }

      const inCooldown = agreementEngine.isInCooldown(socket.id, normalizedType, config.cooldownTime);
      const remaining = inCooldown ? 
        agreementEngine.getRemainingCooldown(socket.id, normalizedType, config.cooldownTime) : 0;

      socket.emit('cooldownStatus', {
        inCooldown,
        remaining: Math.ceil(remaining / 1000),
        type: agreementType
      });

    } catch (error) {
      console.error('Erro ao verificar cooldown:', error);
      socket.emit('cooldownStatus', { inCooldown: false });
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
    agreementEngine.cleanupSocket(socket.id);
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

  console.log('✅ Agreement Engine setup complete - All handlers registered');
}

export { setupAgreementHandlers }