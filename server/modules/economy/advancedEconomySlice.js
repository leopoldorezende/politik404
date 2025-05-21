/**
 * advancedEconomySlice.js
 * Redux slice para economia avançada
 * Integra a lógica do simulador econômico com Redux
 */

import { createSlice } from '@reduxjs/toolkit';

// Estado inicial para a economia avançada de um país
const createInitialEconomyState = (countryData = {}) => ({
  // Indicadores principais
  turn: 0,
  gdp: countryData.gdp || 100,
  inflation: (countryData.inflation || 2.8) / 100, // Converter percentual para decimal
  interestRate: countryData.interestRate || 8.0,
  taxBurden: countryData.taxBurden || 40.0,
  publicServices: countryData.publicServices || 30.0,
  treasury: countryData.treasury || 100,
  publicDebt: countryData.publicDebt || 0,
  unemployment: countryData.unemployment || 12.5,
  popularity: countryData.popularity || 50,
  
  // Capacidades e flags
  canIssueDebt: true,
  creditRating: countryData.creditRating || "AA",
  
  // Crescimento e histórico
  previousQuarterGDP: countryData.previousQuarterGDP || countryData.gdp || 100,
  quarterlyGrowth: (countryData.quarterlyGrowth || 0.005),
  
  // Distribuição setorial do PIB (percentuais)
  services: countryData.economy?.services?.gdpShare || 65,
  commodities: countryData.economy?.commodities?.gdpShare || 20,
  manufactures: countryData.economy?.manufactures?.gdpShare || 15,
  
  // Valores absolutos dos setores (calculados)
  servicesOutput: 0,
  commoditiesOutput: 0,
  manufacturesOutput: 0,
  
  // Necessidades internas (percentuais do PIB)
  commoditiesNeedPercent: 30,
  manufacturesNeedPercent: 45,
  
  // Valores absolutos das necessidades (calculados)
  commoditiesNeeds: 0,
  manufacturesNeeds: 0,
  
  // Históricos para médias móveis
  gdpHistory: countryData.gdpHistory || [countryData.gdp || 100],
  inflationHistory: countryData.inflationHistory || [(countryData.inflation || 2.8) / 100],
  popularityHistory: countryData.popularityHistory || [countryData.popularity || 50],
  unemploymentHistory: countryData.unemploymentHistory || [countryData.unemployment || 12.5],
  
  // Sistema de dívidas
  debtRecords: countryData.debtRecords || [],
  nextDebtId: 1,
  
  // Estatísticas de última atualização
  lastUpdate: Date.now(),
  lastMonthlyUpdate: 0,
  lastQuarterlyUpdate: 0
});

const initialState = {
  // Estado econômico por país (roomName -> countryName -> economyState)
  countryEconomies: {},
  
  // Configurações globais
  autoAdvance: false,
  advanceSpeed: 1000, // ms entre turnos
  
  // Status de carregamento
  loading: false,
  error: null
};

const advancedEconomySlice = createSlice({
  name: 'advancedEconomy',
  initialState,
  reducers: {
    // Inicializa economia para um país específico
    initializeCountryEconomy: (state, action) => {
      const { roomName, countryName, countryData } = action.payload;
      
      if (!state.countryEconomies[roomName]) {
        state.countryEconomies[roomName] = {};
      }
      
      state.countryEconomies[roomName][countryName] = createInitialEconomyState(countryData);
    },
    
    // Atualiza parâmetros econômicos de um país
    updateEconomicParameters: (state, action) => {
      const { roomName, countryName, parameters } = action.payload;
      
      if (state.countryEconomies[roomName]?.[countryName]) {
        Object.assign(state.countryEconomies[roomName][countryName], parameters);
      }
    },
    
    // Avança um turno para um país específico
    advanceTurn: (state, action) => {
      const { roomName, countryName } = action.payload;
      const economy = state.countryEconomies[roomName]?.[countryName];
      
      if (!economy) return;
      
      economy.turn++;
      economy.lastUpdate = Date.now();
      
      // Aqui será implementada a lógica de avanço de turno
      // Por agora, apenas incrementa o turno
    },
    
    // Processa cálculos econômicos completos
    processEconomicCalculations: (state, action) => {
      const { roomName, countryName, calculationResults } = action.payload;
      const economy = state.countryEconomies[roomName]?.[countryName];
      
      if (!economy) return;
      
      // Aplica todos os resultados dos cálculos
      Object.assign(economy, calculationResults);
      economy.lastUpdate = Date.now();
    },
    
    // Emite títulos de dívida pública
    issueBonds: (state, action) => {
      const { roomName, countryName, bondData } = action.payload;
      const economy = state.countryEconomies[roomName]?.[countryName];
      
      if (!economy) return;
      
      const { success, newDebt, updatedEconomy } = bondData;
      
      if (success && newDebt) {
        economy.treasury = updatedEconomy.treasury;
        economy.publicDebt = updatedEconomy.publicDebt;
        economy.debtRecords = updatedEconomy.debtRecords;
        economy.nextDebtId = updatedEconomy.nextDebtId;
      }
    },
    
    // Processa pagamentos mensais de dívidas
    processDebtPayments: (state, action) => {
      const { roomName, countryName, paymentResults } = action.payload;
      const economy = state.countryEconomies[roomName]?.[countryName];
      
      if (!economy) return;
      
      const { updatedDebts, remainingCash, totalPayment } = paymentResults;
      
      economy.debtRecords = updatedDebts;
      economy.treasury = remainingCash;
      economy.lastMonthlyUpdate = Date.now();
    },
    
    // Atualiza distribuição setorial
    updateSectoralDistribution: (state, action) => {
      const { roomName, countryName, distribution } = action.payload;
      const economy = state.countryEconomies[roomName]?.[countryName];
      
      if (!economy) return;
      
      economy.services = distribution.services;
      economy.commodities = distribution.commodities;
      economy.manufactures = distribution.manufactures;
      economy.servicesOutput = distribution.servicesOutput;
      economy.commoditiesOutput = distribution.commoditiesOutput;
      economy.manufacturesOutput = distribution.manufacturesOutput;
    },
    
    // Atualiza necessidades internas
    updateDomesticNeeds: (state, action) => {
      const { roomName, countryName, needs } = action.payload;
      const economy = state.countryEconomies[roomName]?.[countryName];
      
      if (!economy) return;
      
      economy.commoditiesNeedPercent = needs.commoditiesNeedPercent;
      economy.manufacturesNeedPercent = needs.manufacturesNeedPercent;
      economy.commoditiesNeeds = needs.commoditiesNeeds;
      economy.manufacturesNeeds = needs.manufacturesNeeds;
    },
    
    // Atualiza históricos econômicos
    updateEconomicHistories: (state, action) => {
      const { roomName, countryName, histories } = action.payload;
      const economy = state.countryEconomies[roomName]?.[countryName];
      
      if (!economy) return;
      
      if (histories.gdpHistory) economy.gdpHistory = histories.gdpHistory;
      if (histories.inflationHistory) economy.inflationHistory = histories.inflationHistory;
      if (histories.popularityHistory) economy.popularityHistory = histories.popularityHistory;
      if (histories.unemploymentHistory) economy.unemploymentHistory = histories.unemploymentHistory;
    },
    
    // Atualiza classificação de crédito
    updateCreditRating: (state, action) => {
      const { roomName, countryName, creditRating } = action.payload;
      const economy = state.countryEconomies[roomName]?.[countryName];
      
      if (!economy) return;
      
      economy.creditRating = creditRating;
      economy.canIssueDebt = creditRating !== 'D' && (economy.publicDebt / economy.gdp) <= 1.2;
    },
    
    // Remove dados econômicos de uma sala
    removeRoomEconomyData: (state, action) => {
      const { roomName } = action.payload;
      delete state.countryEconomies[roomName];
    },
    
    // Remove dados econômicos de um país específico
    removeCountryEconomyData: (state, action) => {
      const { roomName, countryName } = action.payload;
      if (state.countryEconomies[roomName]) {
        delete state.countryEconomies[roomName][countryName];
      }
    },
    
    // Configurações globais
    setAutoAdvance: (state, action) => {
      state.autoAdvance = action.payload;
    },
    
    setAdvanceSpeed: (state, action) => {
      state.advanceSpeed = action.payload;
    },
    
    // Estados de carregamento e erro
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    // Reset completo do estado
    resetAdvancedEconomy: (state) => {
      state.countryEconomies = {};
      state.autoAdvance = false;
      state.loading = false;
      state.error = null;
    }
  }
});

// Actions
export const {
  initializeCountryEconomy,
  updateEconomicParameters,
  advanceTurn,
  processEconomicCalculations,
  issueBonds,
  processDebtPayments,
  updateSectoralDistribution,
  updateDomesticNeeds,
  updateEconomicHistories,
  updateCreditRating,
  removeRoomEconomyData,
  removeCountryEconomyData,
  setAutoAdvance,
  setAdvanceSpeed,
  setLoading,
  setError,
  clearError,
  resetAdvancedEconomy
} = advancedEconomySlice.actions;

// Seletores
export const selectCountryEconomy = (state, roomName, countryName) => 
  state.advancedEconomy.countryEconomies[roomName]?.[countryName];

export const selectRoomEconomies = (state, roomName) => 
  state.advancedEconomy.countryEconomies[roomName] || {};

export const selectAdvancedEconomyLoading = (state) => 
  state.advancedEconomy.loading;

export const selectAdvancedEconomyError = (state) => 
  state.advancedEconomy.error;

export const selectAutoAdvance = (state) => 
  state.advancedEconomy.autoAdvance;

export const selectAdvanceSpeed = (state) => 
  state.advancedEconomy.advanceSpeed;

// Seletores derivados
export const selectCountryDebtSummary = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  const totalMonthlyPayment = economy.debtRecords.reduce((total, debt) => 
    total + debt.monthlyPayment, 0
  );
  
  const principalRemaining = economy.debtRecords.reduce((total, debt) => 
    total + debt.remainingValue, 0
  );
  
  const totalFuturePayments = economy.debtRecords.reduce((total, debt) => 
    total + (debt.monthlyPayment * debt.remainingInstallments), 0
  );
  
  return {
    totalMonthlyPayment,
    principalRemaining,
    totalFuturePayments,
    debtToGdpRatio: economy.publicDebt / economy.gdp,
    numberOfDebts: economy.debtRecords.length
  };
};

export const selectCountrySectoralBalance = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  const commoditiesBalance = economy.commoditiesOutput - economy.commoditiesNeeds;
  const manufacturesBalance = economy.manufacturesOutput - economy.manufacturesNeeds;
  
  return {
    commoditiesBalance,
    manufacturesBalance,
    commoditiesOutput: economy.commoditiesOutput,
    manufacturesOutput: economy.manufacturesOutput,
    servicesOutput: economy.servicesOutput,
    commoditiesNeeds: economy.commoditiesNeeds,
    manufacturesNeeds: economy.manufacturesNeeds
  };
};

export const selectCountryEconomicIndicators = (state, roomName, countryName) => {
  const economy = selectCountryEconomy(state, roomName, countryName);
  if (!economy) return null;
  
  return {
    gdp: economy.gdp,
    inflation: economy.inflation * 100, // Converter para percentual
    unemployment: economy.unemployment,
    popularity: economy.popularity,
    quarterlyGrowth: economy.quarterlyGrowth * 100, // Converter para percentual
    treasury: economy.treasury,
    publicDebt: economy.publicDebt,
    creditRating: economy.creditRating,
    debtToGdpRatio: (economy.publicDebt / economy.gdp) * 100,
    canIssueDebt: economy.canIssueDebt
  };
};

export default advancedEconomySlice.reducer;