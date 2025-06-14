// =====================================================================
// MOTOR UNIFICADO DE ACORDOS - FASE 1
// =====================================================================
// Local: server/modules/agreements/agreementEngine.js

import { 
  AGREEMENT_TYPES, 
  getAgreementTypeConfig, 
  isValidAgreementType,
  mapLegacyType 
} from '../../shared/config/agreementTypeRegistry.js';
import { getCurrentRoom } from '../../shared/utils/gameStateUtils.js';
import agreementMessagesService from '../../shared/services/agreementMessagesService.js';

/**
 * Motor principal para processamento de todos os tipos de acordo
 * Substitui todos os handlers específicos por um sistema unificado
 * Stateless - recebe dependências por injeção
 */
export class AgreementEngine {
  constructor() {
    this.cooldowns = new Map(); // Cache de cooldowns por socket
    this.activeProposals = new Map(); // Cache de propostas ativas
  }

  // =====================================================================
  // MÉTODO PRINCIPAL DE PROCESSAMENTO
  // =====================================================================

  /**
   * Processa uma proposta de acordo baseada no tipo
   * Ponto de entrada principal do sistema unificado
   */
  async processProposal(socket, gameState, io, proposalData) {
    try {
      // Normalizar tipo (compatibilidade com sistema antigo)
      const normalizedType = this.normalizeAgreementType(proposalData);
      if (!normalizedType) {
        socket.emit('error', 'Tipo de acordo inválido');
        return false;
      }

      // Obter configuração do tipo
      const config = getAgreementTypeConfig(normalizedType);
      if (!config) {
        socket.emit('error', 'Tipo de acordo não encontrado na configuração');
        return false;
      }

      // Validação básica
      const basicValidation = this.validateBasicRequest(socket, gameState);
      if (!basicValidation) return false;

      const { username, roomName, userCountry } = basicValidation;

      // Validação específica do tipo
      const typeValidation = await this.validateAgreement(normalizedType, proposalData, socket, gameState);
      if (!typeValidation.valid) {
        socket.emit('error', typeValidation.error);
        return false;
      }

      // Verificar cooldown
      if (this.isInCooldown(socket.id, normalizedType, config.cooldownTime)) {
        const remaining = this.getRemainingCooldown(socket.id, normalizedType, config.cooldownTime);
        const message = agreementMessagesService.getCooldownMessage(config.category, Math.ceil(remaining / 1000));
        socket.emit('error', message);
        return false;
      }

      // Verificar limites de acordos ativos
      if (config.maxActive && !this.checkActiveLimit(roomName, userCountry, normalizedType, config.maxActive)) {
        socket.emit('error', this.getMaxActiveError(normalizedType, config));
        return false;
      }

      // Processar baseado na categoria
      if (config.requiresProposal) {
        return await this.handleProposalFlow(socket, gameState, io, normalizedType, proposalData, config);
      } else {
        return await this.handleDirectCreation(socket, gameState, normalizedType, proposalData, config);
      }

    } catch (error) {
      console.error('Erro no processamento de acordo:', error);
      socket.emit('error', 'Erro interno no processamento do acordo');
      return false;
    }
  }

  // =====================================================================
  // FLUXO DE PROPOSTAS (ACORDOS BILATERAIS)
  // =====================================================================

  /**
   * Gerencia fluxo completo de proposta para acordos bilaterais
   */
  async handleProposalFlow(socket, gameState, io, agreementType, proposalData, config) {
    const { username, roomName, userCountry } = this.validateBasicRequest(socket, gameState);
    const { targetCountry } = proposalData;

    // Verificar se alvo é válido
    const targetInfo = this.getTargetPlayerInfo(gameState, roomName, targetCountry);
    
    if (targetInfo) {
      // Jogador humano - enviar proposta
      return await this.sendProposalToPlayer(socket, gameState, io, agreementType, proposalData, config, targetInfo);
    } else {
      // IA - decisão automática
      return await this.handleAIDecision(socket, gameState, agreementType, proposalData, config);
    }
  }

  /**
   * Envia proposta para jogador humano
   */
  async sendProposalToPlayer(socket, gameState, io, agreementType, proposalData, config, targetInfo) {
    const { username, roomName, userCountry } = this.validateBasicRequest(socket, gameState);
    const proposalId = this.generateProposalId(agreementType);

    // Armazenar proposta no socket do alvo
    const proposal = {
      id: proposalId,
      type: agreementType,
      originCountry: userCountry,
      targetCountry: proposalData.targetCountry,
      originPlayer: username,
      data: proposalData,
      timestamp: Date.now()
    };

    targetInfo.socket[`${this.getSocketEventPrefix(agreementType)}Proposal`] = proposal;

    // Enviar proposta para o alvo
    const message = this.formatProposalMessage(agreementType, proposal);
    targetInfo.socket.emit(`${this.getSocketEventPrefix(agreementType)}ProposalReceived`, {
      proposalId,
      proposal: proposalData,
      message,
      originCountry: userCountry
    });

    // Confirmar envio para o remetente
    socket.emit(`${this.getSocketEventPrefix(agreementType)}ProposalSent`, {
      targetCountry: proposalData.targetCountry,
      message: `Proposta enviada para ${proposalData.targetCountry}`
    });

    // Iniciar cooldown
    this.setCooldown(socket.id, agreementType, config.cooldownTime);

    return true;
  }

  /**
   * Gerencia decisão automática da IA
   */
  async handleAIDecision(socket, gameState, agreementType, proposalData, config) {
    const { username, roomName, userCountry } = this.validateBasicRequest(socket, gameState);

    // Simular tempo de decisão da IA
    setTimeout(async () => {
      const accepted = Math.random() < config.aiAcceptanceRate;

      if (accepted) {
        // IA aceitou - criar acordo
        const success = await this.createAgreement(roomName, userCountry, proposalData.targetCountry, username, agreementType, proposalData);
        
        if (success) {
          const response = agreementMessagesService.createProposalResponse(
            this.getSocketEventPrefix(agreementType), true, proposalData.targetCountry, 'ai-decision'
          );
          socket.emit(`${this.getSocketEventPrefix(agreementType)}ProposalResponse`, response);
        } else {
          const response = agreementMessagesService.createProposalResponse(
            this.getSocketEventPrefix(agreementType), false, proposalData.targetCountry, 'ai-decision'
          );
          response.message = 'Falha ao criar acordo';
          socket.emit(`${this.getSocketEventPrefix(agreementType)}ProposalResponse`, response);
        }
      } else {
        // IA rejeitou
        const response = agreementMessagesService.createProposalResponse(
          this.getSocketEventPrefix(agreementType), false, proposalData.targetCountry, 'ai-decision'
        );
        socket.emit(`${this.getSocketEventPrefix(agreementType)}ProposalResponse`, response);
      }
    }, 1500);

    // Iniciar cooldown imediatamente
    this.setCooldown(socket.id, agreementType, config.cooldownTime);

    return true;
  }

  // =====================================================================
  // CRIAÇÃO DIRETA (ACORDOS INTERNOS)
  // =====================================================================

  /**
   * Gerencia criação direta para acordos internos
   */
  async handleDirectCreation(socket, gameState, agreementType, proposalData, config) {
    const { username, roomName, userCountry } = this.validateBasicRequest(socket, gameState);

    // Calcular probabilidade baseada nos fatores
    const probability = this.calculateInternalProbability(config, roomName, userCountry);
    const success = Math.random() < probability;

    if (success) {
      // Criar acordo interno
      const created = await this.createAgreement(roomName, userCountry, null, username, agreementType, proposalData);
      
      if (created) {
        socket.emit('agreementCreated', {
          type: agreementType,
          message: `${config.description} criado com sucesso!`,
          points: config.points
        });
        
        // Iniciar cooldown
        this.setCooldown(socket.id, agreementType, config.cooldownTime);
        return true;
      }
    }

    // Falha na criação
    socket.emit('agreementFailed', {
      type: agreementType,
      message: `Falha ao criar ${config.description}. Tente novamente mais tarde.`,
      probability: Math.round(probability * 100)
    });

    // Cooldown menor em caso de falha
    this.setCooldown(socket.id, agreementType, config.cooldownTime / 2);
    return false;
  }

  // =====================================================================
  // RESPOSTA A PROPOSTAS
  // =====================================================================

  /**
   * Processa resposta a uma proposta
   */
  async handleResponse(socket, gameState, io, response) {
    const { proposalId, accepted, agreementType } = response;
    
    // Normalizar tipo
    const normalizedType = mapLegacyType(agreementType || 'trade');
    const eventPrefix = this.getSocketEventPrefix(normalizedType);
    
    // Obter proposta armazenada
    const proposal = socket[`${eventPrefix}Proposal`];
    if (!proposal) {
      socket.emit('error', 'Proposta não encontrada');
      return false;
    }

    const config = getAgreementTypeConfig(normalizedType);
    if (!config) {
      socket.emit('error', 'Configuração de acordo não encontrada');
      return false;
    }

    if (accepted) {
      // Aceitar proposta - criar acordo
      const success = await this.createAgreement(
        getCurrentRoom(socket, gameState),
        proposal.originCountry,
        proposal.targetCountry,
        proposal.originPlayer,
        normalizedType,
        proposal.data
      );

      if (success) {
        // Notificar remetente da proposta
        this.notifyProposalSender(gameState, io, proposal, normalizedType, true);
        
        // Confirmar para quem aceitou
        const processedResponse = agreementMessagesService.createProcessedResponse(eventPrefix, true);
        socket.emit(`${eventPrefix}ProposalProcessed`, processedResponse);
      } else {
        socket.emit('error', 'Falha ao criar acordo');
      }
    } else {
      // Rejeitar proposta
      this.notifyProposalSender(gameState, io, proposal, normalizedType, false);
      
      // Confirmar rejeição
      const processedResponse = agreementMessagesService.createProcessedResponse(eventPrefix, false);
      socket.emit(`${eventPrefix}ProposalProcessed`, processedResponse);
    }

    // Limpar proposta do socket
    delete socket[`${eventPrefix}Proposal`];
    return true;
  }

  // =====================================================================
  // CANCELAMENTO DE ACORDOS
  // =====================================================================

  /**
   * Processa cancelamento de acordo
   */
  async cancelAgreement(socket, gameState, io, cancellationData) {
    const { cardId, agreementType } = cancellationData;
    
    // Validação básica
    const basicValidation = this.validateBasicRequest(socket, gameState);
    if (!basicValidation) return false;

    const { username, roomName, userCountry } = basicValidation;

    // Verificar se serviço de cards está disponível
    if (!global.cardService || !global.cardService.initialized) {
      socket.emit('error', 'Serviço de cards não disponível');
      return false;
    }

    try {
      // Obter informações do card
      const cardInfo = global.cardService.getCardById(roomName, cardId);
      if (!cardInfo || cardInfo.owner !== userCountry) {
        socket.emit('error', 'Card não encontrado ou você não tem permissão');
        return false;
      }

      // Remover TODOS os cards relacionados ao acordo bilateral
      const removedCount = global.cardService.removeAgreementCards(
        roomName, 
        cardInfo.type, 
        cardInfo.owner, 
        cardInfo.target
      );
      
      if (removedCount === 0) {
        socket.emit('error', 'Falha ao remover acordo');
        return false;
      }
      
      console.log(`[AGREEMENT] Removed ${removedCount} cards for ${cardInfo.type} agreement between ${cardInfo.owner} and ${cardInfo.target}`);

      // Notificar parceiro se acordo bilateral
      const config = getAgreementTypeConfig(agreementType);
      if (config && config.bilateral && cardInfo.target) {
        this.notifyAgreementCancellation(gameState, io, userCountry, cardInfo.target, agreementType);
      }

      // Confirmar cancelamento
      socket.emit('agreementCancelled', {
        cardId,
        type: agreementType,
        message: 'Acordo cancelado com sucesso'
      });

      return true;

    } catch (error) {
      console.error('Erro ao cancelar acordo:', error);
      socket.emit('error', 'Erro interno ao cancelar acordo');
      return false;
    }
  }

  // =====================================================================
  // MÉTODOS DE VALIDAÇÃO
  // =====================================================================

  /**
   * Validação básica para qualquer operação
   */
  validateBasicRequest(socket, gameState) {
    const username = socket.username;
    const roomName = getCurrentRoom(socket, gameState);
    const userCountry = this.getUserCountry(gameState, roomName, username);
    
    if (!username || !roomName || !userCountry) {
      socket.emit('error', 'Dados de autenticação inválidos');
      return null;
    }
    
    return { username, roomName, userCountry };
  }

  /**
   * Validação específica do tipo de acordo
   */
  async validateAgreement(agreementType, proposalData, socket, gameState) {
    const config = getAgreementTypeConfig(agreementType);
    if (!config || !config.validation) {
      return { valid: false, error: 'Validação não configurada para este tipo' };
    }

    return config.validation(proposalData);
  }

  // =====================================================================
  // MÉTODOS DE CRIAÇÃO
  // =====================================================================

  /**
   * Cria acordo usando a função específica do tipo
   */
  async createAgreement(roomName, userCountry, targetCountry, username, agreementType, proposalData) {
    const config = getAgreementTypeConfig(agreementType);
    if (!config || !config.creation) {
      return false;
    }

    return config.creation(roomName, userCountry, targetCountry, username, proposalData);
  }

  // =====================================================================
  // MÉTODOS UTILITÁRIOS
  // =====================================================================

  /**
   * Normaliza tipo de acordo para compatibilidade
   */
  normalizeAgreementType(proposalData) {
    if (proposalData.agreementType) return mapLegacyType(proposalData.agreementType);
    if (proposalData.type) {
      // Para acordos comerciais, combinar tipo e produto
      if (['import', 'export'].includes(proposalData.type)) {
        return `trade-${proposalData.type}`;
      }
      return mapLegacyType(proposalData.type);
    }
    return null;
  }

  /**
   * Obter país do usuário
   */
  getUserCountry(gameState, roomName, username) {
    if (!roomName || !username) return null;
    
    const room = gameState.rooms.get(roomName);
    if (!room || !room.players) return null;
    
    const player = room.players.find(p => {
      if (typeof p === 'object') {
        return p.username === username;
      }
      return false;
    });
    
    return player?.country || null;
  }

  /**
   * Obter informações do jogador alvo
   */
  getTargetPlayerInfo(gameState, roomName, targetCountry) {
    const room = gameState.rooms.get(roomName);
    if (!room) return null;
    
    const targetPlayer = room.players.find(player => 
      typeof player === 'object' && player.country === targetCountry
    );
    
    if (!targetPlayer || !targetPlayer.isOnline) {
      return null;
    }
    
    const targetSocketId = gameState.usernameToSocketId?.get(targetPlayer.username);
    const targetSocket = targetSocketId ? 
      global.io?.sockets?.sockets?.get(targetSocketId) : null;
    
    if (!targetSocket || !targetSocket.connected) {
      return null;
    }
    
    return { player: targetPlayer, socket: targetSocket };
  }

  /**
   * Verificar se está em cooldown
   */
  isInCooldown(socketId, agreementType, cooldownTime) {
    const key = `${socketId}-${agreementType}`;
    const lastUsed = this.cooldowns.get(key);
    
    if (!lastUsed) return false;
    
    return (Date.now() - lastUsed) < cooldownTime;
  }

  /**
   * Obter tempo restante de cooldown
   */
  getRemainingCooldown(socketId, agreementType, cooldownTime) {
    const key = `${socketId}-${agreementType}`;
    const lastUsed = this.cooldowns.get(key);
    
    if (!lastUsed) return 0;
    
    const elapsed = Date.now() - lastUsed;
    return Math.max(0, cooldownTime - elapsed);
  }

  /**
   * Definir cooldown
   */
  setCooldown(socketId, agreementType, cooldownTime) {
    const key = `${socketId}-${agreementType}`;
    this.cooldowns.set(key, Date.now());
    
    // Limpar automaticamente após o cooldown
    setTimeout(() => {
      this.cooldowns.delete(key);
    }, cooldownTime + 1000);
  }

  /**
   * Verificar limite de acordos ativos
   */
  checkActiveLimit(roomName, userCountry, agreementType, maxActive) {
    if (!global.cardService) return true;
    
    try {
      const cards = global.cardService.getCardsByOwner(roomName, userCountry);
      const activeOfType = cards.filter(card => 
        card.type === agreementType || card.type === agreementType.replace('-', '_')
      );
      
      return activeOfType.length < maxActive;
    } catch (error) {
      console.error('Erro ao verificar limite de acordos:', error);
      return true; // Em caso de erro, permitir
    }
  }

  /**
   * Gerar ID único para proposta
   */
  generateProposalId(agreementType) {
    return `${agreementType}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Obter prefixo de evento para socket baseado no tipo
   */
  getSocketEventPrefix(agreementType) {
    const prefixMap = {
      'trade-import': 'trade',
      'trade-export': 'trade',
      'military-alliance': 'alliance',
      'strategic-cooperation': 'cooperation',
      'political-pact': 'internal',
      'business-partnership': 'internal',
      'media-control': 'internal'
    };
    
    return prefixMap[agreementType] || 'agreement';
  }

  /**
   * Formatar mensagem de proposta
   */
  formatProposalMessage(agreementType, proposal) {
    const eventPrefix = this.getSocketEventPrefix(agreementType);
    
    switch (eventPrefix) {
      case 'trade':
        const productName = proposal.data.product === 'commodity' ? 'commodities' : 'manufaturas';
        const actionType = proposal.data.type === 'export' ? 'exportar para você' : 'importar de você';
        return `${proposal.originCountry} quer ${actionType} ${productName} (${proposal.data.value} bi USD)`;
      
      case 'alliance':
        return `${proposal.originCountry} propõe uma aliança militar com você!`;
      
      case 'cooperation':
        return `${proposal.originCountry} propõe cooperação militar com você!`;
      
      default:
        return `${proposal.originCountry} enviou uma proposta para você.`;
    }
  }

  /**
   * Notificar remetente sobre resposta da proposta
   */
  notifyProposalSender(gameState, io, proposal, agreementType, accepted) {
    const originSocketId = gameState.usernameToSocketId?.get(proposal.originPlayer);
    const originSocket = originSocketId ? io.sockets.sockets.get(originSocketId) : null;
    
    if (originSocket && originSocket.connected) {
      const eventPrefix = this.getSocketEventPrefix(agreementType);
      const response = agreementMessagesService.createProposalResponse(
        eventPrefix, accepted, proposal.targetCountry, proposal.id
      );
      originSocket.emit(`${eventPrefix}ProposalResponse`, response);
    }
  }

  /**
   * Notificar sobre cancelamento de acordo
   */
  notifyAgreementCancellation(gameState, io, originCountry, targetCountry, agreementType) {
    // Encontrar socket do parceiro
    const room = gameState.rooms.get(getCurrentRoom({ username: 'temp' }, gameState));
    if (!room) return;

    const targetPlayer = room.players.find(player => 
      typeof player === 'object' && player.country === targetCountry
    );

    if (targetPlayer && targetPlayer.isOnline) {
      const targetSocketId = gameState.usernameToSocketId?.get(targetPlayer.username);
      const targetSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : null;
      
      if (targetSocket && targetSocket.connected) {
        const eventPrefix = this.getSocketEventPrefix(agreementType);
        const message = `${originCountry} cancelou o acordo de ${agreementType}`;
        targetSocket.emit(`${eventPrefix}AgreementCancelled`, { 
          originCountry, 
          message 
        });
      }
    }
  }

  /**
   * Calcular probabilidade para acordos internos
   */
  calculateInternalProbability(config, roomName, userCountry) {
    if (!config.probabilityFactors) return 0.5; // 50% padrão

    try {
      // Obter estado do país (simulado - ajustar conforme implementação real)
      const countryState = this.getCountryState(roomName, userCountry);
      
      let baseProbability = 0.3; // 30% base
      
      config.probabilityFactors.forEach(factor => {
        switch (factor) {
          case 'stability':
            baseProbability += (countryState.stability || 0.5) * 0.2;
            break;
          case 'economy':
            baseProbability += (countryState.economy || 0.5) * 0.2;
            break;
          case 'approval':
            baseProbability += (countryState.approval || 0.5) * 0.15;
            break;
          case 'business_confidence':
            baseProbability += (countryState.businessConfidence || 0.5) * 0.15;
            break;
          case 'media_influence':
            baseProbability += (countryState.mediaInfluence || 0.5) * 0.1;
            break;
        }
      });
      
      return Math.min(Math.max(baseProbability, 0.1), 0.9); // Entre 10% e 90%
    } catch (error) {
      console.error('Erro ao calcular probabilidade interna:', error);
      return 0.5;
    }
  }

  /**
   * Obter estado do país (placeholder - implementar conforme sistema real)
   */
  getCountryState(roomName, country) {
    // Placeholder - substituir pela implementação real do estado do país
    return {
      stability: Math.random(),
      economy: Math.random(),
      approval: Math.random(),
      businessConfidence: Math.random(),
      mediaInfluence: Math.random()
    };
  }

  /**
   * Obter mensagem de erro para limite máximo
   */
  getMaxActiveError(agreementType, config) {
    switch (agreementType) {
      case 'military-alliance':
        return 'Você já possui uma aliança militar ativa. Cancele a atual para formar uma nova.';
      case 'political-pact':
        return 'Você já possui um pacto político ativo.';
      case 'media-control':
        return 'Você já possui controle de mídia ativo.';
      default:
        return `Você atingiu o limite máximo de ${config.maxActive} acordo(s) deste tipo.`;
    }
  }

  /**
   * Limpar dados do socket quando desconectar
   */
  cleanupSocket(socketId) {
    // Limpar cooldowns do socket
    const keysToDelete = [];
    this.cooldowns.forEach((value, key) => {
      if (key.startsWith(socketId)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cooldowns.delete(key));
    
    // Limpar propostas ativas
    this.activeProposals.delete(socketId);
  }
}

// =====================================================================
// INSTÂNCIA SINGLETON
// =====================================================================

const agreementEngine = new AgreementEngine();
export default agreementEngine;