import { store } from '../store';
import { setRooms, setCurrentRoom, leaveRoom } from '../modules/room/roomState';
import { setMyCountry, setPlayers, setPlayerOnlineStatus, setOnlinePlayers } from '../modules/game/gameState';
import { addMessage, setChatHistory } from '../modules/chat/chatState';

import {
  initializeCountryStates,
  updateCountryStates,
  updateCountryState,
  resetState as resetCountryState
} from '../modules/country/countryStateSlice';
import {
  addTradeAgreement,
  removeTradeAgreement,
  resetTradeState,
  updateStats
} from '../modules/trade/tradeState';
import {
  initializeCountryEconomy,
  updateEconomicParameters,
  issueBonds as issueBondsAction,
  processDebtPayments as processDebtPaymentsAction,
  updateCreditRating,
  setError as setEconomyError,
  clearError as clearEconomyError
} from '../modules/economy/economySlice';
import { 
  setReconnectAttempts, 
  incrementReconnectAttempts,
  setIsJoiningRoom,
  getIsJoiningRoom,
  getMaxReconnectAttempts
} from './socketConnection';

// Import do serviço de mensagens para mostrar toasts
import MessageService from '../ui/toast/messageService';

// Configurar todos os eventos do socket
export const setupSocketEvents = (socket, socketApi) => {
  if (!socket) return;
  
  // Remover listeners anteriores se existirem para evitar duplicação
  socket.removeAllListeners();
  
  // ======================================================================
  // EVENTOS BASE DO SOCKET
  // ======================================================================
  
  socket.on('connect', () => {
    console.log('Conectado ao servidor socket com ID:', socket.id);
    setReconnectAttempts(0);
    setIsJoiningRoom(false);
    
    // Reautenticar automaticamente se houver um usuário guardado
    const username = sessionStorage.getItem('username');
    if (username) {
      console.log('Reautenticando usuário após conexão:', username);
      
      // MODIFICAR: Verificar se não foi enviado muito recentemente
      const lastAuthTime = sessionStorage.getItem('lastAuthTime');
      const now = Date.now();
      
      if (!lastAuthTime || (now - parseInt(lastAuthTime)) > 1000) {
        sessionStorage.setItem('lastAuthTime', now.toString());
        
        setTimeout(() => {
          socket.emit('authenticate', username, { clientSessionId: sessionStorage.getItem('clientSessionId') });
        }, 300);
      }
    }
  });
  
  socket.io.on("reconnect_attempt", (attempt) => {
    console.log(`Tentativa de reconexão #${attempt}`);
    setReconnectAttempts(attempt);
  });
  
  socket.io.on("reconnect", (attempt) => {
    console.log(`Reconectado com sucesso após ${attempt} tentativas`);
    setIsJoiningRoom(false);
    
    const username = sessionStorage.getItem('username');
    if (username) {
      console.log('Reautenticando após reconexão:', username);
      
      // ADICIONAR: Aguardar um pouco mais e verificar se não foi feito recentemente
      const lastReconnectAuth = sessionStorage.getItem('lastReconnectAuth');
      const now = Date.now();
      
      if (!lastReconnectAuth || (now - parseInt(lastReconnectAuth)) > 5000) {
        sessionStorage.setItem('lastReconnectAuth', now.toString());
        
        setTimeout(() => {
          socket.emit('authenticate', username, { clientSessionId: sessionStorage.getItem('clientSessionId') });
          
          setTimeout(() => {
            socket.emit('getRooms');
          }, 500);
        }, 1000); // Aguardar mais tempo
      }
    }
  });
  
  socket.on('connect_error', (error) => {
    console.error('Erro de conexão ao socket:', error.message);
    incrementReconnectAttempts();
    setIsJoiningRoom(false);
    
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
    
    const pendingRoom = sessionStorage.getItem('pendingRoom');
    if (pendingRoom && !getIsJoiningRoom()) {
      setTimeout(() => {
        console.log('Retomando entrada na sala após autenticação:', pendingRoom);
        socketApi.joinRoom(pendingRoom);
      }, 500);
    } else {
      setTimeout(() => {
        socket.emit('getRooms');
      }, 300);
    }
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
  // EVENTOS DE ESTADO DE PAÍS
  // ======================================================================

  socket.on('countryStatesInitialized', (data) => {
    console.log('Estados de países inicializados:', data);
    store.dispatch(initializeCountryStates(data));
  });

  socket.on('countryStatesUpdated', (data) => {
    store.dispatch(updateCountryStates(data));
  });

  socket.on('countryState', (data) => {
    console.log('Estado de país recebido:', data);
  });

  socket.on('countryStateUpdated', (data) => {
    console.log('Estado de país atualizado:', data);
    store.dispatch(updateCountryState({
      roomName: data.roomName,
      countryName: data.countryName,
      category: data.category,
      updates: data.state[data.category],
      timestamp: data.timestamp
    }));
  });
  
  // ======================================================================
  // EVENTOS DE ECONOMIA AVANÇADA
  // ======================================================================
  
  // Evento para títulos de dívida emitidos com sistema avançado
  socket.on('debtBondsIssued', (data) => {
    console.log('Títulos de dívida emitidos (sistema avançado):', data);
    
    if (data.success) {
      // Mostrar notificação de sucesso com detalhes avançados
      const emergencyText = data.isEmergency ? ' de emergência' : '';
      const ratingText = data.creditRating ? ` (Rating: ${data.creditRating})` : '';
      
      MessageService.showSuccess(
        `Títulos${emergencyText} emitidos: ${data.bondAmount} bi USD` +
        `\nTaxa: ${data.effectiveInterestRate?.toFixed(2)}%${ratingText}` +
        `\nParcela mensal: ${data.monthlyPayment?.toFixed(2)} bi USD`,
        6000
      );
      
      // Atualizar estado da economia no Redux
      const currentRoom = store.getState().rooms?.currentRoom;
      const myCountry = store.getState().game?.myCountry;
      
      if (currentRoom?.name && myCountry) {
        // Disparar ação para atualizar dívidas no Redux
        store.dispatch(issueBondsAction({
          roomName: currentRoom.name,
          countryName: myCountry,
          bondData: {
            success: true,
            bondAmount: data.bondAmount,
            newTreasury: data.newTreasury,
            newPublicDebt: data.newPublicDebt,
            effectiveInterestRate: data.effectiveInterestRate,
            monthlyPayment: data.monthlyPayment,
            remainingInstallments: data.remainingInstallments,
            creditRating: data.creditRating,
            isEmergency: data.isEmergency,
            debtContract: data.debtContract
          }
        }));
        
        // Atualizar rating de crédito se fornecido
        if (data.creditRating) {
          store.dispatch(updateCreditRating({
            roomName: currentRoom.name,
            countryName: myCountry,
            creditRating: data.creditRating
          }));
        }
        
        // Limpar erros econômicos
        store.dispatch(clearEconomyError());
      }
    } else {
      MessageService.showError(data.message || 'Falha na emissão de títulos', 4000);
      store.dispatch(setEconomyError(data.message || 'Falha na emissão de títulos'));
    }
  });
  
  // Evento para títulos de emergência emitidos
  socket.on('emergencyBondsIssued', (data) => {
    console.log('Títulos de emergência emitidos:', data);
    
    if (data.success) {
      MessageService.showWarning(
        `Títulos de emergência emitidos: ${data.actualAmount?.toFixed(2)} bi USD` +
        `\nMotivo: Caixa insuficiente (${data.requiredAmount?.toFixed(2)} bi necessários)`,
        8000
      );
      
      // Atualizar estado no Redux
      const currentRoom = store.getState().rooms?.currentRoom;
      const myCountry = store.getState().game?.myCountry;
      
      if (currentRoom?.name && myCountry) {
        store.dispatch(issueBondsAction({
          roomName: currentRoom.name,
          countryName: myCountry,
          bondData: {
            success: true,
            bondAmount: data.actualAmount,
            newTreasury: data.newTreasury,
            newPublicDebt: data.newPublicDebt,
            isEmergency: true
          }
        }));
      }
    } else {
      MessageService.showError(
        `Falha na emissão de títulos de emergência: ${data.message}`,
        6000
      );
    }
  });
  
  // Evento para pagamentos de dívida processados
  socket.on('debtPaymentProcessed', (data) => {
    console.log('Pagamentos de dívida processados:', data);
    
    const currentRoom = store.getState().rooms?.currentRoom;
    const myCountry = store.getState().game?.myCountry;
    
    if (currentRoom?.name && myCountry) {
      // Atualizar dados de pagamento no Redux
      store.dispatch(processDebtPaymentsAction({
        roomName: currentRoom.name,
        countryName: myCountry,
        paymentResults: {
          totalPayment: data.totalPayment,
          interestPayment: data.interestPayment,
          principalPayment: data.principalPayment,
          updatedDebts: data.updatedDebts,
          remainingCash: data.remainingCash || data.finalTreasury
        }
      }));
    }
    
    // Mostrar notificação baseada no resultado
    if (data.emergencyBondsIssued) {
      MessageService.showWarning(
        `Pagamentos processados: ${data.totalPayment?.toFixed(2)} bi USD` +
        `\nTítulos de emergência emitidos: ${data.emergencyAmount?.toFixed(2)} bi USD`,
        6000
      );
    } else if (data.treasuryDeficit) {
      MessageService.showError(
        `Pagamentos processados mas caixa insuficiente!` +
        `\nPagamento: ${data.totalPayment?.toFixed(2)} bi USD`,
        5000
      );
    } else {
      MessageService.showSuccess(
        `Pagamentos de dívida processados: ${data.totalPayment?.toFixed(2)} bi USD` +
        `\nJuros: ${data.interestPayment?.toFixed(2)} bi | Principal: ${data.principalPayment?.toFixed(2)} bi`,
        4000
      );
    }
  });
  
  // Evento para resumo de dívidas (resposta ao getDebtSummary)
  socket.on('debtSummaryResponse', (data) => {
    console.log('Resumo de dívidas recebido:', data);
    
    // Armazenar no sessionStorage para uso no popup
    sessionStorage.setItem('debtSummaryData', JSON.stringify(data));
    
    // Disparar evento customizado para notificar componentes
    window.dispatchEvent(new CustomEvent('debtSummaryReceived', { detail: data }));
  });
  
  // Evento para parâmetros econômicos atualizados
  socket.on('economicParameterUpdated', (data) => {
    console.log('Parâmetro econômico atualizado:', data);
    
    const currentRoom = store.getState().rooms?.currentRoom;
    const myCountry = store.getState().game?.myCountry;
    
    // Verificar se a atualização é para o país atual
    if (data.countryName === myCountry && data.roomName === currentRoom?.name) {
      // Atualizar parâmetro no Redux
      store.dispatch(updateEconomicParameters({
        roomName: data.roomName,
        countryName: data.countryName,
        parameters: {
          [data.parameter]: data.value
        }
      }));
      
      // Mostrar confirmação
      const parameterNames = {
        interestRate: 'Taxa de Juros',
        taxBurden: 'Carga Tributária',
        publicServices: 'Investimento Público'
      };
      
      const parameterName = parameterNames[data.parameter] || data.parameter;
      const unit = data.parameter === 'interestRate' ? '%' : '%';
      
      MessageService.showSuccess(
        `${parameterName} atualizada: ${data.value}${unit}`,
        3000
      );
    }
  });
  
  // Evento para inicialização de economia avançada
  socket.on('advancedEconomyInitialized', (data) => {
    console.log('Economia avançada inicializada:', data);
    
    const { roomName, countryName, economyData } = data;
    
    // Inicializar economia no Redux
    store.dispatch(initializeCountryEconomy({
      roomName,
      countryName,
      countryData: economyData
    }));
    
    MessageService.showInfo(
      `Sistema econômico avançado ativado para ${countryName}`,
      4000
    );
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
      4000 // 4 segundos
    );
  });
  
  // Handler para receber resposta a uma proposta enviada (CORRIGIDO)
  socket.on('tradeProposalResponse', (response) => {
    console.log('Resposta à proposta de comércio recebida:', response);
    
    const { accepted, targetCountry, message } = response;
    
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
    
    const { accepted, message } = response;
    
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
    
    if (message.includes('sala') || message.includes('room')) {
      setIsJoiningRoom(false);
      sessionStorage.removeItem('pendingRoom');
    }
    
    const isSilentError = message.includes('já está em uso') || 
                         message.includes('autenticação') || 
                         message.includes('desconectado');
    
    if (!isSilentError) {
      // Mostrar erro via toast
      MessageService.showError(message, 4000);
      
      store.dispatch({
        type: 'error/socketError',
        payload: message
      });
    }
  });
  
  // Força ping a cada 30 segundos para manter a conexão ativa
  setInterval(() => {
    if (socket.connected) {
      socket.emit('ping', Date.now());
    }
  }, 30000);
};