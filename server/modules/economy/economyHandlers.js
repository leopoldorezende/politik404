/**
 * economyHandlers.js - Handlers para economia com cálculos avançados
 * APENAS comunicação WebSocket - lógica delegada para EconomyService expandido
 * VERSÃO ATUALIZADA para integrar com os cálculos sofisticados
 */

import { getCurrentRoom, getUsernameFromSocketId } from '../../shared/utils/gameStateUtils.js';
import { evaluateTradeProposal } from '../ai/aiCountryController.js';
import { ECONOMIC_CONSTANTS } from '../../shared/utils/economicConstants.js';
import { 
  debugAdvancedEconomicCalculations, 
  validateEconomicCalculations,
  resetUnrealisticIndicators 
} from '../../shared/utils/economicCalculations.js';

/**
 * Setup economy-related socket event handlers com cálculos avançados
 */
function setupEconomyHandlers(io, socket, gameState) {
  console.log('Economy handlers initialized - delegated to Advanced EconomyService');

  // ======================================================================
  // PARÂMETROS ECONÔMICOS (PRESERVADO COM CÁLCULOS AVANÇADOS)
  // ======================================================================
  
  socket.on('updateEconomicParameter', (data) => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      console.error(`[ECONOMY] Invalid request - missing data: username=${username}, roomName=${roomName}, userCountry=${userCountry}`);
      socket.emit('error', 'Invalid request - missing authentication or room data');
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
    
    // Verificar se economyService existe
    if (!global.economyService) {
      socket.emit('error', 'Economy service not available');
      return;
    }
    
    // Verificar se economyService está inicializado
    if (!global.economyService.initialized) {
      socket.emit('error', 'Economy service not initialized');
      return;
    }
    
    // Tentar atualizar o parâmetro (agora usa cálculos avançados automaticamente)
    try {
      const result = global.economyService.updateEconomicParameter(roomName, userCountry, parameter, value);
      
      if (result) {
        socket.emit('economicParameterUpdated', {
          roomName, 
          countryName: userCountry, 
          parameter, 
          value, 
          success: true
        });
        
        // Broadcast para sala se mudança significativa
        if (parameter === 'interestRate') {
          socket.to(roomName).emit('economicNews', {
            type: 'interestRate', 
            country: userCountry, 
            value,
            message: `${userCountry} changed interest rate to ${value}%`
          });
        }
      } else {
        console.error(`[ECONOMY] Failed to update parameter - global.economyService returned null/false`);
        socket.emit('error', 'Failed to update parameter - service error');
      }
    } catch (error) {
      console.error(`[ECONOMY] Error updating parameter:`, error);
      socket.emit('error', 'Failed to update parameter - internal error');
    }
  });

  // ======================================================================
  // EMISSÃO DE TÍTULOS (PRESERVADO COM SISTEMA EXPANDIDO)
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
    
    // Delegar para EconomyService (agora com sistema de rating avançado)
    const result = global.economyService.issueDebtBonds(roomName, userCountry, bondAmount);
    
    if (result.success) {
      socket.emit('debtBondsIssued', result);
      
      if (bondAmount >= 50) {
        socket.to(roomName).emit('economicNews', {
          type: 'debtIssuance', 
          country: userCountry, 
          amount: bondAmount,
          effectiveRate: result.effectiveRate,
          message: `${userCountry} issued ${bondAmount} billion in government bonds at ${result.effectiveRate.toFixed(2)}% rate`
        });
      }
    } else {
      socket.emit('error', result.message);
    }
  });

  // ======================================================================
  // RESUMO DE DÍVIDAS (PRESERVADO COM DADOS EXPANDIDOS)
  // ======================================================================
    
  socket.on('getDebtSummary', () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    // Verificação adicional: Garantir que o país existe no EconomyService
    if (!global.economyService) {
      socket.emit('error', 'Economy service not available');
      return;
    }
    
    const countryState = global.economyService.getCountryState(roomName, userCountry);
    if (!countryState) {
      console.error(`[ECONOMY] Country state not found for ${userCountry} in room ${roomName}`);
      
      // Tentar inicializar o país se a sala existe mas o país não
      if (gameState.countriesData && gameState.countriesData[userCountry]) {
        console.log(`[ECONOMY] Attempting to initialize missing country: ${userCountry}`);
        global.economyService.initializeRoom(roomName, { [userCountry]: gameState.countriesData[userCountry] });
        
        // Tentar novamente após inicialização
        const retryCountryState = global.economyService.getCountryState(roomName, userCountry);
        if (!retryCountryState) {
          socket.emit('error', 'Failed to initialize country data');
          return;
        }
      } else {
        socket.emit('error', 'Country data not found');
        return;
      }
    }
    
    // Prosseguir com a lógica normal (agora com dados expandidos)
    const debtSummary = global.economyService.getDebtSummary(roomName, userCountry);
    const finalCountryState = global.economyService.getCountryState(roomName, userCountry);
    
    if (finalCountryState) {
      const economy = finalCountryState.economy;
      
      socket.emit('debtSummaryResponse', {
        totalPublicDebt: economy.publicDebt || 0,
        principalRemaining: debtSummary.principalRemaining,
        totalFuturePayments: debtSummary.totalFuturePayments,
        totalMonthlyPayment: debtSummary.totalMonthlyPayment,
        numberOfContracts: debtSummary.numberOfContracts,
        debtToGdpRatio: ((economy.publicDebt || 0) / (economy.gdp || 100)) * 100,
        canIssueMoreDebt: ((economy.publicDebt || 0) / (economy.gdp || 100)) <= 1.2,
        debtRecords: debtSummary.contracts,
        // Dados econômicos expandidos para o popup
        economicData: {
          gdp: economy.gdp || 0,
          treasury: economy.treasury || 0,
          publicDebt: economy.publicDebt || 0,
          creditRating: economy.creditRating || 'A',
          gdpGrowth: economy.gdpGrowth || 0,
          cycleCount: economy._cycleCount || 0
        }
      });
    } else {
      socket.emit('error', 'Failed to retrieve country data after initialization');
    }
  });

  // ======================================================================
  // PROPOSTAS COMERCIAIS (PRESERVADO COM CÁLCULOS AVANÇADOS)
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
      // IA decision (agora considera cálculos avançados)
      const aiDecision = evaluateTradeProposal(gameState, roomName, tradeProposal);
      
      setTimeout(() => {
        if (aiDecision.accepted) {
          // Criar acordo comercial (recalculará automaticamente com cálculos avançados)
          global.economyService.createTradeAgreement(roomName, {
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
  // RESPOSTA A PROPOSTAS (PRESERVADO)
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
      // Criar acordo comercial (agora com recálculos avançados automáticos)
      global.economyService.createTradeAgreement(roomName, {
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
  // CANCELAMENTO DE ACORDOS (PRESERVADO)
  // ======================================================================
  
  socket.on('cancelTradeAgreement', (agreementId) => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    const success = global.economyService.cancelTradeAgreement(roomName, agreementId);
    
    if (success) {
      socket.emit('tradeAgreementCancelled', agreementId);
      
      // Broadcast acordos atualizados (recálculos avançados automáticos)
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
  // OBTER ACORDOS (PRESERVADO)
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
  // SUBSCRIÇÃO A ESTADOS DE PAÍS (ESSENCIAL - PRESERVADO)
  // ======================================================================
  
  socket.on('subscribeToCountryStates', (roomName) => {
    const username = socket.username;
    
    if (!username || !gameState.rooms.get(roomName)) {
      socket.emit('error', 'Invalid subscription request');
      return;
    }
    
    socket.join(`countryStates:${roomName}`);
    
    // Enviar estados iniciais IMEDIATAMENTE (agora com dados avançados)
    const roomStates = global.economyService.getRoomStates(roomName);
    socket.emit('countryStatesInitialized', {
      roomName,
      states: roomStates,
      timestamp: Date.now()
    });
  });
  
  socket.on('unsubscribeFromCountryStates', (roomName) => {
    socket.leave(`countryStates:${roomName}`);
  });

  // ======================================================================
  // NOVOS ENDPOINTS PARA CÁLCULOS AVANÇADOS
  // ======================================================================

  /**
   * Debug dos cálculos avançados (apenas em desenvolvimento)
   */
  socket.on('debugAdvancedCalculations', (data) => {
    if (process.env.NODE_ENV !== 'development') {
      socket.emit('error', 'Debug endpoint only available in development');
      return;
    }

    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }

    // MUDANÇA: Usar função importada em vez de método do service
    const countryState = global.economyService.getCountryState(roomName, userCountry);
    if (countryState) {
      debugAdvancedEconomicCalculations(userCountry, countryState.economy);
      socket.emit('debugResponse', { 
        message: 'Debug information logged to server console',
        roomName,
        countryName: userCountry
      });
    } else {
      socket.emit('error', 'Country state not found');
    }
  });

  /**
   * Obter estatísticas de performance dos cálculos
   */
  socket.on('getEconomyPerformanceStats', () => {
    if (global.economyService && global.economyService.getPerformanceStats) {
      const stats = global.economyService.getPerformanceStats();
      socket.emit('economyPerformanceStats', stats);
    } else {
      socket.emit('error', 'Performance stats not available');
    }
  });

  /**
   * Validar cálculos econômicos de um país
   */
  socket.on('validateEconomicCalculations', () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }

    // MUDANÇA: Usar função importada em vez de método do service
    const countryState = global.economyService.getCountryState(roomName, userCountry);
    if (countryState) {
      const validation = validateEconomicCalculations(countryState.economy);
      socket.emit('economicValidationResult', {
        countryName: userCountry,
        roomName,
        ...validation
      });
    } else {
      socket.emit('error', 'Country state not found');
    }
  });

  /**
   * Forçar recálculo completo (apenas para desenvolvimento/debug)
   */
  socket.on('forceRecalculation', () => {
    if (process.env.NODE_ENV !== 'development') {
      socket.emit('error', 'Force recalculation only available in development');
      return;
    }

    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }

    if (global.economyService && global.economyService.performAdvancedEconomicCalculations) {
      global.economyService.performAdvancedEconomicCalculations(roomName, userCountry);
      socket.emit('recalculationComplete', { 
        message: 'Advanced calculations forced for country',
        roomName,
        countryName: userCountry
      });
    } else {
      socket.emit('error', 'Force recalculation not available');
    }
  });

  /**
   * Resetar indicadores irreais de emergência (desenvolvimento)
   */
  socket.on('emergencyResetCountry', () => {
    if (process.env.NODE_ENV !== 'development') {
      socket.emit('error', 'Emergency reset only available in development');
      return;
    }

    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }

    // MUDANÇA: Usar função importada + método do service para salvar
    const countryState = global.economyService.getCountryState(roomName, userCountry);
    if (countryState) {
      // Aplicar reset usando função importada
      resetUnrealisticIndicators(countryState.economy);
      
      // Recalcular valores iniciais usando método do service
      global.economyService.initializeCalculatedValues(countryState.economy);
      
      // Salvar estado atualizado
      global.economyService.setCountryState(roomName, userCountry, countryState);
      
      socket.emit('emergencyResetComplete', { 
        message: 'Country economic indicators reset to realistic values',
        roomName,
        countryName: userCountry
      });
    } else {
      socket.emit('error', 'Country state not found');
    }
  });



  // ======================================================================
  // Endpoints para Cards
  // ======================================================================

  /**
   * Obter todos os cards de um jogador
   */
  socket.on('getPlayerCards', () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    if (!global.cardService || !global.cardService.initialized) {
      socket.emit('error', 'Card service not available');
      return;
    }
    
    try {
      const playerCards = global.cardService.getCardsByOwner(roomName, userCountry);
      const totalPoints = global.cardService.calculatePlayerPoints(roomName, userCountry);
      
      socket.emit('playerCardsResponse', {
        roomName: roomName,
        country: userCountry,
        cards: playerCards,
        totalPoints: totalPoints,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[CARDS] Error getting player cards:', error);
      socket.emit('error', 'Failed to get player cards');
    }
  });

  /**
   * Obter pontuação de um jogador
   */
  socket.on('getPlayerPoints', () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    if (!global.cardService || !global.cardService.initialized) {
      socket.emit('error', 'Card service not available');
      return;
    }
    
    try {
      const totalPoints = global.cardService.calculatePlayerPoints(roomName, userCountry);
      const cardsByType = {};
      
      // Contar cards por tipo
      const playerCards = global.cardService.getCardsByOwner(roomName, userCountry);
      playerCards.forEach(card => {
        if (!cardsByType[card.type]) {
          cardsByType[card.type] = 0;
        }
        cardsByType[card.type]++;
      });
      
      socket.emit('playerPointsResponse', {
        roomName: roomName,
        country: userCountry,
        totalPoints: totalPoints,
        cardsByType: cardsByType,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[CARDS] Error getting player points:', error);
      socket.emit('error', 'Failed to get player points');
    }
  });

  /**
   * Obter ranking de jogadores
   */
  socket.on('getPlayerRanking', () => {
    const roomName = getCurrentRoom(socket, gameState);
    
    if (!roomName) {
      socket.emit('error', 'Not in a room');
      return;
    }
    
    if (!global.cardService || !global.cardService.initialized) {
      socket.emit('error', 'Card service not available');
      return;
    }
    
    try {
      const ranking = global.cardService.getPlayerRanking(roomName);
      
      // Enriquecer ranking com informações dos jogadores
      const room = gameState.rooms.get(roomName);
      const enrichedRanking = ranking.map(playerScore => {
        const player = room?.players?.find(p => 
          typeof p === 'object' && p.country === playerScore.owner
        );
        
        return {
          ...playerScore,
          playerName: player?.username || null,
          isHuman: !!player,
          isOnline: player?.isOnline || false
        };
      });
      
      socket.emit('playerRankingResponse', {
        roomName: roomName,
        ranking: enrichedRanking,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[CARDS] Error getting player ranking:', error);
      socket.emit('error', 'Failed to get player ranking');
    }
  });

  /**
   * Obter estatísticas do serviço de cards (debug)
   */
  socket.on('getCardServiceStats', () => {
    if (process.env.NODE_ENV !== 'development') {
      socket.emit('error', 'Card service stats only available in development');
      return;
    }
    
    if (!global.cardService || !global.cardService.initialized) {
      socket.emit('error', 'Card service not available');
      return;
    }
    
    try {
      const stats = global.cardService.getStats();
      socket.emit('cardServiceStatsResponse', stats);
    } catch (error) {
      console.error('[CARDS] Error getting card service stats:', error);
      socket.emit('error', 'Failed to get card service stats');
    }
  });


  // ======================================================================
  // PROPOSTAS DE ALIANÇA MILITAR (NOVO - SEGUINDO PADRÃO DE COMÉRCIO)
  // ======================================================================
  
  socket.on('sendAllianceProposal', (proposal) => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    const { type, targetCountry, originCountry } = proposal;
    
    // Validação básica
    if (!type || !targetCountry || type !== 'military_alliance') {
      socket.emit('error', 'Invalid alliance proposal data');
      return;
    }
    
    // Verificar consistência do país de origem
    if (originCountry && originCountry !== userCountry) {
      socket.emit('error', 'Origin country mismatch');
      return;
    }
    
    if (userCountry === targetCountry) {
      socket.emit('error', 'Cannot create alliance with yourself');
      return;
    }
    
    // Verificar se já existe aliança militar para o país de origem
    if (global.cardService) {
      const existingAlliances = global.cardService.getCardsByType(roomName, 'military_alliance');
      const hasExistingAlliance = existingAlliances.some(card => 
        card.owner === userCountry && card.status === 'active'
      );
      
      if (hasExistingAlliance) {
        socket.emit('error', 'You already have an active military alliance. Cancel it first to create a new one.');
        return;
      }
    }
    
    const room = gameState.rooms.get(roomName);
    const proposalId = `alliance-proposal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const allianceProposal = {
      id: proposalId,
      type,
      targetCountry,
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
        targetSocket.allianceProposal = allianceProposal;
        targetSocket.emit('allianceProposalReceived', allianceProposal);
      } else {
        socket.emit('error', 'Target player is not online');
      }
    } else {
      // IA decision - 50% de chance como solicitado
      const aiAccepted = Math.random() < 0.5;
      
      setTimeout(() => {
        if (aiAccepted) {
          // Criar aliança militar
          const success = createMilitaryAlliance(roomName, userCountry, targetCountry, username);
          
          if (success) {
            socket.emit('allianceProposalResponse', {
              proposalId, 
              accepted: true, 
              targetCountry,
              message: `${targetCountry} accepted your military alliance proposal`
            });
          } else {
            socket.emit('allianceProposalResponse', {
              proposalId, 
              accepted: false, 
              targetCountry,
              message: `Failed to create alliance due to existing constraints`
            });
          }
        } else {
          socket.emit('allianceProposalResponse', {
            proposalId, 
            accepted: false, 
            targetCountry,
            message: `${targetCountry} rejected your military alliance proposal`
          });
        }
      }, 1500);
    }
  });
  
  // ======================================================================
  // RESPOSTA A PROPOSTAS DE ALIANÇA (NOVO)
  // ======================================================================
  socket.on('respondToAllianceProposal', (response) => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    
    if (!username || !roomName) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    const { proposalId, accepted } = response;
    const proposal = socket.allianceProposal;
    
    if (!proposal) {
      socket.emit('error', 'Alliance proposal not found');
      return;
    }
    
    if (accepted) {
      // Criar aliança militar
      const success = createMilitaryAlliance(roomName, proposal.originCountry, proposal.targetCountry, proposal.originPlayer);
      
      if (success) {
        // Notificar jogador que enviou proposta
        const originSocketId = gameState.usernameToSocketId?.get(proposal.originPlayer);
        const originSocket = originSocketId ? io.sockets.sockets.get(originSocketId) : null;
        
        if (originSocket && originSocket.connected) {
          originSocket.emit('allianceProposalResponse', {
            proposalId, 
            accepted: true, 
            targetCountry: proposal.targetCountry,
            message: `${proposal.targetCountry} accepted your military alliance proposal`
          });
        }
      } else {
        socket.emit('error', 'Failed to create alliance due to existing constraints');
      }
    } else {
      // Notificar rejeição
      const originSocketId = gameState.usernameToSocketId?.get(proposal.originPlayer);
      const originSocket = originSocketId ? io.sockets.sockets.get(originSocketId) : null;
      
      if (originSocket && originSocket.connected) {
        originSocket.emit('allianceProposalResponse', {
          proposalId, 
          accepted: false, 
          targetCountry: proposal.targetCountry,
          message: `${proposal.targetCountry} rejected your military alliance proposal`
        });
      }
    }
    
    delete socket.allianceProposal;
  });


  // ======================================================================
  // EVENTOS DE ALIANÇA MILITAR (NOVO - SEGUINDO PADRÃO DE COMÉRCIO)
  // ======================================================================
  
  socket.on('allianceProposalReceived', (proposal) => {
    console.log('Proposta de aliança militar recebida:', proposal);
    
    // ✅ Debounce para evitar múltiplas notificações de propostas
    clearTimeout(proposalTimeout);
    proposalTimeout = setTimeout(() => {
      if (window.Audio) {
        try {
          const notificationSound = new Audio('/notification.mp3');
          notificationSound.play().catch(() => {});
        } catch (error) {
          console.debug('Som de notificação não disponível');
        }
      }
      if (isInGamePage()) {
        const { originCountry } = proposal;
        
        // ✅ Usar função com cooldown para evitar toasts duplicados
        showNotificationWithCooldown(
          'info',
          `${originCountry} propõe uma aliança militar com você!`,
          4000
        );
      } else {
        console.log('[TOAST BLOCKED] Alliance proposal notification blocked - not in game page');
      }
    }, 100); // Pequeno delay para agrupar eventos
  });
  

  socket.on('allianceProposalResponse', (response) => {
    console.log('Resposta à proposta de aliança militar recebida:', response);
    
    // ✅ Debounce para evitar múltiplas notificações de resposta
    clearTimeout(responseTimeout);
    responseTimeout = setTimeout(() => {
      
      if (!isInGamePage()) {
        console.log('[TOAST BLOCKED] Alliance response notification blocked - not in game page');
        return;
      }
      
      const { accepted, targetCountry } = response;
      
      if (accepted) {
        showNotificationWithCooldown(
          'success',
          `${targetCountry} aceitou sua proposta de aliança militar!`,
          4000
        );
      } else {
        showNotificationWithCooldown(
          'warning',
          `${targetCountry} recusou sua proposta de aliança militar.`,
          4000
        );
      }
    }, 100);
  });


  socket.on('allianceProposalProcessed', (response) => {
    console.log('Proposta de aliança militar processada:', response);
    
    const { accepted } = response;
    
    if (accepted) {
      MessageService.showSuccess('Você aceitou a proposta de aliança militar.');
    } else {
      MessageService.showInfo('Você recusou a proposta de aliança militar.');
    }
  });


// ======================================================================
  // CANCELAMENTO DE ALIANÇA MILITAR (ATUALIZADO COM COOLDOWN)
  // ======================================================================
  
  socket.on('cancelMilitaryAlliance', (cardId) => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    if (!global.cardService || !global.cardService.initialized) {
      socket.emit('error', 'Card service not available');
      return;
    }
    
    try {
      // Encontrar o card da aliança
      const roomCards = global.cardService.getCardsByRoom(roomName);
      const allianceCard = roomCards.find(card => card.id === cardId);
      
      if (!allianceCard || allianceCard.type !== 'military_alliance') {
        socket.emit('error', 'Military alliance card not found');
        return;
      }
      
      // Verificar se o usuário é o dono do card
      if (allianceCard.owner !== userCountry) {
        socket.emit('error', 'You can only cancel your own military alliances');
        return;
      }
      
      const targetCountry = allianceCard.target;
      
      // Cancelar ambos os cards da aliança (duplo)
      const allAllianceCards = roomCards.filter(card => 
        card.type === 'military_alliance' &&
        ((card.owner === userCountry && card.target === targetCountry) ||
         (card.owner === targetCountry && card.target === userCountry))
      );
      
      let cancelledCount = 0;
      allAllianceCards.forEach(card => {
        const success = global.cardService.cancelCard(roomName, card.id);
        if (success) {
          cancelledCount++;
        }
      });
      
      if (cancelledCount > 0) {
        // ✅ NOVO: Iniciar cooldown de 1 minuto para novas propostas
        const cooldownTimestamp = Date.now();
        socket.emit('militaryAllianceCancelled', {
          cardId,
          targetCountry,
          cooldownTimestamp, // Enviar timestamp para sincronizar cooldown
          message: `Military alliance with ${targetCountry} has been cancelled. You must wait 1 minute before proposing a new alliance.`
        });
        
        // Broadcast atualização de cards
        io.to(roomName).emit('cardsUpdated', {
          roomName: roomName,
          action: 'cancelled',
          cardType: 'military_alliance',
          countries: [userCountry, targetCountry]
        });
        
        console.log(`[ALLIANCE] Military alliance cancelled between ${userCountry} and ${targetCountry}. Cooldown initiated.`);
      } else {
        socket.emit('error', 'Failed to cancel military alliance');
      }
    } catch (error) {
      console.error('[ALLIANCE] Error cancelling military alliance:', error);
      socket.emit('error', 'Failed to cancel military alliance');
    }
  });
}



/**
 * Função auxiliar para criar aliança militar
 * @param {string} roomName - Nome da sala
 * @param {string} country1 - Primeiro país
 * @param {string} country2 - Segundo país
 * @param {string} originPlayer - Jogador que iniciou
 * @returns {boolean} - Sucesso da operação
 */
function createMilitaryAlliance(roomName, country1, country2, originPlayer) {
  if (!global.cardService || !global.cardService.initialized) {
    console.error('[ALLIANCE] CardService not available');
    return false;
  }
  
  try {
    // Verificar se ambos os países já têm alianças ativas
    const existingAlliances = global.cardService.getCardsByType(roomName, 'military_alliance');
    
    const country1HasAlliance = existingAlliances.some(card => 
      card.owner === country1 && card.status === 'active'
    );
    const country2HasAlliance = existingAlliances.some(card => 
      card.owner === country2 && card.status === 'active'
    );
    
    if (country1HasAlliance || country2HasAlliance) {
      console.log(`[ALLIANCE] Cannot create alliance - one of the countries already has an active alliance`);
      return false;
    }
    
    // Criar cards para ambos os países
    const card1 = global.cardService.createCard(roomName, {
      type: 'military_alliance',
      owner: country1,
      target: country2,
      value: 0,
      metadata: {
        allianceType: 'military',
        player: originPlayer,
        agreementType: 'alliance'
      }
    });
    
    const card2 = global.cardService.createCard(roomName, {
      type: 'military_alliance',
      owner: country2,
      target: country1,
      value: 0,
      metadata: {
        allianceType: 'military',
        player: null, // País alvo pode ser IA
        agreementType: 'alliance'
      }
    });
    
    console.log(`[ALLIANCE] Military alliance created between ${country1} and ${country2}`);
    
    // Notificar criação de cards se necessário
    if (global.io) {
      global.io.to(roomName).emit('cardsUpdated', {
        roomName: roomName,
        action: 'created',
        cards: [card1, card2].map(card => ({
          id: card.id,
          type: card.type,
          owner: card.owner,
          points: card.points
        }))
      });
    }
    
    return true;
  } catch (error) {
    console.error('[ALLIANCE] Error creating military alliance:', error);
    return false;
  }
}

/**
 * Função auxiliar para obter país do usuário (PRESERVADA)
 */
function getUserCountry(gameState, roomName, username) {
  if (!roomName || !username) return null;
  
  const room = gameState.rooms.get(roomName);
  if (!room || !room.players) return null;
  
  const player = room.players.find(p => {
    if (typeof p === 'object') {
      return p.username === username;
    }
    return false;
  });
  
  const country = player?.country || null;
  return country;
}

export { setupEconomyHandlers };

