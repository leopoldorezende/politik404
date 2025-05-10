import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Forças militares por país
  forces: {}, // { countryName: { army: number, navy: number, airforce: number, missiles: number, nuclear: boolean } }
  
  // Histórico de investimentos
  investments: {}, // { countryName: [{ type: string, amount: number, timestamp: number }] }
  
  // Capacidade nuclear
  nuclearStatus: {}, // { countryName: boolean }
};

export const defenseState = createSlice({
  name: 'defense',
  initialState,
  reducers: {
    // Atualiza forças militares de um país
    updateDefenseForces: (state, action) => {
      const { country, army, navy, airforce, missiles, nuclear } = action.payload;
      
      if (!state.forces[country]) {
        state.forces[country] = { 
          army: 0, 
          navy: 0, 
          airforce: 0, 
          missiles: 0, 
          nuclear: false 
        };
      }
      
      const forces = state.forces[country];
      if (army !== undefined) forces.army = army;
      if (navy !== undefined) forces.navy = navy;
      if (airforce !== undefined) forces.airforce = airforce;
      if (missiles !== undefined) forces.missiles = missiles;
      if (nuclear !== undefined) forces.nuclear = nuclear;
    },
    
    // Registra um investimento militar
    recordInvestment: (state, action) => {
      const { country, type, amount, timestamp } = action.payload;
      
      if (!state.investments[country]) {
        state.investments[country] = [];
      }
      
      state.investments[country].push({
        type,
        amount,
        timestamp: timestamp || Date.now(),
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      });
      
      // Atualiza as forças militares baseado no tipo de investimento
      if (!state.forces[country]) {
        state.forces[country] = { 
          army: 0, 
          navy: 0, 
          airforce: 0, 
          missiles: 0, 
          nuclear: false 
        };
      }
      
      const forces = state.forces[country];
      
      switch (type) {
        case 'army':
          forces.army = Math.min(100, forces.army + amount);
          break;
        case 'navy':
          forces.navy = Math.min(100, forces.navy + amount);
          break;
        case 'airforce':
          forces.airforce = Math.min(100, forces.airforce + amount);
          break;
        default:
          // Caso não especificado, distribui igualmente
          const perForce = amount / 3;
          forces.army = Math.min(100, forces.army + perForce);
          forces.navy = Math.min(100, forces.navy + perForce);
          forces.airforce = Math.min(100, forces.airforce + perForce);
      }
    },
    
    // Atualiza o status nuclear de um país
    updateNuclearStatus: (state, action) => {
      const { country, hasNuclear } = action.payload;
      
      state.nuclearStatus[country] = hasNuclear;
      
      // Também atualiza no forces para consistência
      if (state.forces[country]) {
        state.forces[country].nuclear = hasNuclear;
      } else {
        state.forces[country] = { 
          army: 0, 
          navy: 0, 
          airforce: 0, 
          missiles: 0, 
          nuclear: hasNuclear 
        };
      }
    },
    
    // Reseta o estado militar
    resetDefenseState: (state) => {
      state.forces = {};
      state.investments = {};
      state.nuclearStatus = {};
    }
  },
});

export const {
  updateDefenseForces,
  recordInvestment,
  updateNuclearStatus,
  resetDefenseState
} = defenseState.actions;

export default defenseState.reducer;