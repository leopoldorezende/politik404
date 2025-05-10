import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  updates: {}, // Para armazenar o histórico de atualizações econômicas por sala
  latestUpdate: null, // Última atualização recebida
  events: [], // Eventos econômicos especiais
  config: null, // Configurações do sistema econômico
};

export const economyState = createSlice({
  name: 'economy',
  initialState,
  reducers: {
    updateEconomyData: (state, action) => {
      // action.payload contém { room, timestamp, countries, isBackgroundUpdate }
      const update = action.payload;
      
      // Se for uma atualização em segundo plano, não redefinimos o país selecionado
      const isBackgroundUpdate = update.isBackgroundUpdate === true;
      
      // Armazena a atualização mais recente
      state.latestUpdate = update;
      
      // Armazena a atualização no histórico identificado pela sala
      if (!state.updates[update.room]) {
        state.updates[update.room] = [];
      }
      
      // Limita o histórico a 10 atualizações por sala
      if (state.updates[update.room].length >= 10) {
        state.updates[update.room].shift();
      }
      
      state.updates[update.room].push(update);
    },
    
    // Reseta todo o estado econômico
    resetEconomyState: (state) => {
      state.updates = {};
      state.latestUpdate = null;
      state.events = [];
      state.config = null;
    }
  },
});

export const {
  updateEconomyData,
  resetEconomyState
} = economyState.actions;

export default economyState.reducer;