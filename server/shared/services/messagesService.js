// =====================================================================
// SERVIÇO DE MENSAGENS UNIFICADO - FASE 2 EXPANDIDA
// =====================================================================
// Local: server/shared/services/messagesService.js

/**
 * Serviço centralizado de mensagens para todos os tipos de acordo
 * EXPANDIDO: Inclui suporte para acordos internos e sistema unificado
 */
class MessagesService {
  constructor() {
    this.initializeMessageTemplates();
  }

  // =====================================================================
  // TEMPLATES DE MENSAGEM EXPANDIDOS
  // =====================================================================

  initializeMessageTemplates() {
    this.messageTemplates = {
      // =================================================================
      // ACORDOS COMERCIAIS (MANTIDOS)
      // =================================================================
      trade: {
        // Propostas
        proposalSent: (targetCountry) => `Proposta comercial enviada para ${targetCountry}`,
        proposalReceived: (originCountry) => `${originCountry} enviou uma proposta comercial`,
        proposalAccepted: (targetCountry) => `${targetCountry} aceitou sua proposta comercial`,
        proposalRejected: (targetCountry) => `${targetCountry} recusou sua proposta comercial`,
        
        // Respostas
        responseAccepted: 'Você aceitou a proposta comercial',
        responseRejected: 'Você recusou a proposta comercial',
        
        // Cancelamentos
        agreementCancelled: (originCountry) => `${originCountry} cancelou o acordo comercial`,
        
        // Validações
        invalidProposal: 'Dados da proposta comercial inválidos',
        invalidTradeType: 'Tipo de comércio inválido. Use import/export com commodity/manufacture',
        valueOutOfRange: 'Valor deve estar entre 1 e 1000 bilhões de USD',
        targetNotFound: 'País alvo não encontrado',
        selfTrade: 'Não é possível comerciar consigo mesmo'
      },

      // =================================================================
      // ACORDOS MILITARES (MANTIDOS E EXPANDIDOS)
      // =================================================================
      alliance: {
        // Propostas
        proposalSent: (targetCountry) => `Proposta de aliança militar enviada para ${targetCountry}`,
        proposalReceived: (originCountry) => `${originCountry} propõe uma aliança militar`,
        proposalAccepted: (targetCountry) => `${targetCountry} aceitou sua proposta de aliança`,
        proposalRejected: (targetCountry) => `${targetCountry} recusou sua proposta de aliança`,
        
        // Respostas
        responseAccepted: 'Você aceitou a proposta de aliança militar',
        responseRejected: 'Você recusou a proposta de aliança militar',
        
        // Cancelamentos
        agreementCancelled: (originCountry) => `${originCountry} cancelou a aliança militar`,
        
        // Validações e restrições
        invalidProposal: 'Dados da proposta de aliança inválidos',
        alreadyHasAlliance: 'Você já possui uma aliança militar ativa',
        targetHasAlliance: (targetCountry) => `${targetCountry} já possui uma aliança militar ativa`,
        selfAlliance: 'Não é possível formar aliança consigo mesmo'
      },

      // =================================================================
      // COOPERAÇÃO MILITAR (MANTIDOS E EXPANDIDOS)
      // =================================================================
      cooperation: {
        // Propostas
        proposalSent: (targetCountry) => `Proposta de cooperação militar enviada para ${targetCountry}`,
        proposalReceived: (originCountry) => `${originCountry} propõe cooperação militar`,
        proposalAccepted: (targetCountry) => `${targetCountry} aceitou sua proposta de cooperação`,
        proposalRejected: (targetCountry) => `${targetCountry} recusou sua proposta de cooperação`,
        
        // Respostas
        responseAccepted: 'Você aceitou a proposta de cooperação militar',
        responseRejected: 'Você recusou a proposta de cooperação militar',
        
        // Cancelamentos
        agreementCancelled: (originCountry) => `${originCountry} cancelou a cooperação militar`,
        
        // Validações
        invalidProposal: 'Dados da proposta de cooperação inválidos',
        selfCooperation: 'Não é possível cooperar militarmente consigo mesmo'
      },

      // =================================================================
      // ACORDOS INTERNOS (NOVO - FASE 2)
      // =================================================================
      internal: {
        // Pactos Políticos
        politicalPact: {
          attemptStarted: 'Iniciando negociações para pacto político...',
          successCreated: 'Pacto político firmado com sucesso! (+4 pontos)',
          failedCreated: (probability) => `Falha ao formar pacto político. Chance era de ${probability}%. Tente novamente mais tarde.`,
          alreadyActive: 'Você já possui um pacto político ativo',
          cooldownActive: (seconds) => `Aguarde ${seconds} segundos antes de tentar novo pacto político`,
          cancelled: 'Pacto político cancelado'
        },

        // Parcerias Empresariais
        businessPartnership: {
          attemptStarted: 'Iniciando negociações empresariais...',
          successCreated: 'Parceria empresarial estabelecida! (+3 pontos)',
          failedCreated: (probability) => `Falha ao estabelecer parceria empresarial. Chance era de ${probability}%. Tente novamente.`,
          cooldownActive: (seconds) => `Aguarde ${seconds} segundos antes de nova tentativa empresarial`,
          cancelled: 'Parceria empresarial encerrada'
        },

        // Controle de Mídia
        mediaControl: {
          attemptStarted: 'Iniciando negociações de controle midiático...',
          successCreated: 'Controle de mídia estabelecido! (+5 pontos)',
          failedCreated: (probability) => `Falha ao estabelecer controle de mídia. Chance era de ${probability}%. Tente mais tarde.`,
          alreadyActive: 'Você já possui controle de mídia ativo',
          cooldownActive: (seconds) => `Aguarde ${seconds} segundos antes de nova tentativa midiática`,
          cancelled: 'Controle de mídia cancelado'
        },

        // Mensagens gerais para acordos internos
        invalidType: 'Tipo de acordo interno inválido',
        serviceUnavailable: 'Serviço de acordos internos temporariamente indisponível',
        insufficientResources: 'Recursos insuficientes para este tipo de acordo',
        stabilityTooLow: 'Estabilidade política insuficiente para este acordo'
      },

      // =================================================================
      // CONFIRMAÇÕES UNIFICADAS (EXPANDIDO)
      // =================================================================
      confirmations: {
        trade: {
          created: 'Acordo comercial criado com sucesso',
          cancelled: 'Acordo comercial cancelado',
          updated: 'Acordo comercial atualizado'
        },
        alliance: {
          created: 'Aliança militar estabelecida',
          cancelled: 'Aliança militar dissolvida',
          updated: 'Aliança militar atualizada'
        },
        cooperation: {
          created: 'Cooperação militar estabelecida',
          cancelled: 'Cooperação militar encerrada',
          updated: 'Cooperação militar atualizada'
        },
        internal: {
          created: (type) => `${this.getInternalTypeName(type)} criado com sucesso`,
          cancelled: (type) => `${this.getInternalTypeName(type)} cancelado`,
          failed: (type) => `Falha ao criar ${this.getInternalTypeName(type)}`
        }
      },

      // =================================================================
      // COOLDOWNS EXPANDIDOS
      // =================================================================
      cooldowns: {
        comercial: (seconds) => `Aguarde ${seconds} segundos antes de uma nova proposta comercial`,
        militar: (seconds) => `Aguarde ${seconds} segundos antes de uma nova proposta militar`,
        interno: (seconds) => `Aguarde ${seconds} segundos antes de uma nova tentativa interna`,
        alliance: (seconds) => `Aguarde ${seconds} segundos antes de uma nova proposta de aliança`,
        cooperation: (seconds) => `Aguarde ${seconds} segundos antes de uma nova proposta de cooperação`,
        political: (seconds) => `Aguarde ${seconds} segundos antes de novo pacto político`,
        business: (seconds) => `Aguarde ${seconds} segundos antes de nova parceria empresarial`,
        media: (seconds) => `Aguarde ${seconds} segundos antes de novo controle de mídia`,
        generic: (seconds) => `Aguarde ${seconds} segundos antes de uma nova ação`
      },

      // =================================================================
      // MENSAGENS DE ERRO GERAIS (EXPANDIDO)
      // =================================================================
      errors: {
        invalidRequest: 'Solicitação inválida - dados insuficientes',
        notAuthenticated: 'Usuário não autenticado',
        roomNotFound: 'Sala não encontrada',
        countryNotFound: 'País não encontrado',
        targetNotFound: 'País alvo não encontrado',
        serviceUnavailable: 'Serviço temporariamente indisponível',
        proposalNotFound: 'Proposta não encontrada',
        alreadyProcessed: 'Proposta já foi processada',
        invalidAgreementType: 'Tipo de acordo inválido',
        maxActiveReached: (type) => `Limite máximo de acordos ${type} atingido`,
        insufficientPermissions: 'Permissões insuficientes para esta ação',
        internalError: 'Erro interno do servidor'
      },

      // =================================================================
      // NOTIFICAÇÕES ESPECIAIS (NOVO)
      // =================================================================
      notifications: {
        agreementExpired: (type, country) => `Acordo de ${type} com ${country} expirou`,
        agreementRenewed: (type, country) => `Acordo de ${type} com ${country} foi renovado`,
        agreementBreached: (type, country) => `${country} violou o acordo de ${type}`,
        systemMaintenance: 'Sistema de acordos em manutenção. Tente novamente em alguns minutos.',
        
        // Notificações para acordos internos
        internalOpportunity: (type) => `Nova oportunidade de ${this.getInternalTypeName(type)} disponível`,
        internalRisk: (type) => `Risco detectado no ${this.getInternalTypeName(type)} ativo`,
        internalBenefit: (type, points) => `${this.getInternalTypeName(type)} gerou +${points} pontos adicionais`
      }
    };
  }

  // =====================================================================
  // MÉTODOS PARA ACORDOS COMERCIAIS (MANTIDOS)
  // =====================================================================

  getTradeMessage(messageType, data = null) {
    const template = this.messageTemplates.trade[messageType];
    return typeof template === 'function' ? template(data) : template;
  }

  // =====================================================================
  // MÉTODOS PARA ACORDOS MILITARES (MANTIDOS)
  // =====================================================================

  getAllianceMessage(messageType, data = null) {
    const template = this.messageTemplates.alliance[messageType];
    return typeof template === 'function' ? template(data) : template;
  }

  getCooperationMessage(messageType, data = null) {
    const template = this.messageTemplates.cooperation[messageType];
    return typeof template === 'function' ? template(data) : template;
  }

  // =====================================================================
  // MÉTODOS DIVERSOS
  // =====================================================================


  /**
   * Obter nome amigável para tipos internos
   */
  getInternalTypeName(type) {
    const names = {
      'political_pact': 'Pacto Político',
      'business_partnership': 'Parceria Empresarial', 
      'media_control': 'Controle de Mídia'
    };
    return names[type] || 'Acordo Interno';
  }

  /**
   * Obter mensagens de cooldown
   */
  getCooldownMessage(type, seconds) {
    const template = this.messageTemplates.cooldowns[type] || this.messageTemplates.cooldowns.generic;
    return template(seconds);
  }


  // =====================================================================
  // MÉTODOS UTILITÁRIOS
  // =====================================================================

  /**
   * Criar resposta padronizada para proposta aceita/rejeitada
   */
  createProposalResponse(agreementType, accepted, targetCountry, proposalId) {
    const messageType = accepted ? 'proposalAccepted' : 'proposalRejected';
    let message;

    // Mapear tipos unificados para métodos de mensagem
    if (agreementType.startsWith('trade') || agreementType === 'trade') {
      message = this.getTradeMessage(messageType, targetCountry);
    } else if (agreementType === 'alliance' || agreementType === 'military-alliance') {
      message = this.getAllianceMessage(messageType, targetCountry);
    } else if (agreementType === 'cooperation' || agreementType === 'strategic-cooperation') {
      message = this.getCooperationMessage(messageType, targetCountry);
    } else {
      message = accepted ? 'Proposta aceita!' : 'Proposta rejeitada.';
    }

    return {
      proposalId,
      accepted,
      targetCountry,
      message
    };
  }

  /**
   * Criar resposta padronizada para processamento de proposta
   */
  createProcessedResponse(agreementType, accepted) {
    const messageType = accepted ? 'responseAccepted' : 'responseRejected';
    let message;

    if (agreementType.startsWith('trade') || agreementType === 'trade') {
      message = this.getTradeMessage(messageType);
    } else if (agreementType === 'alliance' || agreementType === 'military-alliance') {
      message = this.getAllianceMessage(messageType);
    } else if (agreementType === 'cooperation' || agreementType === 'strategic-cooperation') {
      message = this.getCooperationMessage(messageType);
    } else {
      message = accepted ? 'Você aceitou a proposta.' : 'Você recusou a proposta.';
    }

    return { accepted, message };
  }

}

// =====================================================================
// EXPORTAR INSTÂNCIA SINGLETON
// =====================================================================

const messagesService = new MessagesService();
export default messagesService;