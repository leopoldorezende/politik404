import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../modules/auth/authState';
import roomsReducer from '../modules/room/roomState';
import gameReducer from '../modules/game/gameState';
import chatReducer from '../modules/chat/chatState';
import countryStateReducer from '../modules/country/countryStateSlice';
import socketMiddleware from './socketReduxMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    rooms: roomsReducer,
    game: gameReducer,
    chat: chatReducer,
    countryState: countryStateReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignorar ações não serializáveis do socket.io
        ignoredActions: [
          'socket/connect', 
          'socket/authenticate', 
          'error/socketError', 
          'error/connectionFailed',
          // Ações de estado de país
          'socket/subscribeToCountryStates',
          'socket/unsubscribeFromCountryStates',
          'socket/getCountryState',
          'socket/updateCountryState',
        ],
        // Ignorar caminhos no estado que podem conter valores não serializáveis
        ignoredPaths: ['socket']
      } 
    }).concat(socketMiddleware),
});