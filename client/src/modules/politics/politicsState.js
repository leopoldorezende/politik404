import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Aprovação política
  approval: {}, // Formato: { countryName: { parliament: number, media: number, popularity: number } }
  
  // Instabilidade política
  instability: {}, // Formato: { countryName: { protests: number, opposition: number } }
  
  // Eventos políticos recentes
  events: [], // Lista de eventos políticos
  
  // Dinheiro gasto em política
  politicalSpending: {}, // Formato: { countryName: number }
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
    
    // Registra gasto político
    recordPoliticalSpending: (state, action) => {
      const { country, amount } = action.payload;
      
      if (!state.politicalSpending[country]) {
        state.politicalSpending[country] = 0;
      }
      
      state.politicalSpending[country] += amount;
    },
    
    // Aumenta aprovação parlamentar (compra de parlamento)
    increaseParlamentaryApproval: (state, action) => {
      const { country, amount } = action.payload;
      
      if (!state.approval[country]) {
        state.approval[country] = { parliament: 50, media: 50, popularity: 50 };
      }
      
      // Limita o aumento a no máximo 95% no total
      const newValue = Math.min(state.approval[country].parliament + amount, 95);
      state.approval[country].parliament = newValue;
      
      // Registra o evento
      const eventData = {
        country,
        type: 'PARLIAMENT_APPROVAL_INCREASED',
        description: `Aprovação parlamentar aumentada em ${amount}%`,
        timestamp: Date.now()
      };
      
      if (state.events.length >= 20) {
        state.events.shift();
      }
      
      state.events.push(eventData);
    },
    
    // Reseta todo o estado de política
    resetPoliticsState: (state) => {
      state.approval = {};
      state.instability = {};
      state.events = [];
      state.politicalSpending = {};
    }
  },
});

export const {
  updateApproval,
  updateInstability,
  addPoliticalEvent,
  recordPoliticalSpending,
  increaseParlamentaryApproval,
  resetPoliticsState
} = politicsState.actions;

export default politicsState.reducer;