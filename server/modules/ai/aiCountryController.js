/**
 * aiCountryController.js
 * Controlador para gerenciar comportamento e tomada de decisão de países controlados por IA
 */

import { performEconomicCalculations } from '../economy/economyCalculations.js';
import countryStateManager from '../../shared/countryStateManager.js';

/**
 * Avalia uma proposta comercial e decide se deve aceitá-la
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {Object} proposal - Proposta comercial a ser avaliada
 * @returns {Object} - Decisão { accepted: boolean, reason: string }
 */
function evaluateTradeProposal(gameState, roomName, proposal) {
  const { type, product, targetCountry, value, originCountry } = proposal;
  
  // Obter estado do país alvo
  const targetState = countryStateManager.getCountryState(roomName, targetCountry);
  const staticData = gameState.countriesData[targetCountry];
  
  if (!targetState || !staticData) {
    return { 
      accepted: false, 
      reason: 'Dados insuficientes para avaliação' 
    };
  }
  
  // Obter balanços comerciais atuais
  const economy = targetState.economy;
  let needScore = 0;
  let benefitScore = 0;
  
  // Quanto maior o score final, maior a chance de aceitar a proposta
  // Lógica inicial: se o tipo de produto é necessário, aumenta a chance de aceitar
  
  // Para importações pelo país IA (outro país quer exportar para ele)
  if (type === 'export') { // Nota: tipo é do ponto de vista do originador
    // Verificar se o país precisa do produto
    if (product === 'commodity') {
      const currentBalance = economy.commoditiesBalance?.value || 0;
      
      // Se o balanço for negativo, o país precisa importar
      if (currentBalance < 0) {
        // Quanto mais negativo o balanço, mais o país precisa
        needScore += Math.min(Math.abs(currentBalance) / value, 5) * 20;
      } else {
        // Balanço positivo, não precisa muito deste produto
        needScore += 5;
      }
    } else if (product === 'manufacture') {
      const currentBalance = economy.manufacturesBalance?.value || 0;
      
      // Se o balanço for negativo, o país precisa importar
      if (currentBalance < 0) {
        // Quanto mais negativo o balanço, mais o país precisa
        needScore += Math.min(Math.abs(currentBalance) / value, 5) * 20;
      } else {
        // Balanço positivo, não precisa muito deste produto
        needScore += 5;
      }
    }
  }
  // Para exportações pelo país IA (outro país quer importar dele)
  else if (type === 'import') { // O país originador quer importar, então o IA vai exportar
    // Verificar se o país tem excedente para exportar
    if (product === 'commodity') {
      const currentBalance = economy.commoditiesBalance?.value || 0;
      
      // Se o balanço for positivo, o país pode exportar
      if (currentBalance > 0) {
        // Quanto mais positivo o balanço, mais o país pode exportar
        // Mas se a exportação for maior que o excedente, diminui a chance
        if (currentBalance >= value) {
          benefitScore += 30; // Pode exportar com folga
        } else {
          // Pode exportar, mas vai ficar com déficit
          benefitScore += 10 * (currentBalance / value);
        }
      } else {
        // Já está em déficit, não deveria exportar mais
        benefitScore -= 20;
      }
    } else if (product === 'manufacture') {
      const currentBalance = economy.manufacturesBalance?.value || 0;
      
      // Similar à lógica de commodities
      if (currentBalance > 0) {
        if (currentBalance >= value) {
          benefitScore += 30;
        } else {
          benefitScore += 10 * (currentBalance / value);
        }
      } else {
        benefitScore -= 20;
      }
    }
    
    // Valor da exportação também adiciona benefício (receita)
    benefitScore += Math.min(value, 20);
  }
  
  // Ajuste pelo tamanho da economia - acordos muito grandes são mais arriscados
  const gdpValue = economy.gdp?.value || 100;
  const dealSizeFactor = Math.min(value / (gdpValue * 0.01), 10);
  
  // Se o acordo for muito grande em relação ao PIB, diminui a chance
  if (dealSizeFactor > 5) {
    benefitScore -= (dealSizeFactor - 5) * 5;
  }
  
  // Soma os scores com um componente aleatório para variabilidade
  const randomFactor = Math.random() * 30;
  const finalScore = needScore + benefitScore + randomFactor;
  
  // Threshold para aceitação
  const acceptanceThreshold = 50;
  
  console.log(`AI Trade Evaluation for ${targetCountry}:`, {
    needScore,
    benefitScore,
    randomFactor,
    finalScore,
    threshold: acceptanceThreshold,
    proposal: `${type} ${product} (${value}bi)`
  });
  
  const accepted = finalScore >= acceptanceThreshold;
  
  return {
    accepted,
    reason: accepted 
      ? `Proposta benéfica para ${targetCountry}` 
      : `Proposta não atende às necessidades de ${targetCountry}`
  };
}

/**
 * Simula ações de países controlados por IA a cada ciclo de simulação
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 */
function simulateAICountryActions(io, gameState, roomName) {
  const room = gameState.rooms.get(roomName);
  if (!room) return;
  
  // Obter todos os países IA (países sem jogadores humanos controlando)
  const humanControlledCountries = new Set();
  
  room.players.forEach(player => {
    if (typeof player === 'object' && player.country) {
      humanControlledCountries.add(player.country);
    } else if (typeof player === 'string') {
      const match = player.match(/\((.*)\)/);
      if (match) {
        humanControlledCountries.add(match[1]);
      }
    }
  });
  
  const allCountries = Object.keys(gameState.countriesData || {});
  const aiCountries = allCountries.filter(country => !humanControlledCountries.has(country));
  
  // Lógica de simulação seria implementada aqui
  // Por exemplo: criar acordos comerciais entre países IA ou com jogadores humanos
  
  // Por enquanto, apenas log para debug
  if (Math.random() < 0.01) { // Limitar logs (apenas 1% das vezes)
    console.log(`[AI] ${roomName}: Simulando ${aiCountries.length} países IA`);
  }
}

export {
  evaluateTradeProposal,
  simulateAICountryActions
};