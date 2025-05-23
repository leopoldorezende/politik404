/**
 * economyHandlers.js
 * Socket.io handlers for economic operations
 * CORRIGIDO: Integração completa com countryStateManager centralizado
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
  console.log('Economy handlers initialized with countryStateManager integration');
  
  // Set up periodic economic updates only once
  if (!periodicUpdatesInitialized) {
    setupPeriodicTradeUpdates(io, gameState);
    periodicUpdatesInitialized = true;
    console.log('Periodic trade updates initialized (first-time setup)');
  }

  // ======================================================================
  // NOVO: Handler para atualização de parâmetros econômicos
  // ======================================================================
  
  socket.on('updateEconomicParameter', (data) => {
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
    
    const { parameter, value } = data;
    
    // Validar parâmetro
    const validParameters = ['interestRate', 'taxBurden', 'publicServices'];
    if (!validParameters.includes(parameter)) {
      socket.emit('error', 'Invalid economic parameter');
      return;
    }
    
    // Validar valor
    if (typeof value !== 'number' || isNaN(value)) {
      socket.emit('error', 'Invalid parameter value');
      return;
    }
    
    // Validar ranges
    let min = 0, max = 100;
    if (parameter === 'interestRate') {
      max = 25;
    } else if (parameter === 'taxBurden' || parameter === 'publicServices') {
      max = 60;
    }
    
    if (value < min || value > max) {
      socket.emit('error', `${parameter} must be between ${min}% and ${max}%`);
      return;
    }
    
    try {
      // CORRIGIDO: Usar o countryStateManager centralizado
      const updatedState = countryStateManager.updateEconomicParameter(
        roomName, 
        userCountry, 
        parameter, 
        value
      );
      
      if (updatedState) {
        console.log(`[ECONOMY] ${username} updated ${parameter} to ${value}% for ${userCountry}`);
        
        // NOVO: Emitir confirmação para o cliente
        socket.emit('economicParameterUpdated', {
          roomName,
          countryName: userCountry,
          parameter,
          value,
          success: true,
          message: `${parameter} updated to ${value}%`
        });
        
        // NOVO: Notificar outros jogadores na sala sobre mudanças econômicas significativas
        if (parameter === 'interestRate') {
          socket.to(roomName).emit('economicNews', {
            type: 'interestRate',
            country: userCountry,
            value,
            message: `${userCountry} changed interest rate to ${value}%`
          });
        }
        
      } else {
        socket.emit('error', 'Failed to update economic parameter');
      }
      
    } catch (error) {
      console.error(`Error updating economic parameter for ${userCountry}:`, error);
      socket.emit('error', 'Internal error updating economic parameter');
    }
  });

  // ======================================================================
  // CORRIGIDO: Handler para emissão de títulos usando countryStateManager
  // ======================================================================
  
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
    
    try {
      // CORRIGIDO: Usar o countryStateManager centralizado
      const bondResult = countryStateManager.issueDebtBonds(
        roomName,
        userCountry,
        bondAmount
      );
      
      if (bondResult.success) {
        console.log(`[ECONOMY] ${username} issued ${bondAmount} billion in debt bonds for ${userCountry}`);
        
        // CORRIGIDO: Enviar resposta detalhada
        socket.emit('debtBondsIssued', {
          success: true,
          bondAmount,
          newTreasury: bondResult.newTreasury,
          newPublicDebt: bondResult.newPublicDebt,
          effectiveInterestRate: bondResult.effectiveRate,
          message: bondResult.message,
          debtContract: bondResult.newContract
        });
        
        // NOVO: Notificar outros jogadores sobre emissão significativa
        if (bondAmount >= 50) {
          socket.to(roomName).emit('economicNews', {
            type: 'debtIssuance',
            country: userCountry,
            amount: bondAmount,
            message: `${userCountry} issued ${bondAmount} billion in government bonds`
          });
        }
        
      } else {
        console.log(`[ECONOMY] ${username} failed to issue debt bonds for ${userCountry}: ${bondResult.message}`);
        socket.emit('error', bondResult.message);
      }
      
    } catch (error) {
      console.error(`Error issuing debt bonds for ${userCountry}:`, error);
      socket.emit('error', 'Internal error processing bond issuance');
    }
  });

  // ======================================================================
  // CORRIGIDO: Handler para obter resumo de dívidas usando countryStateManager
  // ======================================================================
  
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
    
    try {
      // CORRIGIDO: Usar o countryStateManager centralizado
      const debtSummary = countryStateManager.getDebtSummary(roomName, userCountry);
      
      // Obter dados econômicos atuais
      const currentState = countryStateManager.getCountryState(roomName, userCountry);
      const economy = currentState?.economy || {};
      
      const gdp = economy.gdp?.value || 100;
      const currentPublicDebt = economy.publicDebt || 0;
      
      // CORRIGIDO: Calcular médias ponderadas corretas
      let averageInterestRate = 0;
      if (debtSummary.contracts.length > 0) {
        const totalInterest = debtSummary.contracts.reduce((sum, debt) => 
          sum + (debt.interestRate * debt.remainingValue), 0
        );
        const totalBalance = debtSummary.contracts.reduce((sum, debt) => 
          sum + debt.remainingValue, 0
        );
        averageInterestRate = totalBalance > 0 ? totalInterest / totalBalance : 0;
      }
      
      socket.emit('debtSummaryResponse', {
        totalPublicDebt: currentPublicDebt,
        principalRemaining: debtSummary.principalRemaining,
        totalFuturePayments: debtSummary.totalFuturePayments,
        totalMonthlyPayment: debtSummary.totalMonthlyPayment,
        averageInterestRate,
        numberOfContracts: debtSummary.numberOfContracts,
        debtToGdpRatio: (currentPublicDebt / gdp) * 100,
        canIssueMoreDebt: (currentPublicDebt / gdp) <= 1.2,
        debtRecords: debtSummary.contracts.map(debt => ({
          id: debt.id,
          originalValue: debt.originalValue,
          remainingValue: debt.remainingValue,
          interestRate: debt.interestRate,
          monthlyPayment: debt.monthlyPayment,
          remainingInstallments: debt.remainingInstallments,
          issueDate: debt.issueDate
        }))
      });
      
    } catch (error) {
      console.error(`Error getting debt summary for ${userCountry}:`, error);
      socket.emit('error', 'Internal error getting debt summary');
    }
  });

  // ======================================================================
  // MANTIDO: Handler para títulos de emergência
  // ======================================================================
  
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
    
    try {
      // Usar issueDebtBonds com flag de emergência
      const bondResult = countryStateManager.issueDebtBonds(
        roomName,
        userCountry,
        requiredAmount
      );
      
      if (bondResult.success) {
        console.log(`[ECONOMY] ${username} issued emergency bonds for ${userCountry}: ${bondResult.message}`);
        
        socket.emit('emergencyBondsIssued', {
          success: true,
          requiredAmount,
          actualAmount: bondResult.bondAmount,
          newTreasury: bondResult.newTreasury,
          newPublicDebt: bondResult.newPublicDebt,
          message: `Emergency bonds issued: ${bondResult.message}`
        });
        
        // Notificar sala sobre emissão de emergência
        socket.to(roomName).emit('economicNews', {
          type: 'emergencyBonds',
          country: userCountry,
          amount: bondResult.bondAmount,
          message: `${userCountry} issued emergency bonds due to financial crisis`
        });
        
      } else {
        console.log(`[ECONOMY] ${username} failed to issue emergency bonds for ${userCountry}: ${bondResult.message}`);
        socket.emit('error', bondResult.message);
      }
      
    } catch (error) {
      console.error(`Error issuing emergency bonds for ${userCountry}:`, error);
      socket.emit('error', 'Internal error processing emergency bond issuance');
    }
  });

  // ======================================================================
  // HANDLER PARA PROCESSAMENTO DE PAGAMENTOS (SIMPLIFICADO)
  // ======================================================================
  
  socket.on('processDebtPayments', () => {
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return;
    }
    
    // Este processo é automático no countryStateManager
    // Apenas retornar o status atual
    socket.emit('debtPaymentProcessed', {
      message: 'Debt payments are processed automatically by the economic system',
      automatic: true
    });
  });

  // ======================================================================
  // MANTIDOS: Handlers de comércio com melhorias
  // ======================================================================
  
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
    
    console.log(`[TRADE] Proposal from ${originCountry} to ${targetCountry}. Target is ${isPlayerControlled ? 'player-controlled' : 'AI-controlled'}`);
    
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
        console.log(`[TRADE] Proposal sent to player ${targetPlayer}`);
        
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
          console.log(`[TRADE] AI-controlled ${targetCountry} accepted proposal from ${originCountry}: ${aiDecision.reason}`);
          
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
          console.log(`[TRADE] AI-controlled ${targetCountry} rejected proposal from ${originCountry}: ${aiDecision.reason}`);
          
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
      console.log(`[TRADE] Proposal ${proposalId} accepted by ${username}`);
      
      // Criar acordo comercial usando countryStateManager integrado
      createTradeAgreement(io, gameState, roomName, {
        type: proposal.type,
        product: proposal.product,
        country: proposal.targetCountry,
        value: proposal.value,
        originCountry: proposal.originCountry,
        originPlayer: proposal.originPlayer || null
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
      console.log(`[TRADE] Proposal ${proposalId} rejected by ${username}`);
      
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

  // Handler para criação de acordos comerciais (compatibilidade)
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
    
    // Criar o acordo comercial (isso atualizará automaticamente as economias via countryStateManager)
    const agreement = createTradeAgreement(io, gameState, roomName, {
      type,
      product,
      country,
      value, 
      originCountry: userCountry,
      originPlayer: username
    });
    
    if (agreement) {
      console.log(`[TRADE] ${username} created agreement: ${type} ${product} with ${country}`);
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
    
    // Cancelar o acordo comercial (isso atualizará automaticamente as economias)
    const success = cancelTradeAgreement(io, gameState, roomName, agreementId, userCountry, socket);
    
    if (success) {
      console.log(`[TRADE] ${username} cancelled trade agreement ${agreementId}`);
    }
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