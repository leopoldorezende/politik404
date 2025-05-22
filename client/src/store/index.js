import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../modules/auth/authState';
import roomsReducer from '../modules/room/roomState';
import gameReducer from '../modules/game/gameState';
import chatReducer from '../modules/chat/chatState';
import countryStateReducer from '../modules/country/countryStateSlice';
import tradeReducer from '../modules/trade/tradeState';
import advancedEconomyReducer from '../modules/economy/economySlice';
import socketMiddleware from './socketReduxMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    rooms: roomsReducer,
    game: gameReducer,
    chat: chatReducer,
    countryState: countryStateReducer,
    trade: tradeReducer,
    advancedEconomy: advancedEconomyReducer // Adicionado o reducer de economia avançada
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
          // Ações de comércio
          'socket/createTradeAgreement',
          'socket/cancelTradeAgreement',
          'socket/getTradeAgreements'
        ],
        // Ignorar caminhos no estado que podem conter valores não serializáveis
        ignoredPaths: ['socket']
      } 
    }).concat(socketMiddleware),
});