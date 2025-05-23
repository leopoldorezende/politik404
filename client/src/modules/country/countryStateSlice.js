import { createSlice } from '@reduxjs/toolkit';

/**
 * countryStateSlice.js (Otimizado)
 * Cache passivo para dados econômicos vindos do servidor
 * Apenas recebe e armazena dados, não faz cálculos
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
// SELETORES OTIMIZADOS (com memoização automática)
// ======================================================================

/**
 * Obtém todos os estados de países de uma sala
 */
export const selectRoomCountryStates = (state, roomName) => 
  state.countryState.roomStates[roomName] || {};

/**
 * Obtém estado de um país específico
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
// SELETORES DERIVADOS (para funcionalidades específicas)
// ======================================================================

/**
 * Obtém resumo de dívidas de um país (baseado nos dados do servidor)
 */
export const selectCountryDebtSummary = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  const contracts = economy.debtContracts || [];
  const numberOfContracts = economy.numberOfDebtContracts || contracts.length;
  
  return {
    totalMonthlyPayment: contracts.reduce((sum, debt) => sum + (debt.monthlyPayment || 0), 0),
    principalRemaining: contracts.reduce((sum, debt) => sum + (debt.remainingValue || 0), 0),
    totalFuturePayments: contracts.reduce((sum, debt) => 
      sum + ((debt.monthlyPayment || 0) * (debt.remainingInstallments || 0)), 0
    ),
    numberOfContracts,
    contracts
  };
};

/**
 * Obtém balanços setoriais de um país
 */
export const selectCountrySectoralBalance = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  const getNumericValue = (property) => {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  };
  
  return {
    commoditiesBalance: getNumericValue(economy.commoditiesBalance),
    manufacturesBalance: getNumericValue(economy.manufacturesBalance),
    commoditiesOutput: getNumericValue(economy.commoditiesOutput),
    manufacturesOutput: getNumericValue(economy.manufacturesOutput),
    servicesOutput: getNumericValue(economy.servicesOutput),
    commoditiesNeeds: getNumericValue(economy.commoditiesNeeds),
    manufacturesNeeds: getNumericValue(economy.manufacturesNeeds),
    tradeStats: economy.tradeStats || {
      commodityImports: 0,
      commodityExports: 0,
      manufactureImports: 0,
      manufactureExports: 0
    }
  };
};

/**
 * Obtém indicadores econômicos principais de um país
 */
export const selectCountryEconomicIndicators = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  const getNumericValue = (property) => {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  };
  
  return {
    gdp: getNumericValue(economy.gdp),
    treasury: getNumericValue(economy.treasury),
    publicDebt: getNumericValue(economy.publicDebt),
    inflation: getNumericValue(economy.inflation),
    unemployment: getNumericValue(economy.unemployment),
    popularity: getNumericValue(economy.popularity),
    creditRating: economy.creditRating || 'A',
    interestRate: getNumericValue(economy.interestRate),
    taxBurden: getNumericValue(economy.taxBurden),
    publicServices: getNumericValue(economy.publicServices),
    gdpGrowth: getNumericValue(economy.gdpGrowth)
  };
};

export default countryStateSlice.reducer;