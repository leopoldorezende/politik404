/**
 * cardService.js - Central de Cards
 * Gerencia todos os tipos de cards mantendo compatibilidade com tradeAgreements
 */

import redis from '../redisClient.js';

// Tipos de cards e suas pontuações
export const CARD_TYPES = {
  EXPORT: { name: 'export', points: 2 },
  IMPORT: { name: 'import', points: 1 },
  POLITICAL_PACT: { name: 'political_pact', points: 3 },
  BUSINESS_PARTNERSHIP: { name: 'business_partnership', points: 3 },
  MEDIA_CONTROL: { name: 'media_control', points: 3 },
  STRATEGIC_COOPERATION: { name: 'strategic_cooperation', points: 4 },
  MILITARY_ALLIANCE: { name: 'military_alliance', points: 5 }
};

// Status dos cards
export const CARD_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  TRANSFERRED: 'transferred'
};

class CardService {
  constructor() {
    this.roomCards = new Map(); // roomName -> cards[]
    this.nextCardId = 1;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.loadFromRedis();
      this.initialized = true;
      console.log('[CARDS] CardService initialized');
    } catch (error) {
      console.error('[CARDS] Error initializing CardService:', error);
    }
  }

  /**
   * Cria um novo card
   * @param {string} roomName - Nome da sala
   * @param {Object} cardData - Dados do card
   * @returns {Object} - Card criado
   */
  createCard(roomName, cardData) {
    const {
      type,
      owner,
      target = null,
      value = 0,
      metadata = {},
      sourceAgreementId = null
    } = cardData;

    // Validar tipo de card
    const cardType = Object.values(CARD_TYPES).find(ct => ct.name === type);
    if (!cardType) {
      throw new Error(`Invalid card type: ${type}`);
    }

    const card = {
      id: `card-${this.nextCardId++}`,
      type: type,
      owner: owner,
      target: target,
      value: value,
      points: cardType.points,
      status: CARD_STATUS.ACTIVE,
      timestamp: Date.now(),
      roomName: roomName,
      sourceAgreementId: sourceAgreementId,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString()
      }
    };

    // Adicionar à sala
    if (!this.roomCards.has(roomName)) {
      this.roomCards.set(roomName, []);
    }
    
    this.roomCards.get(roomName).push(card);
    
    console.log(`[CARDS] Created ${type} card for ${owner} in room ${roomName}`);
    return card;
  }

  /**
   * Cria cards para acordo comercial (mantém compatibilidade)
   * @param {string} roomName - Nome da sala
   * @param {Object} agreementData - Dados do acordo
   * @returns {Array} - Cards criados [exportCard, importCard]
   */
  createTradeAgreementCards(roomName, agreementData) {
    const {
      type,
      product,
      country,
      value,
      originCountry,
      originPlayer,
      agreementId
    } = agreementData;

    const cards = [];

    // Card para o país de origem
    const originCard = this.createCard(roomName, {
      type: type, // 'export' ou 'import'
      owner: originCountry,
      target: country,
      value: value,
      sourceAgreementId: agreementId,
      metadata: {
        product: product,
        player: originPlayer,
        agreementType: 'trade'
      }
    });
    cards.push(originCard);

    // Card espelhado para o país alvo
    const mirrorType = type === 'export' ? 'import' : 'export';
    const targetCard = this.createCard(roomName, {
      type: mirrorType,
      owner: country,
      target: originCountry,
      value: value,
      sourceAgreementId: agreementId,
      metadata: {
        product: product,
        player: null, // País alvo pode ser IA
        agreementType: 'trade'
      }
    });
    cards.push(targetCard);

    return cards;
  }

  /**
   * Cancela um card
   * @param {string} roomName - Nome da sala
   * @param {string} cardId - ID do card
   * @returns {boolean} - Sucesso da operação
   */
  cancelCard(roomName, cardId) {
    const roomCards = this.roomCards.get(roomName);
    if (!roomCards) return false;

    const cardIndex = roomCards.findIndex(card => card.id === cardId);
    if (cardIndex === -1) return false;

    const card = roomCards[cardIndex];
    card.status = CARD_STATUS.CANCELLED;
    card.metadata.cancelledAt = new Date().toISOString();

    console.log(`[CARDS] Cancelled card ${cardId} in room ${roomName}`);
    return true;
  }

  /**
   * Cancela cards por acordo comercial
   * @param {string} roomName - Nome da sala
   * @param {string} agreementId - ID do acordo
   * @returns {number} - Número de cards cancelados
   */
  cancelCardsByAgreement(roomName, agreementId) {
    const roomCards = this.roomCards.get(roomName);
    if (!roomCards) return 0;

    let cancelledCount = 0;
    roomCards.forEach(card => {
      if (card.sourceAgreementId === agreementId && card.status === CARD_STATUS.ACTIVE) {
        card.status = CARD_STATUS.CANCELLED;
        card.metadata.cancelledAt = new Date().toISOString();
        cancelledCount++;
      }
    });

    console.log(`[CARDS] Cancelled ${cancelledCount} cards for agreement ${agreementId}`);
    return cancelledCount;
  }

  /**
   * Transfere um card entre jogadores
   * @param {string} roomName - Nome da sala
   * @param {string} cardId - ID do card
   * @param {string} newOwner - Novo proprietário
   * @returns {boolean} - Sucesso da operação
   */
  transferCard(roomName, cardId, newOwner) {
    const roomCards = this.roomCards.get(roomName);
    if (!roomCards) return false;

    const card = roomCards.find(c => c.id === cardId);
    if (!card || card.status !== CARD_STATUS.ACTIVE) return false;

    const oldOwner = card.owner;
    card.owner = newOwner;
    card.status = CARD_STATUS.TRANSFERRED;
    card.metadata.transferredAt = new Date().toISOString();
    card.metadata.previousOwner = oldOwner;

    console.log(`[CARDS] Transferred card ${cardId} from ${oldOwner} to ${newOwner}`);
    return true;
  }

  /**
   * Obtém cards de um jogador
   * @param {string} roomName - Nome da sala
   * @param {string} owner - Proprietário dos cards
   * @returns {Array} - Cards do jogador
   */
  getCardsByOwner(roomName, owner) {
    const roomCards = this.roomCards.get(roomName);
    if (!roomCards) return [];

    return roomCards.filter(card => 
      card.owner === owner && 
      (card.status === CARD_STATUS.ACTIVE || card.status === CARD_STATUS.TRANSFERRED)
    );
  }

  /**
   * Obtém todos os cards de uma sala
   * @param {string} roomName - Nome da sala
   * @returns {Array} - Todos os cards da sala
   */
  getCardsByRoom(roomName) {
    return this.roomCards.get(roomName) || [];
  }

  /**
   * Obtém cards por tipo
   * @param {string} roomName - Nome da sala
   * @param {string} type - Tipo do card
   * @returns {Array} - Cards do tipo especificado
   */
  getCardsByType(roomName, type) {
    const roomCards = this.roomCards.get(roomName);
    if (!roomCards) return [];

    return roomCards.filter(card => 
      card.type === type && 
      (card.status === CARD_STATUS.ACTIVE || card.status === CARD_STATUS.TRANSFERRED)
    );
  }

  /**
   * Calcula pontuação total de um jogador
   * @param {string} roomName - Nome da sala
   * @param {string} owner - Proprietário dos cards
   * @returns {number} - Pontuação total
   */
  calculatePlayerPoints(roomName, owner) {
    const playerCards = this.getCardsByOwner(roomName, owner);
    return playerCards.reduce((total, card) => total + card.points, 0);
  }

  /**
   * Obtém ranking de jogadores por pontuação
   * @param {string} roomName - Nome da sala
   * @returns {Array} - Ranking de jogadores
   */
  getPlayerRanking(roomName) {
    const roomCards = this.roomCards.get(roomName);
    if (!roomCards) return [];

    // Agrupar cards por proprietário
    const playerScores = {};
    
    roomCards.forEach(card => {
      if (card.status === CARD_STATUS.ACTIVE || card.status === CARD_STATUS.TRANSFERRED) {
        if (!playerScores[card.owner]) {
          playerScores[card.owner] = {
            owner: card.owner,
            totalPoints: 0,
            cardsByType: {}
          };
        }
        
        playerScores[card.owner].totalPoints += card.points;
        
        if (!playerScores[card.owner].cardsByType[card.type]) {
          playerScores[card.owner].cardsByType[card.type] = 0;
        }
        playerScores[card.owner].cardsByType[card.type]++;
      }
    });

    // Converter para array e ordenar por pontuação
    return Object.values(playerScores)
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }

  /**
   * Remove cards de acordo comercial (correção para o bug)
   * Esta função estava faltando e causava o erro na linha 122 do economyTrade.js
   * @param {string} roomName - Nome da sala
   * @param {string} agreementId - ID do acordo
   * @returns {number} - Número de cards removidos
   */
  removeTradeAgreementCards(roomName, agreementId) {
    try {
      console.log(`[ECONOMY-CARDS] Removing cards for agreement: ${agreementId}`);
      
      const roomCards = this.roomCards.get(roomName);
      if (!roomCards) {
        console.log(`[ECONOMY-CARDS] Room not found: ${roomName}`);
        return 0;
      }

      let removedCount = 0;
      
      // Remover cards do acordo (filtragem reversa para evitar problemas de índice)
      for (let i = roomCards.length - 1; i >= 0; i--) {
        const card = roomCards[i];
        if (card.sourceAgreementId === agreementId) {
          roomCards.splice(i, 1);
          removedCount++;
          console.log(`[ECONOMY-CARDS] Removed card: ${card.id} (${card.type}) from ${card.owner}`);
        }
      }

      console.log(`[ECONOMY-CARDS] Removed ${removedCount} cards for agreement ${agreementId}`);
      return removedCount;
    } catch (error) {
      console.error('[ECONOMY-CARDS] Error removing trade agreement cards:', error);
      return 0;
    }
  }

  /**
   * Remove sala e todos seus cards
   * @param {string} roomName - Nome da sala
   */
  removeRoom(roomName) {
    this.roomCards.delete(roomName);
    console.log(`[CARDS] Removed room ${roomName} and all its cards`);
  }

  /**
   * Obtém estatísticas de cards para debug
   * @returns {Object} - Estatísticas
   */
  getStats() {
    let totalCards = 0;
    let cardsByType = {};
    
    for (const [roomName, cards] of this.roomCards.entries()) {
      totalCards += cards.length;
      
      cards.forEach(card => {
        if (!cardsByType[card.type]) {
          cardsByType[card.type] = 0;
        }
        cardsByType[card.type]++;
      });
    }

    return {
      totalRooms: this.roomCards.size,
      totalCards: totalCards,
      cardsByType: cardsByType,
      nextCardId: this.nextCardId
    };
  }

  // ========================================================================
  // PERSISTÊNCIA
  // ========================================================================

  async saveToRedis() {
    try {
      const data = {
        roomCards: Object.fromEntries(this.roomCards),
        nextCardId: this.nextCardId
      };
      
      await redis.set('card_service_data', JSON.stringify(data));
      console.log(`[CARDS] Data saved to Redis - ${this.roomCards.size} rooms`);
    } catch (error) {
      console.error('[CARDS] Error saving to Redis:', error);
    }
  }

  async loadFromRedis() {
    try {
      const data = await redis.get('card_service_data');
      if (data) {
        const parsed = JSON.parse(data);
        
        this.roomCards = new Map(Object.entries(parsed.roomCards || {}));
        this.nextCardId = parsed.nextCardId || 1;
        
        console.log(`[CARDS] Loaded from Redis: ${this.roomCards.size} rooms`);
      }
    } catch (error) {
      console.error('[CARDS] Error loading from Redis:', error);
    }
  }

  cleanup() {
    this.saveToRedis();
    console.log('[CARDS] CardService cleanup completed');
  }
}

// Singleton instance
const cardService = new CardService();

export default cardService;