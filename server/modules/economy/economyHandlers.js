/**
 * economyHandlers.js - Correção dos métodos do EconomyService
 * CORREÇÃO: Usar métodos que realmente existem no economyService
 */

import { getCurrentRoom, getUsernameFromSocketId } from '../../shared/utils/gameStateUtils.js';
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
    
    if (typeof value !== 'number' || value < 0 || value > (parameter === 'interestRate' ? 25 : 100)) {
      socket.emit('error', 'Invalid parameter value');
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
  // HANDLER PARA RESUMO DE DÍVIDAS (CORRIGIDO - SEM ensureCountryInitialized)
  // ======================================================================
  
  socket.on('getDebtSummary', () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    // Verificar se economyService existe
    if (!global.economyService) {
      socket.emit('error', 'Economy service not available');
      return;
    }
    
    try {
      // CORREÇÃO: Usar getCountryState em vez de ensureCountryInitialized
      const countryState = global.economyService.getCountryState(roomName, userCountry);
      
      if (!countryState) {
        socket.emit('error', 'Country state not found');
        return;
      }
      
      const economy = countryState.economy;
      const debtSummary = global.economyService.getDebtSummary(roomName, userCountry);
      
      socket.emit('debtSummaryResponse', {
        countryName: userCountry,
        roomName,
        totalDebt: economy.publicDebt || 0,
        totalFuturePayments: debtSummary.totalFuturePayments || 0,
        totalMonthlyPayment: debtSummary.totalMonthlyPayment || 0,
        numberOfContracts: debtSummary.numberOfContracts || 0,
        debtToGdpRatio: ((economy.publicDebt || 0) / (economy.gdp || 100)) * 100,
        canIssueMoreDebt: ((economy.publicDebt || 0) / (economy.gdp || 100)) <= 1.2,
        
        // ========== CORREÇÃO APLICADA ==========
        debtRecords: debtSummary.debtRecords || debtSummary.contracts || [],
        
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
      
    } catch (error) {
      console.error('[ECONOMY] Error in getDebtSummary:', error);
      socket.emit('error', 'Failed to retrieve debt summary');
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
  // OBTER RESUMO DE DÍVIDAS ALTERNATIVO (CORRIGIDO)
  // ======================================================================
  
  socket.on('getCountryDebtSummary', () => {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Invalid request');
      return;
    }
    
    // Verificar se economyService existe
    if (!global.economyService) {
      socket.emit('error', 'Economy service not available');
      return;
    }
    
    try {
      // CORREÇÃO: Usar getCountryState em vez de ensureCountryInitialized
      const countryState = global.economyService.getCountryState(roomName, userCountry);
      
      if (!countryState) {
        socket.emit('error', 'Country state not found');
        return;
      }
      
      const economy = countryState.economy;
      const debtSummary = global.economyService.getDebtSummary(roomName, userCountry);
      
      socket.emit('debtSummaryResponse', {
        countryName: userCountry,
        roomName,
        totalDebt: economy.publicDebt || 0,
        totalFuturePayments: debtSummary.totalFuturePayments || 0,
        totalMonthlyPayment: debtSummary.totalMonthlyPayment || 0,
        numberOfContracts: debtSummary.numberOfContracts || 0,
        debtToGdpRatio: ((economy.publicDebt || 0) / (economy.gdp || 100)) * 100,
        canIssueMoreDebt: ((economy.publicDebt || 0) / (economy.gdp || 100)) <= 1.2,
        
        // ========== CORREÇÃO APLICADA TAMBÉM AQUI ==========
        debtRecords: debtSummary.debtRecords || debtSummary.contracts || [],
        
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
      
    } catch (error) {
      console.error('[ECONOMY] Error in getCountryDebtSummary:', error);
      socket.emit('error', 'Failed to retrieve debt summary');
    }
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
      if (global.economyService.initializeCalculatedValues) {
        global.economyService.initializeCalculatedValues(countryState.economy);
      }
      
      // Salvar estado atualizado
      if (global.economyService.setCountryState) {
        global.economyService.setCountryState(roomName, userCountry, countryState);
      }
      
      socket.emit('emergencyResetComplete', { 
        message: 'Country economic indicators reset to realistic values',
        roomName,
        countryName: userCountry
      });
    } else {
      socket.emit('error', 'Country state not found');
    }
  });
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