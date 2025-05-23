import { createSlice } from '@reduxjs/toolkit';

/**
 * countryStateSlice.js (Corrigido)
 * Cache otimizado para dados econômicos vindos do servidor
 * Foca apenas em armazenar e acessar dados, sem recálculos desnecessários
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
 */
const getNumericValue = (property) => {
  if (property === undefined || property === null) return 0;
  if (typeof property === 'number') return property;
  if (typeof property === 'object' && property.value !== undefined) return property.value;
  return 0;
};

// ======================================================================
// SELETORES BÁSICOS (com memoização automática)
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
// SELETORES PRINCIPAIS (usados pelos componentes)
// ======================================================================

/**
 * Obtém resumo de dívidas de um país (dados diretos do servidor)
 */
export const selectCountryDebtSummary = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  // Usar dados que vêm diretamente do servidor
  const contracts = economy.debtRecords || [];
  const numberOfContracts = economy.numberOfDebtContracts || contracts.length || 0;
  
  // Se o servidor já enviou dados calculados, usar esses
  if (economy.totalMonthlyPayment !== undefined || economy.principalRemaining !== undefined) {
    return {
      totalMonthlyPayment: economy.totalMonthlyPayment || 0,
      principalRemaining: economy.principalRemaining || getNumericValue(economy.publicDebt) || 0,
      totalFuturePayments: economy.totalFuturePayments || 0,
      numberOfContracts,
      contracts
    };
  }
  
  // Fallback: calcular apenas se não há dados do servidor
  if (contracts.length === 0) {
    return {
      totalMonthlyPayment: 0,
      principalRemaining: getNumericValue(economy.publicDebt) || 0,
      totalFuturePayments: 0,
      numberOfContracts: 0,
      contracts: []
    };
  }
  
  // Cálculo simples apenas se necessário
  const totalMonthlyPayment = contracts.reduce((sum, debt) => sum + (debt.monthlyPayment || 0), 0);
  const principalRemaining = contracts.reduce((sum, debt) => sum + (debt.remainingValue || 0), 0);
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
 * Obtém indicadores econômicos principais (dados do servidor)
 */
export const selectCountryEconomicIndicators = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  return {
    // Indicadores básicos
    gdp: getNumericValue(economy.gdp),
    treasury: getNumericValue(economy.treasury),
    publicDebt: getNumericValue(economy.publicDebt),
    
    // Indicadores avançados (já calculados pelo servidor)
    inflation: getNumericValue(economy.inflation),
    unemployment: getNumericValue(economy.unemployment),
    popularity: getNumericValue(economy.popularity),
    creditRating: economy.creditRating || 'A',
    
    // Parâmetros econômicos
    interestRate: getNumericValue(economy.interestRate) || 8.0,
    taxBurden: getNumericValue(economy.taxBurden) || 40.0,
    publicServices: getNumericValue(economy.publicServices) || 30.0,
    
    // Crescimento (já calculado pelo servidor)
    gdpGrowth: getNumericValue(economy.quarterlyGrowth) * 100 || 0,
    
    // Indicadores adicionais se disponíveis
    previousQuarterGDP: getNumericValue(economy.previousQuarterGDP),
    quarterlyGrowth: getNumericValue(economy.quarterlyGrowth),
    
    // Histórico (para gráficos futuros)
    gdpHistory: economy.gdpHistory || [],
    inflationHistory: economy.inflationHistory || [],
    popularityHistory: economy.popularityHistory || [],
    unemploymentHistory: economy.unemploymentHistory || []
  };
};

export default countryStateSlice.reducer;