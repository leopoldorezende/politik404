import { io } from 'socket.io-client';
import { setMyCountry, setPlayers, setPlayerOnlineStatus, setOnlinePlayers, 
         updateEconomyData, addEconomicEvent, setEconomyConfig, applyPolicyChange } from '../../modules/game/gameState';
import { addMessage, setChatHistory } from '../../modules/chat/chatState';

// Mantém uma instância singleton do socket
let socketInstance = null;

// Contador de tentativas de reconexão
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Função para criar um id de sessão único
const generateSessionId = () => {
  if (!localStorage.getItem('clientSessionId')) {
    const sessionId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('clientSessionId', sessionId);
  }
  return localStorage.getItem('clientSessionId');
};

const socketMiddleware = store => {
  let socket = null;

  return next => action => {
    const { dispatch } = store;

    if (action.type === 'socket/connect') {
      // Evitar múltiplas conexões - usar instância existente se possível
      if (socketInstance && socketInstance.connected) {
        console.log('Reutilizando conexão de socket existente:', socketInstance.id);
        socket = socketInstance;
        return next(action);
      }
      
      // Se há uma instância desconectada, desconectar explicitamente
      if (socketInstance) {
        console.log('Descartando instância de socket desconectada');
        socketInstance.disconnect();
        socketInstance = null;
      }
      
      // Obter a URL do socket do ambiente ou usar a origem da página
      const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
      console.log('Conectando ao servidor socket:', socketUrl);
      
      // Configurações de conexão
      const sessionId = generateSessionId();
      const connectionOptions = {
        withCredentials: true,
        transports: ['polling'], // IMPORTANTE: Usar apenas polling para evitar problemas com WebSocket
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        query: {
          clientSessionId: sessionId
        }
      };
      
      // Iniciar a conexão
      socket = io(socketUrl, connectionOptions);
      socketInstance = socket; // Guardar a instância para reutilização
      
      // Para fácil acesso via console para debugging
      window.socket = socket;
      
      socket.on('connect', () => {
        console.log('Conectado ao servidor socket com ID:', socket.id, 'via', socket.io.engine.transport.name);
        reconnectAttempts = 0; // Resetar contador de tentativas
        
        // Se o usuário já estiver autenticado, reautenticar
        const username = sessionStorage.getItem('username');
        if (username) {
          console.log('Reautenticando usuário após conexão:', username);
          socket.emit('authenticate', username);
        }
      });
      
      // Eventos de reconexão
      socket.io.on("reconnect_attempt", (attempt) => {
        console.log(`Tentativa de reconexão #${attempt}`);
        reconnectAttempts = attempt;
      });
      
      socket.io.on("reconnect", (attempt) => {
        console.log(`Reconectado com sucesso após ${attempt} tentativas`);
        
        // Re-autenticar após reconexão
        const username = sessionStorage.getItem('username');
        if (username) {
          console.log('Reautenticando após reconexão:', username);
          socket.emit('authenticate', username);
        }
      });
      
      socket.on('connect_error', (error) => {
        console.error('Erro de conexão ao socket:', error.message);
        reconnectAttempts++;
        
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.error(`Falha após ${MAX_RECONNECT_ATTEMPTS} tentativas. Desistindo.`);
          alert('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
        }
      });
      
      socket.on('roomsList', (rooms) => {
        console.log('Recebida lista de salas:', rooms);
        dispatch({ type: 'rooms/setRooms', payload: rooms });
      });
      
      socket.on('roomJoined', (room) => {
        console.log('Entrou na sala:', room);
        dispatch({ type: 'rooms/setCurrentRoom', payload: room });
      });
      
      socket.on('roomCreated', (data) => {
        console.log('Sala criada:', data);
        if (data.success) {
          // Atualizar lista de salas
          socket.emit('getRooms');
        }
      });
      
      socket.on('chatMessage', (message) => {
        console.log('Mensagem de chat recebida:', message);
        dispatch(addMessage(message));
      });
      
      socket.on('chatHistory', (data) => {
        console.log('Histórico de chat recebido:', data);
        dispatch(setChatHistory(data));
      });
      
      socket.on('playersList', (players) => {
        console.log('Lista de jogadores recebida:', players);
        dispatch(setPlayers(players));
        
        // Extrair usernames para lista de jogadores online
        const onlinePlayers = players.map(player => {
          if (typeof player === 'object' && player.username) {
            return player.username;
          }
          
          if (typeof player === 'string') {
            // Format: "username (country)"
            const match = player.match(/^(.*?)\s*\(/);
            return match ? match[1] : player;
          }
          
          return '';
        }).filter(Boolean);
        
        dispatch(setOnlinePlayers(onlinePlayers));
      });
      
      // Ouvir atualizações de status online
      socket.on('playerOnlineStatus', ({ username, isOnline }) => {
        console.log(`Jogador ${username} agora está ${isOnline ? 'online' : 'offline'}`);
        dispatch(setPlayerOnlineStatus({ username, isOnline }));
      });
      
      // Evento para receber o país atribuído
      socket.on('countryAssigned', (country) => {
        console.log('País atribuído:', country);
        dispatch(setMyCountry(country));
        
        // Salvar o país no sessionStorage para persistência
        sessionStorage.setItem('myCountry', country);
      });
      
      // Evento para restaurar o estado do jogador
      socket.on('stateRestored', (state) => {
        console.log('Estado restaurado:', state);
        if (state && state.country) {
          dispatch(setMyCountry(state.country));
          sessionStorage.setItem('myCountry', state.country);
        }
      });
      
      // Eventos relacionados à economia
      socket.on('economyUpdated', (economyData) => {
        console.log('Economia atualizada:', economyData);
        dispatch(updateEconomyData(economyData));
      });
      
      socket.on('economyData', (data) => {
        console.log('Dados econômicos recebidos:', data);
        
        // Armazena os dados completos
        dispatch(updateEconomyData(data));
        
        // Armazena a configuração do sistema econômico
        if (data.config) {
          dispatch(setEconomyConfig(data.config));
        }
      });
      
      socket.on('economicEvent', (eventData) => {
        console.log('Evento econômico recebido:', eventData);
        dispatch(addEconomicEvent(eventData));
      });
      
      socket.on('policyChange', (policyData) => {
        console.log('Mudança de política recebida:', policyData);
        dispatch(applyPolicyChange(policyData));
      });
      
      // Tratar erros e avisar o usuário
      socket.on('error', (message) => {
        console.error('Erro do socket:', message);
        
        // Não mostrar alguns tipos de erros comuns para não irritar o usuário
        if (message.includes('já está em uso') || 
            message.includes('autenticação') || 
            message.includes('desconectado')) {
          // Log apenas, sem alerta
          console.warn('Erro sem alerta:', message);
        } else {
          // Erros importantes merecem um alerta
          alert(`Erro: ${message}`);
        }
      });
      
      // Tratar desconexão
      socket.on('disconnect', (reason) => {
        console.log('Desconectado do servidor. Motivo:', reason);
        
        // Se a desconexão foi iniciada pelo servidor, tentar reconectar
        if (reason === 'io server disconnect' || reason === 'transport close') {
          setTimeout(() => {
            console.log('Tentando reconectar após desconexão do servidor...');
            socket.connect();
          }, 2000);
        }
      });
    }
    
    if (action.type === 'socket/authenticate' && socket) {
      const username = action.payload;
      const sessionId = sessionStorage.getItem('clientSessionId');
    
      console.log('Autenticando com username:', username, 'e sessionId:', sessionId);
      socket.emit('authenticate', username, { clientSessionId: sessionId });
    
      // Salvar o nome de usuário no sessionStorage para persistência
      sessionStorage.setItem('username', username);
    }
    
    if (action.type === 'socket/getRooms' && socket) {
      console.log('Solicitando lista de salas');
      socket.emit('getRooms');
    }
    
    if (action.type === 'socket/createRoom' && socket) {
      console.log('Criando sala:', action.payload);
      socket.emit('createRoom', action.payload);
    }
    
    if (action.type === 'socket/joinRoom' && socket) {
      console.log('Entrando na sala:', action.payload);
      socket.emit('joinRoom', action.payload);
    }
    
    if (action.type === 'socket/leaveRoom' && socket) {
      console.log('Saindo da sala');
      socket.emit('leaveRoom');
      
      // Limpar o país do jogador quando sair da sala
      dispatch(setMyCountry(null));
      sessionStorage.removeItem('myCountry');
    }
    
    // Lida com o envio de mensagens de chat
    if (action.type === 'socket/sendChatMessage' && socket) {
      const { content, isPrivate, recipient } = action.payload;
      const username = sessionStorage.getItem('username');
      
      if (!username) {
        console.error('Não é possível enviar mensagem: Username não encontrado');
        return next(action);
      }
      
      console.log('Enviando mensagem de chat:', { 
        username, 
        message: content, 
        isPrivate, 
        recipient 
      });
      
      // Envia a mensagem no formato esperado pelo servidor
      socket.emit('chatMessage', { 
        username, 
        message: content, 
        isPrivate, 
        recipient
      });
    }
    
    // Solicitar histórico de chat privado
    if (action.type === 'socket/requestPrivateHistory' && socket) {
      console.log('Solicitando histórico de chat privado com:', action.payload);
      socket.emit('requestPrivateHistory', action.payload);
    }
    
    // Solicitar um país específico
    if (action.type === 'socket/requestCountry' && socket) {
      console.log('Solicitando país específico:', action.payload);
      socket.emit('requestCountry', action.payload);
    }
    
    // Action types para a economia
    if (action.type === 'socket/getEconomyData' && socket) {
      console.log('Solicitando dados econômicos atualizados');
      socket.emit('getEconomyData');
    }
    
    if (action.type === 'socket/adjustInterestRate' && socket) {
      console.log('Ajustando taxa de juros:', action.payload);
      socket.emit('adjustInterestRate', action.payload);
    }
    
    if (action.type === 'socket/adjustTaxBurden' && socket) {
      console.log('Ajustando carga tributária:', action.payload);
      socket.emit('adjustTaxBurden', action.payload);
    }
    
    if (action.type === 'socket/adjustPublicServices' && socket) {
      console.log('Ajustando serviços públicos:', action.payload);
      socket.emit('adjustPublicServices', action.payload);
    }
    
    if (action.type === 'socket/createEconomicEvent' && socket) {
      console.log('Criando evento econômico:', action.payload);
      socket.emit('createEconomicEvent', action.payload);
    }
    
    return next(action);
  };
};

export default socketMiddleware;