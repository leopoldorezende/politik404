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
import {
  setPlayerCards,
  setPlayerPoints,
  setPlayerRanking
} from '../modules/cards/cardState';
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
// HANDLERS UNIFICADOS PARA COMPATIBILIDADE
// =====================================================================

/**
 * Handler unificado para atualização de acordos comerciais
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
  // 🔄 HANDLERS DE COMPATIBILIDADE UNIFICADOS
  // ===================================================================

  // Handler unificado para atualização de acordos comerciais
  socket.on('updateTradeAgreements', updateTradeAgreementsHandler);

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
    store.dispatch(setMyCountry(data.country));
    StorageService.set(StorageService.KEYS.MY_COUNTRY, data.country);
    MessageService.showSuccess(`Você foi designado para ${data.country}!`);
  });

  socket.on('countryRequestFailed', (error) => {
    console.error('❌ Falha ao solicitar país:', error);
    MessageService.showError(`Não foi possível solicitar o país: ${error.message || 'Erro desconhecido'}`);
  });

  // ===================================================================
  // EVENTOS ECONÔMICOS (MANTIDOS)
  // ===================================================================
  
  socket.on('economicDataUpdated', (data) => {
    console.log('💰 Dados econômicos atualizados:', data);
    store.dispatch(updateEconomicData(data));
  });

  socket.on('debtSummary', (data) => {
    console.log('💳 Resumo de dívida recebido:', data);
    store.dispatch(updateDebtSummary(data));
  });

  socket.on('economicCalculationError', (error) => {
    console.error('❌ Erro no cálculo econômico:', error);
    MessageService.showError(`Erro no cálculo econômico: ${error.message || 'Erro desconhecido'}`);
  });

  // ===================================================================
  // EVENTOS DE CHAT (MANTIDOS)
  // ===================================================================
  
  socket.on('chatMessage', (message) => {
    console.log('💬 Mensagem de chat recebida:', message);
    store.dispatch(addChatMessage(message));
  });

  socket.on('privateMessage', (message) => {
    console.log('🔒 Mensagem privada recebida:', message);
    store.dispatch(addPrivateMessage(message));
  });

  socket.on('privateHistory', (data) => {
    console.log('📜 Histórico privado recebido:', data);
    store.dispatch(setPrivateHistory(data.messages));
  });

  // ===================================================================
  // EVENTOS DE CARDS (MANTIDOS)
  // ===================================================================
  
  socket.on('cardsUpdated', (data) => {
    console.log('🃏 Cards atualizados:', data);
    // A lógica de atualização de cards está nos componentes específicos
  });

  socket.on('playerCardsResponse', (data) => {
    console.log('🃏 Cards do jogador recebidos:', data);
    store.dispatch(setPlayerCards(data.cards));
  });

  socket.on('playerPointsResponse', (data) => {
    console.log('📊 Pontos do jogador recebidos:', data);
    store.dispatch(setPlayerPoints(data));
  });

  socket.on('playerRankingResponse', (data) => {
    console.log('🏆 Ranking recebido:', data);
    store.dispatch(setPlayerRanking(data.ranking));
  });

  // ===================================================================
  // EVENTOS DE ERRO (MANTIDOS)
  // ===================================================================
  
  socket.on('error', (error) => {
    console.error('❌ Erro do servidor:', error);
    MessageService.showError(`Erro do servidor: ${error.message || error}`);
  });

  socket.on('warning', (warning) => {
    console.warn('⚠️ Aviso do servidor:', warning);
    MessageService.showWarning(`Aviso: ${warning.message || warning}`);
  });

  console.log('✅ Socket events setup complete - UNIFIED SYSTEM');
};

// =====================================================================
// FUNÇÕES DE LIMPEZA E UTILITÁRIAS
// =====================================================================

export const cleanupSocketEvents = () => {
  const socket = getSocketInstance();
  if (socket) {
    socket.removeAllListeners();
    console.log('🧹 Socket events cleaned up');
  }
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
    legacyCompatibility: false, // Removido código legado
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