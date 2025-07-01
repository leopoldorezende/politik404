/**
 * useEconomy.js - Hook direto para dados econômicos com cálculos avançados
 */

import { useState, useEffect, useCallback } from 'react';
import { socketApi } from '../services/socketClient';

/**
 * Hook principal para dados econômicos de um país com cálculos avançados
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 * @returns {Object} - Dados econômicos e funções auxiliares
 */
export const useEconomy = (roomName, countryName) => {
  const [countryData, setCountryData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handler para inicialização dos estados
  const handleCountryStatesInitialized = useCallback((data) => {
    if (data.roomName === roomName && data.states && data.states[countryName]) {
      setCountryData(data.states[countryName]);
      setLastUpdated(data.timestamp);
      setLoading(false);
    }
  }, [roomName, countryName]);

  // Handler para atualizações periódicas
  const handleCountryStatesUpdated = useCallback((data) => {
    if (data.roomName === roomName && data.states && data.states[countryName]) {      
      setCountryData(data.states[countryName]);
      setLastUpdated(data.timestamp);
      setLoading(false);
    }
  }, [roomName, countryName]);

  // Subscription para atualizações periódicas
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket || !roomName || !countryName) return;

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
  }, [roomName, countryName, handleCountryStatesUpdated, handleCountryStatesInitialized]);

  // Função para obter valor numérico
  const getNumericValue = useCallback((property) => {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  }, []);

  // Formatar moeda (corrigido para retornar apenas números)
  const formatCurrency = useCallback((value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0';
    return Number(value).toFixed(1);
  }, []);

  // Formatar porcentagem
  const formatPercent = useCallback((value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0%';
    return Number(value).toFixed(1) + '%';
  }, []);

  // Indicadores econômicos calculados com campos expandidos
  const economicIndicators = countryData?.economy ? {
    // CAMPOS BÁSICOS PRESERVADOS
    gdp: getNumericValue(countryData.economy.gdp),
    treasury: getNumericValue(countryData.economy.treasury),
    publicDebt: getNumericValue(countryData.economy.publicDebt),
    
    // INDICADORES AVANÇADOS
    inflation: getNumericValue(countryData.economy.inflation),
    unemployment: getNumericValue(countryData.economy.unemployment),
    popularity: getNumericValue(countryData.economy.popularity),
    creditRating: countryData.economy.creditRating || 'A',
    gdpGrowth: getNumericValue(countryData.economy.gdpGrowth),
    
    // PARÂMETROS DE POLÍTICA
    interestRate: getNumericValue(countryData.economy.interestRate),
    taxBurden: getNumericValue(countryData.economy.taxBurden),
    publicServices: getNumericValue(countryData.economy.publicServices),
    
    // ESTRUTURA SETORIAL
    services: getNumericValue(countryData.economy.services),
    commodities: getNumericValue(countryData.economy.commodities),
    manufactures: getNumericValue(countryData.economy.manufactures),
    
    // OUTPUTS SETORIAIS
    servicesOutput: getNumericValue(countryData.economy.servicesOutput),
    commoditiesOutput: getNumericValue(countryData.economy.commoditiesOutput),
    manufacturesOutput: getNumericValue(countryData.economy.manufacturesOutput),
    
    // NECESSIDADES E BALANÇOS
    commoditiesNeeds: getNumericValue(countryData.economy.commoditiesNeeds),
    manufacturesNeeds: getNumericValue(countryData.economy.manufacturesNeeds),
    commoditiesBalance: getNumericValue(countryData.economy.commoditiesBalance),
    manufacturesBalance: getNumericValue(countryData.economy.manufacturesBalance),
    
    // ESTATÍSTICAS DE COMÉRCIO
    tradeStats: countryData.economy.tradeStats || {
      commodityImports: 0,
      commodityExports: 0,
      manufactureImports: 0,
      manufactureExports: 0
    },
    
    // CAMPOS AVANÇADOS DE CONTROLE
    _cycleCount: getNumericValue(countryData.economy._cycleCount),
    _lastQuarterGdp: getNumericValue(countryData.economy._lastQuarterGdp),
    
    // HISTÓRICOS EXPANDIDOS
    _historicGdp: countryData.economy._historicGdp || [getNumericValue(countryData.economy.gdp)],
    _historicInflation: countryData.economy._historicInflation || [getNumericValue(countryData.economy.inflation)],
    _historicPopularity: countryData.economy._historicPopularity || [getNumericValue(countryData.economy.popularity)],
    _historicUnemployment: countryData.economy._historicUnemployment || [getNumericValue(countryData.economy.unemployment)]
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
 * Hook para dados de dívida pública com sistema expandido
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

    const handleEmergencyBondsIssued = (data) => {
      // Auto-refresh após emissão de títulos de emergência
      setTimeout(() => {
        refresh();
      }, 500);
    };

    // NOVA FUNCIONALIDADE: LISTENER PARA ATUALIZAÇÕES DE CONTRATOS =====
    const handleDebtContractsUpdated = (data) => {
      if (data.roomName === roomName && data.countryName === countryName) {
        console.log(`[DEBT] Contratos atualizados para ${countryName}: ${data.contractsCompleted} quitados, ${data.activeContracts} ativos`);
        
        // Auto-refresh para obter dados atualizados
        setTimeout(() => {
          refresh();
        }, 200);
      }
    };

    socket.on('debtSummaryResponse', handleDebtSummaryResponse);
    socket.on('debtBondsIssued', handleDebtBondsIssued);
    socket.on('emergencyBondsIssued', handleEmergencyBondsIssued);
    socket.on('debtContractsUpdated', handleDebtContractsUpdated); // NOVO LISTENER

    // Buscar dados iniciais
    if (roomName && countryName) {
      refresh();
    }

    return () => {
      socket.off('debtSummaryResponse', handleDebtSummaryResponse);
      socket.off('debtBondsIssued', handleDebtBondsIssued);
      socket.off('emergencyBondsIssued', handleEmergencyBondsIssued);
      socket.off('debtContractsUpdated', handleDebtContractsUpdated); // LIMPAR NOVO LISTENER
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
      socket.emit('getActiveAgreements');
    }
  }, [roomName]);

  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    const handleActiveAgreements = (data) => {
      setAgreements(data.agreements || []);
      setLoading(false);
    };

    socket.on('activeAgreements', handleActiveAgreements);

    // Buscar dados iniciais
    if (roomName) {
      refresh();
    }

    return () => {
      socket.off('activeAgreements', handleActiveAgreements);
    };
  }, [roomName, refresh]);

  return {
    agreements,
    loading,
    refresh
  };
};

/**
 * Hook para estatísticas avançadas do sistema econômico
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 * @returns {Object} - Estatísticas avançadas
 */
export const useAdvancedEconomyStats = (roomName, countryName) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(() => {
    if (!roomName || !countryName) return;

    setLoading(true);
    const socket = socketApi.getSocketInstance();
    if (socket) {
      socket.emit('getEconomyPerformanceStats');
    }
  }, [roomName, countryName]);

  const validateCalculations = useCallback(() => {
    if (!roomName || !countryName) return;

    const socket = socketApi.getSocketInstance();
    if (socket) {
      socket.emit('validateEconomicCalculations');
    }
  }, [roomName, countryName]);

  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    const handlePerformanceStats = (data) => {
      setStats(data);
      setLoading(false);
    };

    const handleValidationResult = (data) => {
      console.log('[ECONOMY] Validation result:', data);
    };

    socket.on('economyPerformanceStats', handlePerformanceStats);
    socket.on('economicValidationResult', handleValidationResult);

    return () => {
      socket.off('economyPerformanceStats', handlePerformanceStats);
      socket.off('economicValidationResult', handleValidationResult);
    };
  }, []);

  return {
    stats,
    loading,
    fetchStats,
    validateCalculations
  };
};