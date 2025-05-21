/**
 * advancedDebtManagement.js
 * Sistema de gerenciamento de dívidas públicas
 * Adaptado do simulador econômico para uso com Redux
 */

import { ECONOMIC_CONSTANTS } from './advancedEconomyCalculations.js';

/**
 * Calcula o pagamento mensal para um empréstimo
 * @param {number} principal - Valor principal do empréstimo
 * @param {number} annualInterestRate - Taxa de juros anual
 * @param {number} months - Duração em meses
 * @returns {number} - Valor do pagamento mensal
 */
export function calculateMonthlyPayment(principal, annualInterestRate, months) {
  const monthlyRate = annualInterestRate / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  
  return principal * monthlyRate * Math.pow(1 + monthlyRate, months) / 
         (Math.pow(1 + monthlyRate, months) - 1);
}

/**
 * Calcula a taxa de juros efetiva baseada na classificação de crédito
 * @param {number} baseRate - Taxa de juros base
 * @param {string} creditRating - Classificação de crédito
 * @param {number} debtToGdpRatio - Relação dívida/PIB
 * @param {boolean} isEmergency - Se é emissão de emergência
 * @returns {number} - Taxa de juros efetiva
 */
export function calculateEffectiveInterestRate(baseRate, creditRating, debtToGdpRatio, isEmergency = false) {
  let effectiveRate = baseRate;
  
  // Premium de risco baseado na classificação de crédito
  const riskPremiums = {
    "AAA": isEmergency ? 1.0 : 0,
    "AA": isEmergency ? 2.0 : 0.5,
    "A": isEmergency ? 3.0 : 1.0,
    "BBB": isEmergency ? 5.0 : 2.0,
    "BB": isEmergency ? 8.0 : 3.5,
    "B": isEmergency ? 12.0 : 5.0,
    "CCC": isEmergency ? 18.0 : 8.0,
    "CC": isEmergency ? 25.0 : 12.0,
    "C": isEmergency ? 35.0 : 18.0,
    "D": isEmergency ? 50.0 : 25.0
  };
  
  effectiveRate += riskPremiums[creditRating] || 5.0;
  
  // Adicional por dívida alta
  if (debtToGdpRatio > 0.6) {
    effectiveRate += (debtToGdpRatio - 0.6) * 20;
  }
  
  return effectiveRate;
}

/**
 * Cria uma nova dívida
 * @param {Object} debtData - Dados da dívida
 * @returns {Object} - Objeto da dívida criada
 */
export function createDebt(debtData) {
  const {
    id,
    originalValue,
    effectiveInterestRate,
    issueDate = new Date(),
    months = ECONOMIC_CONSTANTS.DEBT_DURATION_MONTHS
  } = debtData;
  
  const monthlyPayment = calculateMonthlyPayment(originalValue, effectiveInterestRate, months);
  
  return {
    id,
    issueDate,
    originalValue,
    remainingValue: originalValue,
    interestRate: effectiveInterestRate,
    remainingInstallments: months,
    monthlyPayment
  };
}

/**
 * Processa os pagamentos mensais das dívidas
 * @param {Array} debtRecords - Array de registros de dívidas
 * @param {number} availableCash - Caixa disponível
 * @returns {Object} - { totalPayment, interestPayment, principalPayment, updatedDebts, remainingCash }
 */
export function processMonthlyDebtPayments(debtRecords, availableCash) {
  if (!debtRecords || debtRecords.length === 0) {
    return {
      totalPayment: 0,
      interestPayment: 0,
      principalPayment: 0,
      updatedDebts: [],
      remainingCash: availableCash
    };
  }
  
  let totalPayment = 0;
  let totalInterestPayment = 0;
  let totalPrincipalPayment = 0;
  const updatedDebts = [];
  
  // Calcula pagamentos para cada dívida
  for (const debt of debtRecords) {
    if (debt.remainingInstallments > 0) {
      const monthlyRate = debt.interestRate / 100 / 12;
      const interestPayment = debt.remainingValue * monthlyRate;
      const principalPayment = debt.monthlyPayment - interestPayment;
      
      totalInterestPayment += interestPayment;
      totalPrincipalPayment += principalPayment;
      totalPayment += debt.monthlyPayment;
      
      // Atualiza a dívida
      const updatedDebt = {
        ...debt,
        remainingValue: Math.max(0, debt.remainingValue - principalPayment),
        remainingInstallments: debt.remainingInstallments - 1
      };
      
      // Só mantém dívidas que ainda têm parcelas
      if (updatedDebt.remainingInstallments > 0) {
        updatedDebts.push(updatedDebt);
      }
    }
  }
  
  return {
    totalPayment,
    interestPayment: totalInterestPayment,
    principalPayment: totalPrincipalPayment,
    updatedDebts,
    remainingCash: availableCash - totalPayment
  };
}

/**
 * Emite títulos de dívida pública
 * @param {Object} economyState - Estado econômico atual
 * @param {number} bondValue - Valor dos títulos a emitir
 * @param {boolean} isEmergency - Se é emissão de emergência
 * @returns {Object} - { success, newDebt, updatedEconomy, message }
 */
export function issueBonds(economyState, bondValue, isEmergency = false) {
  const {
    publicDebt,
    gdp,
    interestRate,
    creditRating,
    canIssueDebt = true,
    debtRecords = [],
    nextDebtId = 1
  } = economyState;
  
  // Verifica se pode emitir dívida
  const currentDebtToGdp = publicDebt / gdp;
  const newDebtToGdp = (publicDebt + bondValue) / gdp;
  
  if (newDebtToGdp > ECONOMIC_CONSTANTS.MAX_DEBT_TO_GDP_RATIO || !canIssueDebt) {
    return {
      success: false,
      message: 'Não é possível emitir mais títulos! A emissão faria a dívida ultrapassar 120% do PIB ou o país está em situação de calote.',
      newDebt: null,
      updatedEconomy: economyState
    };
  }
  
  // Calcula taxa de juros efetiva
  const effectiveRate = calculateEffectiveInterestRate(
    interestRate,
    creditRating,
    currentDebtToGdp,
    isEmergency
  );
  
  // Cria nova dívida
  const newDebt = createDebt({
    id: nextDebtId,
    originalValue: bondValue,
    effectiveInterestRate: effectiveRate,
    issueDate: new Date()
  });
  
  // Atualiza estado econômico
  const updatedEconomy = {
    ...economyState,
    treasury: economyState.treasury + bondValue,
    publicDebt: publicDebt + bondValue,
    debtRecords: [...debtRecords, newDebt],
    nextDebtId: nextDebtId + 1
  };
  
  return {
    success: true,
    message: `Títulos emitidos com sucesso. Taxa efetiva: ${effectiveRate.toFixed(2)}%`,
    newDebt,
    updatedEconomy
  };
}

/**
 * Emite títulos de emergência quando o caixa está insuficiente
 * @param {Object} economyState - Estado econômico atual
 * @param {number} requiredAmount - Valor necessário
 * @returns {Object} - { success, updatedEconomy, message }
 */
export function issueEmergencyBonds(economyState, requiredAmount) {
  const {
    publicDebt,
    gdp,
    interestRate,
    creditRating,
    canIssueDebt = true,
    debtRecords = []
  } = economyState;
  
  // Verifica se pode emitir dívida
  const currentDebtToGdp = publicDebt / gdp;
  const estimatedNewDebtToGdp = (publicDebt + requiredAmount * 1.5) / gdp; // Estima com fator de juros
  
  if (estimatedNewDebtToGdp > ECONOMIC_CONSTANTS.MAX_DEBT_TO_GDP_RATIO || !canIssueDebt) {
    return {
      success: false,
      message: 'Não é possível emitir títulos de emergência',
      updatedEconomy: {
        ...economyState,
        treasury: 0
      }
    };
  }
  
  // Calcula fator de juros altos para determinar valor necessário
  let highInterestFactor = 1.0;
  
  // Fator baseado na taxa de juros média ponderada das dívidas existentes
  if (debtRecords.length > 0) {
    const totalInterest = debtRecords.reduce((sum, debt) => 
      sum + (debt.remainingValue * debt.interestRate), 0
    );
    const totalBalance = debtRecords.reduce((sum, debt) => 
      sum + debt.remainingValue, 0
    );
    const averageInterest = totalBalance > 0 ? (totalInterest / totalBalance) : interestRate;
    
    highInterestFactor = 1 + Math.max(0, (averageInterest - 8) / 16);
  } else {
    highInterestFactor = 1 + Math.max(0, (interestRate - 8) / 16);
  }
  
  // Penalidade extra se a dívida já estiver alta
  if (currentDebtToGdp > 0.8) {
    highInterestFactor *= (1 + (currentDebtToGdp - 0.8) * 0.5);
  }
  
  const bondValue = Math.ceil(requiredAmount * highInterestFactor);
  
  // Emite os títulos
  const result = issueBonds(economyState, bondValue, true);
  
  if (result.success) {
    return {
      success: true,
      message: `Títulos de emergência emitidos: ${bondValue.toFixed(2)} bi (fator: ${highInterestFactor.toFixed(2)})`,
      updatedEconomy: result.updatedEconomy
    };
  } else {
    return {
      success: false,
      message: 'Falha na emissão de títulos de emergência',
      updatedEconomy: {
        ...economyState,
        treasury: 0
      }
    };
  }
}

/**
 * Atualiza o valor total da dívida pública, incluindo os juros futuros
 * @param {Array} debtRecords - Registros de dívidas
 * @returns {Object} - { totalDebtWithInterest, principalRemaining }
 */
export function updateTotalPublicDebt(debtRecords) {
  if (!debtRecords || debtRecords.length === 0) {
    return {
      totalDebtWithInterest: 0,
      principalRemaining: 0
    };
  }
  
  // Valor apenas do principal restante
  const principalRemaining = debtRecords.reduce((total, debt) => 
    total + debt.remainingValue, 0
  );
  
  // Cálculo incluindo todos os juros futuros
  let totalDebtWithInterest = 0;
  
  debtRecords.forEach(debt => {
    // Pagamento mensal total ao longo da vida do empréstimo
    const totalFuturePayment = debt.monthlyPayment * debt.remainingInstallments;
    totalDebtWithInterest += totalFuturePayment;
  });
  
  return {
    totalDebtWithInterest,
    principalRemaining
  };
}

/**
 * Verifica se o país pode emitir mais dívida
 * @param {Object} economyState - Estado econômico atual
 * @returns {boolean} - Se pode emitir dívida
 */
export function canIssueMoreDebt(economyState) {
  const { publicDebt, gdp, canIssueDebt = true } = economyState;
  
  const debtToGdpRatio = publicDebt / gdp;
  return canIssueDebt && debtToGdpRatio <= ECONOMIC_CONSTANTS.MAX_DEBT_TO_GDP_RATIO;
}

/**
 * Atualiza a capacidade de emitir dívida baseada na situação econômica
 * @param {Object} economyState - Estado econômico atual
 * @returns {boolean} - Nova capacidade de emitir dívida
 */
export function updateDebtIssuingCapacity(economyState) {
  const { publicDebt, gdp } = economyState;
  
  const debtToGdpRatio = publicDebt / gdp;
  
  // Se a dívida ultrapassar 120% do PIB, não pode mais emitir
  return debtToGdpRatio <= ECONOMIC_CONSTANTS.MAX_DEBT_TO_GDP_RATIO;
}