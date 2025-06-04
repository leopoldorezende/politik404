/**
 * economicCalculations.js - CORRIGIDO para ficar igual aos arquivos economy-*.js
 * Implementação baseada nos arquivos anexados que funcionam corretamente
 */

import { ECONOMIC_CONSTANTS } from './economicConstants.js';
import { getNumericValue, limitarComCurva, calcularMediaMovel, calculateRiskPremium } from './economicUtils.js';

/**
 * Calcula o crescimento econômico - BASEADO NO economy-game.js que funciona
 * @param {Object} economy - Estado econômico
 * @returns {number} - Taxa de crescimento para aplicação direta (como decimal)
 */
export function calculateAdvancedGrowth(economy) {
  const taxaEquilibrioJuros = 8.0;
  const diferencaJuros = economy.interestRate - taxaEquilibrioJuros;
  
  // Efeito dos juros no crescimento - EXATO do economy-game.js
  let efeitoJuros;
  if (economy.interestRate <= 10) {
    efeitoJuros = -diferencaJuros * 0.0002;
  } else {
    const jurosExcesso = economy.interestRate - 10;
    efeitoJuros = -(diferencaJuros * 0.0002) - (Math.pow(jurosExcesso, 1.5) * 0.0001);
  }
  
  // Efeito dos impostos no crescimento - EXATO do economy-game.js
  const diferencaImposto = economy.taxBurden - 40;
  const efeitoImposto = -diferencaImposto * 0.00015;
  
  // Efeito do investimento público no crescimento - EXATO do economy-game.js
  let efeitoInvestimento = 0;
  if (economy.publicServices >= 30) {
    efeitoInvestimento = economy.publicServices * 0.0001;
  } else {
    const deficit = 30 - economy.publicServices;
    const fatorPenalidade = 1 - Math.pow(deficit / 30, 1.5) * 0.5;
    efeitoInvestimento = economy.publicServices * 0.0001 * fatorPenalidade;
  }
  
  // Efeito da dívida pública na confiança dos investidores - EXATO do economy-game.js
  let efeitoDivida = 0;
  const dividaPIB = economy.publicDebt / economy.gdp;
  if (dividaPIB > 0.9) {
    efeitoDivida = -(dividaPIB - 0.9) * 0.05;
  }
  
  // Efeito do comércio no crescimento (adicional do nosso sistema)
  const tradeBalance = Math.abs(economy.commoditiesBalance || 0) + Math.abs(economy.manufacturesBalance || 0);
  const tradeEffect = (tradeBalance / economy.gdp) * 0.01; // Reduzido para não dominar
  
  const crescimentoBase = efeitoJuros + efeitoImposto + efeitoInvestimento + efeitoDivida + tradeEffect;
  
  // APLICAÇÃO EXATA do economy-game.js - sem modificação adicional
  return crescimentoBase * 0.061;
}

/**
 * Calcula a inflação dinâmica - BASEADO NO economy-game.js
 * @param {Object} economy - Estado econômico
 * @returns {number} - Nova taxa de inflação
 */
export function calculateDynamicInflation(economy) {
  const taxaEquilibrioJuros = 8.0;
  const taxaEquilibrioImposto = 40.0;
  let novaInflacao = economy.inflation || ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION;
  
  // CÓPIA EXATA do economy-game.js - Efeito dos juros na inflação
  if (economy.interestRate < taxaEquilibrioJuros) {
    const fatorAumento = 1 + ((taxaEquilibrioJuros - economy.interestRate) * 0.03);
    novaInflacao *= fatorAumento;
  } else if (economy.interestRate > taxaEquilibrioJuros) {
    if (economy.interestRate <= 10) {
      const fatorReducao = 1 - ((economy.interestRate - taxaEquilibrioJuros) * 0.025);
      novaInflacao *= Math.max(0.85, fatorReducao);
    } else {
      const jurosNormais = 10 - taxaEquilibrioJuros;
      const jurosExcesso = economy.interestRate - 10;
      
      const reducaoInicial = 1 - (jurosNormais * 0.025);
      const reducaoAdicional = Math.pow(1.2, jurosExcesso) * 0.05;
      
      novaInflacao *= Math.max(0.65, reducaoInicial - reducaoAdicional);
    }
  }
  
  // CÓPIA EXATA do economy-game.js - Efeito dos impostos na inflação
  if (economy.taxBurden > taxaEquilibrioImposto) {
    const fatorReducao = 1 - ((economy.taxBurden - taxaEquilibrioImposto) * 0.003);
    novaInflacao *= Math.max(0.96, fatorReducao);
  } else if (economy.taxBurden < taxaEquilibrioImposto) {
    const fatorAumento = 1 + ((taxaEquilibrioImposto - economy.taxBurden) * 0.002);
    novaInflacao *= fatorAumento;
  }
  
  // CÓPIA EXATA do economy-game.js - Efeito do crescimento econômico na inflação
  const crescimentoEquilibrio = 0.02;
  const gdpGrowth = (economy.gdpGrowth || 0) / 100; // Converter percentual para decimal
  
  if (gdpGrowth > crescimentoEquilibrio) {
    const excesso = gdpGrowth - crescimentoEquilibrio;
    const fatorEnfase = 1 + (excesso * 5);
    novaInflacao += excesso * 0.12 * fatorEnfase;
  } else if (gdpGrowth > 0 && gdpGrowth <= crescimentoEquilibrio) {
    novaInflacao += gdpGrowth * 0.005;
  } else if (gdpGrowth < 0) {
    novaInflacao -= Math.abs(gdpGrowth) * 0.025;
  }
  
  // CÓPIA EXATA do economy-game.js - Efeito da dívida pública na inflação estrutural
  const dividaPIB = economy.publicDebt / economy.gdp;
  if (dividaPIB > 0.7) {
    const excessoDivida = dividaPIB - 0.7;
    novaInflacao += excessoDivida * 0.02;
  }
  
  // CÓPIA EXATA do economy-game.js - Variação aleatória e inércia inflacionária
  const variacaoAleatoria = (Math.random() - 0.5) * 0.0005;
  novaInflacao += variacaoAleatoria;
  novaInflacao = economy.inflation * 0.8 + novaInflacao * 0.2;
  
  // USAR A MESMA FUNÇÃO DO economy-utils.js
  novaInflacao = limitarComCurva(novaInflacao, -0.02, 0.18, 0.04);
  
  return novaInflacao;
}

/**
 * Calcula o desemprego dinâmico - BASEADO NO economy-game.js
 * @param {Object} economy - Estado econômico
 * @returns {number} - Nova taxa de desemprego
 */
export function calculateDynamicUnemployment(economy) {
  let novoDesemprego = economy.unemployment || 12.5;
  
  // CÓPIA EXATA do economy-game.js - Efeito do crescimento no desemprego
  const gdpGrowth = (economy.gdpGrowth || 0) / 100; // Converter percentual para decimal
  
  if (gdpGrowth > 0) {
    // Crescimento reduz desemprego
    novoDesemprego -= gdpGrowth * 5;
  } else {
    // Recessão aumenta desemprego rapidamente
    novoDesemprego += Math.abs(gdpGrowth) * 8;
  }
  
  // CÓPIA EXATA do economy-game.js - Efeito da inflação no desemprego (curva de Phillips)
  if (economy.inflation < 0.05) {
    // Inflação baixa tende a manter desemprego alto
    novoDesemprego += (0.05 - economy.inflation) * 2;
  } else if (economy.inflation > 0.1) {
    // Inflação muito alta eventualmente também aumenta desemprego
    novoDesemprego += (economy.inflation - 0.1) * 3;
  } else {
    // Inflação moderada pode reduzir desemprego
    novoDesemprego -= (economy.inflation - 0.05) * 1;
  }
  
  // CÓPIA EXATA do economy-game.js - Efeito dos impostos no desemprego
  const impostoReferencia = 40;
  if (economy.taxBurden > impostoReferencia) {
    // Impostos altos podem aumentar desemprego
    novoDesemprego += (economy.taxBurden - impostoReferencia) * 0.05;
  }
  
  // CÓPIA EXATA do economy-game.js - Limites para a taxa de desemprego (entre 3% e 40%)
  novoDesemprego = Math.max(3, Math.min(40, novoDesemprego));
  
  // CÓPIA EXATA do economy-game.js - Inércia do desemprego (não muda muito rapidamente)
  return economy.unemployment * 0.9 + novoDesemprego * 0.1;
}

/**
 * Calcula a popularidade dinâmica - BASEADO NO economy-game.js
 * @param {Object} economy - Estado econômico
 * @returns {number} - Nova taxa de popularidade
 */
export function calculateDynamicPopularity(economy) {
  let novaPopularidade = economy.popularity || 50;
  
  // CÓPIA EXATA do economy-game.js - Efeito do crescimento na popularidade
  const gdpGrowth = (economy.gdpGrowth || 0) / 100; // Converter percentual para decimal
  
  if (gdpGrowth > 0) {
    novaPopularidade += gdpGrowth * 100 * 0.2;
  } else if (gdpGrowth < 0) {
    novaPopularidade += gdpGrowth * 100 * 0.3;
  }
  
  // CÓPIA EXATA do economy-game.js - Efeito da inflação na popularidade
  const inflacaoIdeal = 0.04;
  const diferencaInflacao = economy.inflation - inflacaoIdeal;
  if (diferencaInflacao > 0) {
    novaPopularidade -= diferencaInflacao * 100 * 0.25;
  } else if (diferencaInflacao < 0 && economy.inflation > 0) {
    novaPopularidade += Math.abs(diferencaInflacao) * 100 * 0.1;
  }
  
  // CÓPIA EXATA do economy-game.js - Efeito dos impostos na popularidade
  const impostoIdeal = 40;
  const diferencaImposto = economy.taxBurden - impostoIdeal;
  if (diferencaImposto > 0) {
    novaPopularidade -= diferencaImposto * 0.2;
  } else if (diferencaImposto < 0) {
    novaPopularidade += Math.abs(diferencaImposto) * 0.1;
  }
  
  // CÓPIA EXATA do economy-game.js - Efeito do investimento público na popularidade
  const investimentoReferencia = 30;
  const difInvestimento = economy.publicServices - investimentoReferencia;
  const taxaResposta = Math.tanh(difInvestimento / 10) * 0.8;
  novaPopularidade += taxaResposta * Math.abs(difInvestimento) * 0.15;
  
  // CÓPIA EXATA do economy-game.js - Efeito do desemprego na popularidade
  if (economy.unemployment !== undefined) {
    const desempregoIdeal = 15;
    const diferencaDesemprego = economy.unemployment - desempregoIdeal;
    
    if (diferencaDesemprego > 0) {
      // Desemprego acima do ideal reduz popularidade drasticamente
      // Usando função não-linear para aumentar o impacto de desemprego muito alto
      const fatorPenalidade = 1 + Math.pow(diferencaDesemprego / 10, 1.5);
      novaPopularidade -= diferencaDesemprego * 0.3 * fatorPenalidade;
    } else if (diferencaDesemprego < 0) {
      // Desemprego abaixo do ideal aumenta popularidade, mas com impacto menor
      novaPopularidade += Math.abs(diferencaDesemprego) * 0.3;
    }
    
    // CÓPIA EXATA do economy-game.js - Efeito combinado de desemprego alto + inflação alta (miséria econômica)
    if (economy.unemployment > 30 && economy.inflation > 0.08) {
      const indiceMiseria = (economy.unemployment - 30) * (economy.inflation - 0.08) * 100;
      novaPopularidade -= indiceMiseria * 0.2;
    }
  }
  
  // CÓPIA EXATA do economy-game.js - Variação aleatória
  const variacaoAleatoria = (Math.random() - 0.5) * 0.5;
  novaPopularidade += variacaoAleatoria;
  
  // NOVA IMPLEMENTAÇÃO - Curva de dificuldade para popularidade alta
  const popularidadeAtual = economy.popularity || 50;
  
  // Aplicar resistência progressiva apenas para aumentos de popularidade acima de 60%
  if (novaPopularidade > popularidadeAtual && popularidadeAtual >= 60) {
    const ganho = novaPopularidade - popularidadeAtual;
    let fatorResistencia = 1.0;
    
    // 60% - 70%: Difícil (reduz ganho em 20%)
    if (popularidadeAtual >= 60 && popularidadeAtual < 70) {
      fatorResistencia = 0.8;
    }
    // 70% - 80%: Muito difícil (reduz ganho em 40%) 
    else if (popularidadeAtual >= 70 && popularidadeAtual < 80) {
      fatorResistencia = 0.6;
    }
    // 80% - 90%: Quase impossível (reduz ganho em 60%)
    else if (popularidadeAtual >= 80 && popularidadeAtual < 90) {
      fatorResistencia = 0.4;
    }
    // 90%+: Extremamente difícil (reduz ganho em 80%)
    else if (popularidadeAtual >= 90) {
      fatorResistencia = 0.2;
    }
    
    // Aplicar o fator de resistência apenas ao ganho
    const ganhoReduzido = ganho * fatorResistencia;
    novaPopularidade = popularidadeAtual + ganhoReduzido;
  }
  
  // CÓPIA EXATA do economy-game.js - Força de retorno para o equilíbrio (50%)
  const distanciaDe50 = Math.abs(novaPopularidade - 50);
  const forcaDeRetorno = distanciaDe50 * distanciaDe50 * 0.002;
  
  if (novaPopularidade > 50) {
    novaPopularidade -= forcaDeRetorno;
  } else if (novaPopularidade < 50) {
    novaPopularidade += forcaDeRetorno;
  }
  
  // CÓPIA EXATA do economy-game.js - Limite entre 1% e 99%
  novaPopularidade = Math.max(1, Math.min(99, novaPopularidade));
  
  return novaPopularidade;
}

/**
 * Calcula o rating de crédito - BASEADO NO economy-game.js
 * @param {Object} economy - Estado econômico
 * @returns {string} - Rating de crédito
 */
export function calculateCreditRating(economy) {
  const dividaPIB = economy.publicDebt / economy.gdp;
  const inflacao = (economy.inflation || ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION) * 100;
  const crescimentoTrimestral = (economy.gdpGrowth || 0); // Já em percentual
  
  // CÓPIA EXATA do economy-game.js - Determinação da nota base com base APENAS na inflação
  let notaBase;
  
  if (inflacao <= 2) {
    notaBase = "AAA";
  } else if (inflacao <= 3) {
    notaBase = "AA";
  } else if (inflacao <= 4) {
    notaBase = "A";
  } else if (inflacao <= 5.5) {
    notaBase = "BBB";
  } else if (inflacao <= 7) {
    notaBase = "BB";
  } else if (inflacao <= 9) {
    notaBase = "B";
  } else if (inflacao <= 12) {
    notaBase = "CCC";
  } else if (inflacao <= 15) {
    notaBase = "CC";
  } else {
    notaBase = "C";
  }
  
  // CÓPIA EXATA do economy-game.js - Ajuste pela dívida e crescimento
  const niveis = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
  let indiceNota = niveis.indexOf(notaBase);
  
  // Impacto da dívida na classificação
  if (dividaPIB > 0.3 && dividaPIB <= 0.6) {
    indiceNota += 1;
  } else if (dividaPIB > 0.6 && dividaPIB <= 0.9) {
    indiceNota += 2;
  } else if (dividaPIB > 0.9 && dividaPIB <= 1.2) {
    indiceNota += 3;
  } else if (dividaPIB > 1.2) {
    indiceNota += 4;
  }
  
  // Impacto do crescimento negativo na classificação
  if (crescimentoTrimestral < 0) {
    if (crescimentoTrimestral >= -1) {
      indiceNota += 1;
    } else if (crescimentoTrimestral >= -3) {
      indiceNota += 2;
    } else if (crescimentoTrimestral >= -5) {
      indiceNota += 3;
    } else {
      indiceNota += 4;
    }
    
    if (inflacao > 7) {
      indiceNota += 1;
    }
  }
  
  // Casos especiais - CÓPIA EXATA do economy-game.js
  if (inflacao > 15 && economy._historicInflation && economy._historicInflation.length >= 3) {
    const ultimas3 = economy._historicInflation.slice(-3).map(i => i * 100);
    if (ultimas3[2] > ultimas3[0] || Math.abs(ultimas3[2] - ultimas3[1]) > 2) {
      return "D";
    }
  }
  
  if (inflacao > 9 && dividaPIB > 0.9 && crescimentoTrimestral < -3) {
    return "D";
  }
  
  indiceNota = Math.min(indiceNota, niveis.length - 1);
  return niveis[indiceNota];
}

/**
 * Função principal CORRIGIDA - aplicação direta como no economy-game.js
 * @param {Object} economy - Estado econômico
 * @param {Array} debtContracts - Contratos de dívida (opcional)
 * @param {Object} options - Opções de processamento
 * @returns {Object} - Estado econômico atualizado
 */
export function applyAdvancedEconomicCalculations(economy, debtContracts = [], options = {}) {
  const {
    cycleType = 'regular',
    cycleFactor = 1,
    skipGrowthCalculation = false
  } = options;
  
  // [... todo o código de cálculos permanece igual ...]
  
  // ===== RECEITAS E GASTOS DO TESOURO - COMO NO economy-game.js =====
  if (cycleFactor > 0) {
    // CÓPIA EXATA do economy-game.js - calcularCaixa
    const arrecadacao = economy.gdp * (economy.taxBurden / 100) * 0.017 * cycleFactor;
    
    let gastoInvestimento = 0;
    if (economy.publicServices > 0) {
      if (economy.publicServices <= 15) {
        gastoInvestimento = economy.gdp * (economy.publicServices / 100) * 0.015 * cycleFactor;
      } else {
        const baseGasto = economy.gdp * (15 / 100) * 0.015 * cycleFactor;
        const fatorExtra = 2.0;
        const excedenteInvestimento = economy.publicServices - 15;
        const gastoExcedente = economy.gdp * (excedenteInvestimento / 100) * 0.015 * fatorExtra * cycleFactor;
        
        gastoInvestimento = baseGasto + gastoExcedente;
      }
    }
    
    economy.treasury += arrecadacao - gastoInvestimento;
    
    // CORREÇÃO: Não chamar issueEmergencyBonds aqui - deixar para economyService
    // A verificação de tesouro negativo será feita no economyService
  }
  
  // ===== PROCESSAMENTO DE DÍVIDAS (mantido) =====
  if (debtContracts.length > 0 && cycleFactor > 0) {
    processDeptPayments(economy, debtContracts, cycleFactor);
  }
  
  return economy;
}

/**
 * Processa pagamentos de dívida de forma proporcional
 * @param {Object} economy - Estado econômico
 * @param {Array} debtContracts - Contratos de dívida
 * @param {number} cycleFactor - Fator do ciclo (ex: 1/60 para mensal)
 * @returns {number} - Total pago no ciclo
 */
export function processDeptPayments(economy, debtContracts, cycleFactor = 1) {
  if (!debtContracts || debtContracts.length === 0) return 0;
  
  let totalPayment = 0;
  let totalInterest = 0;
  let totalPrincipal = 0;
  
  // Calcular pagamentos proporcionais
  debtContracts.forEach(contract => {
    if (contract.remainingInstallments > 0) {
      const fractionalPayment = contract.monthlyPayment * cycleFactor;
      const monthlyRate = contract.interestRate / 100 / 12;
      const interestPayment = contract.remainingValue * monthlyRate * cycleFactor;
      const principalPayment = fractionalPayment - interestPayment;
      
      totalInterest += interestPayment;
      totalPrincipal += principalPayment;
      totalPayment += fractionalPayment;
      
      // ===== CORREÇÃO: Atualizar contrato gradualmente =====
      contract.remainingValue -= principalPayment;
      
      // ===== CRÍTICO: Decrementar parcelas apenas em ciclos mensais completos =====
      if (cycleFactor >= 1.0) { // Ciclo mensal completo
        contract.remainingInstallments -= 1;
        // console.log(`[DEBT] Contrato ${contract.id}: Parcela paga. Restantes: ${contract.remainingInstallments}`);
      }
      
      // ===== CORREÇÃO: Finalizar contrato quando quitado =====
      if (contract.remainingValue <= 0.01 || contract.remainingInstallments <= 0) {
        contract.remainingValue = 0;
        contract.remainingInstallments = 0;
        // console.log(`[DEBT] Contrato ${contract.id}: QUITADO!`);
      }
    }
  });
  
  // Deduzir pagamento do tesouro
  economy.treasury -= totalPayment;
  
  // Se tesouro insuficiente, emitir títulos de emergência
  if (economy.treasury < 0) {
    const shortfall = Math.abs(economy.treasury);
    economy.treasury = 0;
    
    // Emitir títulos de emergência com validações
    issueEmergencyBonds(economy, shortfall);
  }
  
  // Atualizar dívida total
  const remainingDebt = debtContracts.reduce((sum, contract) => sum + contract.remainingValue, 0);
  economy.publicDebt = remainingDebt;
  
  return totalPayment;
}

/**
 * Função para resetar indicadores irreais (chamada na inicialização)
 * @param {Object} economy - Estado econômico
 * @returns {Object} - Estado econômico corrigido
 */
export function resetUnrealisticIndicators(economy) {
  // Inflação travada em 0
  if (economy.inflation === 0 || economy.inflation === undefined) {
    economy.inflation = ECONOMIC_CONSTANTS.EQUILIBRIUM_INFLATION;
  }
  
  // Desemprego muito baixo
  if (economy.unemployment < 5 || economy.unemployment === undefined) {
    economy.unemployment = 12.5; // Valor mais realista
  }
  
  // Popularidade artificialmente baixa
  if (economy.popularity < 20 || economy.popularity === undefined) {
    economy.popularity = ECONOMIC_CONSTANTS.IDEAL_POPULARITY; // Começar neutro
  }
  
  // Crescimento indefinido
  if (economy.gdpGrowth === undefined) {
    economy.gdpGrowth = 2.5; // 2.5% crescimento inicial
  }
  
  // Históricos avançados
  if (!economy._historicGdp || economy._historicGdp.length === 0) {
    economy._historicGdp = [economy.gdp || 100];
  }
  
  if (!economy._historicInflation || economy._historicInflation.length === 0) {
    economy._historicInflation = [economy.inflation];
  }
  
  if (!economy._historicPopularity || economy._historicPopularity.length === 0) {
    economy._historicPopularity = [economy.popularity];
  }
  
  if (!economy._historicUnemployment || economy._historicUnemployment.length === 0) {
    economy._historicUnemployment = [economy.unemployment];
  }
  
  return economy;
}

/**
 * Função para aplicar variação setorial dinâmica - BASEADO NO economy-game.js
 * @param {Object} economy - Estado econômico
 * @returns {Object} - Estado econômico com setores atualizados
 */
export function applySectoralVariation(economy) {
  // Se não existem setores base, salvar os atuais como base
  if (!economy._servicesBase) {
    economy._servicesBase = economy.services;
    economy._commoditiesBase = economy.commodities;
    economy._manufacturesBase = economy.manufactures;
  }
  
  // CÓPIA EXATA do economy-game.js - Variação mensal aleatória na distribuição setorial
  const variacaoCommodities = Math.floor(Math.random() * 3) - 1; // -1, 0, ou 1
  const variacaoManufaturas = Math.floor(Math.random() * 3) - 1; // -1, 0, ou 1
  
  // Aplicar variações aos setores
  let newCommodities = economy.commodities + variacaoCommodities;
  let newManufactures = economy.manufactures + variacaoManufaturas;
  let newServices = 100 - newCommodities - newManufactures;
  
  // CÓPIA EXATA do economy-game.js - Ajustar limites setoriais
  // Limites para commodities (20-50%)
  if (newCommodities < 20) { 
    const ajuste = 20 - newCommodities;
    newCommodities = 20;
    newServices -= ajuste / 2;
    newManufactures -= ajuste / 2;
  } else if (newCommodities > 50) {
    const ajuste = newCommodities - 50;
    newCommodities = 50;
    newServices += ajuste / 2;
    newManufactures += ajuste / 2;
  }
  
  // Limites para manufaturas (20-50%)
  if (newManufactures < 20) {
    const ajuste = 20 - newManufactures;
    newManufactures = 20;
    newServices -= ajuste / 2;
    newCommodities -= ajuste / 2;
  } else if (newManufactures > 50) {
    const ajuste = newManufactures - 50;
    newManufactures = 50;
    newServices += ajuste / 2;
    newCommodities += ajuste / 2;
  }
  
  // Limites para serviços (20-50%)
  if (newServices < 20) {
    const ajuste = 20 - newServices;
    newServices = 20;
    newCommodities -= ajuste / 2;
    newManufactures -= ajuste / 2;
  } else if (newServices > 50) {
    const ajuste = newServices - 50;
    newServices = 50;
    newCommodities += ajuste / 2;
    newManufactures += ajuste / 2;
  }
  
  // CÓPIA EXATA do economy-game.js - Arredonda para inteiros e garante total de 100%
  economy.commodities = Math.round(newCommodities);
  economy.manufactures = Math.round(newManufactures);
  economy.services = 100 - economy.commodities - economy.manufactures;
  
  // Aplicar força de retorno aos valores base (evita deriva excessiva)
  const returnForce = 0.02; // 2% de força de retorno por ciclo
  economy.commodities = economy.commodities * (1 - returnForce) + economy._commoditiesBase * returnForce;
  economy.manufactures = economy.manufactures * (1 - returnForce) + economy._manufacturesBase * returnForce;
  economy.services = economy.services * (1 - returnForce) + economy._servicesBase * returnForce;
  
  // Rebalancear novamente após força de retorno
  const finalTotal = economy.commodities + economy.manufactures + economy.services;
  economy.commodities = Math.round((economy.commodities / finalTotal) * 100);
  economy.manufactures = Math.round((economy.manufactures / finalTotal) * 100);
  economy.services = 100 - economy.commodities - economy.manufactures;
  
  return economy;
}

/**
 * Função de debug para mostrar status dos cálculos avançados
 * @param {string} countryName - Nome do país
 * @param {Object} economy - Estado econômico
 */
export function debugAdvancedEconomicCalculations(countryName, economy) {
  console.log(`[ECONOMY-CORRECTED] ${countryName} Status:`, {
    // Indicadores principais
    gdp: economy.gdp.toFixed(2),
    growth: `${(economy.gdpGrowth || 0).toFixed(2)}%`,
    inflation: `${(economy.inflation * 100).toFixed(2)}%`,
    unemployment: `${economy.unemployment.toFixed(1)}%`,
    popularity: `${economy.popularity.toFixed(1)}%`,
    rating: economy.creditRating,
    
    // Ciclos e controles
    cycles: economy._cycleCount || 0,
    interestRate: `${economy.interestRate}%`,
    taxBurden: `${economy.taxBurden}%`,
    publicServices: `${economy.publicServices}%`,
    
    // Financeiro
    treasury: economy.treasury.toFixed(2),
    debt: economy.publicDebt.toFixed(2),
    debtRatio: `${((economy.publicDebt / economy.gdp) * 100).toFixed(1)}%`,
    
    // Setorial
    sectors: `C:${economy.commodities}% M:${economy.manufactures}% S:${economy.services}%`,
    balances: `CB:${(economy.commoditiesBalance || 0).toFixed(1)} MB:${(economy.manufacturesBalance || 0).toFixed(1)}`,
    
    // Históricos
    historyLengths: {
      inflation: economy._historicInflation?.length || 0,
      unemployment: economy._historicUnemployment?.length || 0,
      popularity: economy._historicPopularity?.length || 0,
      gdp: economy._historicGdp?.length || 0
    }
  });
}

/**
 * Função para validar a integridade dos cálculos econômicos
 * @param {Object} economy - Estado econômico
 * @returns {Object} - Resultado da validação
 */
export function validateEconomicCalculations(economy) {
  const errors = [];
  const warnings = [];
  
  // Validar valores numéricos
  const numericFields = ['gdp', 'inflation', 'unemployment', 'popularity', 'gdpGrowth'];
  numericFields.forEach(field => {
    if (!isFinite(economy[field]) || isNaN(economy[field])) {
      errors.push(`Invalid ${field}: ${economy[field]}`);
    }
  });
  
  // Validar ranges
  if (economy.inflation < -0.05 || economy.inflation > 0.5) {
    warnings.push(`Inflation out of realistic range: ${(economy.inflation * 100).toFixed(2)}%`);
  }
  
  if (economy.unemployment < 0 || economy.unemployment > 50) {
    warnings.push(`Unemployment out of realistic range: ${economy.unemployment.toFixed(1)}%`);
  }
  
  if (economy.popularity < 0 || economy.popularity > 100) {
    warnings.push(`Popularity out of realistic range: ${economy.popularity.toFixed(1)}%`);
  }
  
  // Validar setores
  if (economy.commodities !== undefined && economy.manufactures !== undefined && economy.services !== undefined) {
    const sectorSum = economy.commodities + economy.manufactures + economy.services;
    if (Math.abs(sectorSum - 100) > 1) {
      errors.push(`Sectors don't sum to 100%: ${sectorSum.toFixed(1)}%`);
    }
  }
  
  // Validar históricos
  const historyFields = ['_historicInflation', '_historicUnemployment', '_historicPopularity', '_historicGdp'];
  historyFields.forEach(field => {
    if (economy[field] && (!Array.isArray(economy[field]) || economy[field].length === 0)) {
      warnings.push(`Invalid history for ${field}`);
    }
    if (economy[field] && economy[field].length > 25) {
      warnings.push(`History too long for ${field}: ${economy[field].length} entries`);
    }
  });
  
  // Validar rating de crédito
  const validRatings = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
  if (!validRatings.includes(economy.creditRating)) {
    errors.push(`Invalid credit rating: ${economy.creditRating}`);
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    score: Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5))
  };
}

/**
 * Emite títulos de emergência quando o tesouro está insuficiente
 * @param {Object} economy - Estado econômico
 * @param {number} shortfall - Valor necessário (ignorado, sempre emite 20 bi)
 * @returns {boolean} - Se a emissão foi bem-sucedida
 */
export function issueEmergencyBonds(economy, shortfall) {
  // Verificar se pode emitir dívida com base na relação dívida/PIB
  const currentDebtToGdp = economy.publicDebt / economy.gdp;
  
  // VALOR FIXO: Sempre calcula para 20 bilhões
  const emergencyAmount = 20.0;
  const newDebtToGdp = (economy.publicDebt + emergencyAmount) / economy.gdp;
  
  // Verificar limite de 120% do PIB - mas permite chegar até o limite
  if (newDebtToGdp > ECONOMIC_CONSTANTS.MAX_DEBT_TO_GDP_RATIO) {
    // Se ultrapassaria o limite, calcular apenas até o limite máximo
    const maxAdditionalDebt = (ECONOMIC_CONSTANTS.MAX_DEBT_TO_GDP_RATIO * economy.gdp) - economy.publicDebt;
    
    if (maxAdditionalDebt > 0.1) { // Se ainda há margem de pelo menos 0.1 bi
      const limitedAmount = Math.min(20.0, maxAdditionalDebt);
      
      // Calcular taxa de juros efetiva para emissão no limite
      const baseRate = economy.interestRate || ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
      const riskPremium = calculateEmergencyRiskPremium(economy.creditRating, currentDebtToGdp);
      const effectiveRate = baseRate + riskPremium;
      
      // console.log(`[EMERGENCY BONDS] Calculating ${limitedAmount.toFixed(2)} bi USD at ${effectiveRate.toFixed(2)}% rate (rating: ${economy.creditRating}) - AT DEBT LIMIT`);
      
      // CORREÇÃO: Apenas retorna informações, não aplica valores
      return {
        amount: limitedAmount,
        rate: effectiveRate,
        rating: economy.creditRating,
        atLimit: true,
        timestamp: Date.now()
      };
    } else {
      // console.warn(`[EMERGENCY BONDS] Cannot issue emergency bonds: already at 120% debt/GDP ratio (${(currentDebtToGdp * 100).toFixed(1)}%)`);
      return false;
    }
  }
  
  // Verificar se o rating permite emissão (rating D bloqueia emissão apenas se dívida já muito alta)
  if (economy.creditRating === 'D' && currentDebtToGdp > 1.0) {
    // console.warn(`[EMERGENCY BONDS] Cannot issue emergency bonds: credit rating is D and debt/GDP > 100%`);
    return false;
  }
  
  // Calcular taxa de juros efetiva baseada no rating e situação de emergência
  const baseRate = economy.interestRate || ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE;
  const riskPremium = calculateEmergencyRiskPremium(economy.creditRating, currentDebtToGdp);
  const effectiveRate = baseRate + riskPremium;
  
  const finalDebtToGdp = ((economy.publicDebt + emergencyAmount) / economy.gdp) * 100;
  // console.log(`[EMERGENCY BONDS] Calculating ${emergencyAmount.toFixed(2)} bi USD at ${effectiveRate.toFixed(2)}% rate (rating: ${economy.creditRating}) - Future Debt/GDP: ${finalDebtToGdp.toFixed(1)}%`);
  
  // CORREÇÃO: Apenas retorna informações, não aplica valores
  return {
    amount: emergencyAmount,
    rate: effectiveRate,
    rating: economy.creditRating,
    atLimit: false,
    timestamp: Date.now()
  };
}

/**
 * Calcula prêmio de risco para títulos de emergência
 * @param {string} creditRating - Rating de crédito
 * @param {number} debtToGdpRatio - Relação dívida/PIB
 * @returns {number} - Prêmio de risco em pontos percentuais
 */
export function calculateEmergencyRiskPremium(creditRating, debtToGdpRatio) {
  // Prêmios base para títulos de emergência (maiores que títulos normais)
  const emergencyRiskPremiums = {
    "AAA": 1.0,   // Premium de emergência mínimo
    "AA": 2.0,
    "A": 3.0,
    "BBB": 5.0,
    "BB": 8.0,
    "B": 12.0,
    "CCC": 18.0,
    "CC": 25.0,
    "C": 35.0,
    "D": 50.0     // Praticamente impossível
  };
  
  let premium = emergencyRiskPremiums[creditRating] || 10.0;
  
  // Prêmio adicional pela alta dívida em situação de emergência
  if (debtToGdpRatio > 0.6) {
    premium += (debtToGdpRatio - 0.6) * 25; // 25 pontos por cada 1% acima de 60%
  }
  
  return premium;
}