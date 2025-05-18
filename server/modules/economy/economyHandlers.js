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

// Flag to track if the periodic updates have been initialized
let periodicUpdatesInitialized = false;

/**
 * Setup economy-related socket event handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Client socket
 * @param {Object} gameState - Global game state
 */
function setupEconomyHandlers(io, socket, gameState) {
  console.log('Economy handlers initialized');
  
  // Set up periodic economic updates only once
  if (!periodicUpdatesInitialized) {
    setupPeriodicTradeUpdates(io, gameState);
    periodicUpdatesInitialized = true;
    console.log('Periodic trade updates initialized (first-time setup)');
  }

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
    
    // Create agreement object for the origin country
    const originAgreement = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      type,
      product,
      country,
      value,
      originCountry: userCountry,
      originPlayer: username
    };
    
    // Create a mirrored agreement for the target country
    // If origin is import, target is export and vice versa
    const targetAgreement = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      type: type === 'import' ? 'export' : 'import', // Invert the type for the target country
      product,
      country: userCountry, // The target sees the origin country
      value,
      originCountry: country, // For the target, the origin is itself
      originPlayer: null // No player assigned for target country's perspective
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
        existing.originCountry === userCountry) &&
      !(existing.type === targetAgreement.type && 
        existing.product === product && 
        existing.country === userCountry && 
        existing.originCountry === country)
    );
    
    // Adicionar os dois acordos (origem e destino)
    room.tradeAgreements.push(originAgreement);
    room.tradeAgreements.push(targetAgreement);
    
    console.log(`Created trade agreement:`, originAgreement);
    console.log(`Created mirrored trade agreement:`, targetAgreement);
    
    // Atualizar economias dos países envolvidos
    updateCountryEconomiesWithTradeAgreement(gameState, roomName, originAgreement, countryStateManager);
    
    console.log(`${username} created a trade agreement: ${type} ${product} with ${country}`);
    
    // Send success response
    socket.emit('tradeAgreementCreated', originAgreement);
    
    // Broadcast to all players in the room about the new agreements
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
    
    // MODIFICAÇÃO: Remover a verificação de permissão para que qualquer jogador 
    // envolvido no acordo possa cancelá-lo
    
    // Verificar apenas se o usuário está envolvido no acordo de alguma forma
    // Se é originador ou destino
    const isInvolved = (agreement.originCountry === userCountry || 
                         agreement.country === userCountry);
    
    if (!isInvolved) {
      socket.emit('error', 'You are not involved in this trade agreement');
      return;
    }
    
    // Remover o acordo
    const removedAgreement = room.tradeAgreements.splice(agreementIndex, 1)[0];
    
    // Encontrar e remover o acordo espelhado
    const mirroredType = agreement.type === 'import' ? 'export' : 'import';
    const mirroredCountry = agreement.originCountry;
    const mirroredOriginCountry = agreement.country;
    
    // Encontrar o acordo espelhado
    const mirroredIndex = room.tradeAgreements.findIndex(a => 
      a.type === mirroredType && 
      a.product === agreement.product && 
      a.country === mirroredCountry && 
      a.originCountry === mirroredOriginCountry
    );
    
    // Se encontrou, remove também
    if (mirroredIndex !== -1) {
      room.tradeAgreements.splice(mirroredIndex, 1);
    }
    
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
 * Setup periodic updates for trade-related economic calculations
 * @param {Object} io - Socket.io instance
 * @param {Object} gameState - Global game state
 */
function setupPeriodicTradeUpdates(io, gameState) {
  // Check if updates are already running
  if (gameState.tradeUpdateInterval) {
    clearInterval(gameState.tradeUpdateInterval);
  }
  
  // Setup interval for periodic updates (every 5 seconds)
  gameState.tradeUpdateInterval = setInterval(() => {
    console.log('Running periodic trade agreement economic updates...');
    
    // Process each room
    for (const [roomName, room] of gameState.rooms.entries()) {
      // Skip if no trade agreements
      if (!room.tradeAgreements || room.tradeAgreements.length === 0) {
        continue;
      }
      
      console.log(`Processing trade agreements for room ${roomName}: ${room.tradeAgreements.length} agreements`);
      
      // Get all unique countries involved in trade agreements
      const tradingCountries = new Set();
      
      for (const agreement of room.tradeAgreements) {
        tradingCountries.add(agreement.originCountry);
        tradingCountries.add(agreement.country);
      }
      
      console.log(`Countries involved in trade in room ${roomName}: ${Array.from(tradingCountries).join(', ')}`);
      
      // Update each country's economy
      for (const countryName of tradingCountries) {
        updateCountryEconomyForTrade(gameState, roomName, countryName, countryStateManager);
      }
      
      // Notify players in the room about updated trade agreements
      io.to(roomName).emit('tradeAgreementUpdated', {
        agreements: room.tradeAgreements,
        timestamp: Date.now()
      });
    }
  }, 5000); // Run every 5 seconds
  
  console.log('Periodic trade updates scheduled (every 5 seconds)');
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
    gameState, roomName, originCountry, countryStateManager
  );
  
  // Atualizar economia do país de destino
  updateCountryEconomyForTrade(
    gameState, roomName, targetCountry, countryStateManager
  );
}

/**
 * Atualiza a economia de um país com base em seus acordos comerciais
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 * @param {Object} countryStateManager - Gerenciador de estados dos países
 */
function updateCountryEconomyForTrade(gameState, roomName, countryName, countryStateManager) {
  // Obter estado atual e dados estáticos do país
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
  
  // MODIFICADO: Agora consideramos todos os acordos na sala
  // Isso é importante porque precisamos considerar acordos onde o país é tanto origem quanto destino
  const allAgreements = room.tradeAgreements || [];
  
  console.log(`Processing ${allAgreements.length} trade agreements for ${countryName} in room ${roomName}`);
  
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
  
  console.log(`Economy updated for ${countryName} - Commodities Balance: ${calculationResult.economy.commoditiesBalance?.value}, Manufactures Balance: ${calculationResult.economy.manufacturesBalance?.value}`);
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
  
  // Atualizar economia do país de origem
  updateCountryEconomyForTrade(
    gameState, roomName, originCountry, countryStateManager
  );
  
  // Atualizar economia do país de destino
  updateCountryEconomyForTrade(
    gameState, roomName, targetCountry, countryStateManager
  );
}

export { setupEconomyHandlers };