import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../modules/auth/authState';
import roomsReducer from '../modules/room/roomState';
import gameReducer from '../modules/game/gameState';
import chatReducer from '../modules/chat/chatState';
import economyReducer from '../modules/economy/economyState';
import politicsReducer from '../modules/politics/politicsState';
import militaryReducer from '../modules/military/militaryState';
import socketMiddleware from './socketReduxMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    rooms: roomsReducer,
    game: gameReducer,
    chat: chatReducer,
    economy: economyReducer,
    politics: politicsReducer,
    military: militaryReducer,
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
          // Ações de economia
          'socket/getEconomyData',
          'socket/adjustInterestRate',
          'socket/adjustTaxBurden',
          'socket/adjustPublicServices',
          // Ações de política
          'socket/getAlliances',
          'socket/createAlliance',
          'socket/breakAlliance',
          'socket/imposeSanctions',
          'socket/liftSanctions',
          // Ações militares
          'socket/getMilitaryData',
          'socket/deployUnit',
          'socket/moveUnit',
          'socket/attackCountry',
          'socket/declareWar',
          'socket/proposePeace',
        ],
        // Ignorar caminhos no estado que podem conter valores não serializáveis
        ignoredPaths: ['socket']
      }
    }).concat(socketMiddleware),
});