import { store } from '../store';
import { setRooms, setCurrentRoom, leaveRoom } from '../modules/room/roomState';
import { setMyCountry, setPlayers, setPlayerOnlineStatus, setOnlinePlayers } from '../modules/game/gameState';
import { addMessage, setChatHistory } from '../modules/chat/chatState';
import {
  initializeCountryStates,
  updateCountryStates,
  updateCountryState,
  resetState as resetCountryState
} from '../modules/country/countryStateSlice';
import { 
  setReconnectAttempts, 
  incrementReconnectAttempts,
  setIsJoiningRoom,
  getIsJoiningRoom,
  getMaxReconnectAttempts
} from './socketConnection';

// Configurar todos os eventos do socket
export const setupSocketEvents = (socket, socketApi) => {
  if (!socket) return;
  
  // Remover listeners anteriores se existirem para evitar duplicação
  socket.removeAllListeners();
  
  // ======================================================================
  // EVENTOS BASE DO SOCKET
  // ======================================================================
  
  socket.on('connect', () => {
    console.log('Conectado ao servidor socket com ID:', socket.id);
    setReconnectAttempts(0);
    setIsJoiningRoom(false);
    
    // Reautenticar automaticamente se houver um usuário guardado
    const username = sessionStorage.getItem('username');
    if (username) {
      console.log('Reautenticando usuário após conexão:', username);
      
      setTimeout(() => {
        socket.emit('authenticate', username, { clientSessionId: sessionStorage.getItem('clientSessionId') });
      }, 300);
    }
  });
  
  socket.io.on("reconnect_attempt", (attempt) => {
    console.log(`Tentativa de reconexão #${attempt}`);
    setReconnectAttempts(attempt);
  });
  
  socket.io.on("reconnect", (attempt) => {
    console.log(`Reconectado com sucesso após ${attempt} tentativas`);
    setIsJoiningRoom(false);
    
    const username = sessionStorage.getItem('username');
    if (username) {
      console.log('Reautenticando após reconexão:', username);
      
      setTimeout(() => {
        socket.emit('authenticate', username, { clientSessionId: sessionStorage.getItem('clientSessionId') });
        
        setTimeout(() => {
          socket.emit('getRooms');
        }, 500);
      }, 300);
    }
  });
  
  socket.on('connect_error', (error) => {
    console.error('Erro de conexão ao socket:', error.message);
    incrementReconnectAttempts();
    setIsJoiningRoom(false);
    
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
    
    const pendingRoom = sessionStorage.getItem('pendingRoom');
    if (pendingRoom && !getIsJoiningRoom()) {
      setTimeout(() => {
        console.log('Retomando entrada na sala após autenticação:', pendingRoom);
        socketApi.joinRoom(pendingRoom);
      }, 500);
    } else {
      setTimeout(() => {
        socket.emit('getRooms');
      }, 300);
    }
  });
  
  socket.on('roomsList', (rooms) => {
    console.log('Recebida lista de salas:', rooms);
    store.dispatch(setRooms(rooms));
  });
  
  socket.on('roomJoined', (room) => {
    console.log('Entrou na sala:', room);
    setIsJoiningRoom(false);
    sessionStorage.removeItem('pendingRoom');
    store.dispatch(setCurrentRoom(room));
  });
  
  socket.on('roomLeft', () => {
    console.log('Saiu da sala');
    setIsJoiningRoom(false);
    store.dispatch(leaveRoom());
    store.dispatch(resetCountryState());
  });
  
  socket.on('roomCreated', (data) => {
    console.log('Sala criada:', data);
    if (data.success) {
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
      sessionStorage.setItem('myCountry', state.country);
    }
  });
  
  // ======================================================================
  // EVENTOS DE ESTADO DE PAÍS
  // ======================================================================

  socket.on('countryStatesInitialized', (data) => {
    console.log('Estados de países inicializados:', data);
    store.dispatch(initializeCountryStates(data));
  });

  socket.on('countryStatesUpdated', (data) => {
    store.dispatch(updateCountryStates(data));
  });

  socket.on('countryState', (data) => {
    console.log('Estado de país recebido:', data);
  });

  socket.on('countryStateUpdated', (data) => {
    console.log('Estado de país atualizado:', data);
    store.dispatch(updateCountryState({
      roomName: data.roomName,
      countryName: data.countryName,
      category: data.category,
      updates: data.state[data.category],
      timestamp: data.timestamp
    }));
  });
  
  // ======================================================================
  // ERROS E OUTROS EVENTOS
  // ======================================================================
  
  socket.on('error', (message) => {
    console.error('Erro do socket:', message);
    
    if (message.includes('sala') || message.includes('room')) {
      setIsJoiningRoom(false);
      sessionStorage.removeItem('pendingRoom');
    }
    
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
};