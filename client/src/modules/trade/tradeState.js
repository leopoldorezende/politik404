import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Acordos comerciais entre países
  tradeAgreements: [], // Lista de acordos comerciais ativos
  
  // Rotas comerciais estabelecidas por país
  tradeRoutes: {}, // Por país: { countryA: [{ destination: 'countryB', type: 'import/export' }] }
};

export const tradeState = createSlice({
  name: 'trade',
  initialState,
  reducers: {
    // Adiciona um novo acordo comercial
    addTradeAgreement: (state, action) => {
      const newAgreement = {
        ...action.payload,
        id: `agreement-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        createdAt: Date.now()
      };
      
      state.tradeAgreements.push(newAgreement);
    },
    
    // Remove um acordo comercial
    removeTradeAgreement: (state, action) => {
      state.tradeAgreements = state.tradeAgreements.filter(
        agreement => agreement.id !== action.payload.id
      );
    },
    
    // Adiciona uma rota comercial
    addTradeRoute: (state, action) => {
      const { sourceCountry, destinationCountry, routeType } = action.payload;
      
      if (!state.tradeRoutes[sourceCountry]) {
        state.tradeRoutes[sourceCountry] = [];
      }
      
      const newRoute = {
        id: `route-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        source: sourceCountry,
        destination: destinationCountry,
        type: routeType || 'export',
        createdAt: Date.now(),
        status: 'active'
      };
      
      state.tradeRoutes[sourceCountry].push(newRoute);
    },
    
    // Remove uma rota comercial
    removeTradeRoute: (state, action) => {
      const { sourceCountry, routeId } = action.payload;
      
      if (state.tradeRoutes[sourceCountry]) {
        state.tradeRoutes[sourceCountry] = state.tradeRoutes[sourceCountry].filter(
          route => route.id !== routeId
        );
      }
    },
    
    // Reseta todo o estado de comércio
    resetTradeState: (state) => {
      state.tradeAgreements = [];
      state.tradeRoutes = {};
    }
  },
});

export const {
  addTradeAgreement,
  removeTradeAgreement,
  addTradeRoute,
  removeTradeRoute,
  resetTradeState
} = tradeState.actions;

export default tradeState.reducer;