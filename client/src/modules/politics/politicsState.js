import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Aprovação política
  approval: {}, // Formato: { countryName: { parliament: number, media: number, popularity: number } }
  
  // Instabilidade política
  instability: {}, // Formato: { countryName: { protests: number, opposition: number } }
  
  // Eventos políticos recentes
  events: [], // Lista de eventos políticos
};

export const politicsState = createSlice({
  name: 'politics',
  initialState,
  reducers: {
    // Atualiza níveis de aprovação para um país
    updateApproval: (state, action) => {
      const { country, parliament, media, popularity } = action.payload;
      if (!state.approval[country]) {
        state.approval[country] = { parliament: 50, media: 50, popularity: 50 };
      }
      
      if (parliament !== undefined) state.approval[country].parliament = parliament;
      if (media !== undefined) state.approval[country].media = media;
      if (popularity !== undefined) state.approval[country].popularity = popularity;
    },
    
    // Atualiza valores de instabilidade para um país
    updateInstability: (state, action) => {
      const { country, protests, opposition } = action.payload;
      if (!state.instability[country]) {
        state.instability[country] = { protests: 0, opposition: 0 };
      }
      
      if (protests !== undefined) state.instability[country].protests = protests;
      if (opposition !== undefined) state.instability[country].opposition = opposition;
    },
    
    // Adiciona um evento político
    addPoliticalEvent: (state, action) => {
      // Limita a lista de eventos a 20
      if (state.events.length >= 20) {
        state.events.shift();
      }
      
      state.events.push({
        ...action.payload,
        timestamp: action.payload.timestamp || Date.now()
      });
    },
    
    // Reseta todo o estado de política
    resetPoliticsState: (state) => {
      state.approval = {};
      state.instability = {};
      state.events = [];
    }
  },
});

export const {
  updateApproval,
  updateInstability,
  addPoliticalEvent,
  resetPoliticsState
} = politicsState.actions;

export default politicsState.reducer;