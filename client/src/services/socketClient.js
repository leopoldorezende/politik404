// =====================================================================
// CLIENTE SOCKET UNIFICADO
// =====================================================================
// Local: client/src/services/socketClient.js

import { store } from '../store';
import { login } from '../modules/auth/authState';
import { setMyCountry } from '../modules/game/gameState';
import { resetTradeState } from '../modules/trade/tradeState';
import StorageService from './storageService.js';
import { 
  initializeSocket, 
  getSocketInstance, 
  disconnectSocket,
  setIsJoiningRoom,
  getIsJoiningRoom
} from './socketConnection';
import { setupSocketEvents } from './socketEventHandlers';

// =====================================================================
// CONSTANTES PARA EVENTOS UNIFICADOS
// =====================================================================

export const SOCKET_EVENTS = {
  CONNECT: 'socket/connect',
  AUTHENTICATE: 'socket/authenticate',
  GET_ROOMS: 'socket/getRooms',
  CREATE_ROOM: 'socket/createRoom',
  JOIN_ROOM: 'socket/joinRoom',
  LEAVE_ROOM: 'socket/leaveRoom',
  SEND_CHAT: 'socket/sendChatMessage',
  REQUEST_CHAT_HISTORY: 'socket/requestPrivateHistory',
  REQUEST_COUNTRY: 'socket/requestCountry',
  SEND_AGREEMENT_PROPOSAL: 'socket/sendAgreementProposal',
  RESPOND_AGREEMENT_PROPOSAL: 'socket/respondToAgreementProposal',
  CANCEL_AGREEMENT: 'socket/cancelAgreement',
  GET_ACTIVE_AGREEMENTS: 'socket/getActiveAgreements',
  ATTEMPT_INTERNAL_AGREEMENT: 'socket/attemptInternalAgreement'
};

// =====================================================================
// API PÚBLICA UNIFICADA
// =====================================================================

export const socketApi = {
  connect: () => {
    const socket = initializeSocket();
    setupSocketEvents(socket, socketApi);
    return socket;
  },
  
  disconnect: () => {
    disconnectSocket();
  },
  
  getSocketInstance: () => {
    return getSocketInstance();
  },
  
  authenticate: (username) => {
    if (!username) {
      console.error('Nome de usuário não fornecido para autenticação');
      return;
    }
    const socket = socketApi.connect();
    StorageService.set(StorageService.KEYS.USERNAME, username);
    store.dispatch(login(username));
    setTimeout(() => {
      socket.emit('authenticate', username, {
        clientSessionId: StorageService.get(StorageService.KEYS.CLIENT_SESSION_ID)
      });
    }, 100);
  },

  getRooms: () => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('getRooms');
  },
  
  createRoom: (roomData) => {
    const socket = getSocketInstance() || socketApi.connect();
    if (typeof roomData === 'string') {
      roomData = { name: roomData, duration: 30 * 60000 };
    }
    socket.emit('createRoom', roomData);
  },
  
  joinRoom: (roomName) => {
    if (getIsJoiningRoom()) {
      console.log('Já está tentando entrar em uma sala, ignorando solicitação');
      return;
    }
    console.log('Tentando entrar na sala:', roomName);
    setIsJoiningRoom(true);
    StorageService.set(StorageService.KEYS.PENDING_ROOM, roomName);
    const socket = getSocketInstance() || socketApi.connect();
    if (!socket.connected) {
      console.log('Socket não está conectado, tentando conectar primeiro');
      socket.connect();
      setTimeout(() => {
        if (getIsJoiningRoom()) {
          console.log('Tempo limite de tentativa de entrar na sala atingido, resetando');
          setIsJoiningRoom(false);
        }
      }, 10000);
      return;
    }
    if (!StorageService.get(StorageService.KEYS.USERNAME)) {
      console.error('Usuário não autenticado, não é possível entrar na sala');
      setIsJoiningRoom(false);
      sessionStorage.removeItem('pendingRoom');
      return;
    }
    console.log(`Enviando evento joinRoom para sala ${roomName}`);
    socket.emit('joinRoom', roomName);
    setTimeout(() => {
      if (getIsJoiningRoom()) {
        console.log('Tempo limite de tentativa de entrar na sala atingido, resetando');
        setIsJoiningRoom(false);
      }
    }, 10000);
  },
  
  leaveRoom: (intentional = true) => {
    setIsJoiningRoom(false);
    StorageService.remove(StorageService.KEYS.PENDING_ROOM);
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('leaveRoom', { intentional });
    store.dispatch(setMyCountry(null));
    StorageService.remove(StorageService.KEYS.MY_COUNTRY);
    store.dispatch(resetTradeState());
  },

  sendMessage: (message, isPrivate = false, recipient = null) => {
    const socket = getSocketInstance() || socketApi.connect();
    const username = StorageService.get(StorageService.KEYS.USERNAME);
    if (!username) {
      console.error('Não é possível enviar mensagem: Nome de usuário não encontrado');
      return;
    }
    socket.emit('chatMessage', {
      username,
      message,
      isPrivate,
      recipient
    });
  },
  
  requestPrivateHistory: (targetUsername) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('requestPrivateHistory', targetUsername);
  },

  requestCountry: (countryName) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('Solicitando país:', countryName);
    socket.emit('requestSpecificCountry', countryName);
  },

  updateEconomicParameter: (parameter, value) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('updateEconomicParameter', { parameter, value });
  },
  
  issueDebtBonds: (bondAmount) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('issueDebtBonds', { bondAmount });
  },
  
  getDebtSummary: () => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('getDebtSummary');
  },

  // 🎯 SISTEMA UNIFICADO DE ACORDOS
  sendAgreementProposal: (proposalData) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('📤 Enviando proposta unificada:', proposalData);
    socket.emit('sendAgreementProposal', proposalData);
  },

  respondToAgreementProposal: (response) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('📥 Enviando resposta unificada:', response);
    socket.emit('respondToAgreementProposal', response);
  },

  cancelAgreement: (cancellationData) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('🗑️ Cancelando acordo:', cancellationData);
    socket.emit('cancelAgreement', cancellationData);
  },

  getActiveAgreements: (type = null) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('getActiveAgreements', { type });
  },

  attemptInternalAgreement: (type) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('🏛️ Tentando acordo interno:', type);
    socket.emit('attemptInternalAgreement', { type });
  },

  getAgreementTypes: () => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('getAgreementTypes');
  },

  // 🏛️ MÉTODOS ESPECÍFICOS PARA ACORDOS INTERNOS
  attemptPoliticalPact: () => {
    return socketApi.attemptInternalAgreement('political_pact');
  },
  attemptBusinessPartnership: () => {
    return socketApi.attemptInternalAgreement('business_partnership');
  },
  attemptMediaControl: () => {
    return socketApi.attemptInternalAgreement('media_control');
  },

  // 📊 MÉTODOS UTILITÁRIOS
  isConnected: () => {
    const socket = getSocketInstance();
    return socket && socket.connected;
  },
  getAgreementSystemStatus: () => {
    return {
      unifiedSystem: true,
      supportedTypes: [
        'trade-import', 'trade-export',
        'military-alliance', 'strategic-cooperation',
        'political-pact', 'business-partnership', 'media-control'
      ],
      newMethods: [
        'sendAgreementProposal', 'respondToAgreementProposal', 'cancelAgreement',
      ]
    };
  },
  clearAgreementData: () => {
    console.log('🧹 Limpando dados locais de acordos');
    // Implementar limpeza conforme necessário
  }
};

// =====================================================================
// HELPERS ATUAIS
// =====================================================================

export const validateProposalData = (proposalData) => {
  const { agreementType, type, targetCountry } = proposalData;
  if (!agreementType && !type) {
    return { valid: false, error: 'Tipo de acordo não especificado' };
  }
  const normalizedType = agreementType || type;
  if (normalizedType.startsWith('trade-')) {
    if (!targetCountry || !proposalData.product || !proposalData.value) {
      return { valid: false, error: 'Dados comerciais incompletos' };
    }
  } else if (normalizedType.includes('alliance') || normalizedType.includes('cooperation')) {
    if (!targetCountry) {
      return { valid: false, error: 'País alvo não especificado' };
    }
  }
  return { valid: true };
};

export default socketApi;

// Exportação global para compatibilidade
if (typeof window !== 'undefined') {
  window.socketApi = socketApi;
}