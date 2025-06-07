/**
 * tradeHandlers.js - Handlers para sistema de comércio
 * Código movido EXATAMENTE de economyHandlers.js sem modificações
 */

import { getCurrentRoom } from '../../shared/utils/gameStateUtils.js';
import { evaluateTradeProposal } from '../ai/aiCountryController.js';

/**
 * Setup trade-related socket event handlers
 */
function setupTradeHandlers(io, socket, gameState) {
  console.log('Trade handlers initialized');

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

export { setupTradeHandlers };