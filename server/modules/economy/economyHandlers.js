/**
 * economyHandlers.js
 * Socket.io handlers for economic operations
 */

import { performEconomicCalculations } from './economyCalculations.js';
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
        
        // Informar o jogador que enviou que a proposta foi encaminhada
        socket.emit('tradeProposalSent', {
          proposalId,
          targetPlayer,
          message: `Proposal sent to ${targetPlayer}`
        });
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
      
      // Notificar o jogador que aceitou
      socket.emit('tradeProposalProcessed', {
        proposalId,
        accepted: true,
        message: `You accepted the trade proposal from ${proposal.originCountry}`
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
      
      // Notificar o jogador que rejeitou
      socket.emit('tradeProposalProcessed', {
        proposalId,
        accepted: false,
        message: 'You rejected the trade proposal'
      });
      
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