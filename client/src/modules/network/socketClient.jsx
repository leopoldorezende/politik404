import { io } from 'socket.io-client';

console.log('[ENV] VITE_API_URL =', import.meta.env.VITE_API_URL);
console.log('[ENV] VITE_SOCKET_URL =', import.meta.env.VITE_SOCKET_URL);

let socket;

export const initializeSocketConnection = (dispatch) => {
  const baseUrl = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;
  console.log(`🔌 Conectando socket em: ${baseUrl}`);

  if (!baseUrl) {
    console.error('❌ VITE_SOCKET_URL não está definido. Verifique seu .env');
    return;
  }

  socket = io(baseUrl, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  window.socket = socket;

  socket.on('connect', () => {
    console.log('✅ Socket conectado com sucesso');
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Erro de conexão com o socket:', err.message);
  });

  socket.on('roomsList', (rooms) => {
    dispatch({ type: 'rooms/setRooms', payload: rooms });
  });

  socket.on('roomJoined', (room) => {
    dispatch({ type: 'rooms/setCurrentRoom', payload: room });
  });

  socket.on('chatMessage', (message) => {
    dispatch({ type: 'chat/addMessage', payload: message });
  });

  // Outros listeners...
};

export const authenticate = (username) => {
  if (socket?.connected) {
    socket.emit('authenticate', username);
  } else {
    console.warn('⚠️ Socket não conectado. Tentativa de autenticação ignorada.');
  }
};

export const joinRoom = (roomName) => {
  if (socket?.connected) {
    socket.emit('joinRoom', roomName);
  }
};

export const sendChatMessage = (message) => {
  if (socket?.connected) {
    socket.emit('chatMessage', message);
  }
};