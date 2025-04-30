import { io } from 'socket.io-client';
import { setMyCountry, setPlayers, setPlayerOnlineStatus, setOnlinePlayers, 
         updateEconomyData, addEconomicEvent, setEconomyConfig, applyPolicyChange } from '../slices/gameSlice';
import { addMessage, setChatHistory } from '../slices/chatSlice';

const socketReduxMiddleware = store => {
  let socket = null;

  return next => action => {
    const { dispatch } = store;

    if (action.type === 'socket/connect') {
      // Avoid multiple connections
      if (socket) socket.disconnect();
      
      // Connect to server
      socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin);
      
      socket.on('connect', () => {
        console.log('Connected to socket server with ID:', socket.id);
      });
      
      socket.on('roomsList', (rooms) => {
        console.log('Received rooms list:', rooms);
        dispatch({ type: 'rooms/setRooms', payload: rooms });
      });
      
      socket.on('roomJoined', (room) => {
        console.log('Joined room:', room);
        dispatch({ type: 'rooms/setCurrentRoom', payload: room });
      });
      
      socket.on('roomCreated', (data) => {
        console.log('Room created:', data);
        if (data.success) {
          // Update room list
          socket.emit('getRooms');
        }
      });
      
      socket.on('chatMessage', (message) => {
        console.log('Received chat message:', message);
        dispatch(addMessage(message));
      });
      
      socket.on('chatHistory', (data) => {
        console.log('Received chat history:', data);
        dispatch(setChatHistory(data));
      });
      
      socket.on('playersList', (players) => {
        console.log('Received players list:', players);
        dispatch(setPlayers(players));
        
        // Extract usernames for online players list
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
      
      // Listen for online status updates
      socket.on('playerOnlineStatus', ({ username, isOnline }) => {
        console.log(`Player ${username} is now ${isOnline ? 'online' : 'offline'}`);
        dispatch(setPlayerOnlineStatus({ username, isOnline }));
      });
      
      // Novo evento para receber o país atribuído
      socket.on('countryAssigned', (country) => {
        console.log('Country assigned:', country);
        dispatch(setMyCountry(country));
        
        // Salvar o país no sessionStorage para persistência
        sessionStorage.setItem('myCountry', country);
      });
      
      // Evento para restaurar o estado do jogador
      socket.on('stateRestored', (state) => {
        console.log('State restored:', state);
        if (state && state.country) {
          dispatch(setMyCountry(state.country));
          sessionStorage.setItem('myCountry', state.country);
        }
      });
      
      // Novos eventos relacionados à economia
      
      // Recebe atualizações econômicas periódicas
      socket.on('economyUpdated', (economyData) => {
        console.log('Economy updated:', economyData);
        dispatch(updateEconomyData(economyData));
      });
      
      // Recebe dados econômicos completos
      socket.on('economyData', (data) => {
        console.log('Received economy data:', data);
        
        // Armazena os dados completos
        dispatch(updateEconomyData(data));
        
        // Armazena a configuração do sistema econômico
        if (data.config) {
          dispatch(setEconomyConfig(data.config));
        }
      });
      
      // Recebe evento econômico especial
      socket.on('economicEvent', (eventData) => {
        console.log('Economic event received:', eventData);
        dispatch(addEconomicEvent(eventData));
      });
      
      // Recebe notificação de mudança de política
      socket.on('policyChange', (policyData) => {
        console.log('Policy change received:', policyData);
        dispatch(applyPolicyChange(policyData));
      });
      
      socket.on('error', (message) => {
        console.error('Socket error:', message);
        alert(`Error: ${message}`);
      });
    }
    
    if (action.type === 'socket/authenticate' && socket) {
      console.log('Authenticating with username:', action.payload);
      socket.emit('authenticate', action.payload);
      
      // Salvar o nome de usuário no sessionStorage para persistência
      sessionStorage.setItem('username', action.payload);
    }
    
    if (action.type === 'socket/getRooms' && socket) {
      console.log('Requesting rooms list');
      socket.emit('getRooms');
    }
    
    if (action.type === 'socket/createRoom' && socket) {
      console.log('Creating room:', action.payload);
      socket.emit('createRoom', action.payload);
    }
    
    if (action.type === 'socket/joinRoom' && socket) {
      console.log('Joining room:', action.payload);
      socket.emit('joinRoom', action.payload);
    }
    
    if (action.type === 'socket/leaveRoom' && socket) {
      console.log('Leaving room');
      socket.emit('leaveRoom');
      
      // Limpar o país do jogador quando sair da sala
      dispatch(setMyCountry(null));
      sessionStorage.removeItem('myCountry');
    }
    
    // Updated to correctly handle chat message sending
    if (action.type === 'socket/sendChatMessage' && socket) {
      const { content, isPrivate, recipient } = action.payload;
      const username = sessionStorage.getItem('username');
      
      if (!username) {
        console.error('Cannot send message: Username not found');
        return next(action);
      }
      
      console.log('Sending chat message:', { 
        username, 
        message: content, 
        isPrivate, 
        recipient 
      });
      
      // Send message with the right format expected by the server
      socket.emit('chatMessage', { 
        username, 
        message: content, 
        isPrivate, 
        recipient
      });
    }
    
    // Novo action type para solicitar histórico de chat privado
    if (action.type === 'socket/requestPrivateHistory' && socket) {
      console.log('Requesting private chat history with:', action.payload);
      socket.emit('requestPrivateHistory', action.payload);
    }
    
    // Novo action type para solicitar um país específico
    if (action.type === 'socket/requestCountry' && socket) {
      console.log('Requesting specific country:', action.payload);
      socket.emit('requestCountry', action.payload);
    }
    
    // Novos action types para a economia
    
    // Solicita dados econômicos atualizados
    if (action.type === 'socket/getEconomyData' && socket) {
      console.log('Requesting updated economy data');
      socket.emit('getEconomyData');
    }
    
    // Ajusta a taxa de juros
    if (action.type === 'socket/adjustInterestRate' && socket) {
      console.log('Adjusting interest rate:', action.payload);
      socket.emit('adjustInterestRate', action.payload);
    }
    
    // Ajusta a carga tributária
    if (action.type === 'socket/adjustTaxBurden' && socket) {
      console.log('Adjusting tax burden:', action.payload);
      socket.emit('adjustTaxBurden', action.payload);
    }
    
    // Ajusta os serviços públicos
    if (action.type === 'socket/adjustPublicServices' && socket) {
      console.log('Adjusting public services:', action.payload);
      socket.emit('adjustPublicServices', action.payload);
    }
    
    // Cria um evento econômico (apenas para admins ou testes)
    if (action.type === 'socket/createEconomicEvent' && socket) {
      console.log('Creating economic event:', action.payload);
      socket.emit('createEconomicEvent', action.payload);
    }
    
    return next(action);
  };
};

export default socketReduxMiddleware;