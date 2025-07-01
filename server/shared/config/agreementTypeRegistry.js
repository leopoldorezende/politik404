/**
 * Registro centralizado de todos os tipos de acordo
 * Esta é a fonte única de verdade para configurações de acordo
 */

// =====================================================================
// FUNÇÕES DE VALIDAÇÃO ESPECÍFICAS
// =====================================================================

import messagesService from '../services/messagesService.js';

/**
 * Validação para acordos comerciais
 */
function validateTradeAgreement(proposal) {
  console.log('🔧 validateTradeAgreement called with:', proposal);
  
  const { type, product, targetCountry, value } = proposal;
  
  console.log('📋 Extracted values:', { type, product, targetCountry, value });
  
  if (!type || !product || !targetCountry) {
    console.error('❌ Missing required fields:', { type, product, targetCountry });
    return { valid: false, error: messagesService.getTradeMessage('invalidProposal') };
  }
  
  console.log('✅ Required fields present');
  console.log('🔍 Validating type:', type, 'against:', ['import', 'export']);
  console.log('🔍 Validating product:', product, 'against:', ['commodity', 'manufacture']);
  
  if (!['import', 'export'].includes(type) || !['commodity', 'manufacture'].includes(product)) {
    console.error('❌ Invalid type or product:', { type, product });
    return { valid: false, error: messagesService.getTradeMessage('invalidTradeType') };
  }
  
  console.log('✅ Type and product are valid');
  console.log('🔍 Validating value:', value, 'range: 0-1000');
  
  if (!value || value <= 0 || value > 1000) {
    console.error('❌ Invalid value:', value);
    return { valid: false, error: messagesService.getTradeMessage('valueOutOfRange') };
  }
  
  console.log('✅ All validations passed');
  return { valid: true };
}

/**
 * Validação para acordos militares
 */
function validateMilitaryAgreement(proposal) {
  const { type, targetCountry } = proposal;
  
  if (!type || !targetCountry || type !== 'military-alliance') {
    return { valid: false, error: messagesService.getAllianceMessage('invalidProposal') };
  }
  
  return { valid: true };
}

/**
 * Validação para acordos de cooperação
 */
function validateCooperationAgreement(proposal) {
  const { type, targetCountry } = proposal;
  
  if (!type || !targetCountry || type !== 'strategic-cooperation') {
    return { valid: false, error: messagesService.getCooperationMessage('invalidProposal') };
  }
  
  return { valid: true };
}

/**
 * Validação para acordos internos
 */
function validateInternalAgreement(proposal) {
  const { type } = proposal;
  
  if (!type || !['political_pact', 'business_partnership', 'media_control'].includes(type)) {
    return { valid: false, error: 'Tipo de acordo interno inválido' };
  }
  
  return { valid: true };
}

// =====================================================================
// FUNÇÕES DE CRIAÇÃO ESPECÍFICAS
// =====================================================================

/**
 * Criação de acordos comerciais
 */
function createTradeAgreement(roomName, userCountry, targetCountry, username, proposalData) {
  if (!global.economyService) return false;
  
  // Extrair o tipo original (import/export) do tipo normalizado para o cardService
  const originalType = proposalData.type.startsWith('trade-') 
    ? proposalData.type.replace('trade-', '') 
    : proposalData.type;
  
  console.log('🔧 createTradeAgreement - originalType:', originalType);
  console.log('🔧 createTradeAgreement - proposalData:', proposalData);
  
  // NÃO adicionar cardsUpdated aqui - já existe no EconomyService
  return global.economyService.createTradeAgreement(roomName, {
    type: originalType, // Usar import/export em vez de trade-import/trade-export
    product: proposalData.product,
    country: targetCountry,
    value: proposalData.value,
    originCountry: userCountry,
    originPlayer: username
  });
}

/**
 * Criação de alianças militares
 */
function createMilitaryAgreement(roomName, userCountry, targetCountry, username, proposalData) {
  console.log('🔧 createMilitaryAgreement called with:', { roomName, userCountry, targetCountry, username, proposalData });
  
  if (!global.cardService) {
    console.error('❌ CardService not available');
    return false;
  }
  
  if (!global.cardService.initialized) {
    console.error('❌ CardService not initialized');
    return false;
  }
  
  try {
    console.log('✅ CardService is available and initialized');
    
    // Criar card para o usuário
    const userCard = global.cardService.createCard(roomName, {
      type: 'military-alliance',
      owner: userCountry,
      target: targetCountry,
      value: 5, // pontos
      duration: 'permanent',
      createdBy: username
    });
    
    console.log('✅ User card created:', userCard);
    
    // Criar card para o alvo
    const targetCard = global.cardService.createCard(roomName, {
      type: 'military-alliance',
      owner: targetCountry,
      target: userCountry,
      value: 5, // pontos
      duration: 'permanent',
      createdBy: username
    });
    
    console.log('✅ Target card created:', targetCard);

    // Notificar atualização de cards
    if (global.io) {
      setTimeout(() => {
        global.io.to(roomName).emit('cardsUpdated', {
          roomName: roomName,
          action: 'created',
          timestamp: Date.now()
        });
      }, 100); // 100ms de delay
    }
    
    const result = userCard && targetCard;
    console.log('✅ createMilitaryAgreement result:', result);
    return result;
  } catch (error) {
    console.error('❌ Erro ao criar aliança militar:', error);
    return false;
  }
}

/**
 * Criação de cooperação estratégica
 */
function createCooperationAgreement(roomName, userCountry, targetCountry, username, proposalData) {
  if (!global.cardService || !global.cardService.initialized) return false;
  
  try {
    // Criar card para o usuário
    const userCard = global.cardService.createCard(roomName, {
      type: 'strategic-cooperation',
      owner: userCountry,
      target: targetCountry,
      value: 3, // pontos
      duration: 'permanent',
      createdBy: username
    });
    
    // Criar card para o alvo
    const targetCard = global.cardService.createCard(roomName, {
      type: 'strategic-cooperation',
      owner: targetCountry,
      target: userCountry,
      value: 3, // pontos
      duration: 'permanent',
      createdBy: username
    });

    // Notificar atualização de cards
    if (global.io) {
      setTimeout(() => {
        global.io.to(roomName).emit('cardsUpdated', {
          roomName: roomName,
          action: 'created',
          timestamp: Date.now()
        });
      }, 100); // 100ms de delay
    }
    
    return userCard && targetCard;
  } catch (error) {
    console.error('Erro ao criar cooperação estratégica:', error);
    return false;
  }
}

/**
 * Criação de acordos internos
 */
function createInternalAgreement(roomName, userCountry, targetCountry, username, proposalData) {
  if (!global.cardService || !global.cardService.initialized) return false;
  
  try {
    const { type } = proposalData;
    
    const pointsMap = {
      'political_pact': 4,
      'business_partnership': 3,
      'media_control': 5
    };
    
    const card = global.cardService.createCard(roomName, {
      type: type,
      owner: userCountry,
      target: null,
      value: pointsMap[type] || 3,
      duration: 'permanent',
      createdBy: username
    });
    
    // Adicionar aqui:
    if (card && global.io) {
      setTimeout(() => {
        global.io.to(roomName).emit('cardsUpdated', {
          roomName: roomName,
          action: 'created',
          timestamp: Date.now()
        });
      }, 100); // 100ms de delay
    }
    
    return !!card;
  } catch (error) {
    console.error('Erro ao criar acordo interno:', error);
    return false;
  }
}

// =====================================================================
// REGISTRO PRINCIPAL DE TIPOS DE ACORDO
// =====================================================================

/**
 * Configuração centralizada de todos os tipos de acordo
 * Esta é a fonte única de verdade para comportamentos de acordo
 */
export const AGREEMENT_TYPES = {
  // ===================================================================
  // ACORDOS COMERCIAIS
  // ===================================================================
  'trade-import': {
    category: 'comercial',
    requiresProposal: true,
    bilateral: true,
    points: 1,
    validation: validateTradeAgreement,
    creation: createTradeAgreement,
    maxActive: null, // Sem limite
    aiAcceptanceRate: 0.6,
    description: 'Acordo de importação comercial'
  },
  
  'trade-export': {
    category: 'comercial',
    requiresProposal: true,
    bilateral: true,
    points: 1,
    validation: validateTradeAgreement,
    creation: createTradeAgreement,
    maxActive: null, // Sem limite
    aiAcceptanceRate: 0.6,
    description: 'Acordo de exportação comercial'
  },
  
  // ===================================================================
  // ACORDOS MILITARES
  // ===================================================================
  'military-alliance': {
    category: 'militar',
    requiresProposal: true,
    bilateral: true,
    points: 5,
    validation: validateMilitaryAgreement,
    creation: createMilitaryAgreement,
    maxActive: 1, // Apenas uma aliança por vez
    aiAcceptanceRate: 0.4,
    description: 'Aliança militar estratégica'
  },
  
  'strategic-cooperation': {
    category: 'militar',
    requiresProposal: true,
    bilateral: true,
    points: 3,
    validation: validateCooperationAgreement,
    creation: createCooperationAgreement,
    maxActive: null, // Sem limite
    aiAcceptanceRate: 0.6,
    description: 'Cooperação militar estratégica'
  },
  
  // ===================================================================
  // ACORDOS INTERNOS (FUTUROS)
  // ===================================================================
  'political-pact': {
    category: 'interno',
    requiresProposal: false, // Acordos internos são automáticos
    bilateral: false,
    points: 4,
    validation: validateInternalAgreement,
    creation: createInternalAgreement,
    maxActive: 1, // Apenas um pacto político por vez
    aiAcceptanceRate: 1.0, // Sempre aceito (interno)
    description: 'Pacto político interno',
    probabilityFactors: ['stability', 'approval', 'economy']
  },
  
  'business-partnership': {
    category: 'interno',
    requiresProposal: false,
    bilateral: false,
    points: 3,
    validation: validateInternalAgreement,
    creation: createInternalAgreement,
    maxActive: null, // Sem limite
    aiAcceptanceRate: 1.0,
    description: 'Parceria empresarial',
    probabilityFactors: ['economy', 'business_confidence']
  },
  
  'media-control': {
    category: 'interno',
    requiresProposal: false,
    bilateral: false,
    points: 5,
    validation: validateInternalAgreement,
    creation: createInternalAgreement,
    maxActive: 1, // Apenas um controle de mídia por vez
    aiAcceptanceRate: 1.0,
    description: 'Controle de mídia',
    probabilityFactors: ['approval', 'media_influence', 'economy']
  }
};

// =====================================================================
// UTILITÁRIOS PARA O REGISTRO
// =====================================================================

/**
 * Obter configuração de um tipo de acordo
 */
export function getAgreementTypeConfig(type) {
  return AGREEMENT_TYPES[type] || null;
}

/**
 * Verificar se um tipo de acordo existe
 */
export function isValidAgreementType(type) {
  return type in AGREEMENT_TYPES;
}

/**
 * Obter todos os tipos de uma categoria
 */
export function getAgreementTypesByCategory(category) {
  return Object.entries(AGREEMENT_TYPES)
    .filter(([key, config]) => config.category === category)
    .reduce((acc, [key, config]) => {
      acc[key] = config;
      return acc;
    }, {});
}

/**
 * Obter tipos que requerem proposta
 */
export function getProposalAgreementTypes() {
  return Object.entries(AGREEMENT_TYPES)
    .filter(([key, config]) => config.requiresProposal)
    .reduce((acc, [key, config]) => {
      acc[key] = config;
      return acc;
    }, {});
}

/**
 * Obter tipos internos (sem proposta)
 */
export function getInternalAgreementTypes() {
  return Object.entries(AGREEMENT_TYPES)
    .filter(([key, config]) => !config.requiresProposal)
    .reduce((acc, [key, config]) => {
      acc[key] = config;
      return acc;
    }, {});
}

export default {
  AGREEMENT_TYPES,
  getAgreementTypeConfig,
  isValidAgreementType,
  getAgreementTypesByCategory,
  getProposalAgreementTypes,
  getInternalAgreementTypes
};