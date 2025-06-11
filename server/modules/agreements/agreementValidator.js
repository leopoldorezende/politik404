// =====================================================================
// VALIDADOR DE CONSISTÊNCIA DO SISTEMA UNIFICADO - FASE 5
// =====================================================================
// Local: server/modules/agreements/agreementValidator.js

import { 
  AGREEMENT_TYPES, 
  getAgreementTypeConfig, 
  isValidAgreementType 
} from '../../shared/config/agreementTypeRegistry.js';

/**
 * Validador que verifica consistência entre cards e acordos
 * Garante integridade do sistema unificado
 */
class AgreementValidator {
  constructor() {
    this.validationErrors = [];
    this.warnings = [];
    this.lastValidation = null;
  }

  // =====================================================================
  // VALIDAÇÃO PRINCIPAL
  // =====================================================================

  /**
   * Executar verificação completa de integridade
   */
  async performHealthCheck(gameState) {
    console.log('🔍 Iniciando verificação de integridade do sistema de acordos...');
    
    try {
      this.validationErrors = [];
      this.warnings = [];
      
      const results = {
        timestamp: Date.now(),
        systemStatus: 'healthy',
        roomsValidated: 0,
        agreementsValidated: 0,
        cardsValidated: 0,
        errors: [],
        warnings: [],
        recommendations: []
      };

      // Validar configuração do sistema
      await this.validateSystemConfiguration(results);

      // Validar dados por sala (se existirem)
      if (gameState?.rooms) {
        for (const [roomName, roomData] of gameState.rooms.entries()) {
          await this.validateRoomData(roomName, roomData, results);
          results.roomsValidated++;
        }
      }

      // Validar serviços globais
      await this.validateGlobalServices(results);

      // Gerar recomendações
      this.generateRecommendations(results);

      // Determinar status final
      results.systemStatus = this.determineSystemStatus(results);
      results.errors = this.validationErrors;
      results.warnings = this.warnings;

      this.lastValidation = results;
      
      console.log(`✅ Verificação concluída: ${results.systemStatus}`, {
        salas: results.roomsValidated,
        acordos: results.agreementsValidated,
        cards: results.cardsValidated,
        erros: results.errors.length,
        avisos: results.warnings.length
      });

      return results;

    } catch (error) {
      console.error('❌ Erro durante verificação de integridade:', error);
      return {
        timestamp: Date.now(),
        systemStatus: 'error',
        error: error.message,
        errors: this.validationErrors,
        warnings: this.warnings
      };
    }
  }

  // =====================================================================
  // VALIDAÇÃO DE CONFIGURAÇÃO DO SISTEMA
  // =====================================================================

  /**
   * Validar configuração base do sistema unificado
   */
  async validateSystemConfiguration(results) {
    console.log('⚙️ Validando configuração do sistema...');

    // Verificar se todos os tipos estão configurados corretamente
    Object.entries(AGREEMENT_TYPES).forEach(([type, config]) => {
      try {
        this.validateAgreementTypeConfig(type, config);
      } catch (error) {
        this.validationErrors.push({
          type: 'CONFIG_ERROR',
          category: 'system',
          message: `Erro na configuração do tipo ${type}: ${error.message}`
        });
      }
    });

    // Verificar funções essenciais
    this.validateEssentialFunctions();

    // Verificar mapeamentos legados
    this.validateLegacyMappings();

    console.log('✅ Configuração do sistema validada');
  }

  /**
   * Validar configuração individual de tipo de acordo
   */
  validateAgreementTypeConfig(type, config) {
    const requiredFields = ['category', 'requiresProposal', 'bilateral', 'points', 'validation', 'creation'];
    
    requiredFields.forEach(field => {
      if (!(field in config)) {
        throw new Error(`Campo obrigatório '${field}' ausente`);
      }
    });

    // Validar tipos de dados
    if (typeof config.points !== 'number' || config.points < 0) {
      throw new Error('Campo points deve ser número positivo');
    }

    if (typeof config.validation !== 'function') {
      throw new Error('Campo validation deve ser função');
    }

    if (typeof config.creation !== 'function') {
      throw new Error('Campo creation deve ser função');
    }

    // Validar categorias válidas
    const validCategories = ['comercial', 'militar', 'interno'];
    if (!validCategories.includes(config.category)) {
      throw new Error(`Categoria '${config.category}' inválida`);
    }
  }

  /**
   * Verificar se funções essenciais estão disponíveis
   */
  validateEssentialFunctions() {
    const essentials = [
      { name: 'getAgreementTypeConfig', func: getAgreementTypeConfig },
      { name: 'isValidAgreementType', func: isValidAgreementType }
    ];

    essentials.forEach(({ name, func }) => {
      if (typeof func !== 'function') {
        this.validationErrors.push({
          type: 'FUNCTION_ERROR',
          category: 'system',
          message: `Função essencial '${name}' não disponível`
        });
      }
    });
  }

  /**
   * Validar mapeamentos de compatibilidade
   */
  validateLegacyMappings() {
    // Verificar se todos os tipos legados têm mapeamento
    const legacyTypes = ['import', 'export', 'trade', 'military_alliance', 'alliance', 'strategic_cooperation', 'cooperation'];
    
    legacyTypes.forEach(legacyType => {
      try {
        const mapped = getAgreementTypeConfig(legacyType);
        if (!mapped) {
          this.warnings.push({
            type: 'MAPPING_WARNING',
            category: 'compatibility',
            message: `Tipo legado '${legacyType}' sem mapeamento definido`
          });
        }
      } catch (error) {
        this.warnings.push({
          type: 'MAPPING_ERROR',
          category: 'compatibility',
          message: `Erro ao mapear tipo legado '${legacyType}': ${error.message}`
        });
      }
    });
  }

  // =====================================================================
  // VALIDAÇÃO DE DADOS POR SALA
  // =====================================================================

  /**
   * Validar dados de uma sala específica
   */
  async validateRoomData(roomName, roomData, results) {
    console.log(`🏠 Validando sala: ${roomName}`);

    try {
      // Validar acordos comerciais
      if (roomData.tradeAgreements) {
        await this.validateTradeAgreements(roomName, roomData.tradeAgreements, results);
      }

      // Validar cards de acordo
      if (roomData.cards) {
        await this.validateAgreementCards(roomName, roomData.cards, results);
      }

      // Validar consistência entre acordos e cards
      await this.validateAgreementCardConsistency(roomName, roomData, results);

    } catch (error) {
      this.validationErrors.push({
        type: 'ROOM_VALIDATION_ERROR',
        category: 'data',
        roomName,
        message: error.message
      });
    }
  }

  /**
   * Validar acordos comerciais
   */
  async validateTradeAgreements(roomName, agreements, results) {
    if (!Array.isArray(agreements)) {
      this.validationErrors.push({
        type: 'DATA_TYPE_ERROR',
        category: 'trade',
        roomName,
        message: 'tradeAgreements deve ser um array'
      });
      return;
    }

    agreements.forEach((agreement, index) => {
      try {
        this.validateSingleTradeAgreement(roomName, agreement, index);
        results.agreementsValidated++;
      } catch (error) {
        this.validationErrors.push({
          type: 'TRADE_AGREEMENT_ERROR',
          category: 'trade',
          roomName,
          agreementIndex: index,
          agreementId: agreement.id,
          message: error.message
        });
      }
    });
  }

  /**
   * Validar um acordo comercial individual
   */
  validateSingleTradeAgreement(roomName, agreement, index) {
    const requiredFields = ['id', 'type', 'product', 'country', 'value', 'originCountry', 'originPlayer'];
    
    requiredFields.forEach(field => {
      if (!(field in agreement)) {
        throw new Error(`Campo obrigatório '${field}' ausente no acordo ${index}`);
      }
    });

    // Validar tipos válidos
    if (!['import', 'export'].includes(agreement.type)) {
      throw new Error(`Tipo de acordo '${agreement.type}' inválido no acordo ${agreement.id}`);
    }

    // Validar produtos válidos
    if (!['commodity', 'manufacture'].includes(agreement.product)) {
      throw new Error(`Produto '${agreement.product}' inválido no acordo ${agreement.id}`);
    }

    // Validar valor
    if (typeof agreement.value !== 'number' || agreement.value <= 0) {
      throw new Error(`Valor inválido no acordo ${agreement.id}`);
    }
  }

  /**
   * Validar cards de acordo
   */
  async validateAgreementCards(roomName, cards, results) {
    if (!Array.isArray(cards)) {
      this.validationErrors.push({
        type: 'DATA_TYPE_ERROR',
        category: 'cards',
        roomName,
        message: 'cards deve ser um array'
      });
      return;
    }

    cards.forEach((card, index) => {
      try {
        this.validateSingleCard(roomName, card, index);
        results.cardsValidated++;
      } catch (error) {
        this.validationErrors.push({
          type: 'CARD_ERROR',
          category: 'cards',
          roomName,
          cardIndex: index,
          cardId: card.id,
          message: error.message
        });
      }
    });
  }

  /**
   * Validar um card individual
   */
  validateSingleCard(roomName, card, index) {
    const requiredFields = ['id', 'type', 'owner', 'value'];
    
    requiredFields.forEach(field => {
      if (!(field in card)) {
        throw new Error(`Campo obrigatório '${field}' ausente no card ${index}`);
      }
    });

    // Validar valor de pontos
    if (typeof card.value !== 'number' || card.value < 0) {
      throw new Error(`Valor de pontos inválido no card ${card.id}`);
    }

    // Verificar se o tipo existe na configuração (usando mapeamento se necessário)
    const config = getAgreementTypeConfig(card.type);
    if (!config) {
      this.warnings.push({
        type: 'UNKNOWN_CARD_TYPE',
        category: 'cards',
        roomName,
        cardId: card.id,
        message: `Tipo de card '${card.type}' não reconhecido pelo sistema unificado`
      });
    }
  }

  /**
   * Validar consistência entre acordos e cards
   */
  async validateAgreementCardConsistency(roomName, roomData, results) {
    // Verificar se acordos comerciais têm cards correspondentes
    if (roomData.tradeAgreements && roomData.cards) {
      roomData.tradeAgreements.forEach(agreement => {
        const relatedCards = roomData.cards.filter(card => 
          card.type?.includes('trade') && 
          (card.owner === agreement.originCountry || card.owner === agreement.country)
        );

        if (relatedCards.length === 0) {
          this.warnings.push({
            type: 'MISSING_CARD',
            category: 'consistency',
            roomName,
            agreementId: agreement.id,
            message: `Acordo comercial ${agreement.id} sem card correspondente`
          });
        }
      });
    }
  }

  // =====================================================================
  // VALIDAÇÃO DE SERVIÇOS GLOBAIS
  // =====================================================================

  /**
   * Validar serviços globais necessários
   */
  async validateGlobalServices(results) {
    console.log('🌐 Validando serviços globais...');

    // Verificar economyService
    if (global.economyService) {
      this.validateEconomyService();
    } else {
      this.warnings.push({
        type: 'SERVICE_WARNING',
        category: 'services',
        message: 'EconomyService não disponível globalmente'
      });
    }

    // Verificar cardService
    if (global.cardService) {
      this.validateCardService();
    } else {
      this.warnings.push({
        type: 'SERVICE_WARNING',
        category: 'services',
        message: 'CardService não disponível globalmente'
      });
    }

    // Verificar agreementEngine
    if (global.agreementEngine) {
      this.validateAgreementEngine();
    } else {
      this.warnings.push({
        type: 'SERVICE_WARNING',
        category: 'services',
        message: 'AgreementEngine não disponível globalmente'
      });
    }
  }

  /**
   * Validar EconomyService
   */
  validateEconomyService() {
    const service = global.economyService;
    const requiredMethods = ['createTradeAgreement', 'getCountryEconomicData'];
    
    requiredMethods.forEach(method => {
      if (typeof service[method] !== 'function') {
        this.validationErrors.push({
          type: 'SERVICE_METHOD_ERROR',
          category: 'services',
          service: 'EconomyService',
          message: `Método '${method}' não disponível`
        });
      }
    });
  }

  /**
   * Validar CardService
   */
  validateCardService() {
    const service = global.cardService;
    const requiredMethods = ['createCard', 'removeCard', 'getCardById', 'getCardsByOwner', 'getCardsByType'];
    
    requiredMethods.forEach(method => {
      if (typeof service[method] !== 'function') {
        this.validationErrors.push({
          type: 'SERVICE_METHOD_ERROR',
          category: 'services',
          service: 'CardService',
          message: `Método '${method}' não disponível`
        });
      }
    });

    // Verificar se está inicializado
    if (!service.initialized) {
      this.warnings.push({
        type: 'SERVICE_INIT_WARNING',
        category: 'services',
        service: 'CardService',
        message: 'CardService não foi inicializado'
      });
    }
  }

  /**
   * Validar AgreementEngine
   */
  validateAgreementEngine() {
    const engine = global.agreementEngine;
    const requiredMethods = ['processProposal', 'handleResponse', 'cancelAgreement'];
    
    requiredMethods.forEach(method => {
      if (typeof engine[method] !== 'function') {
        this.validationErrors.push({
          type: 'ENGINE_METHOD_ERROR',
          category: 'services',
          service: 'AgreementEngine',
          message: `Método '${method}' não disponível`
        });
      }
    });
  }

  // =====================================================================
  // GERAÇÃO DE RECOMENDAÇÕES
  // =====================================================================

  /**
   * Gerar recomendações baseadas na validação
   */
  generateRecommendations(results) {
    const recommendations = [];

    // Recomendações baseadas em erros
    if (results.errors.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'errors',
        message: `Corrigir ${results.errors.length} erro(s) crítico(s) encontrado(s)`
      });
    }

    // Recomendações baseadas em warnings
    if (results.warnings.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'warnings',
        message: `Revisar ${results.warnings.length} aviso(s) encontrado(s)`
      });
    }

    // Recomendações de performance
    if (results.agreementsValidated > 1000) {
      recommendations.push({
        priority: 'low',
        category: 'performance',
        message: 'Considerar implementar limpeza automática de acordos antigos'
      });
    }

    // Recomendações de segurança
    recommendations.push({
      priority: 'medium',
      category: 'security',
      message: 'Executar verificação de integridade regularmente'
    });

    results.recommendations = recommendations;
  }

  /**
   * Determinar status geral do sistema
   */
  determineSystemStatus(results) {
    if (this.validationErrors.length > 0) {
      return 'unhealthy';
    } else if (this.warnings.length > 3) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  // =====================================================================
  // MÉTODOS UTILITÁRIOS
  // =====================================================================

  /**
   * Obter último resultado de validação
   */
  getLastValidationResult() {
    return this.lastValidation;
  }

  /**
   * Verificar se sistema está saudável
   */
  isSystemHealthy() {
    return this.lastValidation?.systemStatus === 'healthy';
  }

  /**
   * Obter resumo rápido de saúde
   */
  getHealthSummary() {
    if (!this.lastValidation) {
      return { status: 'unknown', message: 'Nenhuma validação executada' };
    }

    const { systemStatus, errors, warnings } = this.lastValidation;
    
    return {
      status: systemStatus,
      errors: errors.length,
      warnings: warnings.length,
      lastCheck: new Date(this.lastValidation.timestamp).toLocaleString()
    };
  }

  /**
   * Limpar resultados antigos
   */
  cleanup() {
    this.validationErrors = [];
    this.warnings = [];
    this.lastValidation = null;
  }
}

// =====================================================================
// INSTÂNCIA SINGLETON
// =====================================================================

const agreementValidator = new AgreementValidator();
export default agreementValidator;