// client/src/services/socketEventHandlers.js - Simplificado

import { store } from '../store';
import { setRooms, setCurrentRoom, leaveRoom } from '../modules/room/roomState';
import { setMyCountry, setPlayers, setPlayerOnlineStatus, setOnlinePlayers } from '../modules/game/gameState';
import { addMessage, setChatHistory } from '../modules/chat/chatState';
import authMutex from './authMutex.js';
import StorageService from './storageService.js';

import {
  addTradeAgreement,
  removeTradeAgreement,
  resetTradeState,
  updateStats
} from '../modules/trade/tradeState';
import { 
  setReconnectAttempts, 
  incrementReconnectAttempts,
  setIsJoiningRoom,
  getIsJoiningRoom,
  getMaxReconnectAttempts
} from './socketConnection';

// Import do serviço de mensagens para mostrar toasts
import MessageService from '../ui/toast/messageService';

// Controle de autenticação centralizado no authMutex
let isAuthenticated = false;
let authenticationInProgress = false;

// ✅ CORREÇÃO 1: Rate limiting para notificações duplicadas
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 1000; // 1 segundo entre notificações similares

const showNotificationWithCooldown = (type, message, duration = 4000) => {
  const now = Date.now();
  if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) {
    console.log(`[NOTIFICATION] Blocked duplicate: ${message}`);
    return;
  }
  
  lastNotificationTime = now;
  
  if (type === 'success') {
    MessageService.showSuccess(message, duration);
  } else if (type === 'warning') {
    MessageService.showWarning(message, duration);
  } else if (type === 'error') {
    MessageService.showError(message, duration);
  } else {
    MessageService.showInfo(message, duration);
  }
};

// Configurar todos os eventos do socket - SIMPLIFICADO
export const setupSocketEvents = (socket, socketApi) => {
  if (!socket) return;
  
  // ✅ CORREÇÃO 2: Lista completa de eventos para limpeza garantida
  const eventsToClean = [
    'connect', 'disconnect', 'connect_error', 'authenticated', 'authenticationIgnored',
    'roomsList', 'roomJoined', 'roomLeft', 'roomCreated', 'roomDeleted',
    'chatMessage', 'chatHistory', 'playersList', 'playerOnlineStatus',
    'countryAssigned', 'stateRestored',
    'tradeProposalReceived', 'tradeProposalResponse', 'tradeProposalProcessed',
    'tradeAgreementCancelled', 'tradeAgreementsList', 'tradeAgreementUpdated',
    'debtBondsIssued', 'economicParameterUpdated', 'debtSummaryResponse',
    'emergencyBondsIssued', 'countryStatesUpdated', 'countryStatesInitialized',
    'error', 'pong'
  ];
  
  // ✅ Garantir limpeza completa usando removeAllListeners
  eventsToClean.forEach(eventName => {
    socket.removeAllListeners(eventName);
  });
  
  // Reset de variáveis de controle
  isAuthenticated = false;
  authenticationInProgress = false;
  
  // ✅ CORREÇÃO 3: Timeouts para debounce de eventos duplicados
  let proposalTimeout;
  let responseTimeout;
  let emergencyTimeout;
  
  // ======================================================================
  // EVENTOS BASE DO SOCKET
  // ======================================================================
  
  socket.on('connect', () => {
    console.log('Conectado ao servidor socket com ID:', socket.id);
    setReconnectAttempts(0);
    setIsJoiningRoom(false);
    
    const username = StorageService.get(StorageService.KEYS.USERNAME);

    if (username && !isAuthenticated) {
      console.log('Reautenticando usuário após conexão:', username);
      
      authMutex.executeAuth(async () => {
        if (!isAuthenticated) {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          socket.emit('authenticate', username, { 
            clientSessionId: StorageService.get(StorageService.KEYS.CLIENT_SESSION_ID),
            reconnect: true
          });
          
          return true;
        }
        return false;
      }).catch(error => {
        console.error('Authentication error:', error.message);
      });
    }
  });
  
  socket.io.on("reconnect_attempt", (attempt) => {
    console.log(`Tentativa de reconexão #${attempt}`);
    setReconnectAttempts(attempt);
    isAuthenticated = false;
    authenticationInProgress = false;
  });
  
  socket.io.on("reconnect", (attempt) => {
    console.log(`Reconectado com sucesso após ${attempt} tentativas`);
    setIsJoiningRoom(false);
    isAuthenticated = false;
    authenticationInProgress = false;
    
    const username = sessionStorage.getItem('username');
    if (username) {
      console.log('Reautenticando após reconexão:', username);
      
      setTimeout(() => {
        if (!isAuthenticated && authenticationInProgress) {
          socket.emit('authenticate', username, { 
            clientSessionId: sessionStorage.getItem('clientSessionId'),
            reconnect: true
          });
        }
        
        setTimeout(() => {
          if (isAuthenticated) {
            socket.emit('getRooms');
          }
        }, 1000);
      }, 1500);
    }
  });
  
  socket.on('connect_error', (error) => {
    console.error('Erro de conexão ao socket:', error.message);
    incrementReconnectAttempts();
    setIsJoiningRoom(false);
    isAuthenticated = false;
    authenticationInProgress = false;
    
    if (incrementReconnectAttempts() >= getMaxReconnectAttempts()) {
      console.error(`Falha após ${getMaxReconnectAttempts()} tentativas. Desistindo.`);
      store.dispatch({
        type: 'error/connectionFailed',
        payload: 'Não foi possível conectar ao servidor. Tente novamente mais tarde.'
      });
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Desconectado do servidor. Motivo:', reason);
    setIsJoiningRoom(false);
    isAuthenticated = false;
    
    if (reason === 'io server disconnect' || reason === 'transport close') {
      setTimeout(() => {
        console.log('Tentando reconectar após desconexão do servidor...');
        socket.connect();
      }, 2000);
    }
  });
  
  // ======================================================================
  // EVENTOS DE AUTENTICAÇÃO E SALAS
  // ======================================================================
  
  socket.on('authenticated', (data) => {
    console.log('Autenticação bem-sucedida:', data);
    isAuthenticated = true;
    
    const pendingRoom = StorageService.get(StorageService.KEYS.PENDING_ROOM);
    if (pendingRoom && !getIsJoiningRoom()) {
      setTimeout(() => {
        console.log('Retomando entrada na sala após autenticação:', pendingRoom);
        socketApi.joinRoom(pendingRoom);
      }, 1000);
    } else {
      setTimeout(() => {
        console.log('Solicitando lista de salas após autenticação');
        socket.emit('getRooms');
      }, 500);
    }
  });
  
  socket.on('authenticationIgnored', (data) => {
    console.log('Autenticação ignorada pelo servidor:', data);
    isAuthenticated = true;
    
    setTimeout(() => {
      socket.emit('getRooms');
    }, 500);
  });
  
  socket.on('roomsList', (rooms) => {
    console.log('Recebida lista de salas:', rooms);
    store.dispatch(setRooms(rooms));
  });
  
  socket.on('roomJoined', (room) => {
    console.log('Entrou na sala:', room);
    setIsJoiningRoom(false);
    StorageService.remove(StorageService.KEYS.PENDING_ROOM);
    store.dispatch(setCurrentRoom(room));
  });
  
  socket.on('roomLeft', () => {
    console.log('Saiu da sala');
    setIsJoiningRoom(false);
    store.dispatch(leaveRoom());
    store.dispatch(resetTradeState());
  });
  
  socket.on('roomCreated', (data) => {
    console.log('Sala criada:', data);
    if (data.success) {
      socket.emit('getRooms');
    }
  });

  socket.on('roomDeleted', (data) => {
    console.log('Sala deletada:', data);
    store.dispatch(leaveRoom());
    store.dispatch(resetTradeState());
    
    if (data.message) {
      MessageService.showWarning(data.message, 4000);
    }
  });
  
  // ======================================================================
  // EVENTOS DE CHAT
  // ======================================================================
  
  socket.on('chatMessage', (message) => {
    console.log('Mensagem de chat recebida:', message);
    store.dispatch(addMessage(message));
  });
  
  socket.on('chatHistory', (data) => {
    console.log('Histórico de chat recebido:', data);
    store.dispatch(setChatHistory(data));
  });
  
  // ======================================================================
  // EVENTOS DE JOGADORES
  // ======================================================================
  
  socket.on('playersList', (players) => {
    console.log('Lista de jogadores recebida:', players);
    store.dispatch(setPlayers(players));
    
    const onlinePlayers = players
      .map(player => {
        if (typeof player === 'object' && player.username) {
          return player.username;
        }
        
        if (typeof player === 'string') {
          const match = player.match(/^(.*?)\s*\(/);
          return match ? match[1] : player;
        }
        
        return '';
      })
      .filter(Boolean);
    
    store.dispatch(setOnlinePlayers(onlinePlayers));
  });
  
  socket.on('playerOnlineStatus', ({ username, isOnline }) => {
    console.log(`Jogador ${username} agora está ${isOnline ? 'online' : 'offline'}`);
    store.dispatch(setPlayerOnlineStatus({ username, isOnline }));
  });
  
  socket.on('countryAssigned', (country) => {
    console.log('País atribuído:', country);
    store.dispatch(setMyCountry(country));
    sessionStorage.setItem('myCountry', country);
  });
  
  socket.on('stateRestored', (state) => {
    console.log('Estado restaurado:', state);
    if (state && state.country) {
      store.dispatch(setMyCountry(state.country));
      StorageService.set(StorageService.KEYS.MY_COUNTRY, state.country);
    }
  });
  
  // ======================================================================
  // ✅ CORREÇÃO 4: EVENTOS DE TÍTULOS DE EMERGÊNCIA com debounce
  // ======================================================================
  
  socket.on('emergencyBondsIssued', (data) => {
    // console.log('Títulos de emergência emitidos:', data);
    
    // ✅ Debounce para evitar múltiplas notificações
    clearTimeout(emergencyTimeout);
    emergencyTimeout = setTimeout(() => {
      const { amount, rate, rating, atLimit, message } = data;
      
      // Som de alerta (mais urgente que notificação normal)
      if (window.Audio) {
        try {
          const alertSound = new Audio('/notification.mp3');
          alertSound.volume = 0.8; // Volume alto para chamar atenção
          alertSound.play().catch(() => {});
        } catch (error) {
          console.debug('Som de alerta não disponível');
        }
      }
      
      // Toast de alerta com estilo diferenciado - usando função com cooldown
      if (atLimit) {
        showNotificationWithCooldown(
          'error',
          `LIMITE DE DÍVIDA ATINGIDO! Títulos emitidos: ${amount.toFixed(1)} bi USD`,
          8000 // 8 segundos para dar tempo de ler
        );
      } else {
        showNotificationWithCooldown(
          'warning',
          `Títulos de Emergência: ${amount.toFixed(1)} bi USD (${rate.toFixed(1)}% - ${rating})`,
          6000 // 6 segundos
        );
      }
      
      // Log detalhado para debug
      console.log(`[EMERGENCY BONDS] Received notification:`, {
        amount: `${amount} bi USD`,
        interestRate: `${rate}%`,
        creditRating: rating,
        atDebtLimit: atLimit,
        timestamp: new Date().toLocaleTimeString()
      });
    }, 100); // Pequeno delay para agrupar eventos
  });

  // ======================================================================
  // EVENTOS ECONÔMICOS SIMPLIFICADOS
  // ======================================================================
  
  socket.on('economicParameterUpdated', (data) => {
    console.log('Parâmetro econômico atualizado:', data);
    // Hook useEconomy vai capturar atualizações via countryStatesUpdated
  });
  
  socket.on('debtBondsIssued', (data) => {
    console.log('Títulos de dívida emitidos:', data);
    // Hook usePublicDebt vai capturar via evento específico
  });
  
  socket.on('debtSummaryResponse', (data) => {
    console.log('Resumo de dívidas recebido:', data);
    // Hook usePublicDebt vai capturar via evento específico
  });

  // ======================================================================
  // ✅ CORREÇÃO 5: EVENTOS DE COMÉRCIO com debounce
  // ======================================================================
  
  socket.on('tradeProposalReceived', (proposal) => {
    console.log('Proposta de comércio recebida:', proposal);
    
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
      
      const { originCountry, type, product, value } = proposal;
      const productName = product === 'commodity' ? 'commodities' : 'manufaturas';
      const actionType = type === 'export' ? 'exportar para você' : 'importar de você';
      
      // ✅ Usar função com cooldown para evitar toasts duplicados
      showNotificationWithCooldown(
        'info',
        `${originCountry} quer ${actionType} ${productName} (${value} bi USD)`,
        4000
      );
    }, 100); // Pequeno delay para agrupar eventos
  });
  
  socket.on('tradeProposalResponse', (response) => {
    console.log('Resposta à proposta de comércio recebida:', response);
    
    // ✅ Debounce para evitar múltiplas notificações de resposta
    clearTimeout(responseTimeout);
    responseTimeout = setTimeout(() => {
      const { accepted, targetCountry } = response;
      
      if (accepted) {
        showNotificationWithCooldown(
          'success',
          `${targetCountry} aceitou sua proposta comercial!`,
          4000
        );
      } else {
        showNotificationWithCooldown(
          'warning',
          `${targetCountry} recusou sua proposta comercial.`,
          4000
        );
      }
    }, 100);
  });

  socket.on('tradeProposalProcessed', (response) => {
    console.log('Proposta de comércio processada:', response);
    
    const { accepted } = response;
    
    if (accepted) {
      MessageService.showSuccess('Você aceitou a proposta comercial.');
    } else {
      MessageService.showInfo('Você recusou a proposta comercial.');
    }
  });

  socket.on('tradeAgreementCancelled', (agreementId) => {
    console.log('Acordo comercial cancelado:', agreementId);
    store.dispatch(removeTradeAgreement(agreementId));
    MessageService.showInfo('Acordo comercial cancelado.', 4000);
  });
  
  socket.on('tradeAgreementsList', (data) => {
    //console.log('Lista de acordos comerciais recebida:', data);
    
    store.dispatch(resetTradeState());
    
    if (data.agreements && Array.isArray(data.agreements)) {
      data.agreements.forEach(agreement => {
        store.dispatch(addTradeAgreement(agreement));
      });
    }
    
    store.dispatch(updateStats());
  });
  
  socket.on('tradeAgreementUpdated', (data) => {
    // console.log('Atualização de acordos comerciais recebida:', data);
    
    store.dispatch(resetTradeState());
    
    if (data.agreements && Array.isArray(data.agreements)) {
      data.agreements.forEach(agreement => {
        store.dispatch(addTradeAgreement(agreement));
      });
    }
    
    store.dispatch(updateStats());
  });
  
  // ======================================================================
  // ERROS E OUTROS EVENTOS
  // ======================================================================
  
  socket.on('error', (message) => {
    console.error('Erro do socket:', message);
    
    if (message.includes('autenticação') || message.includes('authentication')) {
      isAuthenticated = false;
      authenticationInProgress = false;
    }
    
    if (message.includes('sala') || message.includes('room')) {
      setIsJoiningRoom(false);
      sessionStorage.removeItem('pendingRoom');
    }
    
    const isSilentError = message.includes('já está em uso') || 
                         message.includes('autenticação') || 
                         message.includes('desconectado') ||
                         message.includes('já está autenticado');
    
    if (!isSilentError) {
      // Mostrar erro via toast
      MessageService.showError(message, 4000);
      
      store.dispatch({
        type: 'error/socketError',
        payload: message
      });
    }
  });

  // ======================================================================
  // ✅ CORREÇÃO 6: Cleanup function para limpar timeouts
  // ======================================================================
  const cleanup = () => {
    clearTimeout(proposalTimeout);
    clearTimeout(responseTimeout);
    clearTimeout(emergencyTimeout);
  };

  // ✅ Retornar função de cleanup (mesmo que não seja usada atualmente)
  return cleanup;
};