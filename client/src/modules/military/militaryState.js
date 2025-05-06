import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Forças militares por país
  forces: {}, // { countryName: { army: number, navy: number, airforce: number, missiles: number, nuclear: boolean } }
  
  // Histórico de investimentos
  investments: {}, // { countryName: [{ type: string, amount: number, timestamp: number }] }
  
  // Histórico de ações de guerra
  warActions: [], // Lista de ações de guerra
  
  // Capacidade nuclear
  nuclearStatus: {}, // { countryName: boolean }
};

export const militaryState = createSlice({
  name: 'military',
  initialState,
  reducers: {
    // Atualiza forças militares de um país
    updateMilitaryForces: (state, action) => {
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
    
    // Registra uma ação de guerra
    recordWarAction: (state, action) => {
      const { country, target, strategy, timestamp } = action.payload;
      
      const warAction = {
        id: `war-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        aggressor: country,
        target,
        strategy,
        timestamp: timestamp || Date.now(),
        status: 'initiated'
      };
      
      state.warActions.push(warAction);
      
      // Efeitos da ação de guerra nas forças militares (redução)
      if (state.forces[country]) {
        switch (strategy) {
          case 'attack':
            // Ataque bélico consome forças militares do agressor
            state.forces[country].army = Math.max(0, state.forces[country].army - 10);
            state.forces[country].navy = Math.max(0, state.forces[country].navy - 5);
            state.forces[country].airforce = Math.max(0, state.forces[country].airforce - 8);
            break;
          case 'sabotage':
            // Sabotagem consome menos recursos
            state.forces[country].army = Math.max(0, state.forces[country].army - 5);
            break;
          case 'regime':
            // Mudança de regime é custosa
            state.forces[country].army = Math.max(0, state.forces[country].army - 15);
            state.forces[country].airforce = Math.max(0, state.forces[country].airforce - 10);
            break;
          case 'disinformation':
            // Desinformação tem baixo custo militar
            state.forces[country].army = Math.max(0, state.forces[country].army - 2);
            break;
        }
      }
    },
    
    // Atualiza o status de uma ação de guerra
    updateWarActionStatus: (state, action) => {
      const { warId, status, outcome } = action.payload;
      
      const warIndex = state.warActions.findIndex(w => w.id === warId);
      if (warIndex !== -1) {
        state.warActions[warIndex].status = status;
        
        if (outcome) {
          state.warActions[warIndex].outcome = outcome;
          state.warActions[warIndex].resolvedAt = Date.now();
        }
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
    resetMilitaryState: (state) => {
      state.forces = {};
      state.investments = {};
      state.warActions = [];
      state.nuclearStatus = {};
    }
  },
});

export const {
  updateMilitaryForces,
  recordInvestment,
  recordWarAction,
  updateWarActionStatus,
  updateNuclearStatus,
  resetMilitaryState
} = militaryState.actions;

export default militaryState.reducer;