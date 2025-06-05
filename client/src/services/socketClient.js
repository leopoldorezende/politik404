import { store } from '../store';
import { login } from '../modules/auth/authState';
import { setMyCountry } from '../modules/game/gameState';
// ❌ REMOVIDO: import { resetState as resetCountryState } from '../modules/country/countryStateSlice';
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

// Constantes para os tipos de eventos
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
  SEND_TRADE_PROPOSAL: 'socket/sendTradeProposal',
};

// ❌ REMOVIDO: export const COUNTRY_STATE_EVENTS (não mais usado)

export const TRADE_EVENTS = {
  CANCEL_AGREEMENT: 'socket/cancelTradeAgreement',
  GET_AGREEMENTS: 'socket/getTradeAgreements',
  SEND_PROPOSAL: 'socket/sendTradeProposal',
  RESPOND_PROPOSAL: 'socket/respondTradeProposal',
};

// API pública para enviar eventos ao servidor
export const socketApi = {
  // ======================================================================
  // MÉTODOS BÁSICOS DE CONEXÃO E AUTENTICAÇÃO
  // ======================================================================
  
  connect: () => {
    const socket = initializeSocket();
    setupSocketEvents(socket, socketApi);
    return socket;
  },
  
  disconnect: () => {
    disconnectSocket();
  },
  
  // Método para obter a instância do socket
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
  
  // ======================================================================
  // MÉTODOS DE GERENCIAMENTO DE SALAS
  // ======================================================================
  
  getRooms: () => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('getRooms');
  },
  
  createRoom: (roomData) => {
    const socket = getSocketInstance() || socketApi.connect();
    // Se for string (compatibilidade com código antigo), converte para objeto
    if (typeof roomData === 'string') {
      roomData = { name: roomData, duration: 30 * 60000 }; // 30 minutos padrão
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
    
    const username = StorageService.get(StorageService.KEYS.USERNAME);
    if (!username) {
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
    // ❌ REMOVIDO: store.dispatch(resetCountryState());
    store.dispatch(resetTradeState());
  },
  
  // ======================================================================
  // MÉTODOS DE CHAT
  // ======================================================================
  
  sendMessage: (content, isPrivate = false, recipient = null) => {
    const socket = getSocketInstance() || socketApi.connect();
    const username = StorageService.get(StorageService.KEYS.USERNAME);
    
    if (!username) {
      console.error('Não é possível enviar mensagem: Nome de usuário não encontrado');
      return;
    }
    
    socket.emit('chatMessage', { 
      username, 
      message: content, 
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
    socket.emit('requestSpecificCountry', countryName);
  },
  
  // ======================================================================
  // MÉTODOS DE ECONOMIA (SIMPLIFICADOS)
  // ======================================================================
  
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

  // ======================================================================
  // MÉTODOS DE COMÉRCIO
  // ======================================================================
  
  // Enviar proposta de acordo comercial (substituindo createTradeAgreement)
  sendTradeProposal: (proposalData) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('Enviando proposta de comércio:', proposalData);
    socket.emit('sendTradeProposal', proposalData);
  },
  
  // Responder a uma proposta de comércio (aceitar ou recusar)
  respondToTradeProposal: (proposalId, accepted) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('respondToTradeProposal', { proposalId, accepted });
  },
  
  // Cancelar um acordo comercial existente
  cancelTradeAgreement: (agreementId) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('cancelTradeAgreement', agreementId);
  },
  
  // Obter lista de acordos comerciais ativos
  getTradeAgreements: () => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('getTradeAgreements');
  },

  // ======================================================================
  // MÉTODOS DE ALIANÇA MILITAR (NOVO - SEGUINDO PADRÃO DE COMÉRCIO)
  // ======================================================================
  
  // Enviar proposta de aliança militar
 sendAllianceProposal: (proposalData) => {
    const socket = getSocketInstance() || socketApi.connect();
    console.log('Enviando proposta de aliança militar:', proposalData);
    socket.emit('sendAllianceProposal', proposalData);
  },
  
  // Responder a uma proposta de aliança militar (aceitar ou recusar)
  respondToAllianceProposal: (proposalId, accepted) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('respondToAllianceProposal', { proposalId, accepted });
  },
  
  // Cancelar uma aliança militar existente
  cancelMilitaryAlliance: (cardId) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('cancelMilitaryAlliance', cardId);
  }

};

export default socketApi;