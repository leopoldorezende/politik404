import socketApi, { SOCKET_EVENTS } from '../services/socketClient';

// Definições adicionais para os novos eventos do socket
const ECONOMY_EVENTS = {
  GET_ECONOMY_DATA: 'socket/getEconomyData',
  ADJUST_INTEREST_RATE: 'socket/adjustInterestRate',
  ADJUST_TAX_BURDEN: 'socket/adjustTaxBurden',
  ADJUST_PUBLIC_SERVICES: 'socket/adjustPublicServices',
  CREATE_ECONOMIC_EVENT: 'socket/createEconomicEvent',
};

const POLITICS_EVENTS = {
  GET_ALLIANCES: 'socket/getAlliances',
  GET_APPROVAL: 'socket/getApproval',
  CREATE_ALLIANCE: 'socket/createAlliance',
  BREAK_ALLIANCE: 'socket/breakAlliance',
  IMPOSE_SANCTIONS: 'socket/imposeSanctions',
  LIFT_SANCTIONS: 'socket/liftSanctions',
  CLOSE_BORDERS: 'socket/closeBorders',
  OPEN_BORDERS: 'socket/openBorders',
  SIGN_TREATY: 'socket/signTreaty',
  CANCEL_TREATY: 'socket/cancelTreaty',
  START_PROPAGANDA: 'socket/startPropaganda',
  QUELL_PROTESTS: 'socket/quellProtests',
  BUY_PARLIAMENT: 'socket/buyParliament'
};

// Novos eventos militares simplificados
const MILITARY_EVENTS = {
  GET_MILITARY_DATA: 'socket/getMilitaryData',
  INVEST_MILITARY: 'socket/investMilitary',    // Novo
  ATTACK_COUNTRY: 'socket/attackCountry',      // Repurposed
  GET_WAR_ACTIONS: 'socket/getWarActions',     // Novo
  UPDATE_WAR_STATUS: 'socket/updateWarStatus', // Novo
};

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
      
    // Eventos de economia
    case ECONOMY_EVENTS.GET_ECONOMY_DATA:
      socketApi.getEconomyData();
      break;
      
    case ECONOMY_EVENTS.ADJUST_INTEREST_RATE:
      socketApi.adjustInterestRate(action.payload);
      break;
      
    case ECONOMY_EVENTS.ADJUST_TAX_BURDEN:
      socketApi.adjustTaxBurden(action.payload);
      break;
      
    case ECONOMY_EVENTS.ADJUST_PUBLIC_SERVICES:
      socketApi.adjustPublicServices(action.payload);
      break;
      
    case ECONOMY_EVENTS.CREATE_ECONOMIC_EVENT:
      socketApi.createEconomicEvent(action.payload);
      break;
      
    // Eventos de política
    case POLITICS_EVENTS.GET_ALLIANCES:
      socketApi.getAlliances();
      break;
      
    case POLITICS_EVENTS.GET_APPROVAL:
      socketApi.getApproval();
      break;
      
    case POLITICS_EVENTS.CREATE_ALLIANCE:
      socketApi.createAlliance(action.payload);
      break;
      
    case POLITICS_EVENTS.BREAK_ALLIANCE:
      socketApi.breakAlliance(action.payload);
      break;
      
    case POLITICS_EVENTS.IMPOSE_SANCTIONS:
      socketApi.imposeSanctions(action.payload);
      break;
      
    case POLITICS_EVENTS.LIFT_SANCTIONS:
      socketApi.liftSanctions(action.payload);
      break;
      
    case POLITICS_EVENTS.CLOSE_BORDERS:
      socketApi.closeBorders(action.payload);
      break;
      
    case POLITICS_EVENTS.OPEN_BORDERS:
      socketApi.openBorders(action.payload);
      break;
      
    case POLITICS_EVENTS.SIGN_TREATY:
      socketApi.signTreaty(action.payload);
      break;
      
    case POLITICS_EVENTS.CANCEL_TREATY:
      socketApi.cancelTreaty(action.payload);
      break;
      
    case POLITICS_EVENTS.START_PROPAGANDA:
      socketApi.startPropaganda(action.payload);
      break;
      
    case POLITICS_EVENTS.QUELL_PROTESTS:
      socketApi.quellProtests(action.payload);
      break;
      
    case POLITICS_EVENTS.BUY_PARLIAMENT:
      socketApi.buyParliament(action.payload);
      break;
      
    // Eventos militares (novos eventos simplificados)
    case MILITARY_EVENTS.GET_MILITARY_DATA:
      socketApi.getMilitaryData();
      break;
      
    case MILITARY_EVENTS.INVEST_MILITARY:
      // Novo método que precisará ser adicionado ao socketApi
      if (socketApi.investMilitary) {
        socketApi.investMilitary(action.payload);
      } else {
        console.warn('socketApi.investMilitary não está implementado');
        // Fallback para método existente próximo
        socketApi.getMilitaryData();
      }
      break;
      
    case MILITARY_EVENTS.ATTACK_COUNTRY:
      // Repurposed para incluir diferentes estratégias
      if (socketApi.attackCountry) {
        socketApi.attackCountry(action.payload);
      } else {
        console.warn('socketApi.attackCountry não está implementado');
      }
      break;
      
    case MILITARY_EVENTS.GET_WAR_ACTIONS:
      // Novo método que precisará ser adicionado ao socketApi
      if (socketApi.getWarActions) {
        socketApi.getWarActions();
      } else {
        console.warn('socketApi.getWarActions não está implementado');
        // Fallback para método existente próximo
        socketApi.getMilitaryData();
      }
      break;
      
    case MILITARY_EVENTS.UPDATE_WAR_STATUS:
      // Novo método que precisará ser adicionado ao socketApi
      if (socketApi.updateWarStatus) {
        socketApi.updateWarStatus(action.payload);
      } else {
        console.warn('socketApi.updateWarStatus não está implementado');
      }
      break;
      
    default:
      // Não faz nada para outras ações
      break;
  }
  
  return result;
};

// Exporta os constantes de eventos para uso em outros arquivos
export { ECONOMY_EVENTS, POLITICS_EVENTS, MILITARY_EVENTS };

export default socketMiddleware;