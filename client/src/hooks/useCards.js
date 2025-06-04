/**
 * useCards.js - Hook principal para gerenciar cards
 * Interface centralizada para consumir dados de cards
 */

import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { socketApi } from '../services/socketClient';
import {
  setPlayerCardsLoading,
  setPlayerCards,
  setPlayerPointsLoading,
  setPlayerPoints,
  setPlayerRankingLoading,
  setPlayerRanking,
  selectFilteredPlayerCards,
  selectPlayerCardStats,
  getCardTypeLabel,
  getCardTypePoints,
  CARD_TYPES
} from '../modules/cards/cardState';

/**
 * Hook principal para cards
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 * @returns {Object} - Dados e funções dos cards
 */
export const useCards = (roomName, countryName) => {
  const dispatch = useDispatch();
  
  // Estados do Redux
  const playerCards = useSelector(selectFilteredPlayerCards);
  const allPlayerCards = useSelector(state => state.cards.playerCards);
  const playerPoints = useSelector(state => state.cards.playerPoints);
  const playerRanking = useSelector(state => state.cards.playerRanking);
  const loading = useSelector(state => state.cards.loading);
  const lastUpdated = useSelector(state => state.cards.lastUpdated);
  const cardStats = useSelector(selectPlayerCardStats);
  
  // Estado local para controle
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // ========================================================================
  // FUNÇÕES DE BUSCA
  // ========================================================================
  
  const refreshPlayerCards = useCallback(async () => {
    if (!roomName || !countryName) return;
    
    dispatch(setPlayerCardsLoading(true));
    
    try {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('getPlayerCards');
      }
    } catch (error) {
      console.error('[CARDS] Error refreshing player cards:', error);
      dispatch(setPlayerCardsLoading(false));
    }
  }, [roomName, countryName, dispatch]);
  
  const refreshPlayerPoints = useCallback(async () => {
    if (!roomName || !countryName) return;
    
    dispatch(setPlayerPointsLoading(true));
    
    try {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('getPlayerPoints');
      }
    } catch (error) {
      console.error('[CARDS] Error refreshing player points:', error);
      dispatch(setPlayerPointsLoading(false));
    }
  }, [roomName, countryName, dispatch]);
  
  const refreshPlayerRanking = useCallback(async () => {
    if (!roomName) return;
    
    dispatch(setPlayerRankingLoading(true));
    
    try {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('getPlayerRanking');
      }
    } catch (error) {
      console.error('[CARDS] Error refreshing player ranking:', error);
      dispatch(setPlayerRankingLoading(false));
    }
  }, [roomName, dispatch]);
  
  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshPlayerCards(),
      refreshPlayerPoints(),
      refreshPlayerRanking()
    ]);
  }, [refreshPlayerCards, refreshPlayerPoints, refreshPlayerRanking]);
  
  // ========================================================================
  // EVENTOS DO SERVIDOR
  // ========================================================================
  
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    const handlePlayerCardsResponse = (data) => {
      if (data.roomName === roomName && data.country === countryName) {
        dispatch(setPlayerCards({
          cards: data.cards,
          timestamp: data.timestamp
        }));
      }
    };
    
    const handlePlayerPointsResponse = (data) => {
      if (data.roomName === roomName && data.country === countryName) {
        dispatch(setPlayerPoints({
          totalPoints: data.totalPoints,
          cardsByType: data.cardsByType,
          timestamp: data.timestamp
        }));
      }
    };
    
    const handlePlayerRankingResponse = (data) => {
      if (data.roomName === roomName) {
        dispatch(setPlayerRanking({
          ranking: data.ranking,
          timestamp: data.timestamp
        }));
      }
    };
    
    const handleCardsUpdated = (data) => {
      if (data.roomName === roomName) {
        // Auto-refresh quando cards são atualizados
        if (autoRefresh) {
          setTimeout(() => {
            refreshAll();
          }, 500);
        }
      }
    };
    
    // Registrar listeners
    socket.on('playerCardsResponse', handlePlayerCardsResponse);
    socket.on('playerPointsResponse', handlePlayerPointsResponse);
    socket.on('playerRankingResponse', handlePlayerRankingResponse);
    socket.on('cardsUpdated', handleCardsUpdated);
    
    return () => {
      socket.off('playerCardsResponse', handlePlayerCardsResponse);
      socket.off('playerPointsResponse', handlePlayerPointsResponse);
      socket.off('playerRankingResponse', handlePlayerRankingResponse);
      socket.off('cardsUpdated', handleCardsUpdated);
    };
  }, [roomName, countryName, dispatch, autoRefresh, refreshAll]);
  
  // ========================================================================
  // BUSCA INICIAL E PERIÓDICA
  // ========================================================================
  
  useEffect(() => {
    if (roomName && countryName) {
      // Busca inicial
      refreshAll();
      
      // Busca periódica (a cada 30 segundos)
      if (autoRefresh) {
        const interval = setInterval(() => {
          refreshAll();
        }, 30000);
        
        return () => clearInterval(interval);
      }
    }
  }, [roomName, countryName, autoRefresh, refreshAll]);
  
  // ========================================================================
  // FUNÇÕES UTILITÁRIAS
  // ========================================================================
  
  const getCardsByType = useCallback((cardType) => {
    return allPlayerCards.filter(card => card.type === cardType);
  }, [allPlayerCards]);
  
  const getActiveCards = useCallback(() => {
    return allPlayerCards.filter(card => card.status === 'active');
  }, [allPlayerCards]);
  
  const getCancelledCards = useCallback(() => {
    return allPlayerCards.filter(card => card.status === 'cancelled');
  }, [allPlayerCards]);
  
  const getTransferredCards = useCallback(() => {
    return allPlayerCards.filter(card => card.status === 'transferred');
  }, [allPlayerCards]);
  
  const getTotalPoints = useCallback(() => {
    return playerPoints.total || 0;
  }, [playerPoints.total]);
  
  const getPointsByType = useCallback((cardType) => {
    return playerPoints.cardsByType[cardType] || 0;
  }, [playerPoints.cardsByType]);
  
  const getRankingPosition = useCallback(() => {
    if (!countryName || !playerRanking.length) return null;
    
    const position = playerRanking.findIndex(player => player.owner === countryName);
    return position !== -1 ? position + 1 : null;
  }, [countryName, playerRanking]);
  
  const isDataStale = useCallback((dataType, maxAge = 60000) => {
    const lastUpdate = lastUpdated[dataType];
    if (!lastUpdate) return true;
    
    return Date.now() - lastUpdate > maxAge;
  }, [lastUpdated]);
  
  // ========================================================================
  // FUNÇÕES DE FORMATAÇÃO
  // ========================================================================
  
  const formatCardForDisplay = useCallback((card) => {
    return {
      ...card,
      typeLabel: getCardTypeLabel(card.type),
      pointsLabel: `${card.points} pt${card.points !== 1 ? 's' : ''}`,
      valueLabel: card.value ? `${card.value} bi USD` : '',
      timestampLabel: new Date(card.timestamp).toLocaleString('pt-BR'),
      statusLabel: {
        active: 'Ativo',
        cancelled: 'Cancelado',
        completed: 'Concluído',
        transferred: 'Transferido'
      }[card.status] || card.status
    };
  }, []);
  
  const formatRankingForDisplay = useCallback((ranking) => {
    return ranking.map((player, index) => ({
      ...player,
      position: index + 1,
      pointsLabel: `${player.totalPoints} pt${player.totalPoints !== 1 ? 's' : ''}`,
      statusLabel: player.isOnline ? 'Online' : 'Offline',
      typeLabel: player.isHuman ? 'Jogador' : 'IA'
    }));
  }, []);
  
  return {
    // Dados
    playerCards,
    allPlayerCards,
    playerPoints,
    playerRanking: formatRankingForDisplay(playerRanking),
    cardStats,
    
    // Estados
    loading,
    lastUpdated,
    autoRefresh,
    
    // Funções de busca
    refreshPlayerCards,
    refreshPlayerPoints,
    refreshPlayerRanking,
    refreshAll,
    
    // Funções utilitárias
    getCardsByType,
    getActiveCards,
    getCancelledCards,
    getTransferredCards,
    getTotalPoints,
    getPointsByType,
    getRankingPosition,
    isDataStale,
    
    // Funções de formatação
    formatCardForDisplay,
    
    // Funções de controle
    setAutoRefresh: (enabled) => setAutoRefresh(enabled),
    
    // Constantes
    CARD_TYPES,
    getCardTypeLabel,
    getCardTypePoints
  };
};

/**
 * Hook simplificado apenas para pontuação
 */
export const usePlayerPoints = (roomName, countryName) => {
  const { playerPoints, getTotalPoints, refreshPlayerPoints, loading } = useCards(roomName, countryName);
  
  return {
    totalPoints: getTotalPoints(),
    cardsByType: playerPoints.cardsByType,
    refresh: refreshPlayerPoints,
    loading: loading.playerPoints
  };
};

/**
 * Hook simplificado apenas para ranking
 */
export const usePlayerRanking = (roomName) => {
  const { playerRanking, refreshPlayerRanking, loading } = useCards(roomName, null);
  
  return {
    ranking: playerRanking,
    refresh: refreshPlayerRanking,
    loading: loading.playerRanking
  };
};

export default useCards;