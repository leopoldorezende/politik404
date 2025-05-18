/**
 * economyHandlers.js
 * Socket.io handlers for economic operations
 */

import { 
  performEconomicCalculations, 
  calculateTradeAgreementsImpact 
} from './economyCalculations.js';
import countryStateManager from '../../shared/countryStateManager.js';
import { getCurrentRoom, getUsernameFromSocketId } from '../../shared/gameStateUtils.js';

/**
 * Setup economy-related socket event handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Client socket
 * @param {Object} gameState - Global game state
 */
function setupEconomyHandlers(io, socket, gameState) {
  console.log('Economy handlers initialized');
  
  // Handle debt bond issuance
  socket.on('issueDebtBonds', (data) => {
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return;
    }
    
    // Get current room
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Not in a room');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    // Get user's country
    const userRoomKey = `${username}:${roomName}`;
    const userCountry = gameState.userRoomCountries.get(userRoomKey);
    
    if (!userCountry) {
      socket.emit('error', 'No country assigned');
      return;
    }
    
    // Validate bond amount
    const { bondAmount } = data;
    if (!bondAmount || bondAmount <= 0 || bondAmount > 1000) {
      socket.emit('error', 'Invalid bond amount. Must be between 0 and 1000 billions');
      return;
    }
    
    // Get current country state
    const currentState = countryStateManager.getCountryState(roomName, userCountry);
    if (!currentState) {
      socket.emit('error', 'Country state not found');
      return;
    }
    
    // Get static country data
    const staticData = gameState.countriesData[userCountry];
    if (!staticData) {
      socket.emit('error', 'Country data not found');
      return;
    }
    
    // Perform economic calculations
    const calculationResult = performEconomicCalculations(
      currentState,
      staticData,
      { issueDebtBonds: true, bondAmount }
    );
    
    // Update country state with new economy values
    countryStateManager.updateCountryState(
      roomName,
      userCountry,
      'economy',
      calculationResult.economy
    );
    
    // Update public debt in static data (note: this is a simplification)
    // In a real game, public debt would also be part of the dynamic state
    if (calculationResult.publicDebtResult !== null && staticData.economy) {
      staticData.economy.publicDebt = {
        value: calculationResult.publicDebtResult,
        unit: 'bi USD'
      };
      
      // Recalculate debt-to-GDP ratio
      const gdpValue = calculationResult.economy.gdp.value;
      staticData.economy.publicDebtToGdp = Math.round((calculationResult.publicDebtResult / gdpValue) * 100);
    }
    
    console.log(`${username} issued ${bondAmount} billion in debt bonds for ${userCountry}`);
    
    // Send success response
    socket.emit('debtBondsIssued', {
      bondAmount,
      newTreasury: calculationResult.economy.treasury.value,
      newPublicDebt: calculationResult.publicDebtResult
    });
  });

  // Handler para criação de acordos comerciais
  socket.on('createTradeAgreement', (data) => {
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return;
    }
    
    // Get current room
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Not in a room');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    // Validar dados do acordo
    const { type, product, country, value } = data;
    
    if (!type || !product || !country || !value) {
      socket.emit('error', 'Missing required agreement details');
      return;
    }
    
    if (type !== 'import' && type !== 'export') {
      socket.emit('error', 'Invalid trade type. Must be "import" or "export"');
      return;
    }
    
    if (product !== 'commodity' && product !== 'manufacture') {
      socket.emit('error', 'Invalid product type. Must be "commodity" or "manufacture"');
      return;
    }
    
    if (value <= 0 || value > 1000) {
      socket.emit('error', 'Invalid trade value. Must be between 0 and 1000 billions');
      return;
    }
    
    // Get user's country
    const userRoomKey = `${username}:${roomName}`;
    const userCountry = gameState.userRoomCountries.get(userRoomKey);
    
    if (!userCountry) {
      socket.emit('error', 'No country assigned');
      return;
    }
    
    // Verificar se o país de destino é válido
    if (!gameState.countriesData[country]) {
      socket.emit('error', 'Invalid target country');
      return;
    }
    
    // Create agreement object
    const agreement = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      type,
      product,
      country,
      value,
      originCountry: userCountry,
      originPlayer: username
    };
    
    // Salvar o acordo no estado da sala (se não existir, crie o array)
    if (!room.tradeAgreements) {
      room.tradeAgreements = [];
    }
    
    // Remover acordos existentes conflitantes (mesmo tipo, produto e países)
    room.tradeAgreements = room.tradeAgreements.filter(existing => 
      !(existing.type === type && 
        existing.product === product && 
        existing.country === country && 
        existing.originCountry === userCountry)
    );
    
    // Adicionar o novo acordo
    room.tradeAgreements.push(agreement);
    
    // Atualizar economias dos países envolvidos
    updateCountryEconomiesWithTradeAgreement(gameState, roomName, agreement, countryStateManager);
    
    console.log(`${username} created a trade agreement: ${type} ${product} with ${country}`);
    
    // Send success response
    socket.emit('tradeAgreementCreated', agreement);
    
    // Broadcast to all players in the room about the new agreement
    io.to(roomName).emit('tradeAgreementUpdated', {
      agreements: room.tradeAgreements,
      timestamp: Date.now()
    });
  });
  
  // Handler para cancelamento de acordos comerciais
  socket.on('cancelTradeAgreement', (agreementId) => {
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return;
    }
    
    // Get current room
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Not in a room');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room || !room.tradeAgreements) {
      socket.emit('error', 'No trade agreements found');
      return;
    }
    
    // Get user's country
    const userRoomKey = `${username}:${roomName}`;
    const userCountry = gameState.userRoomCountries.get(userRoomKey);
    
    // Localizar o acordo
    const agreementIndex = room.tradeAgreements.findIndex(a => a.id === agreementId);
    
    if (agreementIndex === -1) {
      socket.emit('error', 'Trade agreement not found');
      return;
    }
    
    const agreement = room.tradeAgreements[agreementIndex];
    
    // Verificar se o usuário tem permissão para cancelar (origem ou destino)
    if (agreement.originPlayer !== username && agreement.country !== userCountry) {
      socket.emit('error', 'You do not have permission to cancel this agreement');
      return;
    }
    
    // Remover o acordo
    const removedAgreement = room.tradeAgreements.splice(agreementIndex, 1)[0];
    
    // Atualizar economias dos países envolvidos (com impacto inverso)
    updateCountryEconomiesAfterAgreementCancellation(gameState, roomName, removedAgreement, countryStateManager);
    
    console.log(`${username} cancelled a trade agreement: ${removedAgreement.type} ${removedAgreement.product} with ${removedAgreement.country}`);
    
    // Send success response
    socket.emit('tradeAgreementCancelled', agreementId);
    
    // Broadcast to all players in the room
    io.to(roomName).emit('tradeAgreementUpdated', {
      agreements: room.tradeAgreements,
      timestamp: Date.now()
    });
  });
  
  // Handler para obter acordos comerciais ativos
  socket.on('getTradeAgreements', () => {
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return;
    }
    
    // Get current room
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Not in a room');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    // Get all trade agreements for the room
    const agreements = room.tradeAgreements || [];
    
    // Send agreements to client
    socket.emit('tradeAgreementsList', {
      agreements,
      timestamp: Date.now()
    });
  });
}

/**
 * Atualiza as economias dos países envolvidos em um acordo comercial
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {Object} agreement - Dados do acordo
 * @param {Object} countryStateManager - Gerenciador de estados dos países
 */
function updateCountryEconomiesWithTradeAgreement(gameState, roomName, agreement, countryStateManager) {
  const { originCountry, country: targetCountry, type, product, value } = agreement;
  
  // Atualizar economia do país de origem
  updateCountryEconomyForTrade(
    gameState, roomName, originCountry, agreement, countryStateManager, true
  );
  
  // Atualizar economia do país de destino
  // Inverter o tipo para o país de destino (importação vira exportação e vice-versa)
  const reversedAgreement = {
    ...agreement,
    type: type === 'import' ? 'export' : 'import',
    country: originCountry,
    originCountry: targetCountry
  };
  
  updateCountryEconomyForTrade(
    gameState, roomName, targetCountry, reversedAgreement, countryStateManager, false
  );
}

/**
 * Atualiza a economia de um país com base em um acordo comercial
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 * @param {Object} agreement - Dados do acordo
 * @param {Object} countryStateManager - Gerenciador de estados dos países
 * @param {boolean} isOriginCountry - Se é o país de origem do acordo
 */
function updateCountryEconomyForTrade(gameState, roomName, countryName, agreement, countryStateManager, isOriginCountry) {
  // Obter estado atual e dados estáticos do país
  const currentState = countryStateManager.getCountryState(roomName, countryName);
  const staticData = gameState.countriesData[countryName];
  
  if (!currentState || !staticData) return;
  
  // Para o país de origem, realizar cálculos considerando os acordos comerciais
  const room = gameState.rooms.get(roomName);
  if (!room) return;
  
  // Obter todos os acordos em que este país está envolvido
  const countryAgreements = (room.tradeAgreements || []).filter(a => 
    a.originCountry === countryName || a.country === countryName
  );
  
  // Realizar cálculos econômicos
  const calculationResult = performEconomicCalculations(
    currentState,
    staticData,
    {
      tradeAgreements: countryAgreements
    }
  );
  
  // Atualizar o estado do país
  countryStateManager.updateCountryState(
    roomName,
    countryName,
    'economy',
    calculationResult.economy
  );
}

/**
 * Atualiza as economias dos países após cancelamento de um acordo
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {Object} agreement - Acordo cancelado
 * @param {Object} countryStateManager - Gerenciador de estados dos países
 */
function updateCountryEconomiesAfterAgreementCancellation(gameState, roomName, agreement, countryStateManager) {
  const { originCountry, country: targetCountry } = agreement;
  
  // Como o acordo já foi removido, só precisamos recalcular as economias
  // com os acordos restantes
  
  // Atualizar economia do país de origem
  updateCountryEconomyAfterCancellation(
    gameState, roomName, originCountry, countryStateManager
  );
  
  // Atualizar economia do país de destino
  updateCountryEconomyAfterCancellation(
    gameState, roomName, targetCountry, countryStateManager
  );
}

/**
 * Atualiza a economia de um país após cancelamento de acordo
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 * @param {Object} countryStateManager - Gerenciador de estados dos países
 */
function updateCountryEconomyAfterCancellation(gameState, roomName, countryName, countryStateManager) {
  // Obter estado atual e dados estáticos do país
  const currentState = countryStateManager.getCountryState(roomName, countryName);
  const staticData = gameState.countriesData[countryName];
  
  if (!currentState || !staticData) return;
  
  // Obter a sala
  const room = gameState.rooms.get(roomName);
  if (!room) return;
  
  // Obter todos os acordos restantes em que este país está envolvido
  const countryAgreements = (room.tradeAgreements || []).filter(a => 
    a.originCountry === countryName || a.country === countryName
  );
  
  // Realizar cálculos econômicos com os acordos restantes
  const calculationResult = performEconomicCalculations(
    currentState,
    staticData,
    {
      tradeAgreements: countryAgreements
    }
  );
  
  // Atualizar o estado do país
  countryStateManager.updateCountryState(
    roomName,
    countryName,
    'economy',
    calculationResult.economy
  );
}

export { setupEconomyHandlers };