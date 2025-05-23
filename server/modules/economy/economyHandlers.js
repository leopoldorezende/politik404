/**
 * economyHandlers.js
 * Socket.io handlers for economic operations
 * ENHANCED WITH ADVANCED DEBT MANAGEMENT SYSTEM
 */

import { 
  performEconomicCalculations,
  issueDebtBonds,
  issueEmergencyBonds,
  processMonthlyDebtPayments,
  updateTotalPublicDebt,
  canIssueMoreDebt,
  ECONOMIC_CONSTANTS
} from './economyCalculations.js';
import countryStateManager from '../../shared/countryStateManager.js';
import { getCurrentRoom, getUsernameFromSocketId } from '../../shared/gameStateUtils.js';
import { 
  setupPeriodicTradeUpdates,
  createTradeAgreement,
  cancelTradeAgreement,
  updateCountryEconomyForTrade
} from './tradeAgreementService.js';
import { evaluateTradeProposal } from '../ai/aiCountryController.js';

// Flag to track if the periodic updates have been initialized
let periodicUpdatesInitialized = false;

/**
 * Setup economy-related socket event handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Client socket
 * @param {Object} gameState - Global game state
 */
function setupEconomyHandlers(io, socket, gameState) {
  console.log('Economy handlers initialized with advanced debt system');
  
  // Set up periodic economic updates only once
  if (!periodicUpdatesInitialized) {
    setupPeriodicTradeUpdates(io, gameState);
    periodicUpdatesInitialized = true;
    console.log('Periodic trade updates initialized (first-time setup)');
  }

  // Enhanced debt bond issuance handler
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
    const { bondAmount, isEmergency = false } = data;
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
    
    // Prepare enhanced economy state for debt issuance
    const economy = currentState.economy || {};
    const economyStateForDebt = {
      treasury: economy.treasury?.value || 0,
      publicDebt: economy.publicDebt || staticData.economy?.publicDebt?.value || 0,
      gdp: economy.gdp?.value || 100,
      interestRate: staticData.economy?.interestRate || ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE,
      creditRating: staticData.economy?.creditRating || 'A',
      canIssueDebt: true,
      debtRecords: economy.debtRecords || [],
      nextDebtId: economy.nextDebtId || 1
    };
    
    // Check if the country can issue more debt
    if (!canIssueMoreDebt(economyStateForDebt)) {
      socket.emit('error', 'Cannot issue more debt. Debt-to-GDP ratio would exceed 120% or country is in default.');
      return;
    }
    
    // Issue bonds using the enhanced system
    const bondResult = issueDebtBonds(economyStateForDebt, bondAmount, isEmergency);
    
    if (bondResult.success) {
      // Update country state with new debt information
      const updatedEconomy = {
        ...economy,
        treasury: { value: bondResult.updatedEconomy.treasury, unit: 'bi USD' },
        publicDebt: bondResult.updatedEconomy.publicDebt,
        debtRecords: bondResult.updatedEconomy.debtRecords,
        nextDebtId: bondResult.updatedEconomy.nextDebtId
      };
      
      // Update the country state
      countryStateManager.updateCountryState(roomName, userCountry, 'economy', updatedEconomy);
      
      console.log(`${username} issued ${bondAmount} billion in ${isEmergency ? 'emergency ' : ''}debt bonds for ${userCountry} at ${bondResult.newDebt.interestRate.toFixed(2)}% rate`);
      
      // Send enhanced success response with detailed debt information
      socket.emit('debtBondsIssued', {
        success: true,
        bondAmount,
        newTreasury: bondResult.updatedEconomy.treasury,
        newPublicDebt: bondResult.updatedEconomy.publicDebt,
        effectiveInterestRate: bondResult.newDebt.interestRate,
        monthlyPayment: bondResult.newDebt.monthlyPayment,
        remainingInstallments: bondResult.newDebt.remainingInstallments,
        creditRating: economyStateForDebt.creditRating,
        isEmergency: isEmergency,
        message: bondResult.message,
        debtContract: bondResult.newDebt
      });
    } else {
      console.log(`${username} failed to issue debt bonds for ${userCountry}: ${bondResult.message}`);
      socket.emit('error', bondResult.message);
    }
  });

  // Handler for emergency bond issuance
  socket.on('issueEmergencyBonds', (data) => {
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
    
    // Get user's country
    const userRoomKey = `${username}:${roomName}`;
    const userCountry = gameState.userRoomCountries.get(userRoomKey);
    
    if (!userCountry) {
      socket.emit('error', 'No country assigned');
      return;
    }
    
    const { requiredAmount } = data;
    if (!requiredAmount || requiredAmount <= 0) {
      socket.emit('error', 'Invalid required amount for emergency bonds');
      return;
    }
    
    // Get current country state
    const currentState = countryStateManager.getCountryState(roomName, userCountry);
    const staticData = gameState.countriesData[userCountry];
    
    if (!currentState || !staticData) {
      socket.emit('error', 'Country data not found');
      return;
    }
    
    // Prepare economy state for emergency bond issuance
    const economy = currentState.economy || {};
    const economyStateForDebt = {
      treasury: economy.treasury?.value || 0,
      publicDebt: economy.publicDebt || staticData.economy?.publicDebt?.value || 0,
      gdp: economy.gdp?.value || 100,
      interestRate: staticData.economy?.interestRate || ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE,
      creditRating: staticData.economy?.creditRating || 'A',
      canIssueDebt: true,
      debtRecords: economy.debtRecords || [],
      nextDebtId: economy.nextDebtId || 1
    };
    
    // Issue emergency bonds
    const emergencyResult = issueEmergencyBonds(economyStateForDebt, requiredAmount);
    
    if (emergencyResult.success) {
      // Update country state
      const updatedEconomy = {
        ...economy,
        treasury: { value: emergencyResult.updatedEconomy.treasury, unit: 'bi USD' },
        publicDebt: emergencyResult.updatedEconomy.publicDebt,
        debtRecords: emergencyResult.updatedEconomy.debtRecords,
        nextDebtId: emergencyResult.updatedEconomy.nextDebtId
      };
      
      countryStateManager.updateCountryState(roomName, userCountry, 'economy', updatedEconomy);
      
      console.log(`${username} issued emergency bonds for ${userCountry}: ${emergencyResult.message}`);
      
      socket.emit('emergencyBondsIssued', {
        success: true,
        requiredAmount,
        actualAmount: emergencyResult.updatedEconomy.treasury - economyStateForDebt.treasury,
        newTreasury: emergencyResult.updatedEconomy.treasury,
        newPublicDebt: emergencyResult.updatedEconomy.publicDebt,
        message: emergencyResult.message
      });
    } else {
      console.log(`${username} failed to issue emergency bonds for ${userCountry}: ${emergencyResult.message}`);
      socket.emit('error', emergencyResult.message);
    }
  });

  // Handler for debt payment processing (monthly)
  socket.on('processDebtPayments', () => {
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
    
    // Get user's country
    const userRoomKey = `${username}:${roomName}`;
    const userCountry = gameState.userRoomCountries.get(userRoomKey);
    
    if (!userCountry) {
      socket.emit('error', 'No country assigned');
      return;
    }
    
    // Get current country state
    const currentState = countryStateManager.getCountryState(roomName, userCountry);
    if (!currentState) {
      socket.emit('error', 'Country state not found');
      return;
    }
    
    const economy = currentState.economy || {};
    const debtRecords = economy.debtRecords || [];
    const currentTreasury = economy.treasury?.value || 0;
    
    // Process monthly debt payments
    const paymentResult = processMonthlyDebtPayments(debtRecords, currentTreasury);
    
    // Update country state with payment results
    const updatedEconomy = {
      ...economy,
      treasury: { value: paymentResult.remainingCash, unit: 'bi USD' },
      debtRecords: paymentResult.updatedDebts,
      publicDebt: paymentResult.updatedDebts.reduce((total, debt) => total + debt.remainingValue, 0)
    };
    
    countryStateManager.updateCountryState(roomName, userCountry, 'economy', updatedEconomy);
    
    console.log(`${username} processed debt payments for ${userCountry}: ${paymentResult.totalPayment.toFixed(2)} bi paid`);
    
    // If treasury goes negative, automatically issue emergency bonds
    if (paymentResult.remainingCash < 0) {
      const requiredAmount = Math.abs(paymentResult.remainingCash) + 10; // Add buffer
      
      // Prepare for emergency bond issuance
      const staticData = gameState.countriesData[userCountry];
      const economyStateForDebt = {
        treasury: paymentResult.remainingCash,
        publicDebt: updatedEconomy.publicDebt,
        gdp: economy.gdp?.value || 100,
        interestRate: staticData?.economy?.interestRate || ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE,
        creditRating: staticData?.economy?.creditRating || 'A',
        canIssueDebt: true,
        debtRecords: paymentResult.updatedDebts,
        nextDebtId: economy.nextDebtId || 1
      };
      
      const emergencyResult = issueEmergencyBonds(economyStateForDebt, requiredAmount);
      
      if (emergencyResult.success) {
        // Update again with emergency bonds
        const finalEconomy = {
          ...updatedEconomy,
          treasury: { value: emergencyResult.updatedEconomy.treasury, unit: 'bi USD' },
          publicDebt: emergencyResult.updatedEconomy.publicDebt,
          debtRecords: emergencyResult.updatedEconomy.debtRecords,
          nextDebtId: emergencyResult.updatedEconomy.nextDebtId
        };
        
        countryStateManager.updateCountryState(roomName, userCountry, 'economy', finalEconomy);
        
        socket.emit('debtPaymentProcessed', {
          ...paymentResult,
          emergencyBondsIssued: true,
          emergencyAmount: requiredAmount,
          finalTreasury: emergencyResult.updatedEconomy.treasury,
          message: `Debt payments processed. ${emergencyResult.message}`
        });
      } else {
        socket.emit('debtPaymentProcessed', {
          ...paymentResult,
          emergencyBondsIssued: false,
          treasuryDeficit: true,
          message: 'Debt payments processed but treasury is insufficient. Emergency bonds could not be issued.'
        });
      }
    } else {
      socket.emit('debtPaymentProcessed', {
        ...paymentResult,
        emergencyBondsIssued: false,
        message: 'Debt payments processed successfully.'
      });
    }
  });

  // Handler for getting debt summary with enhanced information
  socket.on('getDebtSummary', () => {
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
    
    // Get user's country
    const userRoomKey = `${username}:${roomName}`;
    const userCountry = gameState.userRoomCountries.get(userRoomKey);
    
    if (!userCountry) {
      socket.emit('error', 'No country assigned');
      return;
    }
    
    // Get current country state
    const currentState = countryStateManager.getCountryState(roomName, userCountry);
    if (!currentState) {
      socket.emit('error', 'Country state not found');
      return;
    }
    
    const economy = currentState.economy || {};
    const debtRecords = economy.debtRecords || [];
    
    // Calculate comprehensive debt summary
    const debtSummary = updateTotalPublicDebt(debtRecords);
    const totalMonthlyPayment = debtRecords.reduce((sum, debt) => sum + debt.monthlyPayment, 0);
    const averageInterestRate = debtRecords.length > 0 ? 
      debtRecords.reduce((sum, debt) => sum + (debt.interestRate * debt.remainingValue), 0) / 
      debtRecords.reduce((sum, debt) => sum + debt.remainingValue, 0) : 0;
    
    const gdp = economy.gdp?.value || 100;
    const currentPublicDebt = economy.publicDebt || 0;
    
    socket.emit('debtSummaryResponse', {
      totalPublicDebt: currentPublicDebt,
      principalRemaining: debtSummary.principalRemaining,
      totalFuturePayments: debtSummary.totalDebtWithInterest,
      totalMonthlyPayment,
      averageInterestRate,
      numberOfContracts: debtRecords.length,
      debtToGdpRatio: (currentPublicDebt / gdp) * 100,
      canIssueMoreDebt: canIssueMoreDebt({ 
        publicDebt: currentPublicDebt, 
        gdp: gdp, 
        canIssueDebt: true 
      }),
      debtRecords: debtRecords.map(debt => ({
        id: debt.id,
        originalValue: debt.originalValue,
        remainingValue: debt.remainingValue,
        interestRate: debt.interestRate,
        monthlyPayment: debt.monthlyPayment,
        remainingInstallments: debt.remainingInstallments,
        issueDate: debt.issueDate,
        isEmergency: debt.isEmergency || false,
        creditRating: debt.creditRating || 'A'
      }))
    });
  });

  // Handler para envio de propostas de comércio
  socket.on('sendTradeProposal', (proposal) => {
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
    
    // Validar dados da proposta
    const { type, product, targetCountry, value, originCountry } = proposal;
    
    if (!type || !product || !targetCountry || !value || !originCountry) {
      socket.emit('error', 'Missing required proposal details');
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
    
    // Verificar se o país de origem é controlado pelo jogador que enviou a proposta
    const userRoomKey = `${username}:${roomName}`;
    const userCountry = gameState.userRoomCountries.get(userRoomKey);
    
    if (userCountry !== originCountry) {
      socket.emit('error', 'You can only create proposals for your own country');
      return;
    }
    
    // Gerar ID único para a proposta
    const proposalId = `trade-proposal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Criar objeto da proposta
    const tradeProposal = {
      id: proposalId,
      type,
      product,
      targetCountry,
      value,
      originCountry,
      originPlayer: username,
      timestamp: Date.now()
    };
    
    // Verificar se o país alvo é controlado por um jogador
    let targetPlayer = null;
    let isPlayerControlled = false;
    
    // Procurar o jogador que controla o país alvo
    for (const player of room.players) {
      if (typeof player === 'object' && player.country === targetCountry) {
        targetPlayer = player.username;
        isPlayerControlled = true;
        break;
      }
    }
    
    console.log(`Trade proposal from ${originCountry} to ${targetCountry}. Target is ${isPlayerControlled ? 'player-controlled' : 'AI-controlled'}`);
    
    if (isPlayerControlled) {
      // País alvo é controlado por um jogador
      // Verificar se o jogador está online
      const targetSocketId = gameState.usernameToSocketId?.get(targetPlayer);
      const targetSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : null;
      
      if (targetSocket && targetSocket.connected) {
        // Armazenar a proposta no socket do jogador alvo para uso posterior
        targetSocket.tradeProposal = tradeProposal;
        
        // Enviar proposta para o jogador alvo
        targetSocket.emit('tradeProposalReceived', tradeProposal);
        console.log(`Trade proposal sent to player ${targetPlayer}`);
        
      } else {
        // Jogador alvo não está online
        socket.emit('error', 'Target player is not online');
      }
    } else {
      // País alvo é controlado pelo sistema - usar lógica de IA
      const aiDecision = evaluateTradeProposal(gameState, roomName, {
        type,
        product,
        targetCountry,
        value,
        originCountry
      });
      
      setTimeout(() => {
        if (aiDecision.accepted) {
          console.log(`AI-controlled country ${targetCountry} accepted trade proposal from ${originCountry}: ${aiDecision.reason}`);
          
          // Criar acordo comercial
          createTradeAgreement(io, gameState, roomName, {
            type,
            product,
            country: targetCountry,
            value,
            originCountry,
            originPlayer: username
          });
          
          // Notificar jogador que enviou que a proposta foi aceita
          socket.emit('tradeProposalResponse', {
            proposalId,
            accepted: true,
            targetCountry,
            message: `${targetCountry} accepted your trade proposal`
          });
        } else {
          console.log(`AI-controlled country ${targetCountry} rejected trade proposal from ${originCountry}: ${aiDecision.reason}`);
          
          // Notificar jogador que enviou que a proposta foi rejeitada
          socket.emit('tradeProposalResponse', {
            proposalId,
            accepted: false,
            targetCountry,
            message: `${targetCountry} rejected your trade proposal`
          });
        }
      }, 1500); // Pequeno delay para simular "pensamento" do AI
    }
  });
  
  // Handler para respostas às propostas comerciais
  socket.on('respondToTradeProposal', (response) => {
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return;
    }
    
    const { proposalId, accepted } = response;
    
    if (!proposalId) {
      socket.emit('error', 'Proposal ID is required');
      return;
    }
    
    // Get current room
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Not in a room');
      return;
    }
    
    // Recuperar detalhes da proposta do socket (armazenados quando recebeu a proposta)
    const proposal = socket.tradeProposal;
    
    if (!proposal) {
      socket.emit('error', 'Trade proposal details not found');
      return;
    }
    
    // Verificar se o país de origem é controlado por um jogador humano ou pela IA
    const isAIControlledProposal = !isCountryControlledByHuman(gameState, roomName, proposal.originCountry);
    
    if (accepted) {
      console.log(`Trade proposal ${proposalId} accepted by ${username}`);
      
      // Criar acordo comercial
      createTradeAgreement(io, gameState, roomName, {
        type: proposal.type,
        product: proposal.product,
        country: proposal.targetCountry,
        value: proposal.value,
        originCountry: proposal.originCountry,
        originPlayer: proposal.originPlayer || null // O país IA não tem jogador associado
      });
      
      // Se não for uma proposta de IA, notificar o jogador humano que enviou a proposta
      if (!isAIControlledProposal) {
        const originSocketId = gameState.usernameToSocketId?.get(proposal.originPlayer);
        const originSocket = originSocketId ? io.sockets.sockets.get(originSocketId) : null;
        
        if (originSocket && originSocket.connected) {
          originSocket.emit('tradeProposalResponse', {
            proposalId,
            accepted: true,
            targetCountry: proposal.targetCountry,
            message: `${proposal.targetCountry} accepted your trade proposal`
          });
        }
      }
    } else {
      console.log(`Trade proposal ${proposalId} rejected by ${username}`);
      
      // Se não for uma proposta de IA, notificar o jogador humano que enviou a proposta
      if (!isAIControlledProposal) {
        const originSocketId = gameState.usernameToSocketId?.get(proposal.originPlayer);
        const originSocket = originSocketId ? io.sockets.sockets.get(originSocketId) : null;
        
        if (originSocket && originSocket.connected) {
          originSocket.emit('tradeProposalResponse', {
            proposalId,
            accepted: false,
            targetCountry: proposal.targetCountry,
            message: `${proposal.targetCountry} rejected your trade proposal`
          });
        }
      }
    }
    
    // Limpar a proposta armazenada
    delete socket.tradeProposal;
  });

  // Handler para criação de acordos comerciais (ainda mantido para compatibilidade)
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
      socket.emit('error', 'Faltam detalhes obrigatórios do acordo');
      return;
    }

    if (type !== 'import' && type !== 'export') {
      socket.emit('error', 'Tipo de comércio inválido. Deve ser "import" ou "export"');
      return;
    }

    if (product !== 'commodity' && product !== 'manufacture') {
      socket.emit('error', 'Tipo de produto inválido. Deve ser "commodity" ou "manufacture"');
      return;
    }

    if (value <= 0 || value > 1000) {
      socket.emit('error', 'Valor de comércio inválido. Deve estar entre 0 e 1000 bilhões');
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
    
    // Criar o acordo comercial
    const agreement = createTradeAgreement(io, gameState, roomName, {
      type,
      product,
      country,
      value, 
      originCountry: userCountry,
      originPlayer: username
    });
    
    if (agreement) {
      console.log(`${username} created a trade agreement: ${type} ${product} with ${country}`);
    } else {
      socket.emit('error', 'Failed to create trade agreement');
    }
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
    
    // Cancelar o acordo comercial
    cancelTradeAgreement(io, gameState, roomName, agreementId, userCountry, socket);
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
 * Função auxiliar para verificar se um país é controlado por um jogador humano
 * @param {Object} gameState - Estado global do jogo
 * @param {string} roomName - Nome da sala
 * @param {string} countryName - Nome do país
 * @returns {boolean} - Verdadeiro se controlado por humano
 */
function isCountryControlledByHuman(gameState, roomName, countryName) {
  const room = gameState.rooms.get(roomName);
  if (!room || !room.players) return false;
  
  return room.players.some(player => {
    if (typeof player === 'object') {
      return player.country === countryName;
    }
    if (typeof player === 'string') {
      const match = player.match(/\((.*)\)/);
      return match && match[1] === countryName;
    }
    return false;
  });
}

export { setupEconomyHandlers };