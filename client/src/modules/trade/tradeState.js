import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Acordos comerciais ativos - estrutura proposta:
  // [{ id: string, type: 'export'|'import', product: 'commodity'|'manufacture', country: string, value: number, timestamp: number }]
  tradeAgreements: [],
  
  // Estatísticas de comércio
  tradeStats: {
    commodityImports: 0, // Total de importações de commodities
    commodityExports: 0, // Total de exportações de commodities
    manufactureImports: 0, // Total de importações de manufaturas
    manufactureExports: 0, // Total de exportações de manufaturas
  },
  
  // Outras propriedades
  tradeRoutes: {},
};

export const tradeState = createSlice({
  name: 'trade',
  initialState,
  reducers: {
    // Adicionar um novo acordo comercial
    addTradeAgreement: (state, action) => {
      const newAgreement = {
        id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        ...action.payload
      };
      state.tradeAgreements.push(newAgreement);
      
      // Atualizar estatísticas de comércio
      updateTradeStatistics(state);
    },
    
    // Remover um acordo comercial existente
    removeTradeAgreement: (state, action) => {
      state.tradeAgreements = state.tradeAgreements.filter(
        agreement => agreement.id !== action.payload
      );
      
      // Atualizar estatísticas de comércio
      updateTradeStatistics(state);
    },
    
    // Atualizar as estatísticas de comércio manualmente
    updateStats: (state) => {
      updateTradeStatistics(state);
    },
    
    // Resetar o estado de comércio (ao sair da sala, etc.)
    resetTradeState: (state) => {
      state.tradeAgreements = [];
      state.tradeRoutes = {};
      state.tradeStats = {
        commodityImports: 0,
        commodityExports: 0,
        manufactureImports: 0,
        manufactureExports: 0,
      };
    }
  },
});

// Função auxiliar para atualizar as estatísticas de comércio
function updateTradeStatistics(state) {
  // Zerar os valores
  state.tradeStats = {
    commodityImports: 0,
    commodityExports: 0,
    manufactureImports: 0,
    manufactureExports: 0,
  };
  
  // Calcular os totais baseados nos acordos ativos
  state.tradeAgreements.forEach(agreement => {
    if (agreement.type === 'import') {
      if (agreement.product === 'commodity') {
        state.tradeStats.commodityImports += agreement.value;
      } else if (agreement.product === 'manufacture') {
        state.tradeStats.manufactureImports += agreement.value;
      }
    } else if (agreement.type === 'export') {
      if (agreement.product === 'commodity') {
        state.tradeStats.commodityExports += agreement.value;
      } else if (agreement.product === 'manufacture') {
        state.tradeStats.manufactureExports += agreement.value;
      }
    }
  });
}

// Exportar ações e reducer
export const {
  addTradeAgreement,
  removeTradeAgreement,
  updateStats,
  resetTradeState
} = tradeState.actions;

export default tradeState.reducer;