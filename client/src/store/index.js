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
    getDefaultMiddleware().concat(socketMiddleware),
});