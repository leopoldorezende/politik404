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

  // Adicione esta função antes do useEffect
  const handleCountryStatesInitialized = (data) => {
    if (data.roomName === roomName && data.states && data.states[countryName]) {
      setCountryData(data.states[countryName]);
      setLastUpdated(data.timestamp);
      setLoading(false);
    }
  };

  // Subscription para atualizações periódicas
  useEffect(() => {
  const socket = socketApi.getSocketInstance();
  if (!socket || !roomName || !countryName) return;

  // Handlers para atualizações
  const handleCountryStatesUpdated = (data) => {
    if (data.roomName === roomName && data.states && data.states[countryName]) {
      // console.log('[CLIENT] Atualizando dados para:', countryName, 'inflação:', data.states[countryName].economy.inflation);
      setCountryData(data.states[countryName]);
      setLastUpdated(data.timestamp);
      setLoading(false);
    } else {
      // console.log('[CLIENT] Dados não encontrados para:', countryName, 'room:', roomName, 'disponíveis:', Object.keys(data.states || {}));
    }
  };

  // Registrar listeners
  socket.on('countryStatesUpdated', handleCountryStatesUpdated);
  socket.on('countryStatesInitialized', handleCountryStatesInitialized);

  // Subscrever aos updates da sala
  socket.emit('subscribeToCountryStates', roomName);

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
    if (value === undefined || value === null || isNaN(value)) return '0.0%';
    return Number(value).toFixed(1) + '%';
  }, []);

  // Formatar porcentagem
  const formatPercent = useCallback((value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0%';
    return Number(value).toFixed(2) + '%';
  }, []);

  // Indicadores econômicos calculados
  const economicIndicators = countryData?.economy ? {
    gdp: getNumericValue(countryData.economy.gdp),
    treasury: getNumericValue(countryData.economy.treasury),
    publicDebt: getNumericValue(countryData.economy.publicDebt),
    
    // Indicadores avançados
    inflation: getNumericValue(countryData.economy.inflation),
    unemployment: getNumericValue(countryData.economy.unemployment),
    popularity: getNumericValue(countryData.economy.popularity),
    creditRating: countryData.economy.creditRating,
    gdpGrowth: getNumericValue(countryData.economy.quarterlyGrowth) * 100,
    
    // Parâmetros de política
    interestRate: getNumericValue(countryData.economy.interestRate),
    taxBurden: getNumericValue(countryData.economy.taxBurden),
    publicServices: getNumericValue(countryData.economy.publicServices),
    
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