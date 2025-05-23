import { createSlice } from '@reduxjs/toolkit';

/**
 * countryStateSlice.js (Corrigido)
 * Cache otimizado para dados econômicos vindos do servidor
 * Garante que os indicadores da interface reflitam os cálculos do servidor
 */

const initialState = {
  // Estados dos países por sala (cache dos dados do servidor)
  roomStates: {}, // { roomName: { countryName: economicData } }
  
  // Timestamp da última atualização por sala
  lastUpdated: {}, // { roomName: timestamp }
  
  // Estados de loading/erro simplificados
  loading: false,
  error: null,
};

export const countryStateSlice = createSlice({
  name: 'countryState',
  initialState,
  reducers: {
    // ======================================================================
    // PRINCIPAIS: Recepção de dados do servidor
    // ======================================================================
    
    /**
     * Inicializa todos os estados de uma sala (dados completos do servidor)
     */
    initializeCountryStates: (state, action) => {
      const { roomName, states, timestamp } = action.payload;
      
      state.roomStates[roomName] = states;
      state.lastUpdated[roomName] = timestamp || Date.now();
      state.error = null;
      state.loading = false;
    },
    
    /**
     * Atualiza todos os estados de uma sala (sincronização do servidor)
     */
    updateCountryStates: (state, action) => {
      const { roomName, states, timestamp } = action.payload;
      
      // Só atualiza se timestamp for mais recente ou não existir
      const currentTimestamp = state.lastUpdated[roomName] || 0;
      const newTimestamp = timestamp || Date.now();
      
      if (newTimestamp >= currentTimestamp) {
        state.roomStates[roomName] = states;
        state.lastUpdated[roomName] = newTimestamp;
      }
    },
    
    /**
     * Atualiza um país específico (usado para atualizações pontuais)
     */
    updateSingleCountryState: (state, action) => {
      const { roomName, countryName, countryData, timestamp } = action.payload;
      
      if (!state.roomStates[roomName]) {
        state.roomStates[roomName] = {};
      }
      
      // Merge com dados existentes preservando estrutura
      state.roomStates[roomName][countryName] = {
        ...state.roomStates[roomName][countryName],
        ...countryData
      };
      
      state.lastUpdated[roomName] = timestamp || Date.now();
    },

    // ======================================================================
    // ESPECÍFICOS: Para eventos pontuais do servidor
    // ======================================================================
    
    /**
     * Atualiza parâmetros econômicos de um país (juros, impostos, investimento)
     */
    updateEconomicParameters: (state, action) => {
      const { roomName, countryName, parameters, timestamp } = action.payload;
      
      if (state.roomStates[roomName]?.[countryName]) {
        // Atualizar apenas parâmetros econômicos específicos
        if (!state.roomStates[roomName][countryName].economy) {
          state.roomStates[roomName][countryName].economy = {};
        }
        
        Object.assign(state.roomStates[roomName][countryName].economy, parameters);
        state.lastUpdated[roomName] = timestamp || Date.now();
      }
    },
    
    /**
     * Atualiza dados de dívida de um país (após emissão de títulos)
     */
    updateCountryDebt: (state, action) => {
      const { roomName, countryName, debtData, timestamp } = action.payload;
      
      if (state.roomStates[roomName]?.[countryName]?.economy) {
        Object.assign(state.roomStates[roomName][countryName].economy, debtData);
        state.lastUpdated[roomName] = timestamp || Date.now();
      }
    },

    // ======================================================================
    // UTILITÁRIOS: Limpeza e controle de estado
    // ======================================================================
    
    /**
     * Remove dados de uma sala inteira
     */
    clearRoomStates: (state, action) => {
      const roomName = action.payload;
      
      delete state.roomStates[roomName];
      delete state.lastUpdated[roomName];
    },
    
    /**
     * Remove dados de um país específico
     */
    clearCountryStates: (state, action) => {
      const { roomName, countryName } = action.payload;
      
      if (state.roomStates[roomName]) {
        delete state.roomStates[roomName][countryName];
      }
    },
    
    /**
     * Controle de loading
     */
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    
    /**
     * Controle de erro
     */
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    /**
     * Limpa erro
     */
    clearError: (state) => {
      state.error = null;
    },
    
    /**
     * Reset completo do estado
     */
    resetState: (state) => {
      state.roomStates = {};
      state.lastUpdated = {};
      state.loading = false;
      state.error = null;
    }
  },
});

// ======================================================================
// ACTIONS EXPORTADAS
// ======================================================================

export const {
  // Principais
  initializeCountryStates,
  updateCountryStates,
  updateSingleCountryState,
  
  // Específicos
  updateEconomicParameters,
  updateCountryDebt,
  
  // Utilitários
  clearRoomStates,
  clearCountryStates,
  setLoading,
  setError,
  clearError,
  resetState
} = countryStateSlice.actions;

// ======================================================================
// HELPER FUNCTION - Extrai valor numérico de propriedades
// ======================================================================

/**
 * Função auxiliar para extrair valores numéricos de propriedades que podem estar em diferentes formatos
 * Centraliza a lógica para evitar repetição nos seletores
 */
const getNumericValue = (property) => {
  if (property === undefined || property === null) return 0;
  if (typeof property === 'number') return property;
  if (typeof property === 'object' && property.value !== undefined) return property.value;
  return 0;
};

// ======================================================================
// SELETORES OTIMIZADOS (com memoização automática)
// ======================================================================

/**
 * Obtém todos os estados de países de uma sala
 */
export const selectRoomCountryStates = (state, roomName) => 
  state.countryState.roomStates[roomName] || {};

/**
 * Obtém estado completo de um país específico
 */
export const selectCountryState = (state, roomName, countryName) => {
  if (!roomName || !countryName) return null;
  return state.countryState.roomStates[roomName]?.[countryName] || null;
};

/**
 * Obtém dados econômicos de um país específico
 */
export const selectCountryEconomy = (state, roomName, countryName) => {
  const countryState = selectCountryState(state, roomName, countryName);
  return countryState?.economy || null;
};

/**
 * Obtém último timestamp de atualização de uma sala
 */
export const selectLastUpdated = (state, roomName) => 
  state.countryState.lastUpdated[roomName] || null;

/**
 * Obtém estado de loading
 */
export const selectCountryStateLoading = (state) => 
  state.countryState.loading;

/**
 * Obtém erro atual
 */
export const selectCountryStateError = (state) => 
  state.countryState.error;

/**
 * Verifica se há dados para uma sala
 */
export const selectHasRoomData = (state, roomName) => 
  Boolean(state.countryState.roomStates[roomName]);

/**
 * Obtém lista de países disponíveis em uma sala
 */
export const selectAvailableCountries = (state, roomName) => {
  const roomStates = state.countryState.roomStates[roomName];
  return roomStates ? Object.keys(roomStates) : [];
};

// ======================================================================
// SELETORES DERIVADOS CORRIGIDOS (para funcionalidades específicas)
// ======================================================================

/**
 * CORRIGIDO: Obtém resumo de dívidas de um país (baseado nos dados do servidor)
 */
export const selectCountryDebtSummary = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  // Usar dados vindos diretamente do countryStateManager
  const contracts = economy.debtContracts || economy.debtRecords || [];
  const numberOfContracts = economy.numberOfDebtContracts || economy.numberOfContracts || contracts.length;
  
  // Se não há contratos, retorna resumo vazio
  if (contracts.length === 0) {
    return {
      totalMonthlyPayment: 0,
      principalRemaining: getNumericValue(economy.publicDebt) || 0,
      totalFuturePayments: 0,
      numberOfContracts: 0,
      contracts: []
    };
  }
  
  // Calcular resumo baseado nos contratos
  const totalMonthlyPayment = contracts.reduce((sum, debt) => sum + (debt.monthlyPayment || 0), 0);
  const principalRemaining = contracts.reduce((sum, debt) => sum + (debt.remainingValue || debt.originalValue || 0), 0);
  const totalFuturePayments = contracts.reduce((sum, debt) => 
    sum + ((debt.monthlyPayment || 0) * (debt.remainingInstallments || 0)), 0
  );
  
  return {
    totalMonthlyPayment,
    principalRemaining,
    totalFuturePayments,
    numberOfContracts,
    contracts
  };
};

/**
 * CORRIGIDO: Obtém balanços setoriais de um país (dados calculados pelo servidor)
 */
export const selectCountrySectoralBalance = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  return {
    commoditiesBalance: getNumericValue(economy.commoditiesBalance),
    manufacturesBalance: getNumericValue(economy.manufacturesBalance),
    commoditiesOutput: getNumericValue(economy.commoditiesOutput),
    manufacturesOutput: getNumericValue(economy.manufacturesOutput),
    servicesOutput: getNumericValue(economy.servicesOutput),
    commoditiesNeeds: getNumericValue(economy.commoditiesNeeds),
    manufacturesNeeds: getNumericValue(economy.manufacturesNeeds),
    // Estatísticas de comércio calculadas pelo servidor
    tradeStats: economy.tradeStats || {
      commodityImports: 0,
      commodityExports: 0,
      manufactureImports: 0,
      manufactureExports: 0
    }
  };
};

/**
 * CORRIGIDO: Obtém indicadores econômicos principais (dados avançados do servidor)
 */
export const selectCountryEconomicIndicators = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  // Calcular crescimento do PIB se histórico estiver disponível
  let gdpGrowth = 0;
  if (economy.gdpHistory && economy.gdpHistory.length >= 2) {
    const currentGdp = economy.gdpHistory[economy.gdpHistory.length - 1];
    const previousGdp = economy.gdpHistory[economy.gdpHistory.length - 2];
    if (previousGdp > 0) {
      gdpGrowth = ((currentGdp - previousGdp) / previousGdp) * 100;
    }
  } else if (economy.quarterlyGrowth !== undefined) {
    gdpGrowth = economy.quarterlyGrowth * 100; // Converter para porcentagem
  }
  
  return {
    // Indicadores básicos
    gdp: getNumericValue(economy.gdp),
    treasury: getNumericValue(economy.treasury),
    publicDebt: getNumericValue(economy.publicDebt) || 0,
    
    // Indicadores avançados calculados pelo servidor
    inflation: (getNumericValue(economy.inflation) || 0) * 100, // Converter para porcentagem
    unemployment: getNumericValue(economy.unemployment) || 0,
    popularity: getNumericValue(economy.popularity) || 50,
    creditRating: economy.creditRating || 'A',
    
    // Parâmetros econômicos
    interestRate: getNumericValue(economy.interestRate) || 8.0,
    taxBurden: getNumericValue(economy.taxBurden) || 40.0,
    publicServices: getNumericValue(economy.publicServices) || 30.0,
    
    // Crescimento calculado
    gdpGrowth: gdpGrowth,
    
    // Indicadores adicionais se disponíveis
    previousQuarterGDP: getNumericValue(economy.previousQuarterGDP),
    quarterlyGrowth: getNumericValue(economy.quarterlyGrowth),
    
    // Histórico se disponível (para gráficos futuros)
    gdpHistory: economy.gdpHistory || [],
    inflationHistory: economy.inflationHistory || [],
    popularityHistory: economy.popularityHistory || [],
    unemploymentHistory: economy.unemploymentHistory || []
  };
};

/**
 * NOVO: Obtém distribuição setorial de um país
 */
export const selectCountrySectoralDistribution = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  return {
    services: getNumericValue(economy.services),
    commodities: getNumericValue(economy.commodities),
    manufactures: getNumericValue(economy.manufactures),
    servicesOutput: getNumericValue(economy.servicesOutput),
    commoditiesOutput: getNumericValue(economy.commoditiesOutput),
    manufacturesOutput: getNumericValue(economy.manufacturesOutput)
  };
};

/**
 * NOVO: Obtém dados de necessidades internas de um país
 */
export const selectCountryInternalNeeds = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  return {
    commoditiesNeeds: {
      value: getNumericValue(economy.commoditiesNeeds),
      percentValue: getNumericValue(economy.commoditiesNeeds?.percentValue) || 
                   (economy.commoditiesNeeds?.value && economy.gdp?.value ? 
                    (economy.commoditiesNeeds.value / economy.gdp.value) * 100 : 30)
    },
    manufacturesNeeds: {
      value: getNumericValue(economy.manufacturesNeeds),
      percentValue: getNumericValue(economy.manufacturesNeeds?.percentValue) || 
                   (economy.manufacturesNeeds?.value && economy.gdp?.value ? 
                    (economy.manufacturesNeeds.value / economy.gdp.value) * 100 : 45)
    }
  };
};

export default countryStateSlice.reducer;