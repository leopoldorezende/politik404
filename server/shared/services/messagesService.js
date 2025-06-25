// =====================================================================
// SERVIÇO DE MENSAGENS UNIFICADO
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

  initializeMessageTemplates() {
    this.messageTemplates = {
      // =================================================================
      // ACORDOS COMERCIAIS 
      // =================================================================
      trade: {
        // Propostas
        proposalSent: (targetCountry) => `Proposta comercial enviada para ${targetCountry}`,
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
      // ACORDOS MILITARES 
      // =================================================================
      alliance: {
        // Propostas
        proposalSent: (targetCountry) => `Proposta de aliança militar enviada para ${targetCountry}`,
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
      // COOPERAÇÃO MILITAR
      // =================================================================
      cooperation: {
        // Propostas
        proposalSent: (targetCountry) => `Proposta de cooperação militar enviada para ${targetCountry}`,
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
      // MENSAGENS DE ERRO GERAIS 
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
  // MÉTODOS PARA ACORDOS COMERCIAIS 
  // =====================================================================

  getTradeMessage(messageType, data = null) {
    const template = this.messageTemplates.trade[messageType];
    return typeof template === 'function' ? template(data) : template;
  }

  // =====================================================================
  // MÉTODOS PARA ACORDOS MILITARES 
  // =====================================================================

  getAllianceMessage(messageType, data = null) {
    const template = this.messageTemplates.alliance[messageType];
    return typeof template === 'function' ? template(data) : template;
  }

  getCooperationMessage(messageType, data = null) {
    const template = this.messageTemplates.cooperation[messageType];
    return typeof template === 'function' ? template(data) : template;
  }
  
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

  // =====================================================================
  // MÉTODOS UTILITÁRIOS
  // =====================================================================

  /**
   * Criar resposta padronizada para proposta aceita/rejeitada
   */
  createProposalResponse(agreementType, accepted, targetCountry, proposalId) {
    const messageType = accepted ? 'proposalAccepted' : 'proposalRejected';
    
    return {
      accepted,
      targetCountry,
      proposalId,
      message: this.getMessageByType(agreementType, messageType, targetCountry)
    };
  }

  /**
   * Criar resposta para proposta processada
   */
  createProcessedResponse(agreementType, accepted) {
    const messageType = accepted ? 'responseAccepted' : 'responseRejected';
    
    return {
      accepted,
      message: this.getMessageByType(agreementType, messageType)
    };
  }

  /**
   * Obter mensagem por tipo de acordo
   */
  getMessageByType(agreementType, messageType, data = null) {
    const typeMap = {
      'trade': 'getTradeMessage',
      'alliance': 'getAllianceMessage', 
      'cooperation': 'getCooperationMessage'
    };
    
    const methodName = typeMap[agreementType];
    if (methodName && this[methodName]) {
      return this[methodName](messageType, data);
    }
    
    return 'Mensagem não encontrada';
  }
}

const messagesService = new MessagesService();
export default messagesService;