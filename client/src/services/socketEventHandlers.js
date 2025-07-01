// =====================================================================
// HANDLERS DE EVENTOS UNIFICADOS - FASE 3 CLIENTE - CORRIGIDO
// =====================================================================
// Local: client/src/services/socketEventHandlers.js

import { store } from '../store';
import { 
  login, 
  logout
} from '../modules/auth/authState';
import { 
  setRooms, 
  setCurrentRoom,
  leaveRoom 
} from '../modules/room/roomState';
import { 
  setMyCountry, 
  setCountriesData, 
  updateCountryData,
  setPlayers,
  setOnlinePlayers
} from '../modules/game/gameState';
import { 
  addMessage, 
  setChatHistory 
} from '../modules/chat/chatState';
import { 
  addTradeAgreement, 
  removeTradeAgreement, 
  resetTradeState,
  updateStats 
} from '../modules/trade/tradeState';
import { setIsJoiningRoom, setReconnectAttempts, getIsJoiningRoom } from './socketConnection';
import StorageService from './storageService.js';
import MessageService from '../ui/toast/messageService';

// =====================================================================
// SISTEMA DE DEBOUNCE E CONTROLE
// =====================================================================

let isAuthenticated = false;
const debounceTimeouts = {};

// Sistema de mutex para autenticação
const authMutex = {
  isExecuting: false,
  queue: [],
  
  async executeAuth(authFunction) {
    return new Promise((resolve, reject) => {
      this.queue.push({ authFunction, resolve, reject });
      this.processQueue();
    });
  },
  
  async processQueue() {
    if (this.isExecuting || this.queue.length === 0) return;
    
    this.isExecuting = true;
    const { authFunction, resolve, reject } = this.queue.shift();
    
    try {
      const result = await authFunction();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isExecuting = false;
      setTimeout(() => this.processQueue(), 100);
    }
  }
};

// =====================================================================
// CONSTANTES PARA CONFIGURAÇÃO DE EVENTOS
// =====================================================================

const CONSTANTS = {
  DEBOUNCE_DELAY: 300,
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 1000
};

// Configurações de mensagens por tipo de acordo
const AGREEMENT_MESSAGE_CONFIGS = {
  trade: { name: 'comércio', category: 'comercial' },
  alliance: { name: 'aliança militar', category: 'militar' },
  cooperation: { name: 'cooperação militar', category: 'militar' },
  internal: { name: 'acordo interno', category: 'interno' }
};

// =====================================================================
// UTILITÁRIOS PARA NOTIFICAÇÕES
// =====================================================================

/**
 * Mostrar notificação com controle de cooldown
 */
function showNotificationWithCooldown(type, message, key = 'default') {
  clearTimeout(debounceTimeouts[key]);
  debounceTimeouts[key] = setTimeout(() => {
    if (MessageService[type]) {
      MessageService[type](message);
    } else {
      MessageService.showInfo(message);
    }
  }, CONSTANTS.DEBOUNCE_DELAY);
}

// =====================================================================
// FACTORIES PARA HANDLERS UNIFICADOS
// =====================================================================

// =====================================================================
// HANDLERS UNIFICADOS PRINCIPAIS
// =====================================================================

/**
 * Handlers para eventos unificados de acordo
 */
const unifiedAgreementHandlers = {
  // Evento principal de proposta recebida
  'agreementProposalReceived': (data) => {
    console.log('📨 Proposta unificada recebida:', data);
    // A lógica real de exibição de popups está nos componentes (GamePage.jsx)
  },

  // Evento principal de resposta de proposta
  'agreementProposalResponse': (response) => {
    console.log('📬 Resposta unificada recebida:', response);
    // A lógica real de exibição de mensagens está nos componentes
  },

  // Evento principal de processamento de proposta
  'agreementProposalProcessed': (response) => {
    console.log('⚙️ Processamento unificado:', response);
  },

  // Evento principal de cancelamento
  'agreementCancelled': (data) => {
    console.log('🗑️ Cancelamento unificado:', data);
    // A lógica real de atualização de store e mensagens está nos componentes
  },

  // Eventos específicos para acordos internos
  'agreementCreated': (data) => {
    console.log('✅ Acordo interno criado:', data);
    const { type, message, points } = data;
    MessageService.showSuccess(message || `Acordo ${type} criado com sucesso!`);
    if (points && store.getState().game?.myCountry) {
      store.dispatch(updateStats());
    }
  },

  'agreementFailed': (data) => {
    console.log('❌ Acordo interno falhado:', data);
    const { type, message, probability } = data;
    let displayMessage = message;
    if (!displayMessage && probability) {
      displayMessage = `Falha ao criar acordo ${type}. Probabilidade era ${probability}%. Tente novamente.`;
    }
    MessageService.showWarning(displayMessage || `Falha ao criar acordo ${type}`);
  },

  // Eventos de consulta
  'activeAgreements': (data) => {
    console.log('📋 Acordos ativos recebidos:', data);
    const { agreements, country } = data;
    store.dispatch(resetTradeState());
    if (Array.isArray(agreements)) {
      agreements.forEach(agreement => {
        if (agreement.type?.startsWith('trade') || agreement.category === 'comercial') {
          store.dispatch(addTradeAgreement(agreement));
        }
      });
    }
    store.dispatch(updateStats());
  },

  'cooldownStatus': (data) => {
    console.log('⏱️ Status cooldown:', data);
    // Implementar lógica de cooldown no UI se necessário
  },

  'agreementTypes': (data) => {
    console.log('📋 Tipos de acordo disponíveis:', data);
    // Implementar cache de tipos se necessário
  }
};

// =====================================================================
// HANDLERS LEGADOS PARA COMPATIBILIDADE
// =====================================================================

/**
 * Handlers específicos para acordos comerciais (compatibilidade)
 */
const updateTradeAgreementsHandler = (data) => {
  store.dispatch(resetTradeState());
  if (Array.isArray(data.agreements)) {
    data.agreements.forEach(agreement => {
      store.dispatch(addTradeAgreement(agreement));
    });
  }
  store.dispatch(updateStats());
};

// =====================================================================
// HELPERS PARA FORMATAÇÃO DE MENSAGENS (FALLBACK)
// =====================================================================

/**
 * Obter mensagem formatada para proposta (fallback se servidor não enviar)
 */
function getProposalMessage(agreementType, proposal) {
  switch (agreementType) {
    case 'trade':
      const productName = proposal.product === 'commodity' ? 'commodities' : 'manufaturas';
      const actionType = proposal.type === 'export' ? 'exportar para você' : 'importar de você';
      return `${proposal.originCountry} quer ${actionType} ${productName} (${proposal.value} bi USD)`;
    
    case 'alliance':
      return `${proposal.originCountry} propõe uma aliança militar com você!`;
    
    case 'cooperation':
      return `${proposal.originCountry} propõe cooperação militar com você!`;
    
    default:
      return `${proposal.originCountry} enviou uma proposta para você.`;
  }
}

// =====================================================================
// FUNÇÃO PRINCIPAL DE CONFIGURAÇÃO DOS EVENTOS
// =====================================================================

export const setupSocketEvents = (socket, socketApi) => {
  if (!socket) return;

  // 1. Limpeza de todos os listeners para evitar duplicatas
  socket.removeAllListeners();
  
  // 2. Reset de variáveis de controle
  isAuthenticated = false;
  Object.keys(debounceTimeouts).forEach(key => clearTimeout(debounceTimeouts[key]));

  // ===================================================================
  // EVENTOS DE CONEXÃO E RECONEXÃO (MANTIDOS)
  // ===================================================================
  
  socket.on('connect', () => {
    console.log('🔌 Conectado ao servidor socket com ID:', socket.id);
    setReconnectAttempts(0);
    setIsJoiningRoom(false);
    
    const username = StorageService.get(StorageService.KEYS.USERNAME);
    if (username && !isAuthenticated) {
      console.log('🔐 Reautenticando usuário após conexão:', username);
      authMutex.executeAuth(async () => {
        if (!isAuthenticated) {
          await new Promise(resolve => setTimeout(resolve, 500));
          socket.emit('authenticate', username, { 
            clientSessionId: StorageService.get(StorageService.KEYS.CLIENT_SESSION_ID),
            reconnect: true
          });
          return true;
        }
        return false;
      }).catch(error => console.error('Authentication error:', error.message));
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 Desconectado do servidor. Motivo:', reason);
    isAuthenticated = false;
    
    if (reason !== 'io client disconnect') {
      // Usar incremento simples já que setReconnectAttempts está no socketConnection
      console.log('🔄 Tentando reconectar...');
      setTimeout(() => {
        socket.connect();
      }, CONSTANTS.RECONNECT_DELAY);
    }
  });

  // ===================================================================
  // 🎯 EVENTOS UNIFICADOS DE ACORDO
  // ===================================================================

  // Registrar todos os handlers unificados
  Object.entries(unifiedAgreementHandlers).forEach(([event, handler]) => {
    socket.on(event, handler);
  });

  // ===================================================================
  // 🔄 EVENTOS LEGADOS PARA COMPATIBILIDADE
  // ===================================================================

  // COMÉRCIO - Mantidos para compatibilidade retroativa
  // socket.on('tradeProposalReceived', createProposalReceivedHandler('trade'));
  // socket.on('tradeProposalResponse', createProposalResponseHandler('trade'));
  // socket.on('tradeAgreementCancelled', createAgreementCancelledHandler('trade', removeTradeAgreement));
  socket.on('updateTradeAgreements', updateTradeAgreementsHandler);

  // ALIANÇA - Mantidos para compatibilidade retroativa
  // socket.on('allianceProposalReceived', createProposalReceivedHandler('alliance'));
  // socket.on('allianceProposalResponse', createProposalResponseHandler('alliance'));
  // socket.on('allianceAgreementCancelled', createAgreementCancelledHandler('alliance'));

  // COOPERAÇÃO - Mantidos para compatibilidade retroativa
  // socket.on('cooperationProposalReceived', createProposalReceivedHandler('cooperation'));
  // socket.on('cooperationProposalResponse', createProposalResponseHandler('cooperation'));
  // socket.on('cooperationAgreementCancelled', createAgreementCancelledHandler('cooperation'));

  // ===================================================================
  // EVENTOS DE AUTENTICAÇÃO (MANTIDOS)
  // ===================================================================
  
  socket.on('authenticated', (data) => {
    console.log('✅ Autenticado com sucesso:', data);
    isAuthenticated = true;
    store.dispatch(login(data.username));
    
    const pendingRoom = StorageService.get(StorageService.KEYS.PENDING_ROOM);
    if (pendingRoom && !socketApi.getSocketInstance) {
      console.log('🏠 Entrando na sala pendente:', pendingRoom);
      setTimeout(() => socketApi.joinRoom(pendingRoom), 500);
    }
  });
  
  socket.on('authenticationFailed', (error) => {
    console.error('❌ Falha na autenticação:', error);
    isAuthenticated = false;
    MessageService.showError(`Falha na autenticação: ${error.message || 'Erro desconhecido'}`);
    
    setTimeout(() => {
      store.dispatch(logout());
      StorageService.clear();
      window.location.reload();
    }, 2000);
  });

  // ===================================================================
  // EVENTOS DE SALA (MANTIDOS)
  // ===================================================================
  
  socket.on('roomsUpdated', (rooms) => {
    console.log('🏠 Salas atualizadas:', rooms.length);
    store.dispatch(setRooms(rooms));
  });
  
  socket.on('roomJoined', (data) => {
    console.log('🎯 Entrou na sala:', data.roomName || data);
    setIsJoiningRoom(false);
    StorageService.remove(StorageService.KEYS.PENDING_ROOM);
    
    // O servidor pode enviar tanto { roomName: "abc" } quanto só "abc"
    const roomName = data.roomName || data;
    store.dispatch(setCurrentRoom(roomName));
    
    // Adicionar outras propriedades se existirem
    if (data.countries) {
      store.dispatch(setPlayers(data.countries));
    }
  });
  
  socket.on('roomJoinFailed', (error) => {
    console.error('❌ Falha ao entrar na sala:', error);
    setIsJoiningRoom(false);
    StorageService.remove(StorageService.KEYS.PENDING_ROOM);
    MessageService.showError(`Não foi possível entrar na sala: ${error.message || 'Erro desconhecido'}`);
  });
  
  socket.on('roomLeft', (data) => {
    console.log('👋 Saiu da sala:', data);
    store.dispatch(setCurrentRoom(null));
    store.dispatch(setMyCountry(null));
    store.dispatch(resetTradeState());
    StorageService.remove(StorageService.KEYS.MY_COUNTRY);
    MessageService.showInfo('Você saiu da sala');
  });
  
  socket.on('roomCreated', (data) => {
    console.log('🏗️ Sala criada:', data);
    
    // Correção 1: Usar data.roomName em vez de data.name
    const roomName = data.roomName || data.name;
    
    if (roomName) {
      MessageService.showSuccess(`Sala "${roomName}" criada com sucesso!`);
    } else {
      MessageService.showSuccess('Sala criada com sucesso!');
    }
    
    // Correção 2: Solicitar atualização da lista de salas automaticamente
    setTimeout(() => {
      socket.emit('getRooms');
    }, 500);
  });

  socket.on('roomsList', (rooms) => {
    console.log('📋 Lista de salas recebida:', rooms.length, 'salas');
    store.dispatch(setRooms(rooms));
  });

  // Correção 4: Garantir que o evento getRooms seja enviado após autenticação
  socket.on('authenticated', (data) => {
    console.log('✅ Autenticado com sucesso:', data);
    isAuthenticated = true;
    store.dispatch(login(data.username));
    
    // Solicitar lista de salas imediatamente após autenticação
    setTimeout(() => {
      console.log('📡 Solicitando lista de salas após autenticação');
      socket.emit('getRooms');
    }, 100);
    
    const pendingRoom = StorageService.get(StorageService.KEYS.PENDING_ROOM);
    if (pendingRoom && !getIsJoiningRoom()) {
      console.log('🏠 Entrando na sala pendente:', pendingRoom);
      setTimeout(() => socketApi.joinRoom(pendingRoom), 1000);
    }
  });
  
  socket.on('roomDeleted', (data) => {
    console.log('🗑️ Sala deletada:', data);
    MessageService.showInfo(`Sala "${data.roomName}" foi deletada`);
  });


  socket.on('playersList', (players) => {
    console.log('📋 Lista de jogadores recebida:', players.length, 'jogadores');
    store.dispatch(setPlayers(players));
    
    const onlinePlayerNames = players
      .map(player => {
        if (typeof player === 'object' && player.username) {
          return player.username;
        } else if (typeof player === 'string') {
          const match = player.match(/^(.*?)\s*\(/);
          return match ? match[1] : player;
        }
        return '';
      })
      .filter(Boolean);
    
    store.dispatch(setOnlinePlayers(onlinePlayerNames));

  });

  // ===================================================================
  // EVENTOS DE PAÍS (MANTIDOS)
  // ===================================================================
  
  socket.on('countryAssigned', (data) => {
    console.log('🌍 País atribuído:', data);
    
    // O servidor pode enviar tanto { country: "India" } quanto só "India"
    const country = data.country || data;
    
    store.dispatch(setMyCountry(country));
    StorageService.set(StorageService.KEYS.MY_COUNTRY, country);
  });
  
  socket.on('countryAssignmentFailed', (error) => {
    console.error('❌ Falha na atribuição do país:', error);
    MessageService.showError(`Não foi possível atribuir o país: ${error.message || 'País indisponível'}`);
  });
  
  socket.on('countriesUpdated', (countries) => {
    console.log('🌍 Países atualizados:', countries.length);
    store.dispatch(setCountriesData(countries));
  });
  
  socket.on('countryDataUpdated', (data) => {
    console.log('📊 Dados do país atualizados:', data);
    store.dispatch(updateCountryData(data));
  });

  // ===================================================================
  // EVENTOS DE CHAT (MANTIDOS)
  // ===================================================================
  
  socket.on('chatMessage', (data) => {
    console.log('💬 Mensagem de chat:', data);
    store.dispatch(addMessage(data));
  });
  
  socket.on('privateHistory', (data) => {
    console.log('📜 Histórico privado:', data);
    store.dispatch(setChatHistory(data));
  });

  // ===================================================================
  // EVENTOS DE ECONOMIA (MANTIDOS)
  // ===================================================================
  
  socket.on('economicDataUpdated', (data) => {
    console.log('💰 Dados econômicos atualizados:', data);
    if (data.country) {
      store.dispatch(updateCountryData({
        country: data.country,
        economicData: data
      }));
    }
  });
  
  socket.on('debtSummary', (data) => {
    console.log('📊 Resumo da dívida:', data);
    // Implementar handler de dívida se necessário
  });

  // ===================================================================
  // EVENTOS DE ERRO GERAIS (MANTIDOS)
  // ===================================================================
  
  socket.on('error', (error) => {
    console.error('❌ Erro do servidor:', error);
    
    const errorMessage = typeof error === 'string' ? error : 
                        error.message || 'Erro desconhecido do servidor';
    
    MessageService.showError(errorMessage);
  });
  
  socket.on('notification', (data) => {
    console.log('🔔 Notificação:', data);
    
    const { type = 'info', message, persistent = false } = data;
    
    if (MessageService[type]) {
      MessageService[type](message, { persistent });
    } else {
      MessageService.showInfo(message, { persistent });
    }
  });

  console.log('✅ Todos os event handlers configurados - Sistema Unificado Ativo');
  console.log('🎯 Suporte a eventos unificados + compatibilidade legada');
  
  // Armazenar referência do socketApi no store para uso nos handlers
  store.socketApi = socketApi;
};

// =====================================================================
// UTILITÁRIOS PARA LIMPEZA
// =====================================================================

/**
 * Limpar todos os timeouts e dados temporários
 */
export const cleanupSocketEvents = () => {
  Object.keys(debounceTimeouts).forEach(key => {
    clearTimeout(debounceTimeouts[key]);
    delete debounceTimeouts[key];
  });
  
  isAuthenticated = false;
  authMutex.queue = [];
  authMutex.isExecuting = false;
  
  console.log('🧹 Limpeza de eventos socket concluída');
};

/**
 * Verificar se o sistema unificado está ativo
 */
export const isUnifiedSystemActive = () => {
  return true; // Sistema sempre unificado após migração
};

/**
 * Obter status dos handlers
 */
export const getHandlersStatus = () => {
  return {
    unifiedHandlers: Object.keys(unifiedAgreementHandlers).length,
    legacyCompatibility: true,
    debounceTimeouts: Object.keys(debounceTimeouts).length,
    isAuthenticated,
    authMutexQueue: authMutex.queue.length
  };
};

export default {
  setupSocketEvents,
  cleanupSocketEvents,
  isUnifiedSystemActive,
  getHandlersStatus
};