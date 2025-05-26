/**
 * client/src/hooks/useEconomy.js - Hook direto para dados econômicos
 * Substitui toda a complexidade do Redux countryStateSlice
 */

import { useState, useEffect, useRef } from 'react';
import { socketApi } from '../services/socketClient';

/**
 * Hook para gerenciar dados econômicos em tempo real
 * Conecta diretamente via WebSocket, sem Redux
 */
export const useEconomy = (roomName, countryName) => {
  const [economyData, setEconomyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomName) return;

    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    socketRef.current = socket;
    setLoading(true);

    console.log(`[HOOK] Subscribing to room ${roomName}`);

    // Subscrever a atualizações da sala
    socket.emit('subscribeToCountryStates', roomName);

    // Handler para estados iniciais
    const handleStatesInitialized = (data) => {
      if (data.roomName === roomName) {
        setEconomyData(data.states);
        setLastUpdated(data.timestamp);
        setLoading(false);
      }
    };

    // Handler para atualizações em tempo real
    const handleStatesUpdated = (data) => {
      if (data.roomName === roomName) {
        setEconomyData(data.states);
        setLastUpdated(data.timestamp);
      }
    };

    // Handler para atualizações de país específico
    const handleCountryUpdated = (data) => {
      if (data.roomName === roomName && data.countryName) {
        setEconomyData(prev => ({
          ...prev,
          [data.countryName]: {
            ...prev?.[data.countryName],
            ...data.countryData
          }
        }));
        setLastUpdated(data.timestamp);
      }
    };

    // Registrar listeners
    socket.on('countryStatesInitialized', handleStatesInitialized);
    socket.on('countryStatesUpdated', handleStatesUpdated);
    socket.on('countryStateUpdated', handleCountryUpdated);

    // Cleanup
    return () => {
      socket.off('countryStatesInitialized', handleStatesInitialized);
      socket.off('countryStatesUpdated', handleStatesUpdated);
      socket.off('countryStateUpdated', handleCountryUpdated);
      socket.emit('unsubscribeFromCountryStates', roomName);
    };
  }, [roomName]);

  // Dados do país específico
  const countryData = countryName && economyData ? economyData[countryName] : null;
  const economy = countryData?.economy;

  // Funções de utilidade
  const getNumericValue = (property) => {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  };

  const formatCurrency = (value, decimals = 1) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0';
    return Number(value).toFixed(decimals);
  };

  const formatPercent = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0%';
    return Number(value).toFixed(1) + '%';
  };

  // Indicadores econômicos processados
  const economicIndicators = economy ? {
    gdp: getNumericValue(economy.gdp),
    treasury: getNumericValue(economy.treasury),
    publicDebt: getNumericValue(economy.publicDebt),
    inflation: economy.inflation || 0,
    unemployment: economy.unemployment || 0,
    popularity: economy.popularity || 50,
    creditRating: economy.creditRating || 'A',
    interestRate: economy.interestRate || 8.0,
    taxBurden: economy.taxBurden || 40.0,
    publicServices: economy.publicServices || 30.0,
    gdpGrowth: economy.gdpGrowth || 0,
    
    // Outputs setoriais
    servicesOutput: getNumericValue(economy.servicesOutput),
    commoditiesOutput: getNumericValue(economy.commoditiesOutput),
    manufacturesOutput: getNumericValue(economy.manufacturesOutput),
    
    // Necessidades e balanços
    commoditiesNeeds: getNumericValue(economy.commoditiesNeeds),
    manufacturesNeeds: getNumericValue(economy.manufacturesNeeds),
    commoditiesBalance: getNumericValue(economy.commoditiesBalance),
    manufacturesBalance: getNumericValue(economy.manufacturesBalance),
    
    // Estatísticas de comércio
    tradeStats: economy.tradeStats || {
      commodityImports: 0,
      commodityExports: 0,
      manufactureImports: 0,
      manufactureExports: 0
    }
  } : null;

  return {
    // Dados
    economyData,
    countryData,
    economy,
    economicIndicators,
    
    // Estados
    loading,
    lastUpdated,
    
    // Utilitários
    getNumericValue,
    formatCurrency,
    formatPercent,
    
    // Status
    isConnected: !!socketRef.current?.connected,
    hasData: !!economyData
  };
};

/**
 * Hook específico para comércio
 */
export const useTradeAgreements = (roomName) => {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomName) return;

    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    // Solicitar acordos
    socket.emit('getTradeAgreements');

    // Handler para lista de acordos
    const handleAgreementsList = (data) => {
      setAgreements(data.agreements || []);
      setLoading(false);
    };

    // Handler para atualizações
    const handleAgreementsUpdated = (data) => {
      setAgreements(data.agreements || []);
    };

    // Handler para cancelamento
    const handleAgreementCancelled = (agreementId) => {
      setAgreements(prev => prev.filter(a => a.id !== agreementId));
    };

    socket.on('tradeAgreementsList', handleAgreementsList);
    socket.on('tradeAgreementUpdated', handleAgreementsUpdated);
    socket.on('tradeAgreementCancelled', handleAgreementCancelled);

    return () => {
      socket.off('tradeAgreementsList', handleAgreementsList);
      socket.off('tradeAgreementUpdated', handleAgreementsUpdated);
      socket.off('tradeAgreementCancelled', handleAgreementCancelled);
    };
  }, [roomName]);

  return {
    agreements,
    loading,
    refresh: () => {
      const socket = socketApi.getSocketInstance();
      if (socket) socket.emit('getTradeAgreements');
    }
  };
};

/**
 * Hook para gerenciar dívida pública
 */
export const usePublicDebt = (roomName, countryName) => {
  const [debtSummary, setDebtSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshDebtSummary = () => {
    if (!roomName || !countryName) return;

    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    setLoading(true);
    socket.emit('getDebtSummary');
  };

  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    const handleDebtSummary = (data) => {
      setDebtSummary(data);
      setLoading(false);
    };

    const handleBondsIssued = () => {
      // Atualizar resumo quando títulos forem emitidos
      setTimeout(refreshDebtSummary, 500);
    };

    socket.on('debtSummaryResponse', handleDebtSummary);
    socket.on('debtBondsIssued', handleBondsIssued);

    // Carregar dados iniciais
    if (roomName && countryName) {
      refreshDebtSummary();
    }

    return () => {
      socket.off('debtSummaryResponse', handleDebtSummary);
      socket.off('debtBondsIssued', handleBondsIssued);
    };
  }, [roomName, countryName]);

  return {
    debtSummary,
    loading,
    refresh: refreshDebtSummary
  };
};

export default useEconomy;