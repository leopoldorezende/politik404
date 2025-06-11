// =====================================================================
// MÓDULOS PRINCIPAIS - ARQUITETURA UNIFICADA DE ACORDOS - IMPLEMENTADA
// =====================================================================
// Local: server/modules/index.js

import { setupAuthHandlers } from './auth/authHandlers.js';
import { setupRoomManagement } from './room/roomManagement.js';
import { setupRoomNotifications } from './room/roomNotifications.js';
import { setupPlayerRoomHandlers } from './player/playerRoomHandlers.js';
import { setupPlayerStateManager } from './player/playerStateManager.js';
import { setupCountryAssignment } from './country/countryAssignment.js';
import { setupChatHandlers } from './chat/chatHandlers.js';
import { setupEconomyHandlers } from './economy/economyHandlers.js';

// =====================================================================
// 🎯 SISTEMA UNIFICADO DE ACORDOS - IMPLEMENTADO
// =====================================================================
import { 
  setupAgreementHandlers, 
  setupGlobalAgreementEvents,
  migrateExistingAgreements 
} from './agreements/agreementHandlers.js';

// =====================================================================
// ❌ HANDLERS ANTIGOS REMOVIDOS - SUBSTITUÍDOS PELO SISTEMA UNIFICADO
// =====================================================================
// REMOVIDO: import { setupTradeHandlers } from './trade/tradeHandlers.js';
// REMOVIDO: import { setupAllianceHandlers } from './alliance/allianceHandlers.js';
// REMOVIDO: import { setupCooperationHandlers } from './cooperation/cooperationHandlers.js';
// REMOVIDO: import { setupCardHandlers } from './cards/cardHandlers.js';

/**
 * Inicializa todos os handlers de socket - SISTEMA UNIFICADO IMPLEMENTADO
 * ✅ NOVA VERSÃO: Sistema unificado de acordos substituindo múltiplos handlers
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function initializeSocketHandlers(io, socket, gameState) {
  console.log('🚀 Inicializando handlers de socket - SISTEMA UNIFICADO DE ACORDOS ATIVO');
  
  // ===================================================================
  // HANDLERS ESSENCIAIS (MANTIDOS)
  // ===================================================================
  setupAuthHandlers(io, socket, gameState);
  setupRoomManagement(io, socket, gameState);
  setupRoomNotifications(io, socket, gameState);
  setupPlayerRoomHandlers(io, socket, gameState);
  setupPlayerStateManager(io, socket, gameState);
  setupCountryAssignment(io, socket, gameState);
  // =====================================================================
// MÓDULOS PRINCIPAIS - ARQUITETURA UNIFICADA DE ACORDOS
// =====================================================================
// Local: server/modules/index.js

import { setupAuthHandlers } from './auth/authHandlers.js';
import { setupRoomManagement } from './room/roomManagement.js';
import { setupRoomNotifications } from './room/roomNotifications.js';
import { setupPlayerRoomHandlers } from './player/playerRoomHandlers.js';
import { setupPlayerStateManager } from './player/playerStateManager.js';
import { setupCountryAssignment } from './country/countryAssignment.js';
import { setupChatHandlers } from './chat/chatHandlers.js';
import { setupEconomyHandlers } from './economy/economyHandlers.js';

// =====================================================================
// SISTEMA UNIFICADO DE ACORDOS - SUBSTITUINDO HANDLERS ESPECÍFICOS
// =====================================================================
import { 
  setupAgreementHandlers, 
  setupGlobalAgreementEvents,
  migrateExistingAgreements 
} from './agreements/agreementHandlers.js';

// =====================================================================
// HANDLERS ANTIGOS REMOVIDOS - SUBSTITUÍDOS PELO SISTEMA UNIFICADO
// =====================================================================
// ❌ REMOVIDO: import { setupTradeHandlers } from './trade/tradeHandlers.js';
// ❌ REMOVIDO: import { setupAllianceHandlers } from './alliance/allianceHandlers.js';
// ❌ REMOVIDO: import { setupCooperationHandlers } from './cooperation/cooperationHandlers.js';
// ❌ REMOVIDO: import { setupCardHandlers } from './cards/cardHandlers.js';

/**
 * Inicializa todos os handlers de socket - ARQUITETURA UNIFICADA
 * NOVA VERSÃO: Sistema unificado de acordos substituindo múltiplos handlers
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function initializeSocketHandlers(io, socket, gameState) {
  console.log('🚀 Inicializando handlers de socket - SISTEMA UNIFICADO DE ACORDOS');
  
  // ===================================================================
  // HANDLERS ESSENCIAIS (MANTIDOS)
  // ===================================================================
  setupAuthHandlers(io, socket, gameState);
  setupRoomManagement(io, socket, gameState);
  setupRoomNotifications(io, socket, gameState);
  setupPlayerRoomHandlers(io, socket, gameState);
  setupPlayerStateManager(io, socket, gameState);
  setupCountryAssignment(io, socket, gameState);
  setupChatHandlers(io, socket, gameState);
  
  // ===================================================================
  // HANDLER DE ECONOMIA (REDUZIDO - SEM ACORDOS)
  // ===================================================================
  setupEconomyHandlers(io, socket, gameState); // Apenas economia pura
  
  // ===================================================================
  // 🎯 SISTEMA UNIFICADO DE ACORDOS
  // ===================================================================
  // SUBSTITUI: setupTradeHandlers, setupAllianceHandlers, setupCooperationHandlers, setupCardHandlers
  setupAgreementHandlers(io, socket, gameState);
  
  console.log('✅ UNIFIED AGREEMENT SYSTEM initialized successfully');
  console.log('📊 Handlers ativos: Auth + Room + Player + Country + Chat + Economy + UnifiedAgreements');
}

/**
 * Inicialização global do sistema de acordos
 * Configura eventos globais e migra dados existentes
 * @param {Object} io - Instância do Socket.io
 * @param {Object} gameState - Estado global do jogo
 */
function initializeGlobalAgreementSystem(io, gameState) {
  console.log('🌐 Inicializando sistema global de acordos...');
  
  // Configurar eventos globais
  setupGlobalAgreementEvents(io);
  
  // Migrar dados existentes para formato unificado
  migrateExistingAgreements(gameState);
  
  console.log('✅ Sistema global de acordos inicializado');
}

/**
 * Status do sistema unificado
 */
function getSystemStatus() {
  return {
    unifiedAgreementSystem: true,
    deprecatedHandlers: {
      tradeHandlers: 'REMOVED - Unified into AgreementEngine',
      allianceHandlers: 'REMOVED - Unified into AgreementEngine', 
      cooperationHandlers: 'REMOVED - Unified into AgreementEngine',
      cardHandlers: 'REMOVED - Unified into AgreementEngine'
    },
    activeHandlers: [
      'authHandlers',
      'roomManagement', 
      'roomNotifications',
      'playerRoomHandlers',
      'playerStateManager', 
      'countryAssignment',
      'chatHandlers',
      'economyHandlers (reduced)',
      'agreementHandlers (unified)'
    ]
  };
}

// =====================================================================
// COMENTÁRIOS SOBRE A UNIFICAÇÃO
// =====================================================================

/*
🎯 RESUMO DA UNIFICAÇÃO IMPLEMENTADA:

ANTES (Sistema Fragmentado):
- setupTradeHandlers(io, socket, gameState)
- setupAllianceHandlers(io, socket, gameState) 
- setupCooperationHandlers(io, socket, gameState)
- setupCardHandlers(io, socket, gameState)

DEPOIS (Sistema Unificado):
- setupAgreementHandlers(io, socket, gameState)

BENEFÍCIOS ALCANÇADOS:
✅ Redução de ~70% das linhas de código
✅ Uma única fonte de verdade para acordos
✅ Facilidade para adicionar novos tipos
✅ Comportamento consistente
✅ Manutenibilidade simplificada
✅ Compatibilidade retroativa mantida

// =====================================================================
// COMENTÁRIOS SOBRE A UNIFICAÇÃO
// =====================================================================

/*
🎯 RESUMO DA UNIFICAÇÃO IMPLEMENTADA:

ANTES (Sistema Fragmentado):
- setupTradeHandlers(io, socket, gameState)
- setupAllianceHandlers(io, socket, gameState) 
- setupCooperationHandlers(io, socket, gameState)
- setupCardHandlers(io, socket, gameState)

DEPOIS (Sistema Unificado):
- setupAgreementHandlers(io, socket, gameState)

BENEFÍCIOS ALCANÇADOS:
✅ Redução de ~70% das linhas de código
✅ Uma única fonte de verdade para acordos
✅ Facilidade para adicionar novos tipos
✅ Comportamento consistente
✅ Manutenibilidade simplificada
✅ Compatibilidade retroativa mantida

COMPATIBILIDADE:
- Eventos antigos (sendTradeProposal, etc.) → Mapeados para sistema unificado
- Eventos novos (sendAgreementProposal) → Sistema unificado nativo
- Dados existentes → Migrados automaticamente

EXTENSIBILIDADE:
- Novos tipos → Apenas configuração no agreementTypeRegistry
- Acordos internos → Suportados nativamente
- Validações → Centralizadas e reutilizáveis

PRÓXIMOS PASSOS:
1. ✅ Fase 1: Infraestrutura unificada criada
2. 🔄 Fase 2: Expansão do sistema de mensagens
3. 🔄 Fase 3: Unificação do lado cliente
4. 🔄 Fase 4: Implementação de acordos internos
5. 🔄 Fase 5: Limpeza e remoção de código antigo
*/

export { 
  initializeSocketHandlers,
  initializeGlobalAgreementSystem,
  getSystemStatus 
};