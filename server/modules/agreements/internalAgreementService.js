// =====================================================================
// SERVIÇO DE ACORDOS INTERNOS - FASE 4
// =====================================================================
// Local: server/modules/agreements/internalAgreementService.js

import { getAgreementTypeConfig } from '../../shared/config/agreementTypeRegistry.js';

/**
 * Serviço para acordos que não requerem contrapartida
 * Gerencia criação automática baseada em algoritmos de probabilidade
 */
class InternalAgreementService {
  constructor() {
    this.probabilityCache = new Map(); // Cache de probabilidades calculadas
    this.factorWeights = this.initializeFactorWeights();
  }

  // =====================================================================
  // CONFIGURAÇÃO DE PESOS DOS FATORES
  // =====================================================================

  /**
   * Inicializar pesos dos fatores para cada tipo de acordo
   */
  initializeFactorWeights() {
    return {
      political_pact: {
        stability: 0.35,      // Estabilidade política é crucial
        approval: 0.30,       // Aprovação popular importante
        economy: 0.20,        // Economia influencia
        media_influence: 0.10, // Influência da mídia menor
        corruption: -0.15     // Corrupção prejudica (peso negativo)
      },
      
      business_partnership: {
        economy: 0.40,           // Economia é fator principal
        business_confidence: 0.25, // Confiança empresarial importante
        stability: 0.20,         // Estabilidade necessária
        trade_relations: 0.10,   // Relações comerciais ajudam
        regulation: -0.05        // Excesso de regulação prejudica
      },
      
      media_control: {
        approval: 0.30,        // Aprovação facilita controle
        media_influence: 0.25, // Influência atual na mídia
        economy: 0.20,         // Recursos econômicos necessários
        stability: 0.15,       // Estabilidade política
        transparency: -0.10    // Transparência dificulta controle
      }
    };
  }

  // =====================================================================
  // GERAÇÃO DE ACORDOS INTERNOS
  // =====================================================================

  /**
   * Gerar acordo interno baseado em algoritmo de pesos
   */
  async generateInternalAgreement(roomName, userCountry, agreementType, username) {
    try {
      console.log(`🏛️ Gerando acordo interno: ${agreementType} para ${userCountry}`);

      // Obter configuração do tipo
      const config = getAgreementTypeConfig(agreementType);
      if (!config || config.requiresProposal) {
        throw new Error('Tipo de acordo não é interno ou não encontrado');
      }

      // Calcular probabilidade
      const probability = await this.calculateProbabilities(roomName, userCountry, agreementType);
      
      console.log(`📊 Probabilidade calculada para ${agreementType}: ${(probability * 100).toFixed(1)}%`);

      // Decisão baseada na probabilidade
      const success = Math.random() < probability;
      
      if (success) {
        // Criar o acordo através da função de criação do tipo
        const created = await config.creation(roomName, userCountry, null, username, { type: agreementType });
        
        if (created) {
          console.log(`✅ Acordo interno ${agreementType} criado com sucesso`);
          
          // Registrar no histórico
          this.recordAgreementHistory(roomName, userCountry, agreementType, true, probability);
          
          return {
            success: true,
            agreement: {
              type: agreementType,
              points: config.points,
              description: config.description,
              probability: Math.round(probability * 100)
            }
          };
        }
      }

      // Falha na criação
      console.log(`❌ Falha ao gerar acordo interno ${agreementType}`);
      this.recordAgreementHistory(roomName, userCountry, agreementType, false, probability);
      
      return {
        success: false,
        probability: Math.round(probability * 100),
        reason: this.getFailureReason(agreementType, probability)
      };

    } catch (error) {
      console.error('Erro ao gerar acordo interno:', error);
      return {
        success: false,
        error: 'Erro interno do sistema'
      };
    }
  }

  // =====================================================================
  // CÁLCULO DE PROBABILIDADES
  // =====================================================================

  /**
   * Calcular probabilidades para acordos internos baseado em fatores
   */
  async calculateProbabilities(roomName, userCountry, agreementType) {
    // Verificar cache primeiro
    const cacheKey = `${roomName}-${userCountry}-${agreementType}`;
    const cached = this.probabilityCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < 30000) { // Cache por 30 segundos
      return cached.probability;
    }

    try {
      // Obter estado atual do país
      const countryState = await this.getCountryState(roomName, userCountry);
      
      // Obter pesos para o tipo de acordo
      const weights = this.factorWeights[agreementType];
      if (!weights) {
        console.warn(`Pesos não encontrados para ${agreementType}, usando padrão`);
        return 0.5; // 50% padrão
      }

      // Calcular probabilidade base
      let probability = 0.3; // 30% base

      // Aplicar cada fator com seu peso
      Object.entries(weights).forEach(([factor, weight]) => {
        const factorValue = this.getFactorValue(countryState, factor);
        probability += factorValue * weight;
        
        console.log(`📈 Fator ${factor}: ${(factorValue * 100).toFixed(1)}% (peso: ${weight}) = ${(factorValue * weight * 100).toFixed(1)}%`);
      });

      // Aplicar modificadores especiais
      probability = this.applySpecialModifiers(probability, agreementType, countryState);

      // Garantir que fique entre 10% e 90%
      probability = Math.min(Math.max(probability, 0.1), 0.9);

      // Armazenar no cache
      this.probabilityCache.set(cacheKey, {
        probability,
        timestamp: Date.now()
      });

      return probability;

    } catch (error) {
      console.error('Erro ao calcular probabilidades:', error);
      return 0.5; // Fallback para 50%
    }
  }

  /**
   * Obter valor normalizado de um fator (0-1)
   */
  getFactorValue(countryState, factor) {
    const value = countryState[factor];
    
    // Valores já normalizados (0-1)
    if (typeof value === 'number' && value >= 0 && value <= 1) {
      return value;
    }
    
    // Valores percentuais (0-100)
    if (typeof value === 'number' && value >= 0 && value <= 100) {
      return value / 100;
    }
    
    // Valores econômicos - normalizar baseado em ranges típicos
    if (factor === 'economy') {
      // Assumir GDP per capita entre 1000-50000 USD
      return Math.min(Math.max((value - 1000) / 49000, 0), 1);
    }
    
    // Valores booleanos
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    
    // Fallback para médio
    return 0.5;
  }

  /**
   * Aplicar modificadores especiais baseados no contexto
   */
  applySpecialModifiers(baseProbability, agreementType, countryState) {
    let modifiedProbability = baseProbability;

    // Modificadores por tipo
    switch (agreementType) {
      case 'political_pact':
        // Eleições próximas aumentam necessidade de pactos
        if (countryState.election_proximity && countryState.election_proximity < 0.3) {
          modifiedProbability += 0.15;
        }
        
        // Crises políticas aumentam necessidade
        if (countryState.political_crisis) {
          modifiedProbability += 0.2;
        }
        break;

      case 'business_partnership':
        // Recessão econômica aumenta necessidade de parcerias
        if (countryState.economic_growth && countryState.economic_growth < 0) {
          modifiedProbability += 0.25;
        }
        
        // Alta inflação dificulta parcerias
        if (countryState.inflation && countryState.inflation > 0.1) {
          modifiedProbability -= 0.15;
        }
        break;

      case 'media_control':
        // Escândalos aumentam necessidade de controle
        if (countryState.recent_scandals) {
          modifiedProbability += 0.3;
        }
        
        // Liberdade de imprensa alta dificulta controle
        if (countryState.press_freedom && countryState.press_freedom > 0.8) {
          modifiedProbability -= 0.2;
        }
        break;
    }

    // Modificadores gerais
    
    // Experiência prévia (acordos similares no passado aumentam chances)
    const previousAgreements = this.getPreviousAgreements(countryState.country, agreementType);
    if (previousAgreements > 0) {
      modifiedProbability += Math.min(previousAgreements * 0.05, 0.1); // Máximo +10%
    }

    // Hora do dia (simulação de burocracia - horário comercial é melhor)
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      modifiedProbability += 0.05; // +5% em horário comercial
    }

    return modifiedProbability;
  }

  // =====================================================================
  // OBTENÇÃO DE DADOS DO ESTADO DO PAÍS
  // =====================================================================

  /**
   * Obter estado atual do país
   */
  async getCountryState(roomName, country) {
    try {
      // Obter dados reais do estado do jogo
      const gameState = global.gameState;
      const room = gameState?.rooms?.get(roomName);
      
      if (!room) {
        throw new Error('Sala não encontrada');
      }

      // Obter dados econômicos
      let economicData = {};
      if (global.economyService) {
        economicData = global.economyService.getCountryEconomicData(roomName, country) || {};
      }

      // Obter dados de cards/acordos existentes
      let agreementData = {};
      if (global.cardService) {
        const cards = global.cardService.getCardsByOwner(roomName, country) || [];
        agreementData = {
          total_agreements: cards.length,
          active_alliances: cards.filter(c => c.type === 'military_alliance').length,
          trade_agreements: cards.filter(c => c.type?.includes('trade')).length
        };
      }

      // Construir estado do país
      const countryState = {
        country,
        
        // Dados econômicos (reais ou simulados)
        economy: economicData.gdpPerCapita ? 
          this.normalizeEconomicValue(economicData.gdpPerCapita, 1000, 50000) : 
          Math.random() * 0.4 + 0.3, // 30-70% se não houver dados
          
        stability: economicData.stability || Math.random() * 0.4 + 0.3,
        approval: economicData.approval || Math.random() * 0.4 + 0.3,
        
        // Fatores calculados baseados em dados reais
        business_confidence: this.calculateBusinessConfidence(economicData),
        media_influence: this.calculateMediaInfluence(agreementData),
        
        // Fatores simulados (podem ser substituídos por dados reais)
        corruption: Math.random() * 0.3, // 0-30%
        transparency: Math.random() * 0.5 + 0.5, // 50-100%
        press_freedom: Math.random() * 0.3 + 0.7, // 70-100%
        
        // Contexto temporal
        election_proximity: Math.random(), // Simular proximidade de eleições
        political_crisis: Math.random() < 0.1, // 10% chance de crise
        recent_scandals: Math.random() < 0.05, // 5% chance de escândalos
        
        // Dados de acordos
        ...agreementData,
        
        // Timestamp
        timestamp: Date.now()
      };

      return countryState;

    } catch (error) {
      console.error('Erro ao obter estado do país:', error);
      
      // Retornar estado simulado em caso de erro
      return this.generateSimulatedState(country);
    }
  }

  /**
   * Calcular confiança empresarial baseada em dados econômicos
   */
  calculateBusinessConfidence(economicData) {
    let confidence = 0.5; // Base 50%
    
    // Fatores positivos
    if (economicData.interestRate && economicData.interestRate < 0.05) confidence += 0.1;
    if (economicData.inflation && economicData.inflation < 0.03) confidence += 0.1;
    if (economicData.unemployment && economicData.unemployment < 0.05) confidence += 0.15;
    if (economicData.gdpGrowth && economicData.gdpGrowth > 0.02) confidence += 0.2;
    
    // Fatores negativos  
    if (economicData.debt && economicData.debt > 0.8) confidence -= 0.1;
    if (economicData.taxBurden && economicData.taxBurden > 0.4) confidence -= 0.05;
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Calcular influência de mídia baseada em acordos existentes
   */
  calculateMediaInfluence(agreementData) {
    let influence = 0.3; // Base 30%
    
    // Acordos internos existentes aumentam influência
    if (agreementData.total_agreements > 5) influence += 0.2;
    if (agreementData.active_alliances > 0) influence += 0.15;
    
    return Math.min(influence, 0.8); // Máximo 80%
  }

  /**
   * Normalizar valor econômico para range 0-1
   */
  normalizeEconomicValue(value, min, max) {
    return Math.min(Math.max((value - min) / (max - min), 0), 1);
  }

  /**
   * Gerar estado simulado para fallback
   */
  generateSimulatedState(country) {
    const baseValue = 0.5;
    const variance = 0.2;
    
    return {
      country,
      economy: baseValue + (Math.random() - 0.5) * variance,
      stability: baseValue + (Math.random() - 0.5) * variance,
      approval: baseValue + (Math.random() - 0.5) * variance,
      business_confidence: baseValue + (Math.random() - 0.5) * variance,
      media_influence: baseValue + (Math.random() - 0.5) * variance,
      corruption: Math.random() * 0.3,
      transparency: 0.7 + Math.random() * 0.3,
      press_freedom: 0.7 + Math.random() * 0.3,
      election_proximity: Math.random(),
      political_crisis: false,
      recent_scandals: false,
      total_agreements: 0,
      timestamp: Date.now()
    };
  }

  // =====================================================================
  // UTILITÁRIOS E HELPERS
  // =====================================================================

  /**
   * Obter acordos anteriores do mesmo tipo
   */
  getPreviousAgreements(country, agreementType) {
    // Implementar consulta ao histórico de acordos
    // Por enquanto, retornar valor simulado
    return Math.floor(Math.random() * 3);
  }

  /**
   * Registrar acordo no histórico
   */
  recordAgreementHistory(roomName, country, agreementType, success, probability) {
    try {
      // Implementar registro em banco de dados ou arquivo de log
      const record = {
        timestamp: Date.now(),
        roomName,
        country,
        agreementType,
        success,
        probability: Math.round(probability * 100),
        date: new Date().toISOString()
      };

      console.log('📝 Registrando no histórico:', record);
      
      // TODO: Salvar em persistência real
      
    } catch (error) {
      console.error('Erro ao registrar histórico:', error);
    }
  }

  /**
   * Obter razão da falha baseada na probabilidade
   */
  /**
   * Obter razão da falha baseada na probabilidade
   */
  getFailureReason(agreementType, probability) {
    if (probability < 0.2) {
      return 'Condições muito desfavoráveis';
    } else if (probability < 0.4) {
      return 'Falta de apoio político/econômico';
    } else if (probability < 0.6) {
      return 'Resistência de grupos de interesse';
    } else {
      return 'Timing desfavorável - tente novamente';
    }
  }

  /**
   * Criar card de acordo interno diretamente
   */
  async createInternalAgreementCard(roomName, userCountry, agreementType, username) {
    if (!global.cardService || !global.cardService.initialized) {
      throw new Error('Serviço de cards não disponível');
    }

    const config = getAgreementTypeConfig(agreementType);
    if (!config) {
      throw new Error('Configuração de acordo não encontrada');
    }

    try {
      const card = global.cardService.createCard(roomName, {
        type: agreementType,
        owner: userCountry,
        target: null, // Acordos internos não têm alvo
        value: config.points,
        duration: 'permanent',
        createdBy: username,
        category: 'internal',
        description: config.description,
        timestamp: Date.now()
      });

      return !!card;
    } catch (error) {
      console.error('Erro ao criar card interno:', error);
      return false;
    }
  }

  // =====================================================================
  // MÉTODOS DE CONSULTA E ANÁLISE
  // =====================================================================

  /**
   * Obter probabilidades estimadas para todos os tipos internos
   */
  async getEstimatedProbabilities(roomName, userCountry) {
    try {
      const internalTypes = ['political_pact', 'business_partnership', 'media_control'];
      const probabilities = {};

      for (const type of internalTypes) {
        probabilities[type] = await this.calculateProbabilities(roomName, userCountry, type);
      }

      return probabilities;
    } catch (error) {
      console.error('Erro ao calcular probabilidades estimadas:', error);
      return {
        political_pact: 0.5,
        business_partnership: 0.5,
        media_control: 0.5
      };
    }
  }

  /**
   * Verificar se tipo de acordo interno está disponível
   */
  isInternalAgreementAvailable(agreementType) {
    const config = getAgreementTypeConfig(agreementType);
    return config && !config.requiresProposal && config.category === 'interno';
  }

  /**
   * Obter recomendações de acordos baseadas no estado atual
   */
  async getRecommendations(roomName, userCountry) {
    try {
      const countryState = await this.getCountryState(roomName, userCountry);
      const probabilities = await this.getEstimatedProbabilities(roomName, userCountry);
      
      const recommendations = [];

      // Analisar cada tipo e gerar recomendações
      Object.entries(probabilities).forEach(([type, probability]) => {
        const config = getAgreementTypeConfig(type);
        if (!config) return;

        const recommendation = {
          type,
          probability: Math.round(probability * 100),
          priority: this.calculatePriority(type, probability, countryState),
          description: config.description,
          points: config.points,
          factors: this.getRelevantFactors(type, countryState),
          advice: this.getAdvice(type, probability, countryState)
        };

        recommendations.push(recommendation);
      });

      // Ordenar por prioridade
      recommendations.sort((a, b) => b.priority - a.priority);

      return recommendations;
    } catch (error) {
      console.error('Erro ao gerar recomendações:', error);
      return [];
    }
  }

  /**
   * Calcular prioridade de um acordo
   */
  calculatePriority(type, probability, countryState) {
    let priority = probability * 100; // Base: probabilidade

    // Ajustar baseado na necessidade
    switch (type) {
      case 'political_pact':
        if (countryState.stability < 0.4) priority += 20;
        if (countryState.approval < 0.3) priority += 15;
        break;
      
      case 'business_partnership':
        if (countryState.economy < 0.4) priority += 25;
        if (countryState.business_confidence < 0.3) priority += 20;
        break;
      
      case 'media_control':
        if (countryState.recent_scandals) priority += 30;
        if (countryState.approval < 0.3) priority += 15;
        break;
    }

    return Math.min(priority, 100);
  }

  /**
   * Obter fatores relevantes para exibição
   */
  getRelevantFactors(type, countryState) {
    const weights = this.factorWeights[type];
    if (!weights) return [];

    return Object.entries(weights)
      .map(([factor, weight]) => ({
        name: factor,
        value: this.getFactorValue(countryState, factor),
        weight,
        impact: weight * this.getFactorValue(countryState, factor)
      }))
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 3); // Top 3 fatores mais relevantes
  }

  /**
   * Gerar conselho para o jogador
   */
  getAdvice(type, probability, countryState) {
    if (probability > 0.7) {
      return `Excelente momento para tentar ${type}. Condições muito favoráveis.`;
    } else if (probability > 0.5) {
      return `Boas chances de sucesso. Considere tentar ${type} agora.`;
    } else if (probability > 0.3) {
      return `Chances moderadas. Pode valer a pena tentar, mas sem garantias.`;
    } else {
      const improvements = this.suggestImprovements(type, countryState);
      return `Chances baixas no momento. Sugestão: ${improvements}`;
    }
  }

  /**
   * Sugerir melhorias baseadas nos fatores
   */
  suggestImprovements(type, countryState) {
    const suggestions = [];

    switch (type) {
      case 'political_pact':
        if (countryState.stability < 0.4) suggestions.push('melhorar estabilidade política');
        if (countryState.approval < 0.4) suggestions.push('aumentar aprovação popular');
        if (countryState.economy < 0.4) suggestions.push('fortalecer economia');
        break;

      case 'business_partnership':
        if (countryState.economy < 0.4) suggestions.push('melhorar indicadores econômicos');
        if (countryState.business_confidence < 0.4) suggestions.push('aumentar confiança empresarial');
        if (countryState.stability < 0.4) suggestions.push('estabilizar ambiente político');
        break;

      case 'media_control':
        if (countryState.approval < 0.4) suggestions.push('melhorar aprovação popular');
        if (countryState.economy < 0.4) suggestions.push('ter mais recursos disponíveis');
        if (countryState.media_influence < 0.3) suggestions.push('aumentar influência na mídia');
        break;
    }

    return suggestions.length > 0 ? suggestions.join(', ') : 'aguardar melhores condições';
  }

  // =====================================================================
  // LIMPEZA E MANUTENÇÃO
  // =====================================================================

  /**
   * Limpar cache de probabilidades antigas
   */
  cleanupCache() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutos

    for (const [key, data] of this.probabilityCache.entries()) {
      if (now - data.timestamp > maxAge) {
        this.probabilityCache.delete(key);
      }
    }
  }

  /**
   * Obter estatísticas do serviço
   */
  getServiceStats() {
    return {
      cacheSize: this.probabilityCache.size,
      supportedTypes: Object.keys(this.factorWeights),
      lastCleanup: this.lastCleanup || 'Never'
    };
  }

  /**
   * Executar limpeza periódica
   */
  startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupCache();
      this.lastCleanup = new Date().toISOString();
    }, 5 * 60 * 1000); // Cada 5 minutos
  }
}

// =====================================================================
// INSTÂNCIA SINGLETON
// =====================================================================

const internalAgreementService = new InternalAgreementService();

// Iniciar limpeza periódica
internalAgreementService.startPeriodicCleanup();

export default internalAgreementService;