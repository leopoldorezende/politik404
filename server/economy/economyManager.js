/**
 * Gerenciador de economia do jogo
 * Responsável por atualizar os dados econômicos dos países periodicamente
 */

// Armazena os intervalos ativos por sala
const economyIntervals = new Map();

// Configurações do sistema econômico
const ECONOMY_CONFIG = {
  updateInterval: 5000,  // Alterado de 1000 para 5000ms (5 segundos) para reduzir a frequência de atualizações
  gdpBaseGrowth: 1000000000,     // Crescimento base do PIB por ciclo
  inflationBaseChange: 0.05, // Alteração base da inflação por ciclo
  taxIncomePercent: 0.1,  // Porcentagem do PIB que vai para o tesouro como impostos
  randomVariation: 0.2,   // Variação aleatória (±20%) aplicada às mudanças
};

/**
 * Inicia o sistema econômico para todas as salas existentes
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 */
function initializeEconomySystem(io, gameState) {
  console.log('[ECONOMY] Inicializando sistema econômico...');
  
  // Inicializa o ciclo econômico para cada sala existente
  for (const [roomName, room] of gameState.rooms.entries()) {
    startEconomyCycle(io, gameState, roomName);
  }
  
  // Adicionar um listener para novas salas
  io.on('connection', (socket) => {
    socket.on('createRoom', (data) => {
      if (data && data.name) {
        console.log(`[ECONOMY] Nova sala criada: ${data.name}, aguardando evento roomCreated`);
      }
    });
  });
  
  // Observer para novas salas criadas
  io.on('roomCreated', (data) => {
    if (data && data.success && data.name) {
      console.log(`[ECONOMY] Nova sala criada (via evento): ${data.name}, iniciando ciclo econômico`);
      startEconomyCycle(io, gameState, data.name);
    }
  });
  
  // Listener para quando alguém entra em uma sala
  io.on('connection', (socket) => {
    socket.on('joinRoom', (roomName) => {
      if (roomName && gameState.rooms.has(roomName)) {
        if (!economyIntervals.has(roomName)) {
          console.log(`[ECONOMY] Jogador entrou em sala sem ciclo econômico: ${roomName}, iniciando ciclo`);
          startEconomyCycle(io, gameState, roomName);
        }
      }
    });
  });
  
  console.log('[ECONOMY] Sistema econômico inicializado com sucesso!');
}

/**
 * Inicia o ciclo econômico para uma sala específica
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 */
function startEconomyCycle(io, gameState, roomName) {
  // Adicionando log detalhado
  console.log(`[ECONOMY] Tentativa de iniciar ciclo econômico para sala: ${roomName}`);
  
  // Verifica se já existe um ciclo econômico para esta sala
  if (economyIntervals.has(roomName)) {
    console.log(`[ECONOMY] Ciclo já existe para sala ${roomName}, ignorando`);
    return;
  }
  
  console.log(`[ECONOMY] Iniciando ciclo econômico para a sala: ${roomName} com intervalo de ${ECONOMY_CONFIG.updateInterval}ms`);
  
  // Cria um intervalo para atualização periódica da economia
  const intervalId = setInterval(() => {
    updateEconomy(io, gameState, roomName);
  }, ECONOMY_CONFIG.updateInterval);
  
  // Armazena o ID do intervalo para poder encerrá-lo depois
  economyIntervals.set(roomName, intervalId);
  console.log(`[ECONOMY] Ciclo econômico iniciado com sucesso para sala: ${roomName}, ID: ${intervalId}`);
}

/**
 * Encerra o ciclo econômico para uma sala específica
 * @param {string} roomName - Nome da sala
 */
function stopEconomyCycle(roomName) {
  if (!economyIntervals.has(roomName)) {
    console.log(`Sala ${roomName} não possui ciclo econômico ativo`);
    return;
  }
  
  console.log(`Encerrando ciclo econômico para a sala: ${roomName}`);
  
  // Obtém o ID do intervalo e o cancela
  const intervalId = economyIntervals.get(roomName);
  clearInterval(intervalId);
  
  // Remove a sala do mapa de intervalos
  economyIntervals.delete(roomName);
}

/**
 * Atualiza os dados econômicos de todos os países em uma sala
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 */
function updateEconomy(io, gameState, roomName) {
  try {
    // Removido console.log para reduzir ruído e processamento
    
    const room = gameState.rooms.get(roomName);
    
    if (!room) {
      console.log(`[ECONOMY] Sala ${roomName} não existe, encerrando ciclo econômico`);
      stopEconomyCycle(roomName);
      return;
    }
    
    // Verifica se há jogadores ativos na sala
    const activePlayers = room.players.filter(player => {
      if (typeof player === 'object') {
        return player.isOnline;
      }
      return false;
    });
    
    if (activePlayers.length === 0) {
      // Removido console.log para reduzir ruído
      return;
    }
    
    // Coletando países para atualizar (países dos jogadores ativos)
    const countriesToUpdate = activePlayers
      .map(player => typeof player === 'object' ? player.country : null)
      .filter(Boolean);
    
    if (countriesToUpdate.length === 0) {
      // Removido console.log para reduzir ruído
      return;
    }
    
    // Dados econômicos atualizados para enviar para os clientes
    const economyUpdateData = {
      room: roomName,
      timestamp: Date.now(),
      countries: {},
      // Adicionada uma flag para indicar que é apenas uma atualização econômica em segundo plano
      isBackgroundUpdate: true
    };
    
    // Para cada país, calcular e aplicar as alterações econômicas
    countriesToUpdate.forEach(country => {
      if (gameState.countriesData && gameState.countriesData[country]) {
        const countryData = gameState.countriesData[country];
        
        if (countryData.economy) {
          // Calcula as alterações econômicas
          const updatedEconomy = calculateEconomicChanges(countryData.economy);
          
          // Atualiza os dados do país
          gameState.countriesData[country].economy = updatedEconomy;
          
          // Adiciona os dados atualizados para enviar ao cliente
          economyUpdateData.countries[country] = updatedEconomy;
        }
      }
    });
    
    // Enviar atualizações para todos os jogadores na sala
    if (Object.keys(economyUpdateData.countries).length > 0) {
      io.to(roomName).emit('economyUpdated', economyUpdateData);
    }
  } catch (error) {
    console.error(`[ECONOMY] ERRO ao atualizar economia para sala ${roomName}:`, error);
  }
}

/**
 * Calcula as mudanças econômicas para um país
 * @param {Object} economyData - Dados econômicos atuais do país
 * @returns {Object} - Dados econômicos atualizados
 */
function calculateEconomicChanges(economyData) {
  // Clone os dados para não modificar diretamente
  const updatedEconomy = { ...economyData };
  
  // Aplica variação aleatória ao crescimento base
  const randomFactor = 1 + (Math.random() * ECONOMY_CONFIG.randomVariation * 2 - ECONOMY_CONFIG.randomVariation);
  
  // Calcula o crescimento do PIB para este ciclo
  const cyclicalGrowth = ECONOMY_CONFIG.gdpBaseGrowth * randomFactor;
  
  // Atualiza o valor do PIB
  if (updatedEconomy.gdp && typeof updatedEconomy.gdp === 'object') {
    updatedEconomy.gdp = {
      ...updatedEconomy.gdp,
      value: Math.round((updatedEconomy.gdp.value + cyclicalGrowth) * 100) / 100
    };
  }
  
  // Ajusta a taxa de crescimento
  updatedEconomy.gdpGrowth = Math.round((updatedEconomy.gdpGrowth + (cyclicalGrowth * 0.01)) * 100) / 100;
  
  // Atualiza o tesouro baseado nos impostos
  if (updatedEconomy.treasury && typeof updatedEconomy.treasury === 'object') {
    const taxIncome = cyclicalGrowth * ECONOMY_CONFIG.taxIncomePercent;
    updatedEconomy.treasury = {
      ...updatedEconomy.treasury,
      value: Math.round((updatedEconomy.treasury.value + taxIncome) * 100) / 100
    };
  }
  
  // Ajusta a inflação baseada no crescimento
  const inflationChange = ECONOMY_CONFIG.inflationBaseChange * randomFactor * 
                         (updatedEconomy.gdpGrowth > 3 ? 1.2 : 0.8); // Crescimento alto = mais inflação
  updatedEconomy.inflation = Math.round((updatedEconomy.inflation + inflationChange) * 100) / 100;
  
  // Atualiza o desemprego inversamente proporcional ao crescimento
  const unemploymentChange = -0.05 * updatedEconomy.gdpGrowth * randomFactor;
  updatedEconomy.unemployment = Math.max(2, Math.round((updatedEconomy.unemployment + unemploymentChange) * 100) / 100);
  
  return updatedEconomy;
}

/**
 * Aplica um evento econômico a um país específico
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} country - Nome do país
 * @param {Object} event - Dados do evento econômico
 */
function applyEconomicEvent(io, gameState, roomName, country, event) {
  const room = gameState.rooms.get(roomName);
  
  if (!room || !gameState.countriesData[country]) {
    console.log(`Sala ${roomName} ou país ${country} não existe`);
    return;
  }
  
  console.log(`Aplicando evento econômico no país ${country}: ${event.type}`);
  
  const economyData = gameState.countriesData[country].economy;
  
  // Aplica efeitos do evento
  switch (event.type) {
    case 'recession':
      economyData.gdpGrowth -= event.impact;
      economyData.unemployment += event.impact;
      break;
    case 'boom':
      economyData.gdpGrowth += event.impact;
      economyData.unemployment -= event.impact * 0.5;
      break;
    case 'inflation':
      economyData.inflation += event.impact;
      break;
    case 'investment':
      if (economyData.gdp && typeof economyData.gdp === 'object') {
        economyData.gdp.value += event.amount;
      }
      break;
    default:
      console.log(`Tipo de evento desconhecido: ${event.type}`);
      return;
  }
  
  // Garante que valores não fiquem negativos
  economyData.unemployment = Math.max(2, economyData.unemployment);
  economyData.inflation = Math.max(0, economyData.inflation);
  
  // Notifica os jogadores na sala sobre o evento
  io.to(roomName).emit('economicEvent', {
    room: roomName,
    country: country,
    event: event,
    currentEconomy: {
      gdp: economyData.gdp,
      gdpGrowth: economyData.gdpGrowth,
      inflation: economyData.inflation,
      treasury: economyData.treasury,
      unemployment: economyData.unemployment
    }
  });
}

// Exporta as funções públicas e o mapa de intervalos para poder ser consultado externamente
module.exports = {
  initializeEconomySystem,
  startEconomyCycle,
  stopEconomyCycle,
  updateEconomy,
  applyEconomicEvent,
  ECONOMY_CONFIG,
  economyIntervals // Exporta o mapa de intervalos para verificação externa
};