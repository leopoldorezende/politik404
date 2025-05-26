/**
 * AI Country Controller - ATUALIZADO para usar EconomyService
 * Controla decisões de IA para países não controlados por jogadores
 */

/**
 * Avalia uma proposta de comércio do ponto de vista da IA
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {Object} proposal - Proposta de comércio
 * @returns {Object} - { accepted: boolean, reason: string }
 */
function evaluateTradeProposal(gameState, roomName, proposal) {
  const { type, product, targetCountry, value, originCountry } = proposal;
  
  // ===== NOVA INTEGRAÇÃO COM ECONOMYSERVICE =====
  // Obter dados econômicos do país alvo usando EconomyService
  const economyService = global.economyService;
  let targetCountryData = null;
  
  if (economyService) {
    targetCountryData = economyService.getCountryState(roomName, targetCountry);
  }
  
  // Se não conseguir dados do EconomyService, usar dados estáticos como fallback
  if (!targetCountryData && gameState.countriesData) {
    targetCountryData = { 
      economy: gameState.countriesData[targetCountry]?.economy || {} 
    };
  }
  // ===== FIM DA NOVA INTEGRAÇÃO =====
  
  // Fatores de decisão da IA
  let acceptanceScore = 50; // Base: 50% de chance
  
  // Fator 1: Valor da proposta (propostas maiores são mais atrativas)
  if (value >= 50) {
    acceptanceScore += 20; // Proposta grande
  } else if (value >= 20) {
    acceptanceScore += 10; // Proposta média
  } else if (value < 10) {
    acceptanceScore -= 15; // Proposta muito pequena
  }
  
  // Fator 2: Necessidades econômicas do país
  if (targetCountryData?.economy) {
    const economy = targetCountryData.economy;
    
    // Se for importação (país IA recebe produtos)
    if (type === 'import') {
      // IA prefere receber produtos que precisa
      if (product === 'commodity' && economy.commoditiesBalance < 0) {
        acceptanceScore += 25; // Precisa de commodities
      }
      if (product === 'manufacture' && economy.manufacturesBalance < 0) {
        acceptanceScore += 25; // Precisa de manufaturas
      }
    }
    
    // Se for exportação (país IA envia produtos)
    if (type === 'export') {
      // IA prefere exportar produtos que tem excesso
      if (product === 'commodity' && economy.commoditiesBalance > 10) {
        acceptanceScore += 20; // Tem excesso de commodities
      }
      if (product === 'manufacture' && economy.manufacturesBalance > 10) {
        acceptanceScore += 20; // Tem excesso de manufaturas
      }
      
      // IA reluta em exportar se tem déficit
      if (product === 'commodity' && economy.commoditiesBalance < -5) {
        acceptanceScore -= 30; // Déficit de commodities
      }
      if (product === 'manufacture' && economy.manufacturesBalance < -5) {
        acceptanceScore -= 30; // Déficit de manufaturas
      }
    }
    
    // Fator 3: Situação econômica geral
    const gdp = economy.gdp || 100;
    const treasury = economy.treasury || 10;
    
    // País com baixo tesouro é mais receptivo a comércio lucrativo
    if (treasury < gdp * 0.05) { // Tesouro menor que 5% do PIB
      acceptanceScore += 15;
    }
    
    // País com muito tesouro é mais seletivo
    if (treasury > gdp * 0.15) { // Tesouro maior que 15% do PIB
      acceptanceScore -= 10;
    }
  }
  
  // Fator 4: Relacionamento baseado em acordos existentes
  const room = gameState.rooms.get(roomName);
  if (room && room.tradeAgreements) {
    const existingAgreements = room.tradeAgreements.filter(agreement => 
      (agreement.originCountry === targetCountry && agreement.country === originCountry) ||
      (agreement.originCountry === originCountry && agreement.country === targetCountry)
    );
    
    // Países com acordos existentes são mais propensos a novos acordos
    if (existingAgreements.length > 0) {
      acceptanceScore += 15;
    }
  }
  
  // Fator 5: Variação aleatória (simula "humor" da IA)
  const randomFactor = (Math.random() - 0.5) * 30; // -15 a +15
  acceptanceScore += randomFactor;
  
  // Limitar entre 0 e 100
  acceptanceScore = Math.max(0, Math.min(100, acceptanceScore));
  
  // Decisão final
  const accepted = acceptanceScore > 60; // Limiar de 60% para aceitar
  
  // Gerar razão da decisão
  let reason = '';
  if (accepted) {
    if (acceptanceScore > 80) {
      reason = `${targetCountry} achou a proposta muito vantajosa`;
    } else {
      reason = `${targetCountry} considera a proposta interessante`;
    }
  } else {
    if (acceptanceScore < 30) {
      reason = `${targetCountry} considera a proposta muito desfavorável`;
    } else {
      reason = `${targetCountry} não vê vantagem suficiente na proposta`;
    }
  }
  
  console.log(`[AI] ${targetCountry} avaliou proposta de ${originCountry}: ${accepted ? 'ACEITA' : 'REJEITADA'} (score: ${acceptanceScore.toFixed(1)})`);
  
  return { accepted, reason };
}

/**
 * Gera propostas de comércio automáticas da IA (futuro)
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} aiCountry - País controlado pela IA
 * @returns {Object|null} - Proposta gerada ou null
 */
function generateAITradeProposal(gameState, roomName, aiCountry) {
  // ===== NOVA INTEGRAÇÃO COM ECONOMYSERVICE =====
  const economyService = global.economyService;
  
  if (!economyService) {
    return null; // Sem EconomyService, não pode gerar propostas
  }
  
  const countryData = economyService.getCountryState(roomName, aiCountry);
  if (!countryData?.economy) {
    return null; // Sem dados econômicos
  }
  
  const economy = countryData.economy;
  
  // Lógica simples: se tem déficit grande, tenta importar
  // se tem excesso grande, tenta exportar
  
  let proposalType = null;
  let proposalProduct = null;
  let proposalValue = 0;
  
  // Verificar déficits
  if (economy.commoditiesBalance < -20) {
    proposalType = 'import';
    proposalProduct = 'commodity';
    proposalValue = Math.min(50, Math.abs(economy.commoditiesBalance));
  } else if (economy.manufacturesBalance < -20) {
    proposalType = 'import';
    proposalProduct = 'manufacture';
    proposalValue = Math.min(50, Math.abs(economy.manufacturesBalance));
  }
  
  // Verificar excedentes
  if (!proposalType && economy.commoditiesBalance > 30) {
    proposalType = 'export';
    proposalProduct = 'commodity';
    proposalValue = Math.min(50, economy.commoditiesBalance * 0.5);
  } else if (!proposalType && economy.manufacturesBalance > 30) {
    proposalType = 'export';
    proposalProduct = 'manufacture';
    proposalValue = Math.min(50, economy.manufacturesBalance * 0.5);
  }
  
  if (!proposalType) {
    return null; // Não há necessidade de comércio
  }
  
  // Encontrar um país alvo (jogador humano preferencialmente)
  const room = gameState.rooms.get(roomName);
  if (!room || !room.players) {
    return null;
  }
  
  const humanPlayers = room.players.filter(player => 
    typeof player === 'object' && 
    player.isOnline && 
    player.country !== aiCountry
  );
  
  if (humanPlayers.length === 0) {
    return null; // Sem jogadores humanos online
  }
  
  const targetPlayer = humanPlayers[Math.floor(Math.random() * humanPlayers.length)];
  
  return {
    type: proposalType,
    product: proposalProduct,
    targetCountry: targetPlayer.country,
    value: Math.round(proposalValue),
    originCountry: aiCountry,
    originPlayer: null, // IA
    timestamp: Date.now()
  };
  // ===== FIM DA NOVA INTEGRAÇÃO =====
}

/**
 * Simula ações de países controlados por IA (função principal para middleware)
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 */
function simulateAICountryActions(io, gameState) {
  // Por enquanto, esta função está desabilitada para simplificar
  // A IA só age quando recebe propostas de comércio
  
  // Futuro: Aqui poderia haver lógica para IA proativa
  // - Gerar propostas comerciais automaticamente
  // - Ajustar parâmetros econômicos
  // - Responder a eventos globais
  
  console.log('[AI] AI simulation called but currently disabled for simplicity');
}

export { 
  evaluateTradeProposal,
  generateAITradeProposal,
  simulateAICountryActions
};