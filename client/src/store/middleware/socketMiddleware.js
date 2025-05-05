import socketApi, { SOCKET_EVENTS } from '../../modules/network/socketService';

// Middleware simplificado que usa o serviço socketApi centralizado
const socketMiddleware = store => next => action => {
  // Primeiro, execute a ação normalmente
  const result = next(action);
  
  // Depois, verifique se é uma ação relacionada ao socket e a encaminhe para o socketApi
  switch (action.type) {
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
      
    case SOCKET_EVENTS.GET_ECONOMY:
      socketApi.getEconomyData();
      break;
      
    case SOCKET_EVENTS.ADJUST_INTEREST:
      socketApi.adjustInterestRate(action.payload);
      break;
      
    case SOCKET_EVENTS.ADJUST_TAX:
      socketApi.adjustTaxBurden(action.payload);
      break;
      
    case SOCKET_EVENTS.ADJUST_SERVICES:
      socketApi.adjustPublicServices(action.payload);
      break;
      
    case SOCKET_EVENTS.CREATE_ECONOMIC_EVENT:
      socketApi.createEconomicEvent(action.payload);
      break;
      
    default:
      // Não faz nada para outras ações
      break;
  }
  
  return result;
};

export default socketMiddleware;