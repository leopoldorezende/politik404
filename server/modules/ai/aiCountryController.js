/**
 * aiCountryController.js (Corrigido)
 * IA para países não controlados por jogadores
 * CORRIGIDO: Usa countryStateManager ao invés de economyCalculations removido
 */

import countryStateManager from '../../shared/countryState/countryStateManager.js';

/**
 * Avalia uma proposta de comércio do ponto de vista da IA
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {Object} proposal - Proposta comercial
 * @returns {Object} - { accepted: boolean, reason: string }
 */
function evaluateTradeProposal(gameState, roomName, proposal) {
  const { type, product, targetCountry, value, originCountry } = proposal;
  
  try {
    // Obter estado econômico do país alvo usando countryStateManager
    const targetCountryState = countryStateManager.getCountryState(roomName, targetCountry);
    
    if (!targetCountryState || !targetCountryState.economy) {
      return {
        accepted: false,
        reason: 'No economic data available for evaluation'
      };
    }
    
    const economy = targetCountryState.economy;
    
    // Obter valores numéricos de forma segura
    const getNumericValue = (property) => {
      if (property === undefined || property === null) return 0;
      if (typeof property === 'number') return property;
      if (typeof property === 'object' && property.value !== undefined) return property.value;
      return 0;
    };
    
    const commoditiesBalance = getNumericValue(economy.commoditiesBalance);
    const manufacturesBalance = getNumericValue(economy.manufacturesBalance);
    const gdp = getNumericValue(economy.gdp);
    
    // Lógica de decisão da IA baseada no balanço econômico
    if (type === 'import') {
      // Originador quer importar DO país alvo (país alvo exporta)
      if (product === 'commodity') {
        // Se o país alvo tem excedente de commodities, aceita exportar
        if (commoditiesBalance > gdp * 0.05) { // 5% do PIB de excedente
          return {
            accepted: true,
            reason: `${targetCountry} has commodity surplus and accepts export to ${originCountry}`
          };
        } else {
          return {
            accepted: false,
            reason: `${targetCountry} has insufficient commodity surplus for export`
          };
        }
      } else if (product === 'manufacture') {
        // Se o país alvo tem excedente de manufaturas, aceita exportar
        if (manufacturesBalance > gdp * 0.05) { // 5% do PIB de excedente
          return {
            accepted: true,
            reason: `${targetCountry} has manufacturing surplus and accepts export to ${originCountry}`
          };
        } else {
          return {
            accepted: false,
            reason: `${targetCountry} has insufficient manufacturing surplus for export`
          };
        }
      }
    } else if (type === 'export') {
      // Originador quer exportar PARA o país alvo (país alvo importa)
      if (product === 'commodity') {
        // Se o país alvo tem déficit de commodities, aceita importar
        if (commoditiesBalance < -gdp * 0.02) { // 2% do PIB de déficit
          return {
            accepted: true,
            reason: `${targetCountry} has commodity deficit and accepts import from ${originCountry}`
          };
        } else {
          return {
            accepted: false,
            reason: `${targetCountry} has no significant commodity deficit`
          };
        }
      } else if (product === 'manufacture') {
        // Se o país alvo tem déficit de manufaturas, aceita importar
        if (manufacturesBalance < -gdp * 0.02) { // 2% do PIB de déficit
          return {
            accepted: true,
            reason: `${targetCountry} has manufacturing deficit and accepts import from ${originCountry}`
          };
        } else {
          return {
            accepted: false,
            reason: `${targetCountry} has no significant manufacturing deficit`
          };
        }
      }
    }
    
    // Fallback: decisão aleatória com tendência a rejeitar
    const randomFactor = Math.random();
    if (randomFactor > 0.7) { // 30% de chance de aceitar
      return {
        accepted: true,
        reason: `${targetCountry} accepts proposal based on diplomatic considerations`
      };
    } else {
      return {
        accepted: false,
        reason: `${targetCountry} rejects proposal due to current economic priorities`
      };
    }
    
  } catch (error) {
    console.error(`Error evaluating trade proposal for ${targetCountry}:`, error);
    
    // Em caso de erro, rejeitar a proposta
    return {
      accepted: false,
      reason: 'Internal error during proposal evaluation'
    };
  }
}

/**
 * Simula ações econômicas para países controlados pela IA
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 */
function simulateAICountryActions(gameState, roomName, countryName) {
  try {
    // Obter estado do país usando countryStateManager
    const countryState = countryStateManager.getCountryState(roomName, countryName);
    
    if (!countryState || !countryState.economy) {
      console.warn(`[AI] No economic data for ${countryName}, skipping AI actions`);
      return;
    }
    
    const economy = countryState.economy;
    
    // Obter valores numéricos de forma segura
    const getNumericValue = (property) => {
      if (property === undefined || property === null) return 0;
      if (typeof property === 'number') return property;
      if (typeof property === 'object' && property.value !== undefined) return property.value;
      return 0;
    };
    
    const treasury = getNumericValue(economy.treasury);
    const gdp = getNumericValue(economy.gdp);
    const publicDebt = getNumericValue(economy.publicDebt) || 0;
    
    // Lógica da IA para emissão de títulos
    if (treasury < gdp * 0.05) { // Tesouro abaixo de 5% do PIB
      const debtToGdpRatio = publicDebt / gdp;
      
      // Só emite títulos se a dívida estiver abaixo de 80% do PIB
      if (debtToGdpRatio < 0.8) {
        const bondAmount = Math.min(gdp * 0.1, 50); // 10% do PIB ou 50 bi, o que for menor
        
        try {
          const result = countryStateManager.issueDebtBonds(roomName, countryName, bondAmount);
          
          if (result.success) {
            console.log(`[AI] ${countryName} issued ${bondAmount} billion in bonds (AI decision)`);
          } else {
            console.log(`[AI] ${countryName} failed to issue bonds: ${result.message}`);
          }
        } catch (error) {
          console.error(`[AI] Error issuing bonds for ${countryName}:`, error);
        }
      } else {
        console.log(`[AI] ${countryName} has high debt ratio (${(debtToGdpRatio * 100).toFixed(1)}%), avoiding new debt`);
      }
    }
    
    // Lógica da IA para ajuste de parâmetros econômicos (ocasional)
    if (Math.random() < 0.1) { // 10% de chance a cada ciclo
      // Ajustar taxa de juros baseado na inflação
      const inflation = (getNumericValue(economy.inflation) || 0) * 100;
      let targetInterestRate = 8.0; // Taxa padrão
      
      if (inflation > 6) {
        targetInterestRate = Math.min(15, 8 + (inflation - 6) * 0.5); // Aumentar juros para combater inflação
      } else if (inflation < 2) {
        targetInterestRate = Math.max(2, 8 - (2 - inflation) * 0.5); // Reduzir juros para estimular economia
      }
      
      const currentInterestRate = getNumericValue(economy.interestRate) || 8.0;
      
      // Só ajusta se a diferença for significativa
      if (Math.abs(targetInterestRate - currentInterestRate) > 0.5) {
        try {
          countryStateManager.updateEconomicParameter(
            roomName,
            countryName,
            'interestRate',
            targetInterestRate
          );
          
          console.log(`[AI] ${countryName} adjusted interest rate to ${targetInterestRate.toFixed(1)}% (inflation: ${inflation.toFixed(1)}%)`);
        } catch (error) {
          console.error(`[AI] Error updating interest rate for ${countryName}:`, error);
        }
      }
    }
    
  } catch (error) {
    console.error(`[AI] Error simulating actions for ${countryName}:`, error);
  }
}

export {
  evaluateTradeProposal,
  simulateAICountryActions
};