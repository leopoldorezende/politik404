/**
 * aiCountryController.js
 * Controlador para gerenciar comportamento e tomada de decisão de países controlados por IA
 */

import { performEconomicCalculations } from '../economy/economyCalculations.js';
import countryStateManager from '../../shared/countryStateManager.js';

// Armazenar informações sobre envio de propostas para controlar frequência
const proposalCooldowns = new Map(); // countryName -> { lastProposalTime, targetPlayer }

// Tempo mínimo entre propostas do mesmo país (em ms)
const PROPOSAL_COOLDOWN = 10 * 60 * 1000; // 10 minutos

// Probabilidade base de um país IA fazer uma proposta em cada ciclo (0-1)
const BASE_PROPOSAL_CHANCE = 0.1; // 10% de chance por ciclo

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
  const humanPlayers = new Map(); // Map de país -> usuário
  
  room.players.forEach(player => {
    if (typeof player === 'object' && player.country) {
      humanControlledCountries.add(player.country);
      if (player.username && player.isOnline) {
        humanPlayers.set(player.country, player.username);
      }
    } else if (typeof player === 'string') {
      const match = player.match(/\((.*)\)/);
      if (match) {
        humanControlledCountries.add(match[1]);
      }
    }
  });
  
  const allCountries = Object.keys(gameState.countriesData || {});
  const aiCountries = allCountries.filter(country => !humanControlledCountries.has(country));
  
  // Nenhum jogador humano, nada a fazer
  if (humanPlayers.size === 0) return;
  
  // Para cada país IA, decidir se deve propor comércio
  // Limitamos a uma proposta por ciclo para evitar sobrecarga
  let proposalMade = false;
  
  // Embaralhar países IA para seleção aleatória
  const shuffledAICountries = shuffleArray(aiCountries);
  
  for (const aiCountry of shuffledAICountries) {
    // Se já fizemos uma proposta neste ciclo, pare
    if (proposalMade) break;
    
    // Verificar cooldown
    const cooldown = proposalCooldowns.get(aiCountry);
    const now = Date.now();
    if (cooldown && now - cooldown.lastProposalTime < PROPOSAL_COOLDOWN) {
      continue; // Ainda em cooldown, pular para o próximo país
    }
    
    // Chance base de fazer proposta
    if (Math.random() > BASE_PROPOSAL_CHANCE) {
      continue; // Não passou na chance aleatória, próximo país
    }
    
    // Avaliar situação econômica do país IA e gerar proposta se necessário
    const proposal = evaluateAndGenerateTradeProposal(gameState, roomName, aiCountry, humanPlayers);
    
    if (proposal) {
      // Enviar a proposta
      sendAITradeProposal(io, gameState, roomName, proposal);
      
      // Marcar que fizemos uma proposta neste ciclo
      proposalMade = true;
      
      // Atualizar o cooldown para este país
      proposalCooldowns.set(aiCountry, {
        lastProposalTime: now,
        targetPlayer: proposal.targetPlayer
      });
      
      console.log(`[AI] ${aiCountry} propôs acordo comercial para ${proposal.targetCountry}`);
    }
  }
}

/**
 * Avalia a situação econômica de um país IA e gera uma proposta de comércio se apropriado
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} aiCountry - Nome do país IA
 * @param {Map} humanPlayers - Map de países humanos -> nomes de usuários
 * @returns {Object|null} - Proposta comercial ou null se não houver proposta
 */
function evaluateAndGenerateTradeProposal(gameState, roomName, aiCountry, humanPlayers) {
  // Obter estado econômico do país
  const countryState = countryStateManager.getCountryState(roomName, aiCountry);
  if (!countryState || !countryState.economy) {
    return null;
  }
  
  const economy = countryState.economy;
  
  // Verificar balanços comerciais
  const commoditiesBalance = economy.commoditiesBalance?.value || 0;
  const manufacturesBalance = economy.manufacturesBalance?.value || 0;
  const gdp = economy.gdp?.value || 100;
  
  // Determinar se o país tem superávit ou déficit significativo
  const hasCommoditySurplus = commoditiesBalance > gdp * 0.05; // 5% do PIB
  const hasCommodityDeficit = commoditiesBalance < -gdp * 0.05;
  const hasManufactureSurplus = manufacturesBalance > gdp * 0.05;
  const hasManufactureDeficit = manufacturesBalance < -gdp * 0.05;
  
  // Variáveis para a decisão
  let proposalType = null; // 'import' ou 'export'
  let proposalProduct = null; // 'commodity' ou 'manufacture'
  let proposalValue = 0;
  
  // Decidir qual situação abordar primeiro (priorizar a mais extrema)
  if (hasCommoditySurplus && Math.abs(commoditiesBalance) > Math.abs(manufacturesBalance)) {
    // Tem superávit de commodities, quer exportar (solicitará que outro país importe dele)
    proposalType = 'import'; // Perspectiva do destinatário
    proposalProduct = 'commodity';
    // Valor baseado no superávit, entre 30% e 70% do superávit
    proposalValue = Math.round(commoditiesBalance * (0.3 + Math.random() * 0.4));
  } 
  else if (hasManufactureSurplus && Math.abs(manufacturesBalance) > Math.abs(commoditiesBalance)) {
    // Tem superávit de manufaturas, quer exportar (solicitará que outro país importe dele)
    proposalType = 'import'; // Perspectiva do destinatário
    proposalProduct = 'manufacture';
    // Valor baseado no superávit, entre 30% e 70% do superávit
    proposalValue = Math.round(manufacturesBalance * (0.3 + Math.random() * 0.4));
  }
  else if (hasCommodityDeficit) {
    // Tem déficit de commodities, quer importar (solicitará que outro país exporte para ele)
    proposalType = 'export'; // Perspectiva do destinatário
    proposalProduct = 'commodity';
    // Valor baseado no déficit, entre 30% e 70% do déficit (valor absoluto)
    proposalValue = Math.round(Math.abs(commoditiesBalance) * (0.3 + Math.random() * 0.4));
  }
  else if (hasManufactureDeficit) {
    // Tem déficit de manufaturas, quer importar (solicitará que outro país exporte para ele)
    proposalType = 'export'; // Perspectiva do destinatário
    proposalProduct = 'manufacture';
    // Valor baseado no déficit, entre 30% e 70% do déficit (valor absoluto)
    proposalValue = Math.round(Math.abs(manufacturesBalance) * (0.3 + Math.random() * 0.4));
  }
  
  // Se não temos nenhuma situação para abordar, não propor nada
  if (!proposalType || !proposalProduct || proposalValue <= 0) {
    return null;
  }
  
  // Garantir que o valor mínimo seja significativo (pelo menos 1 bilhão)
  proposalValue = Math.max(1, proposalValue);
  // E o valor máximo não seja excessivo (no máximo 20% do PIB)
  proposalValue = Math.min(proposalValue, gdp * 0.2);
  // Arredondar para 1 casa decimal
  proposalValue = Math.round(proposalValue * 10) / 10;
  
  // Selecionar aleatoriamente um país/jogador humano como alvo
  const targetEntry = selectRandomHumanPlayer(humanPlayers, aiCountry);
  if (!targetEntry) {
    return null;
  }
  
  const [targetCountry, targetPlayer] = targetEntry;
  
  // Verificar se já existe um acordo similar (evitar duplicação)
  const room = gameState.rooms.get(roomName);
  const hasExistingAgreement = (room.tradeAgreements || []).some(agreement => 
    agreement.originCountry === aiCountry && 
    agreement.country === targetCountry &&
    agreement.type === proposalType &&
    agreement.product === proposalProduct
  );
  
  if (hasExistingAgreement) {
    return null;
  }
  
  // Construir a proposta
  return {
    type: proposalType,
    product: proposalProduct,
    targetCountry,
    targetPlayer,
    value: proposalValue,
    originCountry: aiCountry,
  };
}

/**
 * Seleciona aleatoriamente um jogador humano para interagir
 * @param {Map} humanPlayers - Map de países -> nomes de usuários
 * @param {string} aiCountry - País IA originador
 * @returns {Array|null} - Par [país, jogador] selecionado ou null
 */
function selectRandomHumanPlayer(humanPlayers, aiCountry) {
  if (humanPlayers.size === 0) return null;
  
  // Converter o Map para array para seleção aleatória
  const entries = Array.from(humanPlayers.entries());
  if (entries.length === 0) return null;
  
  // Verificar cooldowns para evitar enviar para o mesmo jogador repetidamente
  const eligibleEntries = entries.filter(([country, player]) => {
    const cooldown = proposalCooldowns.get(aiCountry);
    if (!cooldown) return true;
    
    // Se já enviamos proposta para este jogador recentemente, evitar repetir
    return cooldown.targetPlayer !== player;
  });
  
  // Se não há jogadores elegíveis, tentar qualquer um mesmo com cooldown
  const candidates = eligibleEntries.length > 0 ? eligibleEntries : entries;
  
  // Selecionar aleatoriamente
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

/**
 * Envia uma proposta comercial de um país IA para um jogador humano
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {Object} proposal - Proposta comercial
 */
function sendAITradeProposal(io, gameState, roomName, proposal) {
  const { targetPlayer, type, product, targetCountry, value, originCountry } = proposal;
  
  // Gerar ID único para a proposta
  const proposalId = `trade-proposal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Criar objeto da proposta para enviar ao jogador
  const tradeProposal = {
    id: proposalId,
    type,
    product,
    targetCountry,
    value,
    originCountry,
    timestamp: Date.now(),
  };
  
  // Encontrar socket do jogador alvo
  const targetSocketId = gameState.usernameToSocketId?.get(targetPlayer);
  const targetSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : null;
  
  if (targetSocket && targetSocket.connected) {
    // Armazenar a proposta no socket do jogador alvo para uso posterior
    targetSocket.tradeProposal = tradeProposal;
    
    // Enviar proposta para o jogador alvo
    targetSocket.emit('tradeProposalReceived', tradeProposal);
    console.log(`[AI] Proposta de ${originCountry} enviada para ${targetPlayer}`);
  } else {
    console.log(`[AI] Não foi possível enviar proposta: jogador ${targetPlayer} offline`);
  }
}

/**
 * Função auxiliar para embaralhar um array
 * @param {Array} array - Array a ser embaralhado
 * @returns {Array} - Array embaralhado
 */
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export {
  evaluateTradeProposal,
  simulateAICountryActions
};