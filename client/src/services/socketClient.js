import { io } from 'socket.io-client';
import { store } from '../store';
import { login } from '../modules/auth/authState';
import { setRooms, setCurrentRoom, leaveRoom } from '../modules/room/roomState';
import { setMyCountry, setPlayers, setPlayerOnlineStatus, setOnlinePlayers } from '../modules/game/gameState';
import { addMessage, setChatHistory } from '../modules/chat/chatState';
         
// Importações para o módulo de economia
import { 
  updateEconomyData, 
  addEconomicEvent, 
  setEconomyConfig, 
  applyPolicyChange,
  resetEconomyState
} from '../modules/economy/economyState';

// Importações para o módulo de política
import { 
  updateApproval, 
  updateInstability, 
  addPoliticalEvent
} from '../modules/politics/politicsState';

// Importações para o módulo militar
import { 
  updateMilitaryForces, 
  recordInvestment,
  recordWarAction,
  updateWarActionStatus,
  resetMilitaryState
} from '../modules/military/militaryState';

// Importações para o módulo de comércio
import {
  addTradeAgreement,
  removeTradeAgreement,
  addTradeRoute,
  removeTradeRoute,
  resetTradeState
} from '../modules/trade/tradeState';

// Configurações
const MAX_RECONNECT_ATTEMPTS = 5;

// Singleton do socket
let socketInstance = null;
let reconnectAttempts = 0;
let isJoiningRoom = false; // Controle para evitar múltiplas tentativas de entrar na sala

// ID de sessão único para este cliente
const getSessionId = () => {
  if (!localStorage.getItem('clientSessionId')) {
    const sessionId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('clientSessionId', sessionId);
  }
  return localStorage.getItem('clientSessionId');
};

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

// Inicializa a conexão do socket e define handlers
export const initializeSocket = () => {
  // Evitar múltiplas conexões
  if (socketInstance && socketInstance.connected) {
    console.log('Reutilizando conexão de socket existente:', socketInstance.id);
    return socketInstance;
  }
  
  // Se há uma instância desconectada, desconecte explicitamente
  if (socketInstance) {
    console.log('Desconectando instância de socket anterior');
    socketInstance.disconnect();
    socketInstance = null;
  }
  
  // Obter a URL do socket do ambiente ou usar a origem da página
  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  console.log('Conectando ao servidor socket:', socketUrl);
  
  // Opções de conexão
  const sessionId = getSessionId();
  const connectionOptions = {
    withCredentials: true,
    transports: ['polling'], // Usar polling primeiro para melhor compatibilidade
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    query: {
      clientSessionId: sessionId
    }
  };
  
  // Criar a conexão
  const socket = io(socketUrl, connectionOptions);
  socketInstance = socket;
  
  // Para debugging via console
  window.socket = socket;
  
  // Limpar flags de controle
  isJoiningRoom = false;
  
  // Configurar eventos do socket
  setupSocketEvents(socket);
  
  return socket;
};

// Configurar todos os eventos do socket
const setupSocketEvents = (socket) => {
  if (!socket) return;
  
  // Remover listeners anteriores se existirem para evitar duplicação
  socket.removeAllListeners();
  
  // ======================================================================
  // EVENTOS BASE DO SOCKET
  // ======================================================================
  
  // Evento de conexão
  socket.on('connect', () => {
    console.log('Conectado ao servidor socket com ID:', socket.id, 'via', socket.io.engine.transport.name);
    reconnectAttempts = 0; // Resetar contador de tentativas
    isJoiningRoom = false; // Resetar flag de controle
    
    // Reautenticar automaticamente se houver um usuário guardado
    const username = sessionStorage.getItem('username');
    if (username) {
      console.log('Reautenticando usuário após conexão:', username);
      
      // Evitar múltiplas autenticações em sequência
      setTimeout(() => {
        socket.emit('authenticate', username, { clientSessionId: getSessionId() });
      }, 300);
    }
  });
  
  // Eventos de reconexão
  socket.io.on("reconnect_attempt", (attempt) => {
    console.log(`Tentativa de reconexão #${attempt}`);
    reconnectAttempts = attempt;
  });
  
  socket.io.on("reconnect", (attempt) => {
    console.log(`Reconectado com sucesso após ${attempt} tentativas`);
    isJoiningRoom = false; // Resetar flag de controle
    
    // Re-autenticar após reconexão
    const username = sessionStorage.getItem('username');
    if (username) {
      console.log('Reautenticando após reconexão:', username);
      
      setTimeout(() => {
        socket.emit('authenticate', username, { clientSessionId: getSessionId() });
        
        // Atualizar estado após reconexão com delay para evitar conflito
        setTimeout(() => {
          socket.emit('getRooms');
        }, 500);
      }, 300);
    }
  });
  
  // Erros de conexão
  socket.on('connect_error', (error) => {
    console.error('Erro de conexão ao socket:', error.message);
    reconnectAttempts++;
    isJoiningRoom = false; // Resetar flag de controle
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`Falha após ${MAX_RECONNECT_ATTEMPTS} tentativas. Desistindo.`);
      // Notificar usuário sobre o problema de conexão
      store.dispatch({
        type: 'error/connectionFailed',
        payload: 'Não foi possível conectar ao servidor. Tente novamente mais tarde.'
      });
    }
  });
  
  // Desconexão
  socket.on('disconnect', (reason) => {
    console.log('Desconectado do servidor. Motivo:', reason);
    isJoiningRoom = false; // Resetar flag de controle
    
    // Tentar reconectar para desconexões não iniciadas pelo cliente
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
  
  // Evento de autenticação bem-sucedida
  socket.on('authenticated', (data) => {
    console.log('Autenticação bem-sucedida:', data);
    
    // Se estava tentando entrar em uma sala antes, retomar o processo
    const pendingRoom = sessionStorage.getItem('pendingRoom');
    if (pendingRoom && !isJoiningRoom) {
      setTimeout(() => {
        console.log('Retomando entrada na sala após autenticação:', pendingRoom);
        socketApi.joinRoom(pendingRoom);
      }, 500);
    } else {
      // Caso contrário, apenas atualizar a lista de salas
      setTimeout(() => {
        socket.emit('getRooms');
      }, 300);
    }
  });
  
  // Salas
  socket.on('roomsList', (rooms) => {
    console.log('Recebida lista de salas:', rooms);
    store.dispatch(setRooms(rooms));
  });
  
  socket.on('roomJoined', (room) => {
    console.log('Entrou na sala:', room);
    isJoiningRoom = false; // Resetar flag após sucesso
    sessionStorage.removeItem('pendingRoom'); // Limpar sala pendente
    store.dispatch(setCurrentRoom(room));
    
    // Solicitar dados específicos para cada domínio
    setTimeout(() => {
      socket.emit('getEconomyData');
      socket.emit('getAlliances');
      socket.emit('getMilitaryData');
    }, 1000);
  });
  
  socket.on('roomLeft', () => {
    console.log('Saiu da sala');
    isJoiningRoom = false; // Resetar flag após sair
    store.dispatch(leaveRoom());
    
    // Limpar estados de domínio específicos
    store.dispatch(resetEconomyState());
    store.dispatch(resetTradeState());
    store.dispatch(resetMilitaryState());
  });
  
  socket.on('roomCreated', (data) => {
    console.log('Sala criada:', data);
    if (data.success) {
      // Atualizar lista de salas
      socket.emit('getRooms');
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
    
    // Extrair usernames para lista de jogadores online
    const onlinePlayers = players
      .map(player => {
        if (typeof player === 'object' && player.username) {
          return player.username;
        }
        
        if (typeof player === 'string') {
          // Format: "username (country)"
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
  
  // Países
  socket.on('countryAssigned', (country) => {
    console.log('País atribuído:', country);
    store.dispatch(setMyCountry(country));
    sessionStorage.setItem('myCountry', country);
  });
  
  // Estado do jogador
  socket.on('stateRestored', (state) => {
    console.log('Estado restaurado:', state);
    if (state && state.country) {
      store.dispatch(setMyCountry(state.country));
      sessionStorage.setItem('myCountry', state.country);
    }
  });
  
  
  // ======================================================================
  // EVENTOS DE COMÉRCIO SIMPLIFICADOS
  // ======================================================================
  
  socket.on('tradeAgreementCreated', (agreementData) => {
    console.log('Acordo comercial criado:', agreementData);
    store.dispatch(addTradeAgreement(agreementData));
  });
  
  socket.on('tradeAgreementRemoved', (agreementData) => {
    console.log('Acordo comercial removido:', agreementData);
    store.dispatch(removeTradeAgreement(agreementData));
  });
  
  socket.on('tradeRouteCreated', (routeData) => {
    console.log('Rota comercial criada:', routeData);
    store.dispatch(addTradeRoute(routeData));
  });
  
  socket.on('tradeRouteRemoved', (routeData) => {
    console.log('Rota comercial removida:', routeData);
    store.dispatch(removeTradeRoute(routeData));
  });
  
  // ======================================================================
  // EVENTOS MILITARES SIMPLIFICADOS
  // ======================================================================
  
  socket.on('militaryForcesUpdated', (forcesData) => {
    console.log('Forças militares atualizadas:', forcesData);
    store.dispatch(updateMilitaryForces(forcesData));
  });
  
  socket.on('militaryInvestmentRecorded', (investmentData) => {
    console.log('Investimento militar registrado:', investmentData);
    store.dispatch(recordInvestment(investmentData));
  });
  
  socket.on('warActionRecorded', (warActionData) => {
    console.log('Ação de guerra registrada:', warActionData);
    store.dispatch(recordWarAction(warActionData));
  });
  
  socket.on('warActionStatusUpdated', (statusData) => {
    console.log('Status de guerra atualizado:', statusData);
    store.dispatch(updateWarActionStatus(statusData));
  });
  
  // ======================================================================
  // EVENTOS DE ECONOMIA
  // ======================================================================
  
  socket.on('economyUpdated', (economyData) => {
    console.log('Economia atualizada:', economyData);
    store.dispatch(updateEconomyData(economyData));
  });
  
  socket.on('economyData', (data) => {
    console.log('Dados econômicos recebidos:', data);
    store.dispatch(updateEconomyData(data));
    
    if (data.config) {
      store.dispatch(setEconomyConfig(data.config));
    }
  });
  
  socket.on('economicEvent', (eventData) => {
    console.log('Evento econômico recebido:', eventData);
    store.dispatch(addEconomicEvent(eventData));
  });
  
  socket.on('policyChange', (policyData) => {
    console.log('Mudança de política recebida:', policyData);
    store.dispatch(applyPolicyChange(policyData));
  });
  
  // ======================================================================
  // EVENTOS DE POLÍTICA
  // ======================================================================
  
  socket.on('alliancesUpdated', (alliancesData) => {
    console.log('Alianças atualizadas:', alliancesData);
    store.dispatch(updateAlliances(alliancesData));
  });
  
  socket.on('approvalUpdated', (approvalData) => {
    console.log('Níveis de aprovação atualizados:', approvalData);
    store.dispatch(updateApproval(approvalData));
  });
  
  socket.on('instabilityUpdated', (instabilityData) => {
    console.log('Níveis de instabilidade atualizados:', instabilityData);
    store.dispatch(updateInstability(instabilityData));
  });
  
  socket.on('politicalEvent', (eventData) => {
    console.log('Evento político recebido:', eventData);
    store.dispatch(addPoliticalEvent(eventData));
  });
  
  // ======================================================================
  // ERROS E OUTROS EVENTOS
  // ======================================================================
  
  socket.on('error', (message) => {
    console.error('Erro do socket:', message);
    
    // Verificar se é um erro relacionado a sala
    if (message.includes('sala') || message.includes('room')) {
      isJoiningRoom = false; // Resetar flag em caso de erro na sala
      sessionStorage.removeItem('pendingRoom'); // Limpar sala pendente
    }
    
    // Filtrar alguns erros comuns para não irritar o usuário
    const isSilentError = message.includes('já está em uso') || 
                         message.includes('autenticação') || 
                         message.includes('desconectado');
    
    if (!isSilentError) {
      store.dispatch({
        type: 'error/socketError',
        payload: message
      });
    }
  });
  
  // Força ping a cada 30 segundos para manter a conexão ativa
  setInterval(() => {
    if (socket.connected) {
      socket.emit('ping', Date.now());
    }
  }, 30000);
  
  // Monitor de ping para estimar latência
  socket.on('pong', (data) => {
    const latency = Date.now() - data;
    console.debug(`Latência atual: ${latency}ms`);
    // Atualizar um estado de aplicação com latência, se necessário
  });
};

// API pública para enviar eventos ao servidor
export const socketApi = {
  // ======================================================================
  // MÉTODOS BÁSICOS DE CONEXÃO E AUTENTICAÇÃO
  // ======================================================================
  
  connect: () => {
    return initializeSocket();
  },
  
  disconnect: () => {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
  },
  
  authenticate: (username) => {
    if (!username) {
      console.error('Nome de usuário não fornecido para autenticação');
      return;
    }
    
    // Garantir que o socket está inicializado
    const socket = initializeSocket();
    
    // Salvar no sessionStorage para persistência
    sessionStorage.setItem('username', username);
    
    // Atualizar o estado do Redux
    store.dispatch(login(username));
    
    // Autenticar com o servidor com delay para garantir conexão
    setTimeout(() => {
      socket.emit('authenticate', username, { clientSessionId: getSessionId() });
    }, 100);
  },
  
  // ======================================================================
  // MÉTODOS DE GERENCIAMENTO DE SALAS
  // ======================================================================
  
  getRooms: () => {
    const socket = initializeSocket();
    socket.emit('getRooms');
  },
  
  createRoom: (roomName) => {
    const socket = initializeSocket();
    socket.emit('createRoom', roomName);
  },
  
  joinRoom: (roomName) => {
    // Evitar múltiplas tentativas simultâneas de entrar na sala
    if (isJoiningRoom) {
      console.log('Já está tentando entrar em uma sala, ignorando solicitação');
      return;
    }
    
    console.log('Tentando entrar na sala:', roomName);
    
    // Marcar que está tentando entrar na sala
    isJoiningRoom = true;
    
    // Guardar nome da sala que está tentando entrar para recuperação
    sessionStorage.setItem('pendingRoom', roomName);
    
    // Garantir que o socket está inicializado
    const socket = initializeSocket();
    
    // Verificar se está conectado antes de prosseguir
    if (!socket.connected) {
      console.log('Socket não está conectado, tentando conectar primeiro');
      
      // Conectar o socket e tentar novamente depois
      socket.connect();
      
      // Resetar a flag após um tempo para evitar bloqueio permanente
      setTimeout(() => {
        if (isJoiningRoom) {
          console.log('Tempo limite de tentativa de entrar na sala atingido, resetando');
          isJoiningRoom = false;
        }
      }, 10000);
      
      return;
    }
    
    // Verificar se está autenticado com o servidor
    const username = sessionStorage.getItem('username');
    if (!username) {
      console.error('Usuário não autenticado, não é possível entrar na sala');
      isJoiningRoom = false;
      sessionStorage.removeItem('pendingRoom');
      return;
    }
    
    // Tentar entrar na sala
    console.log(`Enviando evento joinRoom para sala ${roomName}`);
    socket.emit('joinRoom', roomName);
    
    // Configurar timeout para resetar a flag se demorar muito
    setTimeout(() => {
      if (isJoiningRoom) {
        console.log('Tempo limite de tentativa de entrar na sala atingido, resetando');
        isJoiningRoom = false;
      }
    }, 10000);
  },
  
  leaveRoom: (intentional = true) => {
    // Limpar flags e dados pendentes
    isJoiningRoom = false;
    sessionStorage.removeItem('pendingRoom');
    
    const socket = initializeSocket();
    socket.emit('leaveRoom', { intentional });
    
    // Limpar o país do usuário no state
    store.dispatch(setMyCountry(null));
    sessionStorage.removeItem('myCountry');
    
    // Limpar estados específicos dos domínios
    store.dispatch(resetEconomyState());
    store.dispatch(resetTradeState());
    store.dispatch(resetMilitaryState());
  },
  
  // ======================================================================
  // MÉTODOS DE CHAT
  // ======================================================================
  
  sendMessage: (content, isPrivate = false, recipient = null) => {
    const socket = initializeSocket();
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
    const socket = initializeSocket();
    socket.emit('requestPrivateHistory', targetUsername);
  },
  
  requestCountry: (countryName) => {
    const socket = initializeSocket();
    socket.emit('requestSpecificCountry', countryName);
  },
  
  // ======================================================================
  // MÉTODOS DE COMÉRCIO SIMPLIFICADOS
  // ======================================================================
  
  createTradeAgreement: (agreementData) => {
    const socket = initializeSocket();
    socket.emit('createTradeAgreement', agreementData);
  },
  
  cancelTradeAgreement: (agreementId) => {
    const socket = initializeSocket();
    socket.emit('cancelTradeAgreement', agreementId);
  },
  
  // ======================================================================
  // MÉTODOS MILITARES SIMPLIFICADOS
  // ======================================================================
  
  getMilitaryData: () => {
    const socket = initializeSocket();
    socket.emit('getMilitaryData');
  },
  
  investMilitary: (investmentData) => {
    const socket = initializeSocket();
    socket.emit('investMilitary', investmentData);
  },
  
  attackCountry: (attackData) => {
    const socket = initializeSocket();
    socket.emit('attackCountry', attackData);
  },
  
  getWarActions: () => {
    const socket = initializeSocket();
    socket.emit('getWarActions');
  },
  
  updateWarStatus: (statusData) => {
    const socket = initializeSocket();
    socket.emit('updateWarStatus', statusData);
  },
  
  // ======================================================================
  // MÉTODOS DE ECONOMIA
  // ======================================================================
  
  getEconomyData: () => {
    const socket = initializeSocket();
    socket.emit('getEconomyData');
  },
  
  adjustInterestRate: (value) => {
    const socket = initializeSocket();
    socket.emit('adjustInterestRate', value);
  },
  
  adjustTaxBurden: (value) => {
    const socket = initializeSocket();
    socket.emit('adjustTaxBurden', value);
  },
  
  adjustPublicServices: (value) => {
    const socket = initializeSocket();
    socket.emit('adjustPublicServices', value);
  },
  
  // ======================================================================
  // MÉTODOS DE POLÍTICA
  // ======================================================================
  
  getAlliances: () => {
    const socket = initializeSocket();
    socket.emit('getAlliances');
  },
  
  // ======================================================================
  // MÉTODOS DE UTILIDADE
  // ======================================================================
  
  ping: (callback) => {
    const socket = initializeSocket();
    const startTime = Date.now();
    
    socket.emit('ping', startTime, () => {
      const latency = Date.now() - startTime;
      if (typeof callback === 'function') {
        callback(latency);
      }
    });
  },
  
  checkConnection: () => {
    const socket = initializeSocket();
    return socket.connected;
  }
};

export default socketApi;