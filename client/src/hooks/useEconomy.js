/**
 * useEconomy.js - Hook para dados econômicos
 * VERSÃO ATUALIZADA para trabalhar com cálculos econômicos avançados
 * Preserva toda funcionalidade existente e adiciona novos campos
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { socketApi } from '../services/socketClient';

/**
 * Hook principal para dados econômicos - EXPANDIDO
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 * @returns {Object} - Dados econômicos expandidos
 */
export function useEconomy(roomName, countryName) {
  const [economicIndicators, setEconomicIndicators] = useState(null);
  const [countryData, setCountryData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Ref para evitar updates desnecessários
  const lastDataRef = useRef(null);
  const subscriptionRef = useRef(false);

  /**
   * Função para formatar percentuais
   */
  const formatPercent = useCallback((value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0%';
    return Number(value).toFixed(1) + '%';
  }, []);

  /**
   * Função para formatar moeda
   */
  const formatCurrency = useCallback((value, decimals = 2) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00';
    return Number(value).toFixed(decimals);
  }, []);

  /**
   * Processar dados econômicos avançados recebidos do servidor
   */
  const processEconomicData = useCallback((states) => {
    if (!states || !countryName || !states[countryName]) {
      setEconomicIndicators(null);
      setCountryData(null);
      setLoading(false);
      return;
    }

    const countryState = states[countryName];
    const economy = countryState.economy || {};

    // ===== INDICADORES EXPANDIDOS =====
    const expandedIndicators = {
      // Indicadores principais (preservados)
      gdp: economy.gdp || 0,
      gdpGrowth: economy.gdpGrowth || 0,
      treasury: economy.treasury || 0,
      publicDebt: economy.publicDebt || 0,
      inflation: economy.inflation || 0,
      unemployment: economy.unemployment || 0,
      popularity: economy.popularity || 0,
      creditRating: economy.creditRating || 'A',
      
      // Controles econômicos (preservados)
      interestRate: economy.interestRate || 8,
      taxBurden: economy.taxBurden || 40,
      publicServices: economy.publicServices || 30,
      
      // Distribuição setorial (preservados)
      services: economy.services || 35,
      commodities: economy.commodities || 35,
      manufactures: economy.manufactures || 30,
      
      // ===== NOVOS CAMPOS AVANÇADOS =====
      
      // Outputs setoriais
      servicesOutput: economy.servicesOutput || 0,
      commoditiesOutput: economy.commoditiesOutput || 0,
      manufacturesOutput: economy.manufacturesOutput || 0,
      
      // Necessidades setoriais
      commoditiesNeeds: economy.commoditiesNeeds || 0,
      manufacturesNeeds: economy.manufacturesNeeds || 0,
      
      // Balanços setoriais
      commoditiesBalance: economy.commoditiesBalance || 0,
      manufacturesBalance: economy.manufacturesBalance || 0,
      
      // Estatísticas de comércio (preservadas)
      tradeStats: economy.tradeStats || {
        commodityImports: 0,
        commodityExports: 0,
        manufactureImports: 0,
        manufactureExports: 0
      },
      
      // ===== DADOS AVANÇADOS DE CICLOS =====
      cycleCount: economy._cycleCount || 0,
      lastQuarterGdp: economy._lastQuarterGdp || economy.gdp || 0,
      
      // Históricos expandidos (mantém compatibilidade)
      historicoPIB: economy.historicoPIB || [economy.gdp || 100],
      historicoInflacao: economy.historicoInflacao || [economy.inflation || 0.04],
      historicoPopularidade: economy.historicoPopularidade || [economy.popularity || 50],
      historicoDesemprego: economy.historicoDesemprego || [economy.unemployment || 12.5],
      
      // Históricos avançados (novos)
      historicGdp: economy._historicGdp || [economy.gdp || 100],
      historicInflation: economy._historicInflation || [economy.inflation || 0.04],
      historicPopularity: economy._historicPopularity || [economy.popularity || 50],
      historicUnemployment: economy._historicUnemployment || [economy.unemployment || 12.5],
      
      // ===== INDICADORES CALCULADOS =====
      
      // Relação dívida/PIB
      debtToGdpRatio: economy.gdp > 0 ? (economy.publicDebt / economy.gdp) * 100 : 0,
      
      // Capacidade de endividamento restante
      remainingDebtCapacity: Math.max(0, 120 - ((economy.publicDebt || 0) / (economy.gdp || 100)) * 100),
      
      // Produtividade setorial (output per capita)
      servicesProductivity: economy.gdp > 0 ? (economy.servicesOutput || 0) / (economy.gdp / 100) : 0,
      commoditiesProductivity: economy.gdp > 0 ? (economy.commoditiesOutput || 0) / (economy.gdp / 100) : 0,
      manufacturesProductivity: economy.gdp > 0 ? (economy.manufacturesOutput || 0) / (economy.gdp / 100) : 0,
      
      // Autossuficiência setorial
      commoditiesSelfSufficiency: economy.commoditiesNeeds > 0 ? 
        Math.min(100, (economy.commoditiesOutput / economy.commoditiesNeeds) * 100) : 100,
      manufacturesSelfSufficiency: economy.manufacturesNeeds > 0 ? 
        Math.min(100, (economy.manufacturesOutput / economy.manufacturesNeeds) * 100) : 100,
      
      // ===== INDICADORES DE TENDÊNCIA =====
      
      // Tendência de inflação (baseada no histórico)
      inflationTrend: economy._historicInflation && economy._historicInflation.length >= 3 ? 
        ((economy._historicInflation.slice(-1)[0] - economy._historicInflation.slice(-3, -2)[0]) * 100).toFixed(2) : 0,
      
      // Tendência de desemprego
      unemploymentTrend: economy._historicUnemployment && economy._historicUnemployment.length >= 3 ? 
        (economy._historicUnemployment.slice(-1)[0] - economy._historicUnemployment.slice(-3, -2)[0]).toFixed(2) : 0,
      
      // Tendência de popularidade
      popularityTrend: economy._historicPopularity && economy._historicPopularity.length >= 3 ? 
        (economy._historicPopularity.slice(-1)[0] - economy._historicPopularity.slice(-3, -2)[0]).toFixed(2) : 0,
      
      // ===== STATUS DE SAÚDE ECONÔMICA =====
      
      // Score geral de saúde (0-100)
      economicHealthScore: calculateEconomicHealthScore(economy),
      
      // Alertas econômicos
      economicAlerts: generateEconomicAlerts(economy),
      
      // Classificação de estabilidade
      stabilityRating: calculateStabilityRating(economy),
    };

    // Verificar se houve mudanças significativas
    const currentDataString = JSON.stringify(expandedIndicators);
    if (lastDataRef.current !== currentDataString) {
      setEconomicIndicators(expandedIndicators);
      setCountryData(countryState);
      setLastUpdated(Date.now());
      setLoading(false);
      setError(null);
      lastDataRef.current = currentDataString;
    }
  }, [countryName]);

  /**
   * Subscrever aos estados de países
   */
  const subscribeToStates = useCallback(() => {
    if (!roomName || subscriptionRef.current) return;

    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    // Configurar listeners para dados expandidos
    const handleStatesInitialized = (data) => {
      if (data.roomName === roomName) {
        processEconomicData(data.states);
      }
    };

    const handleStatesUpdated = (data) => {
      if (data.roomName === roomName) {
        processEconomicData(data.states);
      }
    };

    socket.on('countryStatesInitialized', handleStatesInitialized);
    socket.on('countryStatesUpdated', handleStatesUpdated);

    // Subscrever e solicitar dados iniciais
    socket.emit('subscribeToCountryStates', roomName);
    subscriptionRef.current = true;

    // Cleanup function
    return () => {
      socket.off('countryStatesInitialized', handleStatesInitialized);
      socket.off('countryStatesUpdated', handleStatesUpdated);
      if (subscriptionRef.current) {
        socket.emit('unsubscribeFromCountryStates', roomName);
        subscriptionRef.current = false;
      }
    };
  }, [roomName, processEconomicData]);

  // Effect principal
  useEffect(() => {
    if (!roomName || !countryName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    const cleanup = subscribeToStates();
    
    return cleanup;
  }, [roomName, countryName, subscribeToStates]);

  return {
    economicIndicators,
    countryData,
    lastUpdated,
    loading,
    error,
    formatPercent,
    formatCurrency,
    
    // ===== NOVOS MÉTODOS PARA CÁLCULOS AVANÇADOS =====
    
    /**
     * Refrescar dados manualmente
     */
    refresh: useCallback(() => {
      if (roomName) {
        const socket = socketApi.getSocketInstance();
        if (socket) {
          socket.emit('subscribeToCountryStates', roomName);
        }
      }
    }, [roomName]),
    
    /**
     * Obter estatísticas de performance
     */
    getPerformanceStats: useCallback(() => {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('getEconomyPerformanceStats');
      }
    }, []),
    
    /**
     * Validar cálculos econômicos
     */
    validateCalculations: useCallback(() => {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('validateEconomicCalculations');
      }
    }, []),
    
    /**
     * Debug dos cálculos avançados (apenas desenvolvimento)
     */
    debugCalculations: useCallback(() => {
      if (process.env.NODE_ENV === 'development') {
        const socket = socketApi.getSocketInstance();
        if (socket) {
          socket.emit('debugAdvancedCalculations');
        }
      }
    }, []),
  };
}

/**
 * Hook específico para dívida pública com dados expandidos
 */
export function usePublicDebt(roomName, countryName) {
  const [debtSummary, setDebtSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    if (!roomName || !countryName) return;

    setLoading(true);
    setError(null);

    const socket = socketApi.getSocketInstance();
    if (!socket) {
      setError('Socket not available');
      setLoading(false);
      return;
    }

    const handleDebtSummaryResponse = (data) => {
      setDebtSummary(data);
      setLoading(false);
      setError(null);
    };

    const handleError = (errorMsg) => {
      setError(errorMsg);
      setLoading(false);
    };

    socket.once('debtSummaryResponse', handleDebtSummaryResponse);
    socket.once('error', handleError);

    socket.emit('getDebtSummary');

    // Timeout
    setTimeout(() => {
      socket.off('debtSummaryResponse', handleDebtSummaryResponse);
      socket.off('error', handleError);
      if (loading) {
        setError('Request timeout');
        setLoading(false);
      }
    }, 10000);
  }, [roomName, countryName, loading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    debtSummary,
    loading,
    error,
    refresh
  };
}

/**
 * Hook para acordos comerciais
 */
export function useTradeAgreements(roomName) {
  const [agreements, set



    // PRECISA COMPLETAR O CÓDIGO A PARTIR DAQUI //