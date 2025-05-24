import { store } from '../store';
import { setRooms, setCurrentRoom, leaveRoom } from '../modules/room/roomState';
import { setMyCountry, setPlayers, setPlayerOnlineStatus, setOnlinePlayers } from '../modules/game/gameState';
import { addMessage, setChatHistory } from '../modules/chat/chatState';

import {
  initializeCountryStates,
  updateSingleCountryState,
  updateCountryStates,
  updateEconomicParameters,
  updateCountryDebt,
  resetState as resetCountryState
} from '../modules/country/countryStateSlice';
import {
  addTradeAgreement,
  removeTradeAgreement,
  resetTradeState,
  updateStats
} from '../modules/trade/tradeState';
import { 
  setReconnectAttempts, 
  incrementReconnectAttempts,
  setIsJoiningRoom,
  getIsJoiningRoom,
  getMaxReconnectAttempts
} from './socketConnection';

// Import do serviço de mensagens para mostrar toasts
import MessageService from '../ui/toast/messageService';

// Variáveis para controlar autenticação e evitar spam
let lastAuthTime = 0;
let isAuthenticated = false;
let authenticationInProgress = false;
const AUTH_COOLDOWN = 2000; // 2 segundos entre autenticações

// Configurar todos os eventos do socket
export const setupSocketEvents = (socket, socketApi) => {
  if (!socket) return;
  
  // Remover listeners anteriores se existirem para evitar duplicação
  const eventsToClean = [
    'connect', 'disconnect', 'connect_error', 'authenticated', 'authenticationIgnored',
    'roomsList', 'roomJoined', 'roomLeft', 'roomCreated', 'roomDeleted',
    'chatMessage', 'chatHistory', 'playersList', 'playerOnlineStatus',
    'countryAssigned', 'stateRestored', 'countryStatesInitialized',
    'countryStatesUpdated', 'countryState', 'countryStateUpdated',
    'tradeProposalReceived', 'tradeProposalResponse', 'tradeProposalProcessed',
    'tradeAgreementCancelled', 'tradeAgreementsList', 'tradeAgreementUpdated',
    // Eventos econômicos
    'debtBondsIssued', 'emergencyBondsIssued', 'debtSummaryResponse',
    'economicParameterUpdated',
    'error', 'pong'
  ];
  
  eventsToClean.forEach(eventName => {
    socket.off(eventName);
  });
  
  // Reset de variáveis de controle
  isAuthenticated = false;
  authenticationInProgress = false;
  
  // ======================================================================
  // EVENTOS BASE DO SOCKET
  // ======================================================================
  
  socket.on('connect', () => {
    console.log('Conectado ao servidor socket com ID:', socket.id);
    setReconnectAttempts(0);
    setIsJoiningRoom(false);
    
    // Reautenticar automaticamente se houver um usuário guardado
    const username = sessionStorage.getItem('username');
    if (username && !isAuthenticated && !authenticationInProgress) {
      console.log('Reautenticando usuário após conexão:', username);
      
      const now = Date.now();
      
      // Verificar cooldown de autenticação
      if (now - lastAuthTime >= AUTH_COOLDOWN) {
        lastAuthTime = now;
        authenticationInProgress = true;
        
        setTimeout(() => {
          if (!isAuthenticated && authenticationInProgress) {
            console.log('Enviando autenticação para:', username);
            socket.emit('authenticate', username, { 
              clientSessionId: sessionStorage.getItem('clientSessionId'),
              reconnect: true
            });
          }
        }, 500); // Aguardar meio segundo para estabilizar
      } else {
        console.log('Autenticação em cooldown, aguardando...');
      }
    }
  });
  
  socket.io.on("reconnect_attempt", (attempt) => {
    console.log(`Tentativa de reconexão #${attempt}`);
    setReconnectAttempts(attempt);
    
    // Reset de autenticação em tentativas de reconexão
    isAuthenticated = false;
    authenticationInProgress = false;
  });
  
  socket.io.on("reconnect", (attempt) => {
    console.log(`Reconectado com sucesso após ${attempt} tentativas`);
    setIsJoiningRoom(false);
    
    // Reset de variáveis de autenticação
    isAuthenticated = false;
    authenticationInProgress = false;
    
    const username = sessionStorage.getItem('username');
    if (username) {
      console.log('Reautenticando após reconexão:', username);
      
      const now = Date.now();
      if (now - lastAuthTime >= AUTH_COOLDOWN) {
        lastAuthTime = now;
        authenticationInProgress = true;
        
        setTimeout(() => {
          if (!isAuthenticated && authenticationInProgress) {
            socket.emit('authenticate', username, { 
              clientSessionId: sessionStorage.getItem('clientSessionId'),
              reconnect: true
            });
          }
          
          // Solicitar lista de salas após autenticação
          setTimeout(() => {
            if (isAuthenticated) {
              socket.emit('getRooms');
            }
          }, 1000);
        }, 1500); // Aguardar mais tempo após reconexão
      }
    }
  });
  
  socket.on('connect_error', (error) => {
    console.error('Erro de conexão ao socket:', error.message);
    incrementReconnectAttempts();
    setIsJoiningRoom(false);
    
    // Reset de autenticação em erro
    isAuthenticated = false;
    authenticationInProgress = false;
    
    if (incrementReconnectAttempts() >= getMaxReconnectAttempts()) {
      console.error(`Falha após ${getMaxReconnectAttempts()} tentativas. Desistindo.`);
      store.dispatch({
        type: 'error/connectionFailed',
        payload: 'Não foi possível conectar ao servidor. Tente novamente mais tarde.'
      });
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Desconectado do servidor. Motivo:', reason);
    setIsJoiningRoom(false);
    
    // Reset de autenticação ao desconectar
    isAuthenticated = false;
    authenticationInProgress = false;
    
    if (reason === 'io server disconnect' || reason === 'transport close') {
      setTimeout(() => {
        console.log('Tentando reconectar após desconexão do servidor...');
        socket.connect();
      }, 2000);
    }
  });
  
  // ======================================================================
  // EVENTOS DE AUTENTICAÇÃO E SALAS
  // ======================================================================
  
  socket.on('authenticated', (data) => {
    console.log('Autenticação bem-sucedida:', data);
    
    // Marcar como autenticado para evitar spam
    isAuthenticated = true;
    authenticationInProgress = false;
    
    const pendingRoom = sessionStorage.getItem('pendingRoom');
    if (pendingRoom && !getIsJoiningRoom()) {
      setTimeout(() => {
        console.log('Retomando entrada na sala após autenticação:', pendingRoom);
        socketApi.joinRoom(pendingRoom);
      }, 1000); // Aguardar mais tempo após autenticação
    } else {
      setTimeout(() => {
        console.log('Solicitando lista de salas após autenticação');
        socket.emit('getRooms');
      }, 500);
    }
  });
  
  // Handler para evitar múltiplas autenticações
  socket.on('authenticationIgnored', (data) => {
    console.log('Autenticação ignorada pelo servidor:', data);
    isAuthenticated = true;
    authenticationInProgress = false;
    
    // Ainda assim, solicitar salas se necessário
    setTimeout(() => {
      socket.emit('getRooms');
    }, 500);
  });
  
  socket.on('roomsList', (rooms) => {
    console.log('Recebida lista de salas:', rooms);
    store.dispatch(setRooms(rooms));
  });
  
  socket.on('roomJoined', (room) => {
    console.log('Entrou na sala:', room);
    setIsJoiningRoom(false);
    sessionStorage.removeItem('pendingRoom');
    store.dispatch(setCurrentRoom(room));
  });
  
  socket.on('roomLeft', () => {
    console.log('Saiu da sala');
    setIsJoiningRoom(false);
    store.dispatch(leaveRoom());
    store.dispatch(resetCountryState());
    store.dispatch(resetTradeState());
  });
  
  socket.on('roomCreated', (data) => {
    console.log('Sala criada:', data);
    if (data.success) {
      socket.emit('getRooms');
    }
  });
  
  // Handler para quando a sala é deletada (manual ou automaticamente)
  socket.on('roomDeleted', (data) => {
    console.log('Sala deletada:', data);
    // Faz o mesmo que roomLeft - volta para a tela de salas
    store.dispatch(leaveRoom());
    store.dispatch(resetCountryState());
    store.dispatch(resetTradeState());
    
    // Opcional: mostrar alerta para o usuário
    if (data.message) {
      MessageService.showWarning(data.message, 4000);
    }
  });
  
  // ======================================================================
  // EVENTOS DE CHAT
  // ======================================================================
  
  socket.on('chatMessage', (message) => {
    console.log('Mensagem de chat recebida:', message);
    store.dispatch(addMessage(message));
  });
  
  socket.on('chatHistory', (data) => {
    console.log('Histórico de chat recebido:', data);
    store.dispatch(setChatHistory(data));
  });
  
  // ======================================================================
  // EVENTOS DE JOGADORES
  // ======================================================================
  
  socket.on('playersList', (players) => {
    console.log('Lista de jogadores recebida:', players);
    store.dispatch(setPlayers(players));
    
    const onlinePlayers = players
      .map(player => {
        if (typeof player === 'object' && player.username) {
          return player.username;
        }
        
        if (typeof player === 'string') {
          const match = player.match(/^(.*?)\s*\(/);
          return match ? match[1] : player;
        }
        
        return '';
      })
      .filter(Boolean);
    
    store.dispatch(setOnlinePlayers(onlinePlayers));
  });
  
  socket.on('playerOnlineStatus', ({ username, isOnline }) => {
    console.log(`Jogador ${username} agora está ${isOnline ? 'online' : 'offline'}`);
    store.dispatch(setPlayerOnlineStatus({ username, isOnline }));
  });
  
  socket.on('countryAssigned', (country) => {
    console.log('País atribuído:', country);
    store.dispatch(setMyCountry(country));
    sessionStorage.setItem('myCountry', country);
  });
  
  socket.on('stateRestored', (state) => {
    console.log('Estado restaurado:', state);
    if (state && state.country) {
      store.dispatch(setMyCountry(state.country));
      sessionStorage.setItem('myCountry', state.country);
    }
  });
  
  // ======================================================================
  // EVENTOS DE ESTADO DE PAÍS (CORRIGIDOS PARA REFLETIR DADOS DO SERVIDOR)
  // ======================================================================

  socket.on('countryStatesInitialized', (data) => {
    console.log('[ECONOMY] Estados de países inicializados:', data);
    
    const { roomName, states, timestamp } = data;
    
    if (roomName && states) {
      store.dispatch(initializeCountryStates({
        roomName,
        states,
        timestamp: timestamp || Date.now()
      }));
      
      console.log(`[ECONOMY] Dados econômicos carregados: ${Object.keys(states).length} países na sala ${roomName}`);
    }
  });

  socket.on('countryStatesUpdated', (data) => {
    const { roomName, states, timestamp } = data;
    
    if (roomName && states) {
      // CORRIGIDO: Processar cada país para garantir formatação correta dos indicadores
      const processedStates = {};
      
      Object.keys(states).forEach(countryName => {
        const countryData = states[countryName];
        
        if (countryData.economy) {
          processedStates[countryName] = {
            ...countryData,
            economy: {
              ...countryData.economy,
              // CORRIGIDO: Converter inflação de decimal para porcentagem se necessário
              inflation: typeof countryData.economy.inflation === 'number' && countryData.economy.inflation < 1 
                ? countryData.economy.inflation * 100 
                : countryData.economy.inflation || 0,
              // CORRIGIDO: Garantir que todos os indicadores estejam presentes
              unemployment: countryData.economy.unemployment || 0,
              popularity: countryData.economy.popularity || 50,
              creditRating: countryData.economy.creditRating || 'A'
            }
          };
        } else {
          processedStates[countryName] = countryData;
        }
      });
      
      store.dispatch(updateCountryStates({
        roomName,
        states: processedStates,
        timestamp: timestamp || Date.now()
      }));
      
      // Log apenas ocasionalmente para evitar spam
      if (Date.now() % 10000 < 2000) { // A cada ~10 segundos
        console.log(`[ECONOMY] Estados atualizados para sala ${roomName}: ${Object.keys(processedStates).length} países`);
      }
    }
  });

  socket.on('countryState', (data) => {
    console.log('[ECONOMY] Estado de país específico recebido:', data);
    
    const { roomName, countryName, state, timestamp } = data;
    
    if (roomName && countryName && state) {
      store.dispatch(updateSingleCountryState({
        roomName,
        countryName,
        countryData: state,
        timestamp: timestamp || Date.now()
      }));
    }
  });

  socket.on('countryStateUpdated', (data) => {
    console.log('[ECONOMY] Estado de país atualizado:', data);
    
    const { roomName, countryName, category, state, timestamp } = data;
    
    if (roomName && countryName && state) {
      store.dispatch(updateSingleCountryState({
        roomName,
        countryName,
        countryData: state,
        timestamp: timestamp || Date.now()
      }));
    }
  });
  
  // ======================================================================
  // EVENTOS ECONÔMICOS ESPECÍFICOS
  // ======================================================================
  
  // Handler para confirmação de emissão de títulos
  socket.on('debtBondsIssued', (data) => {
    console.log('[ECONOMY] Títulos de dívida emitidos:', data);
    
    const { success, bondAmount, newTreasury, newPublicDebt, message, debtContract } = data;
    
    if (success) {
      MessageService.showSuccess(`Títulos emitidos: ${bondAmount} bi USD`, 4000);
      
      // Atualizar dados econômicos no Redux
      const currentRoom = store.getState().rooms.currentRoom;
      const myCountry = store.getState().game.myCountry;
      
      if (currentRoom?.name && myCountry) {
        store.dispatch(updateCountryDebt({
          roomName: currentRoom.name,
          countryName: myCountry,
          debtData: {
            treasury: { value: newTreasury, unit: 'bi USD' },
            publicDebt: newPublicDebt,
            debtRecords: debtContract ? [debtContract] : []
          },
          timestamp: Date.now()
        }));
      }
    } else {
      MessageService.showError(message || 'Falha na emissão de títulos');
    }
  });
  
  // Handler para emissão de títulos de emergência
  socket.on('emergencyBondsIssued', (data) => {
    console.log('[ECONOMY] Títulos de emergência emitidos:', data);
    
    const { success, message, newTreasury, newPublicDebt } = data;
    
    if (success) {
      MessageService.showWarning(`Emergência: ${message}`, 6000);
      
      // Atualizar dados no Redux
      const currentRoom = store.getState().rooms.currentRoom;
      const myCountry = store.getState().game.myCountry;
      
      if (currentRoom?.name && myCountry) {
        store.dispatch(updateCountryDebt({
          roomName: currentRoom.name,
          countryName: myCountry,
          debtData: {
            treasury: { value: newTreasury, unit: 'bi USD' },
            publicDebt: newPublicDebt
          },
          timestamp: Date.now()
        }));
      }
    } else {
      MessageService.showError(message || 'Falha na emissão de títulos de emergência');
    }
  });
  
  // Handler para confirmação de atualização de parâmetros econômicos
  socket.on('economicParameterUpdated', (data) => {
    console.log('[ECONOMY] Parâmetro econômico atualizado:', data);
    
    const { roomName, countryName, parameter, value, success } = data;
    
    if (success && roomName && countryName) {
      store.dispatch(updateEconomicParameters({
        roomName,
        countryName,
        parameters: { [parameter]: value },
        timestamp: Date.now()
      }));
    }
  });
  
  // Handler para resumo de dívidas
  socket.on('debtSummaryResponse', (data) => {
    console.log('[ECONOMY] Resumo de dívidas recebido:', data);
    
    const currentRoom = store.getState().rooms.currentRoom;
    const myCountry = store.getState().game.myCountry;
    
    if (currentRoom?.name && myCountry) {
      store.dispatch(updateCountryDebt({
        roomName: currentRoom.name,
        countryName: myCountry,
        debtData: {
          debtRecords: data.debtRecords || [],
          numberOfDebtContracts: data.numberOfContracts || 0,
          totalMonthlyPayment: data.totalMonthlyPayment || 0,
          principalRemaining: data.principalRemaining || 0
        },
        timestamp: Date.now()
      }));
    }
  });
  
  // ======================================================================
  // EVENTOS DE COMÉRCIO
  // ======================================================================
  
  // Handler para receber uma proposta de comércio (para o destinatário)
  socket.on('tradeProposalReceived', (proposal) => {
    console.log('Proposta de comércio recebida:', proposal);
    
    // Adicionar som de notificação, se disponível
    if (window.Audio) {
      try {
        const notificationSound = new Audio('/notification.mp3');
        notificationSound.play().catch(() => {
          // Som não disponível, continuar normalmente
        });
      } catch (error) {
        console.debug('Som de notificação não disponível');
      }
    }
    
    // Mostrar toast de notificação da proposta recebida
    const { originCountry, type, product, value } = proposal;
    const productName = product === 'commodity' ? 'commodities' : 'manufaturas';
    const actionType = type === 'export' ? 'exportar para você' : 'importar de você';
    
    MessageService.showInfo(
      `${originCountry} quer ${actionType} ${productName} (${value} bi USD)`,
      4000
    );
  });
  
  // Handler para receber resposta a uma proposta enviada
  socket.on('tradeProposalResponse', (response) => {
    console.log('Resposta à proposta de comércio recebida:', response);
    
    const { accepted, targetCountry } = response;
    
    // Mostrar toast com a resposta
    if (accepted) {
      MessageService.showSuccess(
        `${targetCountry} aceitou sua proposta comercial!`,
        4000
      );
    } else {
      MessageService.showWarning(
        `${targetCountry} recusou sua proposta comercial.`,
        4000
      );
    }
  });

  // Confirmação de proposta processada (para quem respondeu)
  socket.on('tradeProposalProcessed', (response) => {
    console.log('Proposta de comércio processada:', response);
    
    const { accepted } = response;
    
    // Notificar o usuário sobre o processamento
    if (accepted) {
      MessageService.showSuccess('Você aceitou a proposta comercial.');
    } else {
      MessageService.showInfo('Você recusou a proposta comercial.');
    }
  });

  // Receber confirmação de que um acordo comercial foi cancelado
  socket.on('tradeAgreementCancelled', (agreementId) => {
    console.log('Acordo comercial cancelado:', agreementId);
    store.dispatch(removeTradeAgreement(agreementId));
    
    // Mostrar toast de confirmação
    MessageService.showInfo('Acordo comercial cancelado.', 4000);
  });
  
  // Receber lista atualizada de acordos comerciais
  socket.on('tradeAgreementsList', (data) => {
    console.log('Lista de acordos comerciais recebida:', data);
    
    // Limpar os acordos atuais antes de adicionar os novos
    store.dispatch(resetTradeState());
    
    if (data.agreements && Array.isArray(data.agreements)) {
      data.agreements.forEach(agreement => {
        store.dispatch(addTradeAgreement(agreement));
      });
    }
    
    // Atualizar estatísticas após carregar os acordos
    store.dispatch(updateStats());
  });
  
  // Receber atualizações de acordos comerciais (broadcast)
  socket.on('tradeAgreementUpdated', (data) => {
    console.log('Atualização de acordos comerciais recebida:', data);
    
    // Limpar os acordos atuais antes de adicionar os novos
    store.dispatch(resetTradeState());
    
    if (data.agreements && Array.isArray(data.agreements)) {
      data.agreements.forEach(agreement => {
        store.dispatch(addTradeAgreement(agreement));
      });
    }
    
    // Atualizar estatísticas após atualizar os acordos
    store.dispatch(updateStats());
  });
  
  // ======================================================================
  // ERROS E OUTROS EVENTOS
  // ======================================================================
  
  socket.on('error', (message) => {
    console.error('Erro do socket:', message);
    
    // Reset de autenticação em caso de erro de autenticação
    if (message.includes('autenticação') || message.includes('authentication')) {
      isAuthenticated = false;
      authenticationInProgress = false;
    }
    
    if (message.includes('sala') || message.includes('room')) {
      setIsJoiningRoom(false);
      sessionStorage.removeItem('pendingRoom');
    }
    
    const isSilentError = message.includes('já está em uso') || 
                         message.includes('autenticação') || 
                         message.includes('desconectado') ||
                         message.includes('já está autenticado');
    
    if (!isSilentError) {
      // Mostrar erro via toast
      MessageService.showError(message, 4000);
      
      store.dispatch({
        type: 'error/socketError',
        payload: message
      });
    }
  });
  
  // ======================================================================
  // PING/PONG PARA MANTER CONEXÃO ATIVA
  // ======================================================================
  
  // Ping mais inteligente - só envia se estiver autenticado e conectado
  const pingInterval = setInterval(() => {
    if (socket.connected && isAuthenticated) {
      socket.emit('ping', Date.now());
    }
  }, 30000); // A cada 30 segundos
  
  // Limpar intervalo quando o socket for desconectado
  socket.on('disconnect', () => {
    if (pingInterval) {
      clearInterval(pingInterval);
    }
  });
  
  // Adicionar handler para pong (opcional, para debugging)
  socket.on('pong', (timestamp) => {
    const latency = Date.now() - timestamp;
    if (latency > 1000) { // Log apenas se latência for alta
      console.log(`Socket latency: ${latency}ms`);
    }
  });
};