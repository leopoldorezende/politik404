/**
 * allianceHandlers.js - Handlers para sistema de alianças militares
 * Código movido EXATAMENTE de economyHandlers.js sem modificações
 */

import { getCurrentRoom } from '../../shared/utils/gameStateUtils.js';

/**
 * Setup alliance-related socket event handlers
 */
function setupAllianceHandlers(io, socket, gameState) {
  console.log('Alliance handlers initialized');

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
      
      // Cancelar ambos os cards da aliança
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
        // ✅ CORREÇÃO: Encontrar o jogador do país alvo para notificar
        const room = gameState.rooms.get(roomName);
        const targetPlayer = room?.players?.find(player => 
          typeof player === 'object' && player.country === targetCountry
        );
        
        // ✅ CORREÇÃO: Notificar APENAS o outro jogador da aliança
        if (targetPlayer && targetPlayer.isOnline) {
          const targetSocketId = gameState.usernameToSocketId?.get(targetPlayer.username);
          const targetSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : null;
          
          if (targetSocket && targetSocket.connected) {
            targetSocket.emit('militaryAllianceCancelled', {
              cancelledBy: userCountry,
              message: `${userCountry} cancelou a aliança militar com você.`
            });
          }
        }
        
        // Para quem cancelou, apenas confirmação simples
        socket.on('allianceCancelConfirmed', (data) => {
          console.log('Alliance cancel confirmed:', data);
          
        });
        
        // Atualizar cards para toda a sala (interface apenas)
        io.to(roomName).emit('cardsUpdated', {
          roomName: roomName,
          action: 'cancelled',
          cardType: 'military_alliance',
          countries: [userCountry, targetCountry],
          silent: true // Não mostrar toast, apenas atualizar interface
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

export { setupAllianceHandlers };