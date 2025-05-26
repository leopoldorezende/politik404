/**
 * economyHandlers.js - Handlers simplificados para economia
 * APENAS comunicação WebSocket - lógica delegada para EconomyService
 */

import economyService from '../../shared/services/EconomyService.js';
import { getCurrentRoom, getUsernameFromSocketId } from '../../shared/utils/gameStateUtils.js';
import { evaluateTradeProposal } from '../ai/aiCountryController.js';

/**
 * Setup economy-related socket event handlers
 */
function setupEconomyHandlers(io, socket, gameState) {
  console.log('Economy handlers initialized - delegated to EconomyService');

  // ======================================================================
  // PARÂMETROS ECONÔMICOS
  // ======================================================================
  
  socket.on('updateEconomicParameter', (data) => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    const { parameter, value } = data;
    
    // Validação básica
    if (!['interestRate', 'taxBurden', 'publicServices'].includes(parameter)) {
      socket.emit('error', 'Invalid parameter');
      return;
    }
    
    if (typeof value !== 'number' || value < 0 || value > (parameter === 'interestRate' ? 25 : 60)) {
      socket.emit('error', 'Invalid value');
      return;
    }
    
    // Delegar para EconomyService
    const result = economyService.updateEconomicParameter(roomName, userCountry, parameter, value);
    
    if (result) {
      socket.emit('economicParameterUpdated', {
        roomName, countryName: userCountry, parameter, value, success: true
      });
      
      // Broadcast para sala se mudança significativa
      if (parameter === 'interestRate') {
        socket.to(roomName).emit('economicNews', {
          type: 'interestRate', country: userCountry, value,
          message: `${userCountry} changed interest rate to ${value}%`
        });
      }
    } else {
      socket.emit('error', 'Failed to update parameter');
    }
  });

  // ======================================================================
  // EMISSÃO DE TÍTULOS
  // ======================================================================
  
  socket.on('issueDebtBonds', (data) => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    const { bondAmount } = data;
    
    // Delegar para EconomyService
    const result = economyService.issueDebtBonds(roomName, userCountry, bondAmount);
    
    if (result.success) {
      socket.emit('debtBondsIssued', result);
      
      if (bondAmount >= 50) {
        socket.to(roomName).emit('economicNews', {
          type: 'debtIssuance', country: userCountry, amount: bondAmount,
          message: `${userCountry} issued ${bondAmount} billion in government bonds`
        });
      }
    } else {
      socket.emit('error', result.message);
    }
  });

  // ======================================================================
  // RESUMO DE DÍVIDAS
  // ======================================================================
  
  socket.on('getDebtSummary', () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    // Delegar para EconomyService
    const debtSummary = economyService.getDebtSummary(roomName, userCountry);
    const countryState = economyService.getCountryState(roomName, userCountry);
    
    if (countryState) {
      const economy = countryState.economy;
      
      socket.emit('debtSummaryResponse', {
        totalPublicDebt: economy.publicDebt || 0,
        principalRemaining: debtSummary.principalRemaining,
        totalFuturePayments: debtSummary.totalFuturePayments,
        totalMonthlyPayment: debtSummary.totalMonthlyPayment,
        numberOfContracts: debtSummary.numberOfContracts,
        debtToGdpRatio: ((economy.publicDebt || 0) / (economy.gdp || 100)) * 100,
        canIssueMoreDebt: ((economy.publicDebt || 0) / (economy.gdp || 100)) <= 1.2,
        debtRecords: debtSummary.contracts,
        // Dados econômicos completos para o popup
        economicData: {
          gdp: economy.gdp || 0,
          treasury: economy.treasury || 0,
          publicDebt: economy.publicDebt || 0
        }
      });
    } else {
      socket.emit('error', 'Country data not found');
    }
  });

  // ======================================================================
  // PROPOSTAS COMERCIAIS
  // ======================================================================
  
  socket.on('sendTradeProposal', (proposal) => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    const { type, product, targetCountry, value } = proposal;
    
    // Validação básica
    if (!type || !product || !targetCountry || !value || value <= 0 || value > 1000) {
      socket.emit('error', 'Invalid proposal data');
      return;
    }
    
    if (!['import', 'export'].includes(type) || !['commodity', 'manufacture'].includes(product)) {
      socket.emit('error', 'Invalid trade type or product');
      return;
    }
    
    if (userCountry !== proposal.originCountry) {
      socket.emit('error', 'You can only create proposals for your own country');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    const proposalId = `trade-proposal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const tradeProposal = {
      id: proposalId,
      type, product, targetCountry, value,
      originCountry: userCountry,
      originPlayer: username,
      timestamp: Date.now()
    };
    
    // Verificar se país alvo é controlado por jogador
    const targetPlayer = room.players.find(player => 
      typeof player === 'object' && player.country === targetCountry
    );
    
    if (targetPlayer && targetPlayer.isOnline) {
      // Enviar para jogador humano
      const targetSocketId = gameState.usernameToSocketId?.get(targetPlayer.username);
      const targetSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : null;
      
      if (targetSocket && targetSocket.connected) {
        targetSocket.tradeProposal = tradeProposal;
        targetSocket.emit('tradeProposalReceived', tradeProposal);
      } else {
        socket.emit('error', 'Target player is not online');
      }
    } else {
      // IA decision
      const aiDecision = evaluateTradeProposal(gameState, roomName, tradeProposal);
      
      setTimeout(() => {
        if (aiDecision.accepted) {
          // Criar acordo comercial
          economyService.createTradeAgreement(roomName, {
            type, product, country: targetCountry, value,
            originCountry: userCountry, originPlayer: username
          });
          
          socket.emit('tradeProposalResponse', {
            proposalId, accepted: true, targetCountry,
            message: `${targetCountry} accepted your trade proposal`
          });
        } else {
          socket.emit('tradeProposalResponse', {
            proposalId, accepted: false, targetCountry,
            message: `${targetCountry} rejected your trade proposal`
          });
        }
      }, 1500);
    }
  });
  
  // ======================================================================
  // RESPOSTA A PROPOSTAS
  // ======================================================================
  
  socket.on('respondToTradeProposal', (response) => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    
    if (!username || !roomName) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    const { proposalId, accepted } = response;
    const proposal = socket.tradeProposal;
    
    if (!proposal) {
      socket.emit('error', 'Trade proposal not found');
      return;
    }
    
    if (accepted) {
      // Criar acordo comercial
      economyService.createTradeAgreement(roomName, {
        type: proposal.type,
        product: proposal.product,
        country: proposal.targetCountry,
        value: proposal.value,
        originCountry: proposal.originCountry,
        originPlayer: proposal.originPlayer
      });
      
      // Notificar jogador que enviou proposta
      const originSocketId = gameState.usernameToSocketId?.get(proposal.originPlayer);
      const originSocket = originSocketId ? io.sockets.sockets.get(originSocketId) : null;
      
      if (originSocket && originSocket.connected) {
        originSocket.emit('tradeProposalResponse', {
          proposalId, accepted: true, targetCountry: proposal.targetCountry,
          message: `${proposal.targetCountry} accepted your trade proposal`
        });
      }
    } else {
      // Notificar rejeição
      const originSocketId = gameState.usernameToSocketId?.get(proposal.originPlayer);
      const originSocket = originSocketId ? io.sockets.sockets.get(originSocketId) : null;
      
      if (originSocket && originSocket.connected) {
        originSocket.emit('tradeProposalResponse', {
          proposalId, accepted: false, targetCountry: proposal.targetCountry,
          message: `${proposal.targetCountry} rejected your trade proposal`
        });
      }
    }
    
    delete socket.tradeProposal;
  });

  // ======================================================================
  // CANCELAMENTO DE ACORDOS
  // ======================================================================
  
  socket.on('cancelTradeAgreement', (agreementId) => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    const success = economyService.cancelTradeAgreement(roomName, agreementId);
    
    if (success) {
      socket.emit('tradeAgreementCancelled', agreementId);
      
      // Broadcast acordos atualizados
      const room = gameState.rooms.get(roomName);
      io.to(roomName).emit('tradeAgreementUpdated', {
        agreements: room.tradeAgreements || [],
        timestamp: Date.now()
      });
    } else {
      socket.emit('error', 'Failed to cancel trade agreement');
    }
  });
  
  // ======================================================================
  // OBTER ACORDOS
  // ======================================================================
  
  socket.on('getTradeAgreements', () => {
    const roomName = getCurrentRoom(socket, gameState);
    
    if (!roomName) {
      socket.emit('error', 'Not in a room');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    const agreements = room?.tradeAgreements || [];
    
    socket.emit('tradeAgreementsList', {
      agreements,
      timestamp: Date.now()
    });
  });

  // ======================================================================
  // SUBSCRIÇÃO A ESTADOS DE PAÍS (ESSENCIAL - NÃO PODE SER REMOVIDO)
  // ======================================================================
  
  socket.on('subscribeToCountryStates', (roomName) => {
    const username = socket.username;
    
    if (!username || !gameState.rooms.get(roomName)) {
      socket.emit('error', 'Invalid subscription request');
      return;
    }
    
    console.log(`[ECONOMY] ${username} subscribed to country states for room ${roomName}`);
    
    socket.join(`countryStates:${roomName}`);
    
    // Enviar estados iniciais IMEDIATAMENTE
    const roomStates = economyService.getRoomStates(roomName);
    socket.emit('countryStatesInitialized', {
      roomName,
      states: roomStates,
      timestamp: Date.now()
    });
  });
  
  socket.on('unsubscribeFromCountryStates', (roomName) => {
    console.log(`[ECONOMY] User unsubscribed from country states for room ${roomName}`);
    socket.leave(`countryStates:${roomName}`);
  });
}

/**
 * Função auxiliar para obter país do usuário
 */
function getUserCountry(gameState, roomName, username) {
  if (!roomName || !username) return null;
  
  const userRoomKey = `${username}:${roomName}`;
  return gameState.userRoomCountries.get(userRoomKey) || null;
}

export { setupEconomyHandlers };