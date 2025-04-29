/**
 * Handlers para eventos econômicos
 * Gerencia a integração das funcionalidades econômicas com o Socket.io
 */

const { 
  startEconomyCycle, 
  stopEconomyCycle, 
  applyEconomicEvent, 
  ECONOMY_CONFIG 
} = require('./economyManager');

/**
 * Configura os handlers relacionados à economia
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupEconomyHandlers(io, socket, gameState) {
  console.log('Economy handlers inicializados para socket: ' + socket.id);
  
  // Adiciona um listener para debug
  socket.on('checkEconomyStatus', () => {
    console.log('Checking economy status for socket: ' + socket.id);
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Obtém a sala atual do jogador
    const roomName = gameState.userToRoom.get(username);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    // Verifica se a sala tem um ciclo econômico ativo
    const economyIntervals = require('./economyManager').economyIntervals;
    const hasActiveEconomy = economyIntervals && economyIntervals.has(roomName);
    
    socket.emit('economyStatus', {
      active: hasActiveEconomy,
      roomName: roomName,
      config: ECONOMY_CONFIG
    });
  });
  
  // Solicitar dados econômicos atualizados
  socket.on('getEconomyData', () => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Obtém a sala atual do jogador
    const roomName = gameState.userToRoom.get(username);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    // Prepara os dados econômicos de todos os países na sala
    const economyData = {};
    const room = gameState.rooms.get(roomName);
    
    if (!room || !room.players) {
      socket.emit('error', 'Sala não encontrada ou vazia');
      return;
    }
    
    // Verifica se o ciclo econômico está ativo para esta sala
    const economyIntervals = require('./economyManager').economyIntervals;
    const hasActiveEconomy = economyIntervals && economyIntervals.has(roomName);
    
    if (!hasActiveEconomy) {
      console.log(`Iniciando ciclo econômico para sala ${roomName} sob demanda`);
      startEconomyCycle(io, gameState, roomName);
    }
    
    // Coleta dados econômicos atuais de cada país na sala
    for (const player of room.players) {
      let country;
      
      if (typeof player === 'object' && player.country) {
        country = player.country;
      } else if (typeof player === 'string') {
        const match = player.match(/\((.*)\)/);
        if (match) {
          country = match[1];
        }
      }
      
      if (country && gameState.countriesData[country]) {
        economyData[country] = gameState.countriesData[country].economy;
      }
    }
    
    // Envia os dados econômicos para o cliente
    socket.emit('economyData', {
      room: roomName,
      timestamp: Date.now(),
      countries: economyData,
      config: ECONOMY_CONFIG
    });
    
    console.log(`Enviados dados econômicos para ${username}`);
  });
  
  // Alterar taxa de juros
  socket.on('adjustInterestRate', (data) => {
    const { adjustment } = data;
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Obtém a sala e o país do jogador
    const roomName = gameState.userToRoom.get(username);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    // Obtém o país do jogador
    const userRoomKey = `${username}:${roomName}`;
    const country = gameState.userRoomCountries.get(userRoomKey);
    
    if (!country || !gameState.countriesData[country]) {
      socket.emit('error', 'País não encontrado');
      return;
    }
    
    const economyData = gameState.countriesData[country].economy;
    
    // Valida o ajuste (limite de ±2% por ação)
    const validAdjustment = Math.max(-2, Math.min(2, adjustment));
    
    // Aplica o ajuste
    const oldRate = economyData.interestRate;
    economyData.interestRate = Math.max(0, Math.round((oldRate + validAdjustment) * 100) / 100);
    
    console.log(`${username} ajustou taxa de juros de ${country}: ${oldRate}% → ${economyData.interestRate}%`);
    
    // Calcular efeitos econômicos
    const effects = calculateInterestRateEffects(economyData.interestRate, oldRate, economyData);
    
    // Aplicar efeitos
    Object.assign(economyData, effects);
    
    // Notificar todos na sala sobre a mudança na política monetária
    io.to(roomName).emit('policyChange', {
      room: roomName,
      country,
      type: 'interestRate',
      oldValue: oldRate,
      newValue: economyData.interestRate,
      effects
    });
  });
  
  // Alterar carga tributária
  socket.on('adjustTaxBurden', (data) => {
    const { adjustment } = data;
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Obtém a sala e o país do jogador
    const roomName = gameState.userToRoom.get(username);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    // Obtém o país do jogador
    const userRoomKey = `${username}:${roomName}`;
    const country = gameState.userRoomCountries.get(userRoomKey);
    
    if (!country || !gameState.countriesData[country]) {
      socket.emit('error', 'País não encontrado');
      return;
    }
    
    const economyData = gameState.countriesData[country].economy;
    
    // Valida o ajuste (limite de ±5% por ação)
    const validAdjustment = Math.max(-5, Math.min(5, adjustment));
    
    // Aplica o ajuste
    const oldRate = economyData.taxBurden;
    economyData.taxBurden = Math.max(0, Math.min(70, Math.round((oldRate + validAdjustment) * 100) / 100));
    
    console.log(`${username} ajustou carga tributária de ${country}: ${oldRate}% → ${economyData.taxBurden}%`);
    
    // Calcular efeitos econômicos
    const effects = calculateTaxEffects(economyData.taxBurden, oldRate, economyData);
    
    // Aplicar efeitos
    Object.assign(economyData, effects);
    
    // Notificar todos na sala sobre a mudança na política fiscal
    io.to(roomName).emit('policyChange', {
      room: roomName,
      country,
      type: 'taxBurden',
      oldValue: oldRate,
      newValue: economyData.taxBurden,
      effects
    });
  });
  
  // Alterar serviços públicos
  socket.on('adjustPublicServices', (data) => {
    const { adjustment } = data;
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Obtém a sala e o país do jogador
    const roomName = gameState.userToRoom.get(username);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    // Obtém o país do jogador
    const userRoomKey = `${username}:${roomName}`;
    const country = gameState.userRoomCountries.get(userRoomKey);
    
    if (!country || !gameState.countriesData[country]) {
      socket.emit('error', 'País não encontrado');
      return;
    }
    
    const economyData = gameState.countriesData[country].economy;
    
    // Valida o ajuste (limite de ±5% por ação)
    const validAdjustment = Math.max(-5, Math.min(5, adjustment));
    
    // Aplica o ajuste
    const oldValue = economyData.publicServices;
    economyData.publicServices = Math.max(0, Math.min(70, Math.round((oldValue + validAdjustment) * 100) / 100));
    
    console.log(`${username} ajustou serviços públicos de ${country}: ${oldValue}% → ${economyData.publicServices}%`);
    
    // Calcular custo do ajuste
    const cost = calculatePublicServicesCost(validAdjustment, economyData);
    
    // Deduzir do tesouro, se positivo
    if (validAdjustment > 0 && economyData.treasury && typeof economyData.treasury === 'object') {
      economyData.treasury.value = Math.max(0, economyData.treasury.value - cost);
    }
    
    // Calcular efeitos econômicos
    const effects = calculatePublicServicesEffects(economyData.publicServices, oldValue, economyData);
    
    // Aplicar efeitos
    Object.assign(economyData, effects);
    
    // Notificar todos na sala sobre a mudança na política fiscal
    io.to(roomName).emit('policyChange', {
      room: roomName,
      country,
      type: 'publicServices',
      oldValue: oldValue,
      newValue: economyData.publicServices,
      cost,
      effects
    });
  });
  
  // Criar um evento econômico (apenas para admins ou testes)
  socket.on('createEconomicEvent', (data) => {
    const { targetCountry, eventType, impact, duration } = data;
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Obtém a sala atual
    const roomName = gameState.userToRoom.get(username);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    
    // Apenas o dono da sala ou administradores podem criar eventos
    if (room.owner !== username && !gameState.admins?.includes(username)) {
      socket.emit('error', 'Permissão negada: apenas o dono da sala pode criar eventos econômicos');
      return;
    }
    
    // Validar país alvo
    if (!targetCountry || !gameState.countriesData[targetCountry]) {
      socket.emit('error', 'País alvo inválido');
      return;
    }
    
    // Criar o evento
    const event = {
      type: eventType,
      impact: impact || 1.0,
      duration: duration || 1,
      createdBy: username,
      timestamp: Date.now()
    };
    
    // Aplicar o evento
    applyEconomicEvent(io, gameState, roomName, targetCountry, event);
    
    console.log(`Evento econômico criado por ${username} no país ${targetCountry}: ${eventType}`);
  });
}

/**
 * Calcula os efeitos econômicos de uma mudança na taxa de juros
 * @param {number} newRate - Nova taxa de juros
 * @param {number} oldRate - Antiga taxa de juros
 * @param {Object} economyData - Dados econômicos atuais
 * @returns {Object} - Efeitos calculados
 */
function calculateInterestRateEffects(newRate, oldRate, economyData) {
  const change = newRate - oldRate;
  const effects = {};
  
  // Taxa mais alta = menos crescimento, menos inflação
  // Taxa mais baixa = mais crescimento, mais inflação
  effects.gdpGrowth = Math.round((economyData.gdpGrowth - (change * 0.2)) * 100) / 100;
  effects.inflation = Math.round((economyData.inflation - (change * 0.3)) * 100) / 100;
  
  // Garante valores mínimos
  effects.gdpGrowth = Math.max(-5, effects.gdpGrowth);
  effects.inflation = Math.max(0, effects.inflation);
  
  // Efeito na popularidade: mudanças extremas reduzem a popularidade
  const popularityChange = Math.abs(change) > 2 ? -5 : Math.abs(change) > 1 ? -3 : 0;
  effects.popularity = Math.max(0, Math.min(100, economyData.popularity + popularityChange));
  
  return effects;
}

/**
 * Calcula os efeitos econômicos de uma mudança na carga tributária
 * @param {number} newRate - Nova carga tributária
 * @param {number} oldRate - Antiga carga tributária
 * @param {Object} economyData - Dados econômicos atuais
 * @returns {Object} - Efeitos calculados
 */
function calculateTaxEffects(newRate, oldRate, economyData) {
  const change = newRate - oldRate;
  const effects = {};
  
  // Impostos mais altos = menos crescimento, mais receita
  // Impostos mais baixos = mais crescimento, menos receita
  effects.gdpGrowth = Math.round((economyData.gdpGrowth - (change * 0.1)) * 100) / 100;
  
  // Efeito no tesouro
  if (economyData.treasury && typeof economyData.treasury === 'object' && economyData.gdp && typeof economyData.gdp === 'object') {
    // Calcula aproximadamente o ganho/perda de receita baseado na mudança de impostos
    const treasuryChange = economyData.gdp.value * (change / 100) * 0.1;
    effects.treasury = {
      ...economyData.treasury,
      value: Math.round((economyData.treasury.value + treasuryChange) * 100) / 100
    };
  }
  
  // Efeito na popularidade: impostos mais altos reduzem a popularidade
  const popularityChange = -change * 1.5;
  effects.popularity = Math.max(0, Math.min(100, economyData.popularity + popularityChange));
  
  return effects;
}

/**
 * Calcula o custo de ajuste dos serviços públicos
 * @param {number} adjustment - Valor do ajuste
 * @param {Object} economyData - Dados econômicos atuais
 * @returns {number} - Custo do ajuste
 */
function calculatePublicServicesCost(adjustment, economyData) {
  if (adjustment <= 0) return 0;
  
  if (economyData.gdp && typeof economyData.gdp === 'object') {
    // O custo é proporcional ao PIB e ao tamanho do ajuste
    return Math.round((economyData.gdp.value * (adjustment / 100) * 0.2) * 100) / 100;
  }
  
  return 0;
}

/**
 * Calcula os efeitos econômicos de uma mudança nos serviços públicos
 * @param {number} newValue - Novo nível de serviços públicos
 * @param {number} oldValue - Antigo nível de serviços públicos
 * @param {Object} economyData - Dados econômicos atuais
 * @returns {Object} - Efeitos calculados
 */
function calculatePublicServicesEffects(newValue, oldValue, economyData) {
  const change = newValue - oldValue;
  const effects = {};
  
  // Mais serviços = menos desemprego, mais popularidade
  // Menos serviços = mais desemprego, menos popularidade
  effects.unemployment = Math.max(2, Math.round((economyData.unemployment - (change * 0.1)) * 100) / 100);
  
  // Efeito na popularidade: serviços públicos aumentados melhoram a popularidade
  const popularityChange = change * 1.2;
  effects.popularity = Math.max(0, Math.min(100, economyData.popularity + popularityChange));
  
  return effects;
}

module.exports = { setupEconomyHandlers };