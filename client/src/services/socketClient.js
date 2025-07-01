// =====================================================================
// CLIENTE SOCKET UNIFICADO - FASE 3
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
  // Eventos básicos
  CONNECT: 'socket/connect',
  AUTHENTICATE: 'socket/authenticate',
  GET_ROOMS: 'socket/getRooms',
  CREATE_ROOM: 'socket/createRoom',
  JOIN_ROOM: 'socket/joinRoom',
  LEAVE_ROOM: 'socket/leaveRoom',
  SEND_CHAT: 'socket/sendChatMessage',
  REQUEST_CHAT_HISTORY: 'socket/requestPrivateHistory',
  REQUEST_COUNTRY: 'socket/requestCountry',
  
  // 🎯 EVENTOS UNIFICADOS DE ACORDO
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
  // ===================================================================
  // MÉTODOS BÁSICOS DE CONEXÃO E AUTENTICAÇÃO (MANTIDOS)
  // ===================================================================
  
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

  // ===================================================================
  // MÉTODOS DE SALA (MANTIDOS)
  // ===================================================================
  
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

  // ===================================================================
  // MÉTODOS DE CHAT (MANTIDOS)
  // ===================================================================
  
  // ===================================================================
  // MÉTODOS DE CHAT (MANTIDOS)
  // ===================================================================
  
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

  // ===================================================================
  // MÉTODOS DE PAÍS (MANTIDOS)
  // ===================================================================
  
  requestCountry: (countryName) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('Solicitando país:', countryName);
    socket.emit('requestSpecificCountry', countryName);
  },
  
  // ===================================================================
  // MÉTODOS DE ECONOMIA (SIMPLIFICADOS - MANTIDOS)
  // ===================================================================
  
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

  // ===================================================================
  // 🎯 SISTEMA UNIFICADO DE ACORDOS - NOVOS MÉTODOS PRINCIPAIS
  // ===================================================================

  /**
   * Método principal para envio de propostas de acordo
   * Substitui sendTradeProposal, sendAllianceProposal, sendCooperationProposal
   */
  sendAgreementProposal: (proposalData) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('📤 Enviando proposta unificada:', proposalData);
    socket.emit('sendAgreementProposal', proposalData);
  },

  /**
   * Método principal para resposta a propostas
   * Substitui respondToTradeProposal, respondToAllianceProposal, respondToCooperationProposal
   */
  respondToAgreementProposal: (response) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('📥 Enviando resposta unificada:', response);
    socket.emit('respondToAgreementProposal', response);
  },

  /**
   * Método principal para cancelamento de acordos
   * Substitui cancelTradeAgreement, cancelMilitaryAlliance, cancelStrategicCooperation
   */
  cancelAgreement: (cancellationData) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('🗑️ Cancelando acordo:', cancellationData);
    socket.emit('cancelAgreement', cancellationData);
  },

  /**
   * Obter acordos ativos por tipo
   */
  getActiveAgreements: (type = null) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('getActiveAgreements', { type });
  },

  /**
   * Tentar criar acordo interno (sem proposta)
   */
  attemptInternalAgreement: (type) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('🏛️ Tentando acordo interno:', type);
    socket.emit('attemptInternalAgreement', { type });
  },

  /**
   * Obter tipos de acordo disponíveis
   */
  getAgreementTypes: () => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('getAgreementTypes');
  },

  // ===================================================================
  // 🏛️ MÉTODOS ESPECÍFICOS PARA ACORDOS INTERNOS
  // ===================================================================

  /**
   * Tentar pacto político
   */
  attemptPoliticalPact: () => {
    return socketApi.attemptInternalAgreement('political_pact');
  },

  /**
   * Tentar parceria empresarial
   */
  attemptBusinessPartnership: () => {
    return socketApi.attemptInternalAgreement('business_partnership');
  },

  /**
   * Tentar controle de mídia
   */
  attemptMediaControl: () => {
    return socketApi.attemptInternalAgreement('media_control');
  },

  // ===================================================================
  // 📊 MÉTODOS UTILITÁRIOS
  // ===================================================================

  /**
   * Verificar se socket está conectado
   */
  isConnected: () => {
    const socket = getSocketInstance();
    return socket && socket.connected;
  },

  /**
   * Obter status do sistema de acordos
   */
  getAgreementSystemStatus: () => {
    return {
      unifiedSystem: true,
      legacyCompatibility: true,
      supportedTypes: [
        'trade-import', 'trade-export',
        'military-alliance', 'strategic-cooperation',
        'political-pact', 'business-partnership', 'media-control'
      ],
      deprecatedMethods: [
        'sendTradeProposal', 'sendAllianceProposal', 'sendCooperationProposal',
        'respondToTradeProposal', 'respondToAllianceProposal', 'respondToCooperationProposal',
        'cancelTradeAgreement', 'cancelMilitaryAlliance', 'cancelStrategicCooperation'
      ],
      newMethods: [
        'sendAgreementProposal', 'respondToAgreementProposal', 'cancelAgreement',
      ]
    };
  },

  /**
   * Limpar dados locais relacionados a acordos
   */
  clearAgreementData: () => {
    // Limpar dados de acordos no localStorage/sessionStorage se necessário
    console.log('🧹 Limpando dados locais de acordos');
    // Implementar limpeza conforme necessário
  }
};

// =====================================================================
// HELPERS PARA MIGRAÇÃO E COMPATIBILIDADE
// =====================================================================

/**
 * Validar dados de proposta antes do envio
 */
export const validateProposalData = (proposalData) => {
  const { agreementType, type, targetCountry } = proposalData;
  
  // Validação básica
  if (!agreementType && !type) {
    return { valid: false, error: 'Tipo de acordo não especificado' };
  }

  // Validações específicas por tipo
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

// =====================================================================
// LOGGING E DEBUG
// =====================================================================

if (process.env.NODE_ENV === 'development') {
  // Adicionar logging para debug em desenvolvimento
  window.socketApiDebug = {
    getStatus: () => socketApi.getAgreementSystemStatus(),
    checkConnection: () => socketApi.isConnected(),
    clearData: () => socketApi.clearAgreementData(),
    validateProposal: validateProposalData,
  };
  
  console.log('🔧 Socket API Debug tools disponíveis em window.socketApiDebug');
}

export default socketApi;