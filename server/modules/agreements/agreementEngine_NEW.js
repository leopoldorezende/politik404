import { playerStateManager } from '../player/playerStateManager.js'; // Importação 'initialize' removida
import { v4 as uuidv4 } from 'uuid';
import { getAgreementTypeConfig, isValidAgreementType, mapLegacyType } from '../../shared/config/agreementTypeRegistry.js';
import redis from '../../shared/redisClient.js';

/**
 * AgreementEngine - Central de Gerenciamento de Acordos
 * Responsável por processar propostas, gerenciar o ciclo de vida dos acordos e interagir com outros serviços.
 */
class AgreementEngine {
  constructor(io) {
    if (!AgreementEngine.instance) {
      this.io = io;
      this.agreements = new Map(); // agreementId -> agreementObject
      this.proposals = new Map(); // proposalId -> proposalObject
      this.proposalTimeout = 60000; // 60 segundos
      this.initialized = false;
      this.redisKey = 'agreement_engine_data';
      AgreementEngine.instance = this;
    }
    return AgreementEngine.instance;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.loadFromRedis();
      this.initialized = true;
      console.log('[AGREEMENT ENGINE] Agreement Engine initialized');
    } catch (error) {
      console.error('[AGREEMENT ENGINE] Error initializing Agreement Engine:', error);
    }
  }
  
  // ========================================================================
  // PERSISTÊNCIA
  // ========================================================================
  
  async saveToRedis() {
    try {
      const data = {
        agreements: Object.fromEntries(this.agreements),
        proposals: Object.fromEntries(this.proposals)
      };
      
      await redis.set(this.redisKey, JSON.stringify(data));
      console.log('[AGREEMENT ENGINE] Data saved to Redis');
    } catch (error) {
      console.error('[AGREEMENT ENGINE] Error saving to Redis:', error);
    }
  }
  
  async loadFromRedis() {
    try {
      const data = await redis.get(this.redisKey);
      if (data) {
        const parsed = JSON.parse(data);
        
        this.agreements = new Map(Object.entries(parsed.agreements || {}));
        this.proposals = new Map(Object.entries(parsed.proposals || {}));
        
        // Reiniciar timeouts para propostas pendentes
        this.proposals.forEach((proposal) => {
          this.setProposalTimeout(proposal.proposalId);
        });
        
        console.log('[AGREEMENT ENGINE] Data loaded from Redis');
      }
    } catch (error) {
      console.error('[AGREEMENT ENGINE] Error loading from Redis:', error);
    }
  }

  // ========================================================================
  // GERENCIAMENTO DE PROPOSTAS
  // ========================================================================
  
  /**
   * Processa uma nova proposta de acordo
   * @param {string} roomName - Sala onde a proposta foi feita
   * @param {Object} proposalData - Dados da proposta
   * @returns {Object} - Resultado do processamento
   */
  async processProposal(roomName, proposalData) {
    // Mapear tipo legado para o unificado (ex: 'military_alliance' -> 'military-alliance')
    const unifiedType = mapLegacyType(proposalData.type);
    
    // Atualizar proposalData para usar o tipo unificado
    proposalData.type = unifiedType;
    proposalData.agreementType = unifiedType;

    console.log('📤 Unified proposal received:', proposalData);

    // Obter configuração do acordo
    const agreementConfig = getAgreementTypeConfig(unifiedType);
    if (!agreementConfig) {
      throw new Error(`Tipo de acordo inválido: ${unifiedType}`);
    }

    // Validar proposta
    const validation = agreementConfig.validation(proposalData);
    if (!validation.valid) {
      throw new Error(`Dados da proposta de ${unifiedType} inválidos: ${validation.error}`);
    }

    // Criar objeto da proposta
    const proposalId = `${unifiedType}-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const proposal = {
      proposalId,
      roomName,
      status: 'pending',
      timestamp: Date.now(),
      ...proposalData
    };
    
    this.proposals.set(proposalId, proposal);
    this.setProposalTimeout(proposalId);
    
    // Notificar país alvo
    const targetSocketId = playerStateManager.getPlayerSocketId(proposal.targetCountry);
    if (targetSocketId) {
      this.io.to(targetSocketId).emit('agreementProposalReceived', proposal);
      console.log(`📨 Proposta ${unifiedType} enviada para ${proposal.targetCountry}`);
    } else {
      console.log(`País alvo ${proposal.targetCountry} não encontrado.`);
      // Se o alvo não estiver online, a proposta ainda fica pendente
    }
    
    await this.saveToRedis();
    return proposal;
  }
  
  /**
   * Processa a resposta a uma proposta
   * @param {string} proposalId - ID da proposta
   * @param {boolean} accepted - Se a proposta foi aceita ou não
   * @param {string} username - Nome do jogador que respondeu
   * @returns {Object} - Resultado do processamento
   */
  async handleResponse({ proposalId, accepted, username, message }) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'pending') {
      throw new Error('Proposta não encontrada ou já processada');
    }
    
    const { roomName, originCountry, targetCountry, type } = proposal;

    // Obter configuração do acordo
    const agreementConfig = getAgreementTypeConfig(type);
    if (!agreementConfig) {
      throw new Error(`Configuração do acordo inválida para o tipo ${type}`);
    }

    // Se a proposta foi aceita, criar o acordo
    if (accepted) {
      // ✅ NOVO: Verificar se o acordo é bilateral ou interno
      if (agreementConfig.bilateral) {
        // Acordos bilaterais (aliança, cooperação, comércio)
        await this.createAgreement({
          ...proposal,
          status: 'active',
          acceptedBy: username,
          country1: originCountry,
          country2: targetCountry
        });
      } else {
        // Acordos internos (são criados automaticamente)
        // A lógica de criação para acordos internos está no `createInternalAgreement`
        await this.createAgreement({
          ...proposal,
          status: 'active',
          acceptedBy: username,
          country1: originCountry,
          country2: null
        });
      }

      // Notificar ambos os países
      this.io.to(playerStateManager.getPlayerSocketId(originCountry))
        .emit('agreementProposalResponse', { proposalId, accepted, targetCountry, agreementType: type, message });
      this.io.to(playerStateManager.getPlayerSocketId(targetCountry))
        .emit('agreementProposalResponse', { proposalId, accepted, targetCountry: originCountry, agreementType: type, message });
    
      console.log('📥 Unified response received:', { proposalId, accepted, agreementType: type });
    } else {
      // Se recusado, notificar apenas o originador
      const originSocketId = playerStateManager.getPlayerSocketId(originCountry);
      if (originSocketId) {
        this.io.to(originSocketId).emit('agreementProposalResponse', { proposalId, accepted, targetCountry, agreementType: type, message });
      }
    }
    
    // Atualizar status da proposta para processada
    proposal.status = 'processed';
    this.proposals.set(proposalId, proposal);
    
    await this.saveToRedis();
    return proposal;
  }
  
  /**
   * Configura um timeout para a proposta
   */
  setProposalTimeout(proposalId) {
    setTimeout(async () => {
      const proposal = this.proposals.get(proposalId);
      if (proposal && proposal.status === 'pending') {
        proposal.status = 'expired';
        console.log(`⏱️ Proposta ${proposalId} expirou`);
        
        const originSocketId = playerStateManager.getPlayerSocketId(proposal.originCountry);
        if (originSocketId) {
          this.io.to(originSocketId).emit('agreementProposalResponse', {
            proposalId,
            accepted: false,
            message: 'A proposta expirou.'
          });
        }
        await this.saveToRedis();
      }
    }, this.proposalTimeout);
  }

  // ========================================================================
  // GERENCIAMENTO DE ACORDOS
  // ========================================================================
  
  /**
   * Cria um novo acordo a partir de uma proposta aceita
   * @param {Object} proposal - Proposta aceita
   */
  async createAgreement(proposal) {
    const agreementId = `agreement-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const agreement = {
      agreementId,
      status: 'active',
      timestamp: Date.now(),
      ...proposal
    };
    
    // Obter configuração de criação do acordo
    const agreementConfig = getAgreementTypeConfig(agreement.type);
    if (agreementConfig && agreementConfig.creation) {
      const isCreated = agreementConfig.creation(
        agreement.roomName,
        agreement.originCountry,
        agreement.targetCountry,
        agreement.originPlayer,
        agreement
      );
      
      if (!isCreated) {
        throw new Error(`Falha ao criar o acordo do tipo: ${agreement.type}`);
      }
    } else {
      throw new Error(`Tipo de acordo sem função de criação: ${agreement.type}`);
    }

    this.agreements.set(agreementId, agreement);
    console.log(`✅ Acordo ${agreement.type} criado: ${agreementId}`);

    await this.saveToRedis();
    return agreement;
  }

  /**
   * Cancela um acordo
   * @param {Object} params - Parâmetros de cancelamento
   * @param {string} params.roomName - Nome da sala
   * @param {string} params.agreementId - ID do acordo
   * @param {string} params.agreementType - Tipo do acordo
   * @param {string} params.username - Nome do usuário que cancelou
   */
  async cancelAgreement({ roomName, agreementId, agreementType, username }) {
    console.log(`[AGREEMENT ENGINE] Attempting to cancel agreement ${agreementId} of type ${agreementType} in room ${roomName}`);
    
    const agreement = await this.getAgreementById(agreementId);
    if (!agreement) {
        throw new Error('Acordo não encontrado');
    }

    const agreementConfig = getAgreementTypeConfig(agreement.type);
    if (!agreementConfig) {
        throw new Error(`Configuração do acordo inválida para o tipo ${agreement.type}`);
    }

    // Checar se o acordo pode ser cancelado
    if (agreement.status !== 'active') {
        throw new Error('Acordo não está ativo');
    }

    // Checar permissão para cancelar
    // No momento, apenas o criador pode cancelar
    if (agreement.originPlayer !== username) {
        throw new Error('Você não tem permissão para cancelar este acordo');
    }

    let removedCount = 0;
    // ✅ CORREÇÃO: Usar o método de cancelamento de card apropriado para o tipo de acordo
    if (agreementConfig.category === 'comercial') {
        if (!global.cardService) throw new Error('CardService não disponível');
        removedCount = global.cardService.cancelCardsByAgreement(roomName, agreementId);
    } else if (agreementConfig.category === 'militar') {
        if (!global.cardService) throw new Error('CardService não disponível');
        // Lógica para acordos bilaterais como alianças
        removedCount = global.cardService.removeAgreementCards(roomName, agreement.type, agreement.country1, agreement.country2);
    } else {
        throw new Error(`Tipo de acordo desconhecido para cancelamento: ${agreement.type}`);
    }

    // Atualizar status do acordo no Redis
    await this.updateAgreementStatus(agreementId, 'cancelled');

    // Notificar clientes sobre o cancelamento
    global.io.to(roomName).emit('agreementCancelled', {
        roomName,
        agreementId,
        agreementType,
        message: `O acordo de ${agreementConfig.description} foi cancelado por ${username}.`
    });
    
    console.log(`[AGREEMENT ENGINE] Agreement ${agreementId} cancelled. Removed ${removedCount} cards.`);
    return { success: true, agreementId, agreementType, message: 'Acordo cancelado com sucesso' };
}

  /**
   * Obtém um acordo por ID
   */
  async getAgreementById(agreementId) {
    if (this.agreements.has(agreementId)) {
      return this.agreements.get(agreementId);
    }
    return null;
  }
  
  /**
   * Atualiza o status de um acordo
   */
  async updateAgreementStatus(agreementId, status) {
    const agreement = this.agreements.get(agreementId);
    if (agreement) {
      agreement.status = status;
      this.agreements.set(agreementId, agreement);
      await this.saveToRedis();
    }
  }

  /**
   * Obtém todos os acordos ativos de uma sala
   */
  getRoomAgreements(roomName) {
    const activeAgreements = [];
    for (const agreement of this.agreements.values()) {
      if (agreement.roomName === roomName && agreement.status === 'active') {
        activeAgreements.push(agreement);
      }
    }
    return activeAgreements;
  }
  
  /**
   * Obtém todos os acordos ativos de um país
   */
  getCountryAgreements(roomName, countryName) {
    const agreements = this.getRoomAgreements(roomName);
    return agreements.filter(
      (a) => a.originCountry === countryName || a.targetCountry === countryName
    );
  }
  
  /**
   * Verifica se um acordo bilateral já existe
   */
  async getBilateralAgreement(roomName, type, country1, country2) {
    const agreements = this.getRoomAgreements(roomName);
    return agreements.find(
      (a) =>
        a.type === type &&
        ((a.originCountry === country1 && a.targetCountry === country2) ||
          (a.originCountry === country2 && a.targetCountry === country1))
    );
  }
}

// Singleton instance
let agreementEngineInstance = null;

export const initialize = (io) => {
  if (!agreementEngineInstance) {
    agreementEngineInstance = new AgreementEngine(io);
  }
  return agreementEngineInstance.initialize();
};

export const getAgreementEngineInstance = () => {
  if (!agreementEngineInstance) {
    throw new Error('AgreementEngine not initialized. Call initialize() first.');
  }
  return agreementEngineInstance;
};

export default AgreementEngine;