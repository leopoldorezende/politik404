import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Mantendo a estrutura mínima caso seja necessária no futuro
  tradeAgreements: [],
  tradeRoutes: {},
};

export const tradeState = createSlice({
  name: 'trade',
  initialState,
  reducers: {
    // Mantendo apenas o reducer de reset que pode ser útil
    resetTradeState: (state) => {
      state.tradeAgreements = [];
      state.tradeRoutes = {};
    }
  },
});

export const {
  resetTradeState
} = tradeState.actions;

export default tradeState.reducer;