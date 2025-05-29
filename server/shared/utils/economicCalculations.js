/**
 * economicCalculations.js - Módulo específico para cálculos econômicos dinâmicos
 * Localização: server/shared/utils/economicCalculations.js
 * Baseado nos arquivos de inspiração para resolver os problemas identificados
 */

/**
 * Constantes econômicas baseadas nos arquivos de inspiração
 */
const ECONOMIC_CONSTANTS = {
  EQUILIBRIUM_INTEREST_RATE: 8.0,
  EQUILIBRIUM_TAX_RATE: 40.0,
  EQUILIBRIUM_INFLATION: 0.04, // 4%
  IDEAL_UNEMPLOYMENT: 8.0,
  IDEAL_POPULARITY: 50.0,
  
  // Fatores de ajuste para tornar mudanças mais perceptíveis
  INFLATION_SENSITIVITY: 0.001,
  UNEMPLOYMENT_SENSITIVITY: 0.1,
  POPULARITY_SENSITIVITY: 0.5,
  GROWTH_SENSITIVITY: 0.0001,
};

/**
 * Calcula a inflação dinâmica baseada nas políticas econômicas
 * CORRIGE: Inflação travada em 0%
 */
export function calculateDynamicInflation(economy) {
  let currentInflation = economy.inflation || 0.04; // Garantir valor inicial
  
  // Se inflação for 0, inicializar com valor base
  if (currentInflation === 0) {
    currentInflation = 0.04; // 4% inicial
  }
  
  // Efeito da taxa de juros na inflação (inverso)
  const interestDiff = economy.interestRate - ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
  let inflationEffect = 0;
  
  if (economy.interestRate < ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE) {
    // Juros baixos aumentam inflação
    const factor = 1 + ((ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE - economy.interestRate) * 0.05);
    inflationEffect = currentInflation * factor - currentInflation;
  } else if (economy.interestRate > ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE) {
    // Juros altos reduzem inflação
    if (economy.interestRate <= 15) {
      const factor = 1 - ((economy.interestRate - ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE) * 0.03);
      inflationEffect = currentInflation * Math.max(0.3, factor) - currentInflation;
    } else {
      // Juros muito altos reduzem drasticamente
      const normalReduction = 1 - (7 * 0.03); // Até 15%
      const excessReduction = Math.pow(1.1, economy.interestRate - 15) * 0.02;
      const factor = Math.max(0.1, normalReduction - excessReduction);
      inflationEffect = currentInflation * factor - currentInflation;
    }
  }
  
  // Efeito da carga tributária
  const taxDiff = economy.taxBurden - ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
  let taxEffect = 0;
  
  if (economy.taxBurden > ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE) {
    // Impostos altos reduzem inflação (efeito deflacionário)
    const factor = 1 - ((economy.taxBurden - ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE) * 0.002);
    taxEffect = currentInflation * Math.max(0.9, factor) - currentInflation;
  } else {
    // Impostos baixos aumentam inflação
    const factor = 1 + ((ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE - economy.taxBurden) * 0.003);
    taxEffect = currentInflation * factor - currentInflation;
  }
  
  // Efeito do crescimento econômico
  const gdpGrowth = economy.gdpGrowth || 0;
  let growthEffect = 0;
  
  if (gdpGrowth > 2) { // Crescimento acima de 2%
    const excess = (gdpGrowth - 2) / 100;
    const emphasis = 1 + (excess * 3);
    growthEffect = excess * 0.02 * emphasis;
  } else if (gdpGrowth > 0 && gdpGrowth <= 2) {
    growthEffect = (gdpGrowth / 100) * 0.001;
  } else if (gdpGrowth < 0) {
    // Crescimento negativo reduz inflação
    growthEffect = (gdpGrowth / 100) * 0.01;
  }
  
  // Efeito da dívida pública
  const debtToGDP = economy.publicDebt / economy.gdp;
  let debtEffect = 0;
  
  if (debtToGDP > 0.7) {
    const excessDebt = debtToGDP - 0.7;
    debtEffect = excessDebt * 0.01; // Dívida alta aumenta inflação estrutural
  }
  
  // Variação aleatória pequena para realismo
  const randomVariation = (Math.random() - 0.5) * 0.002;
  
  // Aplicar todos os efeitos
  let newInflation = currentInflation + inflationEffect + taxEffect + growthEffect + debtEffect + randomVariation;
  
  // Inércia inflacionária (80% do valor anterior, 20% do novo)
  newInflation = currentInflation * 0.8 + newInflation * 0.2;
  
  // Limites realistas (deflação até 25% de inflação)
  newInflation = Math.max(-0.05, Math.min(0.25, newInflation));
  
  return newInflation;
}

/**
 * Calcula o desemprego dinâmico
 * CORRIGE: Desemprego sempre caindo para 3%
 */
export function calculateDynamicUnemployment(economy) {
  let currentUnemployment = economy.unemployment || 12.5;
  
  // Se desemprego estiver muito baixo, forçar realismo
  if (currentUnemployment < 5) {
    currentUnemployment = 8.0; // Resetar para valor mais realista
  }
  
  // Efeito do crescimento econômico (Lei de Okun adaptada)
  const gdpGrowth = economy.gdpGrowth || 0;
  let growthEffect = 0;
  
  if (gdpGrowth > 0) {
    // Crescimento reduz desemprego, mas não linearmente
    growthEffect = -(gdpGrowth * 0.4); // Para cada 1% de crescimento, -0.4% desemprego
  } else if (gdpGrowth < 0) {
    // Recessão aumenta desemprego mais rapidamente
    growthEffect = Math.abs(gdpGrowth) * 0.8;
  }
  
  // Efeito da inflação (Curva de Phillips modificada)
  const inflationPercent = (economy.inflation || 0.04) * 100;
  let inflationEffect = 0;
  
  if (inflationPercent < 1) {
    // Deflação ou inflação muito baixa mantém desemprego alto
    inflationEffect = (1 - inflationPercent) * 0.5;
  } else if (inflationPercent > 10) {
    // Inflação muito alta também prejudica emprego (estagflação)
    inflationEffect = (inflationPercent - 10) * 0.3;
  } else if (inflationPercent >= 2 && inflationPercent <= 5) {
    // Faixa ideal de inflação pode reduzir desemprego levemente
    inflationEffect = -((inflationPercent - 1) * 0.1);
  }
  
  // Efeito do investimento público
  let investmentEffect = 0;
  if (economy.publicServices > 30) {
    // Investimento público acima de 30% reduz desemprego
    investmentEffect = -((economy.publicServices - 30) * 0.15);
  } else if (economy.publicServices < 20) {
    // Investimento muito baixo aumenta desemprego
    investmentEffect = (20 - economy.publicServices) * 0.1;
  }
  
  // Efeito da carga tributária
  let taxEffect = 0;
  if (economy.taxBurden > 50) {
    // Impostos muito altos podem desencorajar contratações
    taxEffect = (economy.taxBurden - 50) * 0.08;
  } else if (economy.taxBurden < 25) {
    // Impostos muito baixos podem reduzir serviços públicos e aumentar desemprego
    taxEffect = (25 - economy.taxBurden) * 0.05;
  }
  
  // Efeito da taxa de juros
  let interestEffect = 0;
  if (economy.interestRate > 12) {
    // Juros muito altos desencorajam investimento e aumentam desemprego
    interestEffect = (economy.interestRate - 12) * 0.2;
  }
  
  // Aplicar todos os efeitos
  let newUnemployment = currentUnemployment + growthEffect + inflationEffect + investmentEffect + taxEffect + interestEffect;
  
  // Inércia do desemprego (muda lentamente)
  newUnemployment = currentUnemployment * 0.9 + newUnemployment * 0.1;
  
  // Limites realistas (3% a 35%)
  newUnemployment = Math.max(3, Math.min(35, newUnemployment));
  
  return newUnemployment;
}

/**
 * Calcula a popularidade dinâmica baseada nos indicadores
 * CORRIGE: Popularidade travada em 95%
 */
export function calculateDynamicPopularity(economy) {
  let currentPopularity = economy.popularity || 50;
  
  // Se popularidade estiver muito alta, aplicar realismo
  if (currentPopularity > 85) {
    currentPopularity = 55; // Resetar para valor mais realista
  }
  
  // Efeito do crescimento econômico
  const gdpGrowth = economy.gdpGrowth || 0;
  let growthEffect = 0;
  
  if (gdpGrowth > 0) {
    growthEffect = gdpGrowth * 3; // Crescimento aumenta popularidade
  } else if (gdpGrowth < 0) {
    growthEffect = gdpGrowth * 5; // Recessão reduz mais a popularidade
  }
  
  // Efeito da inflação
  const inflationPercent = (economy.inflation || 0.04) * 100;
  const idealInflation = 4;
  let inflationEffect = 0;
  
  const inflationDiff = inflationPercent - idealInflation;
  if (inflationDiff > 0) {
    // Inflação acima do ideal reduz popularidade
    inflationEffect = -inflationDiff * 2;
  } else if (inflationDiff < 0 && inflationPercent > 0) {
    // Inflação abaixo do ideal (mas positiva) pode aumentar popularidade
    inflationEffect = Math.abs(inflationDiff) * 0.5;
  } else if (inflationPercent <= 0) {
    // Deflação é muito ruim para popularidade
    inflationEffect = inflationPercent * 10;
  }
  
  // Efeito do desemprego (maior impacto)
  const unemploymentDiff = economy.unemployment - ECONOMIC_CONSTANTS.IDEAL_UNEMPLOYMENT;
  let unemploymentEffect = 0;
  
  if (unemploymentDiff > 0) {
    // Desemprego alto reduz popularidade drasticamente
    const penalty = 1 + Math.pow(unemploymentDiff / 10, 1.2);
    unemploymentEffect = -unemploymentDiff * 2 * penalty;
  } else if (unemploymentDiff < 0) {
    // Desemprego baixo aumenta popularidade
    unemploymentEffect = Math.abs(unemploymentDiff) * 1.5;
  }
  
  // Efeito dos impostos
  const taxDiff = economy.taxBurden - ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
  let taxEffect = 0;
  
  if (taxDiff > 0) {
    taxEffect = -taxDiff * 0.8; // Impostos altos reduzem popularidade
  } else if (taxDiff < 0) {
    taxEffect = Math.abs(taxDiff) * 0.4; // Impostos baixos aumentam popularidade
  }
  
  // Efeito do investimento público
  const investmentRef = 30;
  const investmentDiff = economy.publicServices - investmentRef;
  let investmentEffect = 0;
  
  if (investmentDiff > 0) {
    // Mais investimento público aumenta popularidade
    investmentEffect = investmentDiff * 0.3;
  } else if (investmentDiff < 0) {
    // Menos investimento reduz popularidade
    investmentEffect = investmentDiff * 0.5;
  }
  
  // Índice de miséria (desemprego alto + inflação alta)
  let miseryEffect = 0;
  if (economy.unemployment > 15 && inflationPercent > 8) {
    const miseryIndex = (economy.unemployment - 15) * (inflationPercent - 8);
    miseryEffect = -miseryIndex * 0.3;
  }
  
  // Variação aleatória pequena
  const randomVariation = (Math.random() - 0.5) * 1;
  
  // Aplicar todos os efeitos
  let newPopularity = currentPopularity + growthEffect + inflationEffect + unemploymentEffect + 
                     taxEffect + investmentEffect + miseryEffect + randomVariation;
  
  // Força de retorno ao equilíbrio (50%) - governos tendem ao centro
  const distanceFrom50 = Math.abs(newPopularity - 50);
  const returnForce = distanceFrom50 * 0.05;
  
  if (newPopularity > 50) {
    newPopularity -= returnForce;
  } else if (newPopularity < 50) {
    newPopularity += returnForce;
  }
  
  // Inércia da popularidade
  newPopularity = currentPopularity * 0.7 + newPopularity * 0.3;
  
  // Limites realistas (5% a 90%)
  newPopularity = Math.max(5, Math.min(90, newPopularity));
  
  return newPopularity;
}

/**
 * Calcula o crescimento econômico dinâmico
 */
export function calculateDynamicGrowth(economy) {
  const equilibriumInterest = ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
  const interestDiff = economy.interestRate - equilibriumInterest;
  
  // Efeito dos juros no crescimento
  let interestEffect = 0;
  if (economy.interestRate <= 12) {
    interestEffect = -interestDiff * 0.15; // Para cada 1% de juros acima de 8%, -0.15% crescimento
  } else {
    const normalEffect = -(4 * 0.15); // Até 12%
    const excessInterest = economy.interestRate - 12;
    const excessEffect = -Math.pow(excessInterest, 1.3) * 0.1;
    interestEffect = normalEffect + excessEffect;
  }
  
  // Efeito dos impostos no crescimento
  const taxDiff = economy.taxBurden - ECONOMIC_CONSTANTS.EQUILIBRIUM_TAX_RATE;
  const taxEffect = -taxDiff * 0.08; // Para cada 1% de imposto acima de 40%, -0.08% crescimento
  
  // Efeito do investimento público
  let investmentEffect = 0;
  if (economy.publicServices >= 30) {
    investmentEffect = economy.publicServices * 0.05;
  } else {
    const deficit = 30 - economy.publicServices;
    const penalty = 1 - Math.pow(deficit / 30, 1.2) * 0.6;
    investmentEffect = economy.publicServices * 0.05 * penalty;
  }
  
  // Efeito da dívida pública
  let debtEffect = 0;
  const debtToGDP = economy.publicDebt / economy.gdp;
  if (debtToGDP > 0.6) {
    debtEffect = -(debtToGDP - 0.6) * 2; // Dívida alta reduz crescimento
  }
  
  // Efeito do comércio
  const tradeBalance = Math.abs(economy.commoditiesBalance || 0) + Math.abs(economy.manufacturesBalance || 0);
  const tradeEffect = (tradeBalance / economy.gdp) * 0.1; // Comércio estimula crescimento
  
  // Crescimento base + efeitos
  const baseGrowth = 2.5; // 2.5% base anual
  const totalEffect = interestEffect + taxEffect + investmentEffect + debtEffect + tradeEffect;
  
  let newGrowth = baseGrowth + totalEffect;
  
  // Variação aleatória pequena
  const randomVariation = (Math.random() - 0.5) * 0.5;
  newGrowth += randomVariation;
  
  // Limites realistas (-8% a +12%)
  newGrowth = Math.max(-8, Math.min(12, newGrowth));
  
  return newGrowth;
}

/**
 * Processa pagamentos de dívida (CORRIGE: Dívida não sendo paga)
 */
export function processDeptPayments(economy, debtContracts) {
  if (!debtContracts || debtContracts.length === 0) return 0;
  
  let totalPayment = 0;
  let totalInterest = 0;
  let totalPrincipal = 0;
  
  // Calcular pagamentos mensais
  debtContracts.forEach(contract => {
    if (contract.remainingInstallments > 0) {
      const monthlyRate = contract.interestRate / 100 / 12;
      const interestPayment = contract.remainingValue * monthlyRate;
      const principalPayment = contract.monthlyPayment - interestPayment;
      
      totalInterest += interestPayment;
      totalPrincipal += principalPayment;
      totalPayment += contract.monthlyPayment;
      
      // Atualizar contrato
      contract.remainingValue -= principalPayment;
      contract.remainingInstallments--;
      
      if (contract.remainingValue < 0.01) {
        contract.remainingValue = 0;
        contract.remainingInstallments = 0;
      }
    }
  });
  
  // Deduzir pagamento do tesouro
  economy.treasury -= totalPayment;
  
  // Se tesouro insuficiente, emitir títulos de emergência
  if (economy.treasury < 0) {
    const shortfall = Math.abs(economy.treasury);
    economy.treasury = 0;
    
    // Emitir títulos para cobrir déficit (com juros mais altos)
    const emergencyAmount = shortfall * 1.2; // 20% a mais devido aos juros altos
    economy.treasury += emergencyAmount;
    economy.publicDebt += emergencyAmount;
  }
  
  // Atualizar dívida total
  const remainingDebt = debtContracts.reduce((sum, contract) => sum + contract.remainingValue, 0);
  economy.publicDebt = remainingDebt;
  
  return totalPayment;
}

/**
 * Função principal para aplicar todos os cálculos econômicos
 * Esta é a função chamada pelo EconomyService a cada ciclo
 */
export function applyEconomicCalculations(economy, debtContracts = []) {
  // 1. Calcular novo crescimento
  const newGrowth = calculateDynamicGrowth(economy);
  economy.gdpGrowth = newGrowth;
  
  // 2. Aplicar crescimento ao PIB (crescimento mensal = crescimento anual / 12)
  const monthlyGrowthRate = newGrowth / 100 / 12;
  economy.gdp *= (1 + monthlyGrowthRate);
  
  // 3. Calcular nova inflação
  economy.inflation = calculateDynamicInflation(economy);
  
  // 4. Calcular novo desemprego
  economy.unemployment = calculateDynamicUnemployment(economy);
  
  // 5. Calcular nova popularidade
  economy.popularity = calculateDynamicPopularity(economy);
  
  // 6. Processar pagamentos de dívida (simulação mensal)
  if (debtContracts.length > 0) {
    // Simular pagamento mensal (a cada 30 ciclos seria um mês, mas fazemos proporcionalmente)
    const monthlyPaymentRate = 1 / 60; // Aproximadamente 2 ciclos por segundo * 30 = 60 ciclos por mês
    
    // Processar uma fração do pagamento mensal a cada ciclo
    let totalMonthlyPayment = 0;
    debtContracts.forEach(contract => {
      if (contract.remainingInstallments > 0) {
        const fractionalPayment = contract.monthlyPayment * monthlyPaymentRate;
        const monthlyRate = contract.interestRate / 100 / 12;
        const interestPayment = contract.remainingValue * monthlyRate * monthlyPaymentRate;
        const principalPayment = fractionalPayment - interestPayment;
        
        totalMonthlyPayment += fractionalPayment;
        
        // Atualizar contrato gradualmente
        contract.remainingValue -= principalPayment;
        if (contract.remainingValue < 0.01) {
          contract.remainingValue = 0;
          contract.remainingInstallments = 0;
        }
      }
    });
    
    // Deduzir pagamento do tesouro
    economy.treasury -= totalMonthlyPayment;
    
    // Se tesouro insuficiente, emitir títulos de emergência
    if (economy.treasury < 0) {
      const shortfall = Math.abs(economy.treasury);
      economy.treasury = 0;
      
      // Emitir títulos para cobrir déficit
      const emergencyAmount = shortfall * 1.1; // 10% a mais devido aos juros de emergência
      economy.treasury += emergencyAmount;
      economy.publicDebt += emergencyAmount;
    }
    
    // Atualizar dívida total
    const remainingDebt = debtContracts.reduce((sum, contract) => sum + contract.remainingValue, 0);
    economy.publicDebt = remainingDebt;
  }
  
  // 7. Atualizar receitas/gastos do tesouro (proporcionalmente)
  const cycleFactor = 1 / 60; // Aproximação de ciclo mensal
  const revenue = economy.gdp * (economy.taxBurden / 100) * 0.01 * cycleFactor;
  const expenses = economy.gdp * (economy.publicServices / 100) * 0.008 * cycleFactor;
  economy.treasury += revenue - expenses;
  
  // Garantir que tesouro não fique muito negativo
  if (economy.treasury < -economy.gdp * 0.1) {
    economy.treasury = -economy.gdp * 0.1; // Limite de déficit
  }
  
  // 8. Aplicar efeitos da inflação no PIB
  const inflationEffect = economy.inflation;
  if (inflationEffect > 0.1) { // Inflação acima de 10%
    const excess = inflationEffect - 0.1;
    const penaltyFactor = 1 - (excess * 0.01 * cycleFactor);
    economy.gdp *= Math.max(0.999, penaltyFactor);
  }
  
  return economy;
}

/**
 * Função utilitária para limitar valores com tendência de retorno
 */
export function limitWithCurve(value, min, max, target) {
  if (value < min) value = min;
  if (value > max) value = max;
  
  const distanceFromTarget = Math.abs(value - target);
  
  if (value > target) {
    const correctionFactor = 1 - Math.min(0.2, distanceFromTarget * 0.01);
    return value * correctionFactor + target * (1 - correctionFactor);
  } else if (value < target) {
    const correctionFactor = 1 - Math.min(0.2, distanceFromTarget * 0.01);
    return value * correctionFactor + target * (1 - correctionFactor);
  }
  
  return value;
}

/**
 * Calcula média móvel para históricos
 */
export function calculateMovingAverage(history) {
  if (history.length === 0) return 0;
  return history.reduce((a, b) => a + b, 0) / history.length;
}

/**
 * Função para resetar indicadores irreais (chamada na inicialização)
 */
export function resetUnrealisticIndicators(economy) {
  // Inflação travada em 0
  if (economy.inflation === 0 || economy.inflation === undefined) {
    economy.inflation = 0.04; // 4% inicial
  }
  
  // Desemprego muito baixo
  if (economy.unemployment < 5 || economy.unemployment === undefined) {
    economy.unemployment = 12.5; // Valor mais realista
  }
  
  // Popularidade muito alta
  if (economy.popularity > 85 || economy.popularity === undefined) {
    economy.popularity = 50; // Começar neutro
  }
  
  // Crescimento indefinido
  if (economy.gdpGrowth === undefined) {
    economy.gdpGrowth = 2.5; // 2.5% crescimento inicial
  }
  
  // Históricos vazios
  if (!economy.historicoPIB || economy.historicoPIB.length === 0) {
    economy.historicoPIB = [economy.gdp || 100];
  }
  
  if (!economy.historicoInflacao || economy.historicoInflacao.length === 0) {
    economy.historicoInflacao = [economy.inflation];
  }
  
  if (!economy.historicoPopularidade || economy.historicoPopularidade.length === 0) {
    economy.historicoPopularidade = [economy.popularity];
  }
  
  if (!economy.historicoDesemprego || economy.historicoDesemprego.length === 0) {
    economy.historicoDesemprego = [economy.unemployment];
  }
  
  return economy;
}

/**
 * Função de debug para mostrar status dos cálculos
 */
export function debugEconomicCalculations(countryName, economy) {
  console.log(`[ECON-CALC] ${countryName} Status:`, {
    gdp: economy.gdp.toFixed(2),
    growth: `${(economy.gdpGrowth || 0).toFixed(2)}%`,
    inflation: `${(economy.inflation * 100).toFixed(2)}%`,
    unemployment: `${economy.unemployment.toFixed(1)}%`,
    popularity: `${economy.popularity.toFixed(1)}%`,
    treasury: economy.treasury.toFixed(2),
    debt: economy.publicDebt.toFixed(2),
    debtRatio: `${((economy.publicDebt / economy.gdp) * 100).toFixed(1)}%`,
    rating: economy.creditRating,
    interestRate: `${economy.interestRate}%`,
    taxBurden: `${economy.taxBurden}%`,
    publicServices: `${economy.publicServices}%`
  });
}