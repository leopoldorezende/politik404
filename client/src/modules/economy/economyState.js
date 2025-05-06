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
    
    addEconomicEvent: (state, action) => {
      // action.payload contém { room, country, event, currentEconomy }
      const eventData = action.payload;
      
      // Adiciona o evento à lista, limitando a 20 eventos
      if (state.events.length >= 20) {
        state.events.shift();
      }
      
      state.events.push(eventData);
    },
    
    setEconomyConfig: (state, action) => {
      // Armazena as configurações do sistema econômico
      state.config = action.payload;
    },
    
    applyPolicyChange: (state, action) => {
      // Este reducer não atualiza diretamente o estado de economia,
      // mas é usado para notificar sobre mudanças de política que afetam a economia
      // Os efeitos reais são aplicados quando o servidor envia uma atualização econômica
    },
    
    resetEconomyState: (state) => {
      // Reseta todo o estado econômico
      state.updates = {};
      state.latestUpdate = null;
      state.events = [];
      state.config = null;
    }
  },
});

export const {
  updateEconomyData,
  addEconomicEvent,
  setEconomyConfig,
  applyPolicyChange,
  resetEconomyState
} = economyState.actions;

export default economyState.reducer;