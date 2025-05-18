import socketApi, { SOCKET_EVENTS, COUNTRY_STATE_EVENTS, TRADE_EVENTS } from '../services/socketClient';

// Middleware refinado que usa o serviço socketApi centralizado
const socketMiddleware = store => next => action => {
  // Primeiro, execute a ação normalmente
  const result = next(action);
  
  // Depois, verifique se é uma ação relacionada ao socket e a encaminhe para o socketApi
  switch (action.type) {
    // Eventos principais
    case SOCKET_EVENTS.CONNECT:
      socketApi.connect();
      break;
      
    case SOCKET_EVENTS.AUTHENTICATE:
      socketApi.authenticate(action.payload);
      break;
      
    case SOCKET_EVENTS.GET_ROOMS:
      socketApi.getRooms();
      break;
      
    case SOCKET_EVENTS.CREATE_ROOM:
      socketApi.createRoom(action.payload);
      break;
      
    case SOCKET_EVENTS.JOIN_ROOM:
      socketApi.joinRoom(action.payload);
      break;
      
    case SOCKET_EVENTS.LEAVE_ROOM:
      socketApi.leaveRoom();
      break;
      
    case SOCKET_EVENTS.SEND_CHAT:
      const { content, isPrivate, recipient } = action.payload;
      socketApi.sendMessage(content, isPrivate, recipient);
      break;
      
    case SOCKET_EVENTS.REQUEST_CHAT_HISTORY:
      socketApi.requestPrivateHistory(action.payload);
      break;
      
    case SOCKET_EVENTS.REQUEST_COUNTRY:
      socketApi.requestCountry(action.payload);
      break;
      
    // Eventos de estado de país
    case COUNTRY_STATE_EVENTS.SUBSCRIBE:
      socketApi.subscribeToCountryStates(action.payload);
      break;
      
    case COUNTRY_STATE_EVENTS.UNSUBSCRIBE:
      socketApi.unsubscribeFromCountryStates(action.payload);
      break;
      
    case COUNTRY_STATE_EVENTS.GET_STATE:
      socketApi.getCountryState(action.payload.roomName, action.payload.countryName);
      break;
      
    case COUNTRY_STATE_EVENTS.UPDATE_STATE:
      socketApi.updateCountryState(
        action.payload.roomName,
        action.payload.countryName,
        action.payload.category,
        action.payload.updates
      );
      break;
    
    // Eventos de comércio
    case TRADE_EVENTS.CREATE_AGREEMENT:
      socketApi.createTradeAgreement(action.payload);
      break;
    
    case TRADE_EVENTS.CANCEL_AGREEMENT:
      socketApi.cancelTradeAgreement(action.payload);
      break;
    
    case TRADE_EVENTS.GET_AGREEMENTS:
      socketApi.getTradeAgreements();
      break;

    default:
      // Não faz nada para outras ações
      break;
  }
  
  return result;
};

export { COUNTRY_STATE_EVENTS, TRADE_EVENTS };

export default socketMiddleware;