/**
 * economyUpdateService.js
 * Service for updating country economies based on trade agreements and other economic factors
 */

import { performEconomicCalculations } from './economyCalculations.js';

/**
 * Atualiza as economias dos países envolvidos em um acordo comercial
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {Object} agreement - Dados do acordo
 */
function updateCountryEconomiesWithTradeAgreement(gameState, roomName, agreement) {
  const { originCountry, country: targetCountry } = agreement;
  
  // Atualizar economia do país de origem
  updateCountryEconomyForTrade(gameState, roomName, originCountry);
  
  // Atualizar economia do país de destino
  updateCountryEconomyForTrade(gameState, roomName, targetCountry);
}

/**
 * Atualiza a economia de um país com base em seus acordos comerciais
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 */
function updateCountryEconomyForTrade(gameState, roomName, countryName) {
  // Obter estado atual e dados estáticos do país
  const countryStateManager = global.countryStateManager;
  if (!countryStateManager) return;
  
  const currentState = countryStateManager.getCountryState(roomName, countryName);
  const staticData = gameState.countriesData[countryName];
  
  if (!currentState || !staticData) {
    console.error(`Country data missing for ${countryName}`);
    return;
  }
  
  // Para o país de origem, realizar cálculos considerando os acordos comerciais
  const room = gameState.rooms.get(roomName);
  if (!room) {
    console.error(`Room not found: ${roomName}`);
    return;
  }
  
  // Consideramos todos os acordos na sala
  // Isso é importante porque precisamos considerar acordos onde o país é tanto origem quanto destino
  const allAgreements = room.tradeAgreements || [];
  
  // Realizar cálculos econômicos
  const calculationResult = performEconomicCalculations(
    currentState,
    { ...staticData, countryName: countryName },
    {
      tradeAgreements: allAgreements
    }
  );
  
  // Log para debug dos balanços comerciais
  console.log(`Trade calculation results for ${countryName}:`, {
    manufacturesBalance: calculationResult.economy.manufacturesBalance?.value,
    commoditiesBalance: calculationResult.economy.commoditiesBalance?.value,
    tradeStats: calculationResult.economy.tradeStats
  });
  
  // Atualizar o estado do país
  countryStateManager.updateCountryState(
    roomName,
    countryName,
    'economy',
    calculationResult.economy
  );
}

/**
 * Calcula o impacto dos acordos comerciais na economia
 * Evita dupla contagem considerando apenas acordos onde o país atual é originador
 * @param {Object} economy - Estado econômico atual
 * @param {Array} tradeAgreements - Acordos comerciais ativos
 * @param {string} countryName - Nome do país atual
 * @returns {Object} - Ajustes a serem aplicados
 */
function calculateTradeAgreementsImpact(economy, tradeAgreements = [], countryName) {
  if (!tradeAgreements || tradeAgreements.length === 0 || !countryName) {
    return {
      commodityImports: 0,
      commodityExports: 0,
      manufactureImports: 0,
      manufactureExports: 0,
      balanceAdjustments: {}
    };
  }

  // Totais iniciais
  let commodityImports = 0;
  let commodityExports = 0;
  let manufactureImports = 0;
  let manufactureExports = 0;

  // Filtramos apenas os acordos onde este país é o originador
  // Isso é fundamental para evitar a contagem dupla
  const ownAgreements = tradeAgreements.filter(agreement => 
    agreement.originCountry === countryName
  );
  
  // Processamos apenas os acordos originados por este país
  ownAgreements.forEach(agreement => {
    if (agreement.type === 'export') {
      // Exportação do país atual
      if (agreement.product === 'commodity') {
        commodityExports += agreement.value;
      } else if (agreement.product === 'manufacture') {
        manufactureExports += agreement.value;
      }
    } else if (agreement.type === 'import') {
      // Importação para o país atual
      if (agreement.product === 'commodity') {
        commodityImports += agreement.value;
      } else if (agreement.product === 'manufacture') {
        manufactureImports += agreement.value;
      }
    }
  });

  // Calcular ajustes nos balanços - exportações DIMINUEM, importações aumentam
  // Para o cálculo do balanço, exportações subtraem e importações adicionam ao saldo interno disponível
  const commoditiesBalanceAdjustment = -commodityExports + commodityImports;
  const manufacturesBalanceAdjustment = -manufactureExports + manufactureImports;

  console.log(`Trade adjustments for ${countryName}:`, {
    commodityExports,
    commodityImports,
    manufactureExports, 
    manufactureImports,
    commoditiesBalanceAdjustment,
    manufacturesBalanceAdjustment
  });

  return {
    commodityImports,
    commodityExports,
    manufactureImports,
    manufactureExports,
    balanceAdjustments: {
      commodities: commoditiesBalanceAdjustment,
      manufactures: manufacturesBalanceAdjustment
    }
  };
}

export {
  updateCountryEconomiesWithTradeAgreement,
  updateCountryEconomyForTrade,
  calculateTradeAgreementsImpact
};