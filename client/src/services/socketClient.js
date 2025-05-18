import { store } from '../store';
import { login } from '../modules/auth/authState';
import { setMyCountry } from '../modules/game/gameState';
import { resetState as resetCountryState } from '../modules/country/countryStateSlice';
import { resetTradeState } from '../modules/trade/tradeState';
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
};

export const COUNTRY_STATE_EVENTS = {
  SUBSCRIBE: 'socket/subscribeToCountryStates',
  UNSUBSCRIBE: 'socket/unsubscribeFromCountryStates',
  GET_STATE: 'socket/getCountryState',
  UPDATE_STATE: 'socket/updateCountryState',
};

export const TRADE_EVENTS = {
  CREATE_AGREEMENT: 'socket/createTradeAgreement',
  CANCEL_AGREEMENT: 'socket/cancelTradeAgreement',
  GET_AGREEMENTS: 'socket/getTradeAgreements'
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
    
    sessionStorage.setItem('username', username);
    store.dispatch(login(username));
    
    setTimeout(() => {
      socket.emit('authenticate', username, { clientSessionId: sessionStorage.getItem('clientSessionId') });
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
    
    sessionStorage.setItem('pendingRoom', roomName);
    
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
    
    const username = sessionStorage.getItem('username');
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
    sessionStorage.removeItem('pendingRoom');
    
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('leaveRoom', { intentional });
    
    store.dispatch(setMyCountry(null));
    sessionStorage.removeItem('myCountry');
    store.dispatch(resetCountryState());
    store.dispatch(resetTradeState());
  },
  
  // ======================================================================
  // MÉTODOS DE CHAT
  // ======================================================================
  
  sendMessage: (content, isPrivate = false, recipient = null) => {
    const socket = getSocketInstance() || socketApi.connect();
    const username = sessionStorage.getItem('username');
    
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
  // MÉTODOS DE ESTADO DE PAÍS
  // ======================================================================

  subscribeToCountryStates: (roomName) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('subscribeToCountryStates', roomName);
  },

  unsubscribeFromCountryStates: (roomName) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('unsubscribeFromCountryStates', roomName);
  },

  getCountryState: (roomName, countryName) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('getCountryState', { roomName, countryName });
  },

  updateCountryState: (roomName, countryName, category, updates) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('updateCountryState', { roomName, countryName, category, updates });
  },

  // ======================================================================
  // MÉTODOS DE ECONOMIA
  // ======================================================================

  issueDebtBonds: (bondAmount) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('issueDebtBonds', { bondAmount });
  },
  
  // ======================================================================
  // MÉTODOS DE COMÉRCIO
  // ======================================================================
  
  // Criar um novo acordo comercial
  createTradeAgreement: (tradeData) => {
    const socket = getSocketInstance() || socketApi.connect();
    socket.emit('createTradeAgreement', tradeData);
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
  }
};

export default socketApi;