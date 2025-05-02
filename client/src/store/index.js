import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../modules/auth/authState';
import roomsReducer from '../modules/room/roomState';
import gameReducer from '../modules/game/gameState';
import shipsReducer from '../modules/military/shipsState';
import chatReducer from '../modules/chat/chatState';
import socketMiddleware from './middleware/socketMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    rooms: roomsReducer,
    game: gameReducer,
    ships: shipsReducer,
    chat: chatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignorar ações não serializáveis do socket.io que podem causar warnings
        ignoredActions: ['socket/connect', 'socket/authenticate'],
        // Ignorar caminhos no estado que podem conter valores não serializáveis
        ignoredPaths: ['socket']
      }
    }).concat(socketMiddleware),
});