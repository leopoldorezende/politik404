/**
 * useEconomy.js - Hook direto para dados econômicos
 * Substitui toda complexidade do Redux com comunicação direta via socket
 */

import { useState, useEffect, useCallback } from 'react';
import { socketApi } from '../services/socketClient';

/**
 * Hook principal para dados econômicos de um país
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 * @returns {Object} - Dados econômicos e funções auxiliares
 */
export const useEconomy = (roomName, countryName) => {
  const [countryData, setCountryData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  // Subscription para atualizações periódicas
  useEffect(() => {
    if (!roomName || !countryName) {
      setCountryData(null);
      setLoading(false);
      return;
    }

    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    setLoading(true);

    // Subscrever para atualizações de estados
    socket.emit('subscribeToCountryStates', roomName);

    // Handlers para atualizações
    const handleCountryStatesUpdated = (data) => {
      if (data.roomName === roomName && data.states && data.states[countryName]) {
        setCountryData(data.states[countryName]);
        setLastUpdated(data.timestamp);
        setLoading(false);
      }
    };

    const handleCountryStatesInitialized = (data) => {
      if (data.roomName === roomName && data.states && data.states[countryName]) {
        setCountryData(data.states[countryName]);
        setLastUpdated(data.timestamp);
        setLoading(false);
      }
    };

    // Adicionar listeners
    socket.on('countryStatesUpdated', handleCountryStatesUpdated);
    socket.on('countryStatesInitialized', handleCountryStatesInitialized);

    // Cleanup
    return () => {
      socket.off('countryStatesUpdated', handleCountryStatesUpdated);
      socket.off('countryStatesInitialized', handleCountryStatesInitialized);
      socket.emit('unsubscribeFromCountryStates', roomName);
    };
  }, [roomName, countryName]);

  // Função para obter valor numérico
  const getNumericValue = useCallback((property) => {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  }, []);

  // Formatar moeda
  const formatCurrency = useCallback((value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0';
    return Number(value).toFixed(1);
  }, []);

  // Formatar porcentagem
  const formatPercent = useCallback((value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0%';
    return Number(value).toFixed(1) + '%';
  }, []);

  // Indicadores econômicos calculados
  const economicIndicators = countryData?.economy ? {
    gdp: getNumericValue(countryData.economy.gdp),
    treasury: getNumericValue(countryData.economy.treasury),
    publicDebt: getNumericValue(countryData.economy.publicDebt) || 0,
    
    // Indicadores avançados
    inflation: getNumericValue(countryData.economy.inflation) || 0,
    unemployment: getNumericValue(countryData.economy.unemployment) || 0,
    popularity: getNumericValue(countryData.economy.popularity) || 0,
    creditRating: countryData.economy.creditRating || 'N/A',
    gdpGrowth: getNumericValue(countryData.economy.quarterlyGrowth) * 100 || 0,
    
    // Parâmetros de política
    interestRate: getNumericValue(countryData.economy.interestRate) || 8.0,
    taxBurden: getNumericValue(countryData.economy.taxBurden) || 40.0,
    publicServices: getNumericValue(countryData.economy.publicServices) || 30.0,
    
    // Outputs setoriais
    servicesOutput: getNumericValue(countryData.economy.servicesOutput),
    commoditiesOutput: getNumericValue(countryData.economy.commoditiesOutput),
    manufacturesOutput: getNumericValue(countryData.economy.manufacturesOutput),
    
    // Necessidades e balanços
    commoditiesNeeds: getNumericValue(countryData.economy.commoditiesNeeds),
    manufacturesNeeds: getNumericValue(countryData.economy.manufacturesNeeds),
    commoditiesBalance: getNumericValue(countryData.economy.commoditiesBalance),
    manufacturesBalance: getNumericValue(countryData.economy.manufacturesBalance),
    
    // Estatísticas de comércio
    tradeStats: countryData.economy.tradeStats || {
      commodityImports: 0,
      commodityExports: 0,
      manufactureImports: 0,
      manufactureExports: 0
    }
  } : null;

  return {
    countryData,
    economicIndicators,
    lastUpdated,
    loading,
    getNumericValue,
    formatCurrency,
    formatPercent
  };
};

/**
 * Hook para dados de dívida pública
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 * @returns {Object} - Dados de dívida e função de refresh
 */
export const usePublicDebt = (roomName, countryName) => {
  const [debtSummary, setDebtSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!roomName || !countryName) return;

    setLoading(true);
    const socket = socketApi.getSocketInstance();
    if (socket) {
      socket.emit('getDebtSummary');
    }
  }, [roomName, countryName]);

  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    const handleDebtSummaryResponse = (data) => {
      setDebtSummary(data);
      setLoading(false);
    };

    const handleDebtBondsIssued = (data) => {
      if (data.success) {
        // Auto-refresh após emissão bem-sucedida
        setTimeout(() => {
          refresh();
        }, 500);
      }
    };

    socket.on('debtSummaryResponse', handleDebtSummaryResponse);
    socket.on('debtBondsIssued', handleDebtBondsIssued);

    // Buscar dados iniciais
    if (roomName && countryName) {
      refresh();
    }

    return () => {
      socket.off('debtSummaryResponse', handleDebtSummaryResponse);
      socket.off('debtBondsIssued', handleDebtBondsIssued);
    };
  }, [roomName, countryName, refresh]);

  return {
    debtSummary,
    loading,
    refresh
  };
};

/**
 * Hook para acordos comerciais
 * @param {string} roomName - Nome da sala
 * @returns {Object} - Acordos e função de refresh
 */
export const useTradeAgreements = (roomName) => {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!roomName) return;

    setLoading(true);
    const socket = socketApi.getSocketInstance();
    if (socket) {
      socket.emit('getTradeAgreements');
    }
  }, [roomName]);

  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    const handleTradeAgreementsList = (data) => {
      setAgreements(data.agreements || []);
      setLoading(false);
    };

    const handleTradeAgreementUpdated = (data) => {
      setAgreements(data.agreements || []);
      setLoading(false);
    };

    socket.on('tradeAgreementsList', handleTradeAgreementsList);
    socket.on('tradeAgreementUpdated', handleTradeAgreementUpdated);

    // Buscar dados iniciais
    if (roomName) {
      refresh();
    }

    return () => {
      socket.off('tradeAgreementsList', handleTradeAgreementsList);
      socket.off('tradeAgreementUpdated', handleTradeAgreementUpdated);
    };
  }, [roomName, refresh]);

  return {
    agreements,
    loading,
    refresh
  };
};