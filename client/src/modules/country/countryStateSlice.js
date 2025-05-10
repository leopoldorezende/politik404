import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Estados dos países por sala
  roomStates: {}, // { roomName: { countryName: { economy, defense, commerce, politics } } }
  
  // Timestamp da última atualização por sala
  lastUpdated: {}, // { roomName: timestamp }
  
  // Status de carregamento
  loading: false,
  
  // Erro atual
  error: null,
};

export const countryStateSlice = createSlice({
  name: 'countryState',
  initialState,
  reducers: {
    // Quando os estados dos países são inicializados para uma sala
    initializeCountryStates: (state, action) => {
      const { roomName, states, timestamp } = action.payload;
      
      // Armazena os estados dos países para esta sala
      state.roomStates[roomName] = states;
      
      // Atualiza o timestamp
      state.lastUpdated[roomName] = timestamp;
      
      // Limpa o erro
      state.error = null;
      
      // Marca como carregado
      state.loading = false;
    },
    
    // Quando os estados dos países são atualizados para uma sala
    updateCountryStates: (state, action) => {
      const { roomName, states, timestamp } = action.payload;
      
      // Só atualiza se o timestamp for mais recente
      if (!state.lastUpdated[roomName] || timestamp > state.lastUpdated[roomName]) {
        // Atualiza os estados
        state.roomStates[roomName] = states;
        
        // Atualiza o timestamp
        state.lastUpdated[roomName] = timestamp;
      }
    },
    
    // Atualiza um país específico
    updateCountryState: (state, action) => {
      const { roomName, countryName, category, updates, timestamp } = action.payload;
      
      // Verifica se a sala e o país existem
      if (state.roomStates[roomName] && state.roomStates[roomName][countryName]) {
        // Só atualiza se o timestamp for mais recente
        if (!state.lastUpdated[roomName] || timestamp > state.lastUpdated[roomName]) {
          // Atualiza a categoria específica
          state.roomStates[roomName][countryName][category] = {
            ...state.roomStates[roomName][countryName][category],
            ...updates
          };
          
          // Atualiza o timestamp
          state.lastUpdated[roomName] = timestamp;
        }
      }
    },
    
    // Quando começa a carregar os estados dos países
    startLoading: (state) => {
      state.loading = true;
      state.error = null;
    },
    
    // Quando ocorre um erro
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    // Ao sair de uma sala, limpa os estados dos países para essa sala
    clearRoomStates: (state, action) => {
      const roomName = action.payload;
      
      if (state.roomStates[roomName]) {
        delete state.roomStates[roomName];
      }
      
      if (state.lastUpdated[roomName]) {
        delete state.lastUpdated[roomName];
      }
    },
    
    // Limpa todos os estados
    resetState: (state) => {
      state.roomStates = {};
      state.lastUpdated = {};
      state.loading = false;
      state.error = null;
    }
  },
});

// Export das actions
export const {
  initializeCountryStates,
  updateCountryStates,
  updateCountryState,
  startLoading,
  setError,
  clearRoomStates,
  resetState
} = countryStateSlice.actions;

// Seletores
export const selectCountryStates = (state, roomName) => state.countryState.roomStates[roomName] || {};
export const selectCountryState = (state, roomName, countryName) => state.countryState.roomStates[roomName]?.[countryName] || null;
export const selectCountryStateLoading = (state) => state.countryState.loading;
export const selectCountryStateError = (state) => state.countryState.error;
export const selectLastUpdated = (state, roomName) => state.countryState.lastUpdated[roomName] || null;

export default countryStateSlice.reducer;