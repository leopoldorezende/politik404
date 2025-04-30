// src/services/socketService.js
import { io } from 'socket.io-client';

let socket;

export const initializeSocketConnection = (dispatch) => {
  socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin);

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  // Configurar event listeners para diferentes tipos de eventos
  socket.on('roomsList', (rooms) => {
    dispatch({ type: 'rooms/setRooms', payload: rooms });
  });

  socket.on('roomJoined', (room) => {
    dispatch({ type: 'rooms/setCurrentRoom', payload: room });
  });

  socket.on('chatMessage', (message) => {
    dispatch({ type: 'chat/addMessage', payload: message });
  });

  // ... outros listeners
};

// Funções para emitir eventos
export const authenticate = (username) => {
  socket.emit('authenticate', username);
};

export const joinRoom = (roomName) => {
  socket.emit('joinRoom', roomName);
};

export const sendChatMessage = (message) => {
  socket.emit('chatMessage', message);
};
