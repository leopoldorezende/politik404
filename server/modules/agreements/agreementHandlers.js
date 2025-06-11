// =====================================================================
// HANDLER UNIFICADO DE ACORDOS - FASE 1
// =====================================================================
// Local: server/modules/agreements/agreementHandlers.js

import agreementEngine from './agreementEngine.js';
import { mapLegacyType } from '../../shared/config/agreementTypeRegistry.js';

/**
 * Handler único que substitui todos os handlers específicos de acordo
 * Centraliza todo o processamento através do AgreementEngine
 * Mantém compatibilidade com eventos existentes através de mapeamento
 */
function setupAgreementHandlers(io, socket, gameState) {
  console.log('🎯 Agreement Engine handlers initialized - UNIFIED SYSTEM');

  // =====================================================================
  // EVENTOS UNIFICADOS PRINCIPAIS
  // =====================================================================

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

  // =====================================================================
  // EVENTOS DE COMPATIBILIDADE LEGADA
  // =====================================================================

  /**
   * Mapeamento de eventos antigos para sistema unificado
   * Mantém compatibilidade durante transição
   */

  // COMÉRCIO - Compatibilidade
  socket.on('sendTradeProposal', async (proposal) => {
    console.log('🔄 Legacy trade proposal mapped to unified system');
    const unifiedProposal = {
      ...proposal,
      agreementType: 'trade-' + proposal.type // import/export -> trade-import/trade-export
    };
    await agreementEngine.processProposal(socket, gameState, io, unifiedProposal);
  });

  socket.on('respondToTradeProposal', async (response) => {
    console.log('🔄 Legacy trade response mapped to unified system');
    const unifiedResponse = {
      ...response,
      agreementType: 'trade'
    };
    await agreementEngine.handleResponse(socket, gameState, io, unifiedResponse);
  });

  socket.on('cancelTradeAgreement', async (cardId) => {
    console.log('🔄 Legacy trade cancellation mapped to unified system');
    await agreementEngine.cancelAgreement(socket, gameState, io, {
      cardId,
      agreementType: 'trade'
    });
  });

  // ALIANÇA - Compatibilidade
  socket.on('sendAllianceProposal', async (proposal) => {
    console.log('🔄 Legacy alliance proposal mapped to unified system');
    const unifiedProposal = {
      ...proposal,
      agreementType: 'military-alliance'
    };
    await agreementEngine.processProposal(socket, gameState, io, unifiedProposal);
  });

  socket.on('respondToAllianceProposal', async (response) => {
    console.log('🔄 Legacy alliance response mapped to unified system');
    const unifiedResponse = {
      ...response,
      agreementType: 'military-alliance'
    };
    await agreementEngine.handleResponse(socket, gameState, io, unifiedResponse);
  });

  socket.on('cancelMilitaryAlliance', async (cardId) => {
    console.log('🔄 Legacy alliance cancellation mapped to unified system');
    await agreementEngine.cancelAgreement(socket, gameState, io, {
      cardId,
      agreementType: 'military-alliance'
    });
  });

  // COOPERAÇÃO - Compatibilidade
  socket.on('sendCooperationProposal', async (proposal) => {
    console.log('🔄 Legacy cooperation proposal mapped to unified system');
    const unifiedProposal = {
      ...proposal,
      agreementType: 'strategic-cooperation'
    };
    await agreementEngine.processProposal(socket, gameState, io, unifiedProposal);
  });

  socket.on('respondToCooperationProposal', async (response) => {
    console.log('🔄 Legacy cooperation response mapped to unified system');
    const unifiedResponse = {
      ...response,
      agreementType: 'strategic-cooperation'
    };
    await agreementEngine.handleResponse(socket, gameState, io, unifiedResponse);
  });

  socket.on('cancelStrategicCooperation', async (cardId) => {
    console.log('🔄 Legacy cooperation cancellation mapped to unified system');
    await agreementEngine.cancelAgreement(socket, gameState, io, {
      cardId,
      agreementType: 'strategic-cooperation'
    });
  });

  // =====================================================================
  // EVENTOS INTERNOS (NOVOS)
  // =====================================================================

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

// =====================================================================
// EVENTOS GLOBAIS DO AGREEMENT ENGINE
// =====================================================================

/**
 * Configurar eventos globais do io para o Agreement Engine
 */
export function setupGlobalAgreementEvents(io) {
  // Armazenar referência global do io para notificações
  global.io = io;
  
  console.log('🌐 Global Agreement Engine events configured');
}

// =====================================================================
// UTILITÁRIOS DE MIGRAÇÃO
// =====================================================================

/**
 * Migrar dados de acordos existentes para novo formato
 * Executar durante inicialização do servidor
 */
export function migrateExistingAgreements(gameState) {
  console.log('🔄 Migrating existing agreements to unified format...');
  
  try {
    if (!gameState.rooms) return;

    gameState.rooms.forEach((room, roomName) => {
      // Migrar acordos comerciais
      if (room.tradeAgreements) {
        room.tradeAgreements.forEach(agreement => {
          // Normalizar formato se necessário
          if (!agreement.normalizedType) {
            agreement.normalizedType = `trade-${agreement.type}`;
          }
        });
      }

      // Migrar cards de acordo se necessário
      if (global.cardService && room.cards) {
        // Atualizar tipos de card para formato unificado
        room.cards.forEach(card => {
          if (card.type === 'military_alliance') {
            card.normalizedType = 'military-alliance';
          } else if (card.type === 'strategic_cooperation') {
            card.normalizedType = 'strategic-cooperation';
          }
        });
      }
    });

    console.log('✅ Agreement migration completed successfully');
  } catch (error) {
    console.error('❌ Error during agreement migration:', error);
  }
}

export { setupAgreementHandlers }