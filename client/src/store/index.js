import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import roomsReducer from './slices/roomsSlice';
import gameReducer from './slices/gameSlice';
import shipsReducer from './slices/shipsSlice';
import chatReducer from './slices/chatSlice';
import socketReduxMiddleware from './middleware/socketReduxMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    rooms: roomsReducer,
    game: gameReducer,
    ships: shipsReducer,
    chat: chatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(socketReduxMiddleware),
});