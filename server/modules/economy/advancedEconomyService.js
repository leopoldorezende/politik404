/**
 * advancedEconomyService.js
 * Serviço que conecta os cálculos econômicos puros com o Redux
 * Processa turnos econômicos e atualiza o estado
 */

import { store } from '../../store';
import {
  processEconomicCalculations,
  updateSectoralDistribution,
  updateDomesticNeeds,
  updateEconomicHistories,
  updateCreditRating,
  issueBonds as issueBondsAction,
  processDebtPayments as processDebtPaymentsAction,
  selectCountryEconomy
} from './advancedEconomySlice';

// Importar funções de cálculo do servidor (assumindo que estarão disponíveis no cliente)
// Em uma implementação real, essas funções viriam do servidor via API
const calculateEconomicGrowth = (economyState) => {
  const { interestRate = 8.0, taxBurden = 40.0, publicServices = 30.0, publicDebt = 0, gdp = 100 } = economyState;
  
  const interestDiff = interestRate - 8.0;
  
  // Efeito dos juros no crescimento
  let interestEffect;
  if (interestRate <= 10) {
    interestEffect = -interestDiff * 0.0002;
  } else {
    const excessInterest = interestRate - 10;
    interestEffect = -(interestDiff * 0.0002) - (Math.pow(excessInterest, 1.5) * 0.0001);
  }
  
  // Efeito dos impostos no crescimento
  const taxDiff = taxBurden - 40.0;
  const taxEffect = -taxDiff * 0.00015;
  
  // Efeito do investimento público no crescimento
  let investmentEffect = 0;
  if (publicServices >= 30) {
    investmentEffect = publicServices * 0.0001;
  } else {
    const deficit = 30 - publicServices;
    const penaltyFactor = 1 - Math.pow(deficit / 30, 1.5) * 0.5;
    investmentEffect = publicServices * 0.0001 * penaltyFactor;
  }
  
  // Efeito da dívida pública na confiança dos investidores
  let debtEffect = 0;
  const debtToGdpRatio = publicDebt / gdp;
  if (debtToGdpRatio > 0.9) {
    debtEffect = -(debtToGdpRatio - 0.9) * 0.05;
  }
  
  const baseGrowth = interestEffect + taxEffect + investmentEffect + debtEffect;
  return baseGrowth * 0.061;
};

const calculateInflation = (economyState) => {
  const { 
    inflation = 0.04, 
    interestRate = 8.0, 
    taxBurden = 40.0, 
    quarterlyGrowth = 0.02, 
    publicDebt = 0, 
    gdp = 100,
    inflationHistory = []
  } = economyState;
  
  let newInflation = inflation;
  
  // Efeito dos juros na inflação
  if (interestRate < 8.0) {
    const increaseFactor = 1 + ((8.0 - interestRate) * 0.03);
    newInflation *= increaseFactor;
  } else if (interestRate > 8.0) {
    if (interestRate <= 10) {
      const reductionFactor = 1 - ((interestRate - 8.0) * 0.025);
      newInflation *= Math.max(0.85, reductionFactor);
    } else {
      const normalInterest = 10 - 8.0;
      const excessInterest = interestRate - 10;
      
      const initialReduction = 1 - (normalInterest * 0.025);
      const additionalReduction = Math.pow(1.2, excessInterest) * 0.05;
      
      newInflation *= Math.max(0.65, initialReduction - additionalReduction);
    }
  }
  
  // Efeito dos impostos na inflação
  if (taxBurden > 40.0) {
    const reductionFactor = 1 - ((taxBurden - 40.0) * 0.003);
    newInflation *= Math.max(0.96, reductionFactor);
  } else if (taxBurden < 40.0) {
    const increaseFactor = 1 + ((40.0 - taxBurden) * 0.002);
    newInflation *= increaseFactor;
  }
  
  // Efeito do crescimento econômico na inflação
  const equilibriumGrowth = 0.02;
  
  if (quarterlyGrowth > equilibriumGrowth) {
    const excess = quarterlyGrowth - equilibriumGrowth;
    const emphasisFactor = 1 + (excess * 5);
    newInflation += excess * 0.12 * emphasisFactor;
  } else if (quarterlyGrowth > 0 && quarterlyGrowth <= equilibriumGrowth) {
    newInflation += quarterlyGrowth * 0.005;
  } else if (quarterlyGrowth < 0) {
    newInflation -= Math.abs(quarterlyGrowth) * 0.025;
  }
  
  // Efeito da dívida pública na inflação estrutural
  const debtToGdp = publicDebt / gdp;
  if (debtToGdp > 0.7) {
    const excessDebt = debtToGdp - 0.7;
    newInflation += excessDebt * 0.02;
  }
  
  // Variação aleatória e inércia inflacionária
  const randomVariation = (Math.random() - 0.5) * 0.0005;
  newInflation += randomVariation;
  newInflation = inflation * 0.8 + newInflation * 0.2;
  
  // Limita a inflação
  newInflation = Math.max(-0.02, Math.min(0.18, newInflation));
  
  // Cria novo histórico para média móvel
  const newInflationHistory = [...inflationHistory, newInflation];
  if (newInflationHistory.length > 20) {
    newInflationHistory.shift();
  }
  
  const averageInflation = newInflationHistory.reduce((a, b) => a + b, 0) / newInflationHistory.length;
  
  return {
    newInflation: newInflation * 0.8 + averageInflation * 0.2,
    newInflationHistory
  };
};

const calculateUnemployment = (economyState) => {
  const { unemployment = 12.5, quarterlyGrowth = 0, inflation = 0.04, taxBurden = 40.0 } = economyState;
  
  let newUnemployment = unemployment;
  
  // Efeito do crescimento no desemprego
  if (quarterlyGrowth > 0) {
    newUnemployment -= quarterlyGrowth * 5;
  } else {
    newUnemployment += Math.abs(quarterlyGrowth) * 8;
  }
  
  // Efeito da inflação no desemprego (curva de Phillips)
  if (inflation < 0.05) {
    newUnemployment += (0.05 - inflation) * 2;
  } else if (inflation > 0.1) {
    newUnemployment += (inflation - 0.1) * 3;
  } else {
    newUnemployment -= (inflation - 0.05) * 1;
  }
  
  // Efeito dos impostos no desemprego
  if (taxBurden > 40) {
    newUnemployment += (taxBurden - 40) * 0.05;
  }
  
  // Limites para a taxa de desemprego (entre 3% e 40%)
  newUnemployment = Math.max(3, Math.min(40, newUnemployment));
  
  // Inércia do desemprego
  return unemployment * 0.9 + newUnemployment * 0.1;
};

const calculateTreasury = (economyState) => {
  const { treasury = 100, gdp = 100, taxBurden = 40.0, publicServices = 30.0 } = economyState;
  
  // Arrecadação via impostos
  const revenue = gdp * (taxBurden / 100) * 0.017;
  
  // Gastos com investimento público
  let investmentExpense = 0;
  
  if (publicServices > 0) {
    if (publicServices <= 15) {
      investmentExpense = gdp * (publicServices / 100) * 0.015;
    } else {
      const baseExpense = gdp * (15 / 100) * 0.015;
      const extraFactor = 2.0;
      const excessInvestment = publicServices - 15;
      const excessExpense = gdp * (excessInvestment / 100) * 0.015 * extraFactor;
      
      investmentExpense = baseExpense + excessExpense;
    }
  }
  
  return treasury + revenue - investmentExpense;
};

const calculatePopularity = (economyState) => {
  const { 
    popularity = 50, 
    quarterlyGrowth = 0, 
    inflation = 0.04, 
    taxBurden = 40.0, 
    publicServices = 30.0, 
    gdp = 100, 
    unemployment = 12.5,
    popularityHistory = []
  } = economyState;
  
  let newPopularity = popularity;
  
  // Efeito do crescimento na popularidade
  if (quarterlyGrowth > 0) {
    newPopularity += quarterlyGrowth * 100 * 0.2;
  } else if (quarterlyGrowth < 0) {
    newPopularity += quarterlyGrowth * 100 * 0.3;
  }
  
  // Efeito da inflação na popularidade
  const idealInflation = 0.04;
  const inflationDiff = inflation - idealInflation;
  if (inflationDiff > 0) {
    newPopularity -= inflationDiff * 100 * 0.25;
  } else if (inflationDiff < 0 && inflation > 0) {
    newPopularity += Math.abs(inflationDiff) * 100 * 0.1;
  }
  
  // Efeito dos impostos na popularidade
  const idealTax = 40;
  const taxDiff = taxBurden - idealTax;
  if (taxDiff > 0) {
    newPopularity -= taxDiff * 0.2;
  } else if (taxDiff < 0) {
    newPopularity += Math.abs(taxDiff) * 0.1;
  }
  
  // Efeito do investimento público na popularidade
  const investmentReference = Math.round(gdp / 3.33);
  const investmentDiff = publicServices - investmentReference;
  const responseRate = Math.tanh(investmentDiff / 10) * 0.8;
  newPopularity += responseRate * Math.abs(investmentDiff) * 0.15;
  
  // Efeito do desemprego na popularidade
  const idealUnemployment = 15;
  const unemploymentDiff = unemployment - idealUnemployment;
  
  if (unemploymentDiff > 0) {
    const penaltyFactor = 1 + Math.pow(unemploymentDiff / 10, 1.5);
    newPopularity -= unemploymentDiff * 0.3 * penaltyFactor;
  } else if (unemploymentDiff < 0) {
    newPopularity += Math.abs(unemploymentDiff) * 0.3;
  }
  
  // Efeito combinado de desemprego alto + inflação alta
  if (unemployment > 30 && inflation > 0.08) {
    const miseryIndex = (unemployment - 30) * (inflation - 0.08) * 100;
    newPopularity -= miseryIndex * 0.2;
  }
  
  // Variação aleatória
  const randomVariation = (Math.random() - 0.5) * 0.5;
  newPopularity += randomVariation;
  
  // Força de retorno para o equilíbrio (50%)
  const distanceFrom50 = Math.abs(newPopularity - 50);
  const returnForce = distanceFrom50 * distanceFrom50 * 0.002;
  
  if (newPopularity > 50) {
    newPopularity -= returnForce;
  } else if (newPopularity < 50) {
    newPopularity += returnForce;
  }
  
  // Limite entre 1% e 99%
  newPopularity = Math.max(1, Math.min(99, newPopularity));
  
  // Cria novo histórico para média móvel
  const newPopularityHistory = [...popularityHistory, newPopularity];
  if (newPopularityHistory.length > 20) {
    newPopularityHistory.shift();
  }
  
  const averagePopularity = newPopularityHistory.reduce((a, b) => a + b, 0) / newPopularityHistory.length;
  
  return {
    newPopularity: newPopularity * 0.7 + averagePopularity * 0.3,
    newPopularityHistory
  };
};

const updateCreditRatingValue = (economyState) => {
  const { publicDebt = 0, gdp = 100, inflation = 0.04, quarterlyGrowth = 0, inflationHistory = [] } = economyState;
  
  const debtToGdp = publicDebt / gdp;
  const inflationPercent = inflation * 100;
  const growthPercent = quarterlyGrowth * 100;
  
  // Determinação da nota base com base na inflação
  let baseRating;
  
  if (inflationPercent <= 2) {
    baseRating = "AAA";
  } else if (inflationPercent <= 3) {
    baseRating = "AA";
  } else if (inflationPercent <= 4) {
    baseRating = "A";
  } else if (inflationPercent <= 5.5) {
    baseRating = "BBB";
  } else if (inflationPercent <= 7) {
    baseRating = "BB";
  } else if (inflationPercent <= 9) {
    baseRating = "B";
  } else if (inflationPercent <= 12) {
    baseRating = "CCC";
  } else if (inflationPercent <= 15) {
    baseRating = "CC";
  } else {
    baseRating = "C";
  }
  
  // Ajuste pela dívida e crescimento
  const levels = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
  let ratingIndex = levels.indexOf(baseRating);
  
  // Impacto da dívida na classificação
  if (debtToGdp > 0.3 && debtToGdp <= 0.6) {
    ratingIndex += 1;
  } else if (debtToGdp > 0.6 && debtToGdp <= 0.9) {
    ratingIndex += 2;
  } else if (debtToGdp > 0.9 && debtToGdp <= 1.2) {
    ratingIndex += 3;
  } else if (debtToGdp > 1.2) {
    ratingIndex += 4;
  }
  
  // Impacto do crescimento negativo na classificação
  if (growthPercent < 0) {
    if (growthPercent >= -1) {
      ratingIndex += 1;
    } else if (growthPercent >= -3) {
      ratingIndex += 2;
    } else if (growthPercent >= -5) {
      ratingIndex += 3;
    } else {
      ratingIndex += 4;
    }
    
    // Caso especial: Estagflação
    if (inflationPercent > 7) {
      ratingIndex += 1;
    }
  }
  
  // Casos especiais para rating D
  if (inflationPercent > 15 && inflationHistory.length >= 3) {
    const last3 = inflationHistory.slice(-3).map(i => i * 100);
    if (last3[2] > last3[0] || Math.abs(last3[2] - last3[1]) > 2) {
      return "D";
    }
  }
  
  if (inflationPercent > 9 && debtToGdp > 0.9 && growthPercent < -3) {
    return "D";
  }
  
  // Garantir que o índice não ultrapasse o tamanho do array
  ratingIndex = Math.min(ratingIndex, levels.length - 1);
  
  return levels[ratingIndex];
};

/**
 * Serviço principal de economia avançada
 */
class AdvancedEconomyService {
  constructor() {
    this.autoAdvanceInterval = null;
  }
  
  /**
   * Avança um turno para um país específico
   * @param {string} roomName - Nome da sala
   * @param {string} countryName - Nome do país
   */
  advanceCountryTurn(roomName, countryName) {
    const state = store.getState();
    const economy = selectCountryEconomy(state, roomName, countryName);
    
    if (!economy) {
      console.error(`Economy not found for ${countryName} in room ${roomName}`);
      return;
    }
    
    // Calcula o crescimento econômico
    const growth = calculateEconomicGrowth(economy);
    
    // Atualiza o PIB com base no crescimento
    const newGdp = economy.gdp * (1 + growth);
    
    // Atualiza histórico do PIB
    const newGdpHistory = [...economy.gdpHistory, newGdp];
    if (newGdpHistory.length > 20) {
      newGdpHistory.shift();
    }
    
    // Atualiza crescimento trimestral a cada 90 turnos
    let newQuarterlyGrowth = economy.quarterlyGrowth;
    let newPreviousQuarterGDP = economy.previousQuarterGDP;
    
    if ((economy.turn + 1) % 90 === 0) {
      newQuarterlyGrowth = (newGdp - economy.previousQuarterGDP) / economy.previousQuarterGDP;
      newPreviousQuarterGDP = newGdp;
    }
    
    // Calcula inflação
    const inflationResult = calculateInflation({
      ...economy,
      gdp: newGdp,
      quarterlyGrowth: newQuarterlyGrowth
    });
    
    // Calcula desemprego
    const newUnemployment = calculateUnemployment({
      ...economy,
      quarterlyGrowth: newQuarterlyGrowth,
      inflation: inflationResult.newInflation
    });
    
    // Atualiza histórico de desemprego
    const newUnemploymentHistory = [...economy.unemploymentHistory, newUnemployment];
    if (newUnemploymentHistory.length > 20) {
      newUnemploymentHistory.shift();
    }
    
    // Calcula novo caixa/tesouro
    const newTreasury = calculateTreasury({
      ...economy,
      gdp: newGdp
    });
    
    // Calcula popularidade
    const popularityResult = calculatePopularity({
      ...economy,
      gdp: newGdp,
      quarterlyGrowth: newQuarterlyGrowth,
      inflation: inflationResult.newInflation,
      unemployment: newUnemployment
    });
    
    // Atualiza classificação de crédito
    const newCreditRating = updateCreditRatingValue({
      ...economy,
      gdp: newGdp,
      inflation: inflationResult.newInflation,
      quarterlyGrowth: newQuarterlyGrowth,
      inflationHistory: inflationResult.newInflationHistory
    });
    
    // Efeito da inflação alta no PIB
    let finalGdp = newGdp;
    if (inflationResult.newInflation > 0.1) {
      const excess = inflationResult.newInflation - 0.1;
      const penaltyFactor = 0.9998 - (excess * 0.001);
      finalGdp *= Math.max(0.9995, penaltyFactor);
    }
    
    // Processa pagamentos de dívidas mensalmente
    let updatedTreasury = newTreasury;
    let updatedDebtRecords = economy.debtRecords;
    
    if ((economy.turn + 1) % 30 === 0) {
      const paymentResult = this.processMonthlyDebtPayments(economy.debtRecords, newTreasury);
      updatedTreasury = paymentResult.remainingCash;
      updatedDebtRecords = paymentResult.updatedDebts;
      
      // Se não há dinheiro suficiente, emite títulos de emergência
      if (updatedTreasury <= 0) {
        const emergencyResult = this.issueEmergencyBonds({
          ...economy,
          treasury: updatedTreasury,
          gdp: finalGdp,
          creditRating: newCreditRating
        }, Math.abs(updatedTreasury) + 10);
        
        if (emergencyResult.success) {
          updatedTreasury = emergencyResult.updatedEconomy.treasury;
          updatedDebtRecords = emergencyResult.updatedEconomy.debtRecords;
        } else {
          updatedTreasury = 0;
        }
      }
    }
    
    // Atualiza distribuição setorial mensalmente
    let sectoralUpdate = null;
    if ((economy.turn + 1) % 30 === 0) {
      sectoralUpdate = this.updateSectoralDistribution({
        ...economy,
        gdp: finalGdp
      });
    }
    
    // Monta o resultado dos cálculos
    const calculationResults = {
      turn: economy.turn + 1,
      gdp: finalGdp,
      inflation: inflationResult.newInflation,
      unemployment: newUnemployment,
      treasury: updatedTreasury,
      quarterlyGrowth: newQuarterlyGrowth,
      previousQuarterGDP: newPreviousQuarterGDP,
      popularity: popularityResult.newPopularity,
      creditRating: newCreditRating,
      canIssueDebt: newCreditRating !== 'D' && (economy.publicDebt / finalGdp) <= 1.2,
      debtRecords: updatedDebtRecords,
      lastUpdate: Date.now()
    };
    
    // Se houve atualização setorial, inclui
    if (sectoralUpdate) {
      Object.assign(calculationResults, sectoralUpdate);
    }
    
    // Dispatcha as atualizações para o Redux
    store.dispatch(processEconomicCalculations({
      roomName,
      countryName,
      calculationResults
    }));
    
    // Atualiza históricos
    store.dispatch(updateEconomicHistories({
      roomName,
      countryName,
      histories: {
        gdpHistory: newGdpHistory,
        inflationHistory: inflationResult.newInflationHistory,
        popularityHistory: popularityResult.newPopularityHistory,
        unemploymentHistory: newUnemploymentHistory
      }
    }));
  }
  
  /**
   * Processa pagamentos mensais de dívidas
   * @param {Array} debtRecords - Registros de dívidas
   * @param {number} availableCash - Caixa disponível
   * @returns {Object} - Resultado do processamento
   */
  processMonthlyDebtPayments(debtRecords, availableCash) {
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
    
    for (const debt of debtRecords) {
      if (debt.remainingInstallments > 0) {
        const monthlyRate = debt.interestRate / 100 / 12;
        const interestPayment = debt.remainingValue * monthlyRate;
        const principalPayment = debt.monthlyPayment - interestPayment;
        
        totalInterestPayment += interestPayment;
        totalPrincipalPayment += principalPayment;
        totalPayment += debt.monthlyPayment;
        
        const updatedDebt = {
          ...debt,
          remainingValue: Math.max(0, debt.remainingValue - principalPayment),
          remainingInstallments: debt.remainingInstallments - 1
        };
        
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
   * Emite títulos de emergência
   * @param {Object} economyState - Estado econômico
   * @param {number} requiredAmount - Valor necessário
   * @returns {Object} - Resultado da emissão
   */
  issueEmergencyBonds(economyState, requiredAmount) {
    const currentDebtToGdp = economyState.publicDebt / economyState.gdp;
    
    if (currentDebtToGdp > 1.2 || !economyState.canIssueDebt) {
      return {
        success: false,
        message: 'Não é possível emitir títulos de emergência',
        updatedEconomy: {
          ...economyState,
          treasury: 0
        }
      };
    }
    
    let highInterestFactor = 1.0;
    
    if (economyState.debtRecords && economyState.debtRecords.length > 0) {
      const totalInterest = economyState.debtRecords.reduce((sum, debt) => 
        sum + (debt.remainingValue * debt.interestRate), 0
      );
      const totalBalance = economyState.debtRecords.reduce((sum, debt) => 
        sum + debt.remainingValue, 0
      );
      const averageInterest = totalBalance > 0 ? (totalInterest / totalBalance) : economyState.interestRate;
      
      highInterestFactor = 1 + Math.max(0, (averageInterest - 8) / 16);
    } else {
      highInterestFactor = 1 + Math.max(0, (economyState.interestRate - 8) / 16);
    }
    
    if (currentDebtToGdp > 0.8) {
      highInterestFactor *= (1 + (currentDebtToGdp - 0.8) * 0.5);
    }
    
    const bondValue = Math.ceil(requiredAmount * highInterestFactor);
    
    return this.issueBonds(economyState, bondValue, true);
  }
  
  /**
   * Emite títulos de dívida pública
   * @param {Object} economyState - Estado econômico
   * @param {number} bondValue - Valor dos títulos
   * @param {boolean} isEmergency - Se é emissão de emergência
   * @returns {Object} - Resultado da emissão
   */
  issueBonds(economyState, bondValue, isEmergency = false) {
    const currentDebtToGdp = economyState.publicDebt / economyState.gdp;
    const newDebtToGdp = (economyState.publicDebt + bondValue) / economyState.gdp;
    
    if (newDebtToGdp > 1.2 || !economyState.canIssueDebt) {
      return {
        success: false,
        message: 'Não é possível emitir mais títulos!',
        newDebt: null,
        updatedEconomy: economyState
      };
    }
    
    // Calcula taxa de juros efetiva
    let effectiveRate = economyState.interestRate;
    
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
    
    effectiveRate += riskPremiums[economyState.creditRating] || 5.0;
    
    // Adicional por dívida alta
    if (currentDebtToGdp > 0.6) {
      effectiveRate += (currentDebtToGdp - 0.6) * 20;
    }
    
    // Calcula pagamento mensal
    const monthlyRate = effectiveRate / 100 / 12;
    const months = 120; // 10 anos
    const monthlyPayment = bondValue * monthlyRate * Math.pow(1 + monthlyRate, months) / 
                          (Math.pow(1 + monthlyRate, months) - 1);
    
    // Cria nova dívida
    const newDebt = {
      id: economyState.nextDebtId || 1,
      issueDate: new Date(),
      originalValue: bondValue,
      remainingValue: bondValue,
      interestRate: effectiveRate,
      remainingInstallments: months,
      monthlyPayment
    };
    
    // Atualiza estado econômico
    const updatedEconomy = {
      ...economyState,
      treasury: economyState.treasury + bondValue,
      publicDebt: economyState.publicDebt + bondValue,
      debtRecords: [...(economyState.debtRecords || []), newDebt],
      nextDebtId: (economyState.nextDebtId || 1) + 1
    };
    
    return {
      success: true,
      message: `Títulos emitidos com sucesso. Taxa efetiva: ${effectiveRate.toFixed(2)}%`,
      newDebt,
      updatedEconomy
    };
  }
  
  /**
   * Atualiza distribuição setorial do PIB
   * @param {Object} economyState - Estado econômico
   * @returns {Object} - Nova distribuição setorial
   */
  updateSectoralDistribution(economyState) {
    const { services = 65, commodities = 20, manufactures = 15, gdp = 100 } = economyState;
    
    // Variação mensal aleatória na distribuição setorial
    const commoditiesVariation = Math.floor(Math.random() * 3) - 1; // -1, 0, ou 1
    const manufacturesVariation = Math.floor(Math.random() * 3) - 1; // -1, 0, ou 1
    
    let newCommodities = commodities + commoditiesVariation;
    let newManufactures = manufactures + manufacturesVariation;
    
    // Recalcula serviços para manter o total em 100%
    let newServices = 100 - newCommodities - newManufactures;
    
    // Ajusta os limites setoriais
    const adjusted = this.adjustSectoralLimits({
      commodities: newCommodities,
      manufactures: newManufactures,
      services: newServices
    });
    
    return {
      services: adjusted.services,
      commodities: adjusted.commodities,
      manufactures: adjusted.manufactures,
      servicesOutput: gdp * adjusted.services / 100,
      commoditiesOutput: gdp * adjusted.commodities / 100,
      manufacturesOutput: gdp * adjusted.manufactures / 100
    };
  }
  
  /**
   * Ajusta os limites da distribuição setorial
   * @param {Object} sectors - Setores econômicos
   * @returns {Object} - Setores ajustados
   */
  adjustSectoralLimits(sectors) {
    const adjusted = { ...sectors };
    
    // Limites para commodities (20-50%)
    if (adjusted.commodities < 20) { 
      const adjustment = 20 - adjusted.commodities;
      adjusted.commodities = 20;
      adjusted.services -= adjustment / 2;
      adjusted.manufactures -= adjustment / 2;
    } else if (adjusted.commodities > 50) {
      const adjustment = adjusted.commodities - 50;
      adjusted.commodities = 50;
      adjusted.services += adjustment / 2;
      adjusted.manufactures += adjustment / 2;
    }
    
    // Limites para manufaturas (20-50%)
    if (adjusted.manufactures < 20) {
      const adjustment = 20 - adjusted.manufactures;
      adjusted.manufactures = 20;
      adjusted.services -= adjustment / 2;
      adjusted.commodities -= adjustment / 2;
    } else if (adjusted.manufactures > 50) {
      const adjustment = adjusted.manufactures - 50;
      adjusted.manufactures = 50;
      adjusted.services += adjustment / 2;
      adjusted.commodities += adjustment / 2;
    }
    
    // Limites para serviços (20-50%)
    if (adjusted.services < 20) {
      const adjustment = 20 - adjusted.services;
      adjusted.services = 20;
      adjusted.commodities -= adjustment / 2;
      adjusted.manufactures -= adjustment / 2;
    } else if (adjusted.services > 50) {
      const adjustment = adjusted.services - 50;
      adjusted.services = 50;
      adjusted.commodities += adjustment / 2;
      adjusted.manufactures += adjustment / 2;
    }
    
    // Arredonda para inteiros e garante total de 100%
    adjusted.commodities = Math.round(adjusted.commodities);
    adjusted.manufactures = Math.round(adjusted.manufactures);
    adjusted.services = 100 - adjusted.commodities - adjusted.manufactures;
    
    return adjusted;
  }
  
  /**
   * Atualiza necessidades internas do país
   * @param {Object} economyState - Estado econômico
   * @returns {Object} - Novas necessidades
   */
  updateDomesticNeeds(economyState) {
    const { 
      gdp = 100, 
      commoditiesNeedPercent = 30, 
      manufacturesNeedPercent = 45 
    } = economyState;
    
    // Atualiza as percentagens das necessidades com pequena variação aleatória
    const commoditiesVariation = (Math.random() * 0.4) - 0.2; // -0.2 a +0.2
    const manufacturesVariation = (Math.random() * 0.4) - 0.2; // -0.2 a +0.2
    
    const newCommoditiesNeedPercent = Math.max(25, Math.min(40, 
      commoditiesNeedPercent + commoditiesVariation
    ));
    
    const newManufacturesNeedPercent = Math.max(25, Math.min(40, 
      manufacturesNeedPercent + manufacturesVariation
    ));
    
    return {
      commoditiesNeedPercent: newCommoditiesNeedPercent,
      manufacturesNeedPercent: newManufacturesNeedPercent,
      commoditiesNeeds: gdp * (newCommoditiesNeedPercent / 100),
      manufacturesNeeds: gdp * (newManufacturesNeedPercent / 100)
    };
  }
  
  /**
   * Inicia avanço automático de turnos
   * @param {string} roomName - Nome da sala
   * @param {Array} countryNames - Nomes dos países
   * @param {number} speed - Velocidade em ms
   */
  startAutoAdvance(roomName, countryNames, speed = 1000) {
    if (this.autoAdvanceInterval) {
      this.stopAutoAdvance();
    }
    
    this.autoAdvanceInterval = setInterval(() => {
      countryNames.forEach(countryName => {
        this.advanceCountryTurn(roomName, countryName);
      });
    }, speed);
  }
  
  /**
   * Para o avanço automático de turnos
   */
  stopAutoAdvance() {
    if (this.autoAdvanceInterval) {
      clearInterval(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
    }
  }
  
  /**
   * Atualiza parâmetros econômicos de um país
   * @param {string} roomName - Nome da sala
   * @param {string} countryName - Nome do país
   * @param {Object} parameters - Parâmetros a atualizar
   */
  updateCountryParameters(roomName, countryName, parameters) {
    store.dispatch(updateEconomicParameters({
      roomName,
      countryName,
      parameters
    }));
  }
  
  /**
   * Emite títulos de dívida pública (interface pública)
   * @param {string} roomName - Nome da sala
   * @param {string} countryName - Nome do país
   * @param {number} bondValue - Valor dos títulos
   * @returns {Promise<Object>} - Resultado da emissão
   */
  async issueBondsForCountry(roomName, countryName, bondValue) {
    const state = store.getState();
    const economy = selectCountryEconomy(state, roomName, countryName);
    
    if (!economy) {
      return {
        success: false,
        message: 'País não encontrado'
      };
    }
    
    const result = this.issueBonds(economy, bondValue, false);
    
    if (result.success) {
      store.dispatch(issueBondsAction({
        roomName,
        countryName,
        bondData: result
      }));
    }
    
    return result;
  }
  
  /**
   * Limpa dados econômicos de uma sala
   * @param {string} roomName - Nome da sala
   */
  clearRoomData(roomName) {
    store.dispatch(removeRoomEconomyData({ roomName }));
  }
  
  /**
   * Limpa dados econômicos de um país
   * @param {string} roomName - Nome da sala
   * @param {string} countryName - Nome do país
   */
  clearCountryData(roomName, countryName) {
    store.dispatch(removeCountryEconomyData({ roomName, countryName }));
  }
  
  /**
   * Obtém um resumo econômico de um país
   * @param {string} roomName - Nome da sala
   * @param {string} countryName - Nome do país
   * @returns {Object} - Resumo econômico
   */
  getCountryEconomicSummary(roomName, countryName) {
    const state = store.getState();
    const economy = selectCountryEconomy(state, roomName, countryName);
    
    if (!economy) return null;
    
    const debtSummary = {
      totalMonthlyPayment: economy.debtRecords.reduce((total, debt) => 
        total + debt.monthlyPayment, 0
      ),
      principalRemaining: economy.debtRecords.reduce((total, debt) => 
        total + debt.remainingValue, 0
      ),
      totalFuturePayments: economy.debtRecords.reduce((total, debt) => 
        total + (debt.monthlyPayment * debt.remainingInstallments), 0
      ),
      debtToGdpRatio: economy.publicDebt / economy.gdp,
      numberOfDebts: economy.debtRecords.length
    };
    
    const sectoralBalance = {
      commoditiesBalance: economy.commoditiesOutput - economy.commoditiesNeeds,
      manufacturesBalance: economy.manufacturesOutput - economy.manufacturesNeeds,
      commoditiesOutput: economy.commoditiesOutput,
      manufacturesOutput: economy.manufacturesOutput,
      servicesOutput: economy.servicesOutput,
      commoditiesNeeds: economy.commoditiesNeeds,
      manufacturesNeeds: economy.manufacturesNeeds
    };
    
    const indicators = {
      gdp: economy.gdp,
      inflation: economy.inflation * 100,
      unemployment: economy.unemployment,
      popularity: economy.popularity,
      quarterlyGrowth: economy.quarterlyGrowth * 100,
      treasury: economy.treasury,
      publicDebt: economy.publicDebt,
      creditRating: economy.creditRating,
      debtToGdpRatio: (economy.publicDebt / economy.gdp) * 100,
      canIssueDebt: economy.canIssueDebt
    };
    
    return {
      economy,
      debtSummary,
      sectoralBalance,
      indicators
    };
  }
}

// Exporta uma instância singleton do serviço
export const advancedEconomyService = new AdvancedEconomyService();
export default advancedEconomyService;