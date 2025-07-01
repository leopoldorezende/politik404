import { createSlice, createSelector } from '@reduxjs/toolkit';

// Tipos de cards e suas pontuações (sincronizado com backend) - UNIFICADO
export const CARD_TYPES = {
  EXPORT: { name: 'trade-export', points: 2, label: 'Exportação' },
  IMPORT: { name: 'trade-import', points: 1, label: 'Importação' },
  POLITICAL_PACT: { name: 'political-pact', points: 3, label: 'Pacto Político' },
  BUSINESS_PARTNERSHIP: { name: 'business-partnership', points: 3, label: 'Parceria Empresarial' },
  MEDIA_CONTROL: { name: 'media-control', points: 3, label: 'Controle de Mídia' },
  STRATEGIC_COOPERATION: { name: 'strategic-cooperation', points: 4, label: 'Cooperação Estratégica' },
  MILITARY_ALLIANCE: { name: 'military-alliance', points: 5, label: 'Aliança Militar', color: '#00bcd4' }
};

// Status dos cards
export const CARD_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'active', // Mantido para compatibilidade
  CANCELLED: 'cancelled',
  TRANSFERRED: 'transferred'
};

const initialState = {
  // Cards do jogador atual
  playerCards: [],
  
  // Pontuação do jogador atual
  playerPoints: {
    total: 0,
    cardsByType: {}
  },
  
  // Ranking de todos os jogadores
  playerRanking: [],
  
  // Estados de carregamento
  loading: {
    playerCards: false,
    playerPoints: false,
    playerRanking: false
  },
  
  // Última atualização
  lastUpdated: {
    playerCards: null,
    playerPoints: null,
    playerRanking: null
  }
};

export const cardState = createSlice({
  name: 'cards',
  initialState,
  reducers: {
    // ========================================================================
    // CARDS DO JOGADOR
    // ========================================================================
    
    setPlayerCardsLoading: (state, action) => {
      state.loading.playerCards = action.payload;
    },
    
    setPlayerCards: (state, action) => {
      const { cards, timestamp } = action.payload;
      state.playerCards = cards;
      state.lastUpdated.playerCards = timestamp;
      state.loading.playerCards = false;
    },
    
    addPlayerCard: (state, action) => {
      const card = action.payload;
      const existingIndex = state.playerCards.findIndex(c => c.id === card.id);
      
      if (existingIndex !== -1) {
        state.playerCards[existingIndex] = card;
      } else {
        state.playerCards.push(card);
      }
    },
    
    cardsUpdatedEvent: (state, action) => {
      state.needsRefresh = true;
      state.lastEventTimestamp = Date.now();
    },

    agreementUpdatedEvent: (state, action) => {
      state.needsRefresh = true;
      state.lastEventTimestamp = Date.now();
    },

    clearRefreshFlag: (state) => {
      state.needsRefresh = false;
    },
    
    removePlayerCard: (state, action) => {
      const cardId = action.payload;
      state.playerCards = state.playerCards.filter(card => card.id !== cardId);
    },
    
    updatePlayerCardStatus: (state, action) => {
      const { cardId, status, metadata } = action.payload;
      const cardIndex = state.playerCards.findIndex(card => card.id === cardId);
      
      if (cardIndex !== -1) {
        state.playerCards[cardIndex].status = status;
        if (metadata) {
          state.playerCards[cardIndex].metadata = {
            ...state.playerCards[cardIndex].metadata,
            ...metadata
          };
        }
      }
    },
    
    // ========================================================================
    // PONTUAÇÃO DO JOGADOR
    // ========================================================================
    
    setPlayerPointsLoading: (state, action) => {
      state.loading.playerPoints = action.payload;
    },
    
    setPlayerPoints: (state, action) => {
      const { totalPoints, cardsByType, timestamp } = action.payload;
      state.playerPoints = {
        total: totalPoints,
        cardsByType: cardsByType
      };
      state.lastUpdated.playerPoints = timestamp;
      state.loading.playerPoints = false;
    },
    
    updatePlayerPoints: (state, action) => {
      const { pointsChange, cardType } = action.payload;
      
      state.playerPoints.total += pointsChange;
      
      if (cardType) {
        if (!state.playerPoints.cardsByType[cardType]) {
          state.playerPoints.cardsByType[cardType] = 0;
        }
        
        if (pointsChange > 0) {
          state.playerPoints.cardsByType[cardType]++;
        } else {
          state.playerPoints.cardsByType[cardType] = Math.max(0, state.playerPoints.cardsByType[cardType] - 1);
        }
      }
    },
    
    // ========================================================================
    // RANKING DOS JOGADORES
    // ========================================================================
    
    setPlayerRankingLoading: (state, action) => {
      state.loading.playerRanking = action.payload;
    },
    
    setPlayerRanking: (state, action) => {
      const { ranking, timestamp } = action.payload;
      state.playerRanking = ranking;
      state.lastUpdated.playerRanking = timestamp;
      state.loading.playerRanking = false;
    },
    
    updatePlayerInRanking: (state, action) => {
      const { owner, totalPoints, cardsByType } = action.payload;
      const playerIndex = state.playerRanking.findIndex(p => p.owner === owner);
      
      if (playerIndex !== -1) {
        state.playerRanking[playerIndex].totalPoints = totalPoints;
        state.playerRanking[playerIndex].cardsByType = cardsByType;
        
        // Reordenar ranking
        state.playerRanking.sort((a, b) => b.totalPoints - a.totalPoints);
      }
    },
    
    // ========================================================================
    // RESET E LIMPEZA
    // ========================================================================
    
    resetCardState: (state) => {
      state.playerCards = [];
      state.playerPoints = { total: 0, cardsByType: {} };
      state.playerRanking = [];
      state.loading = {
        playerCards: false,
        playerPoints: false,
        playerRanking: false
      };
      state.lastUpdated = {
        playerCards: null,
        playerPoints: null,
        playerRanking: null
      };
    },
    
    resetPlayerData: (state) => {
      state.playerCards = [];
      state.playerPoints = { total: 0, cardsByType: {} };
      state.lastUpdated.playerCards = null;
      state.lastUpdated.playerPoints = null;
    }
  },
});

// ========================================================================
// SELETORES MEMOIZADOS (CORREÇÃO)
// ========================================================================

// ✅ CORREÇÃO: Selector base para playerCards
const selectPlayerCards = (state) => state.cards.playerCards;

// ✅ CORREÇÃO: Selector memoizado para estatísticas
export const selectPlayerCardStats = createSelector(
  [selectPlayerCards],
  (playerCards) => {
    const stats = {
      total: playerCards.length,
      active: 0,
      cancelled: 0,
      totalValue: 0,
      totalPoints: 0
    };
    
    playerCards.forEach(card => {
      if (card.status === CARD_STATUS.ACTIVE) stats.active++;
      else if (card.status === CARD_STATUS.CANCELLED) stats.cancelled++;
      
      if (card.status === CARD_STATUS.ACTIVE) {
        stats.totalPoints += card.points;
        stats.totalValue += card.value || 0;
      }
    });
    
    return stats;
  }
);

// Obter label de um tipo de card
export const getCardTypeLabel = (cardType) => {
  const typeInfo = Object.values(CARD_TYPES).find(ct => ct.name === cardType);
  return typeInfo ? typeInfo.label : cardType;
};

// Obter pontos de um tipo de card
export const getCardTypePoints = (cardType) => {
  const typeInfo = Object.values(CARD_TYPES).find(ct => ct.name === cardType);
  return typeInfo ? typeInfo.points : 0;
};

export const {
  setPlayerCardsLoading,
  setPlayerCards,
  addPlayerCard,
  removePlayerCard,
  updatePlayerCardStatus,
  setPlayerPointsLoading,
  setPlayerPoints,
  updatePlayerPoints,
  setPlayerRankingLoading,
  setPlayerRanking,
  updatePlayerInRanking,
  resetCardState,
  resetPlayerData
} = cardState.actions;

export default cardState.reducer;