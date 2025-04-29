// economy.js (modificado para compatibilidade com React)
// ==========================================
// ECONOMY MODULE - Core economic data and calculations
// ==========================================

import { limitarComCurva, calcularMediaMovel } from './economy-utils.js';

// Constantes globais - mantidas fora para serem compartilhadas
export const TAMANHO_HISTORICO = 20;
export const DURACAO_DIVIDA_ANOS = 10;
export const DURACAO_DIVIDA_MESES = DURACAO_DIVIDA_ANOS * 12;

// Configurações de tempo
export const dataInicial = new Date(2025, 0, 1);
export const AUTO_PLAY_VELOCIDADE = 100;

// Função para criar estado inicial da economia (factory pattern)
export function createInitialEconomy(initialData = {}) {
  return {
    // Variáveis econômicas principais
    turno: initialData.turno || 0,
    pib: initialData.pib || 100,
    inflacao: initialData.inflacao || 0.04, // 4% inicial
    taxaJuros: initialData.taxaJuros || 8.0,
    taxaImposto: initialData.taxaImposto || 40.0,
    investimentoPublico: initialData.investimentoPublico || 30.0,
    caixa: initialData.caixa || 100,
    dividaPublica: initialData.dividaPublica || 0,
    desemprego: initialData.desemprego || 12.5,
    popularidade: initialData.popularidade || 50,
    podeEmitirDivida: initialData.podeEmitirDivida !== undefined ? initialData.podeEmitirDivida : true,
    classificacaoCredito: initialData.classificacaoCredito || "AA",
    
    // Variáveis para cálculo do crescimento
    pibAnteriorTrimestre: initialData.pibAnteriorTrimestre || 100,
    crescimentoTrimestral: initialData.crescimentoTrimestral || 0.02, // 2% inicial
    
    // Distribuição setorial do PIB
    commodities: initialData.commodities || 35,  // 35% do PIB
    manufaturas: initialData.manufaturas || 30,  // 30% do PIB
    servicos: initialData.servicos || 35,     // 35% do PIB
    
    // Necessidades do país (como percentual do PIB)
    percentualNecessidadeCommodities: initialData.percentualNecessidadeCommodities || 30, // 30% do PIB
    percentualNecessidadeManufaturas: initialData.percentualNecessidadeManufaturas || 45, // 35% do PIB
    
    // Variáveis para armazenar os valores absolutos das necessidades
    necessidadeCommodities: initialData.necessidadeCommodities || 30,
    necessidadeManufaturas: initialData.necessidadeManufaturas || 35,
    
    // Históricos para médias móveis
    historicoPIB: initialData.historicoPIB || [initialData.pib || 100],
    historicoInflacao: initialData.historicoInflacao || [initialData.inflacao || 0.04],
    historicoPopularidade: initialData.historicoPopularidade || [initialData.popularidade || 50],
    historicoDesemprego: initialData.historicoDesemprego || [initialData.desemprego || 12.5],
    
    // Sistema de dívidas
    registroDividas: initialData.registroDividas || [],
    proximoIdDivida: initialData.proximoIdDivida || 1,
  };
}

// Funções puras que aceitam um estado de economia e retornam um valor ou novo estado

// Inicializa a economia
export function initializeEconomy(economy) {
  const updatedEconomy = { ...economy };
  
  // Inicializa necessidades como percentual do PIB
  updatedEconomy.necessidadeCommodities = updatedEconomy.pib * (updatedEconomy.percentualNecessidadeCommodities / 100);
  updatedEconomy.necessidadeManufaturas = updatedEconomy.pib * (updatedEconomy.percentualNecessidadeManufaturas / 100);
  
  return updatedEconomy;
}

// Calcula o crescimento econômico
export function calcularCrescimento(economy) {
  const taxaEquilibrioJuros = 8.0;
  const diferencaJuros = economy.taxaJuros - taxaEquilibrioJuros;
  
  // Efeito dos juros no crescimento
  let efeitoJuros;
  if (economy.taxaJuros <= 10) {
    efeitoJuros = -diferencaJuros * 0.0002;
  } else {
    const jurosExcesso = economy.taxaJuros - 10;
    efeitoJuros = -(diferencaJuros * 0.0002) - (Math.pow(jurosExcesso, 1.5) * 0.0001);
  }
  
  // Efeito dos impostos no crescimento
  const diferencaImposto = economy.taxaImposto - 40;
  const efeitoImposto = -diferencaImposto * 0.00015;
  
  // Efeito do investimento público no crescimento
  let efeitoInvestimento = 0;
  if (economy.investimentoPublico >= 30) {
    efeitoInvestimento = economy.investimentoPublico * 0.0001;
  } else {
    const deficit = 30 - economy.investimentoPublico;
    const fatorPenalidade = 1 - Math.pow(deficit / 30, 1.5) * 0.5;
    efeitoInvestimento = economy.investimentoPublico * 0.0001 * fatorPenalidade;
  }
  
  // Efeito da dívida pública na confiança dos investidores
  let efeitoDivida = 0;
  const dividaPIB = economy.dividaPublica / economy.pib;
  if (dividaPIB > 0.9) {
    efeitoDivida = -(dividaPIB - 0.9) * 0.05; // desaceleração do crescimento
  }
  
  const crescimentoBase = efeitoJuros + efeitoImposto + efeitoInvestimento + efeitoDivida;
  return crescimentoBase * 0.061; // Fator de ajuste para crescimento mais lento
}

// Calcula a inflação
export function calcularInflacao(economy) {
  const taxaEquilibrioJuros = 8.0;
  const taxaEquilibrioImposto = 40.0;
  let novaInflacao = economy.inflacao;
  
  // Efeito dos juros na inflação
  if (economy.taxaJuros < taxaEquilibrioJuros) {
    const fatorAumento = 1 + ((taxaEquilibrioJuros - economy.taxaJuros) * 0.03);
    novaInflacao *= fatorAumento;
  } else if (economy.taxaJuros > taxaEquilibrioJuros) {
    if (economy.taxaJuros <= 10) {
      const fatorReducao = 1 - ((economy.taxaJuros - taxaEquilibrioJuros) * 0.025);
      novaInflacao *= Math.max(0.85, fatorReducao);
    } else {
      const jurosNormais = 10 - taxaEquilibrioJuros;
      const jurosExcesso = economy.taxaJuros - 10;
      
      const reducaoInicial = 1 - (jurosNormais * 0.025);
      const reducaoAdicional = Math.pow(1.2, jurosExcesso) * 0.05;
      
      novaInflacao *= Math.max(0.65, reducaoInicial - reducaoAdicional);
    }
  }
  
  // Efeito dos impostos na inflação
  if (economy.taxaImposto > taxaEquilibrioImposto) {
    const fatorReducao = 1 - ((economy.taxaImposto - taxaEquilibrioImposto) * 0.003);
    novaInflacao *= Math.max(0.96, fatorReducao);
  } else if (economy.taxaImposto < taxaEquilibrioImposto) {
    const fatorAumento = 1 + ((taxaEquilibrioImposto - economy.taxaImposto) * 0.002);
    novaInflacao *= fatorAumento;
  }
  
  // Efeito do crescimento econômico na inflação
  const crescimentoEquilibrio = 0.02;
  
  if (economy.crescimentoTrimestral > crescimentoEquilibrio) {
    const excesso = economy.crescimentoTrimestral - crescimentoEquilibrio;
    const fatorEnfase = 1 + (excesso * 5);
    novaInflacao += excesso * 0.12 * fatorEnfase;
  } else if (economy.crescimentoTrimestral > 0 && economy.crescimentoTrimestral <= crescimentoEquilibrio) {
    novaInflacao += economy.crescimentoTrimestral * 0.005;
  } else if (economy.crescimentoTrimestral < 0) {
    novaInflacao -= Math.abs(economy.crescimentoTrimestral) * 0.025;
  }
  
  // Efeito da dívida pública na inflação estrutural
  const dividaPIB = economy.dividaPublica / economy.pib;
  if (dividaPIB > 0.7) {
    const excessoDivida = dividaPIB - 0.7;
    novaInflacao += excessoDivida * 0.02;
  }
  
  // Variação aleatória e inércia inflacionária
  const variacaoAleatoria = (Math.random() - 0.5) * 0.0005;
  novaInflacao += variacaoAleatoria;
  novaInflacao = economy.inflacao * 0.8 + novaInflacao * 0.2;
  novaInflacao = limitarComCurva(novaInflacao, -0.02, 0.18, 0.04);
  
  // Cria novo histórico para média móvel (imutabilidade)
  const novoHistoricoInflacao = [...economy.historicoInflacao, novaInflacao];
  if (novoHistoricoInflacao.length > TAMANHO_HISTORICO) {
    novoHistoricoInflacao.shift();
  }
  
  const mediaInflacao = calcularMediaMovel(novoHistoricoInflacao);
  return {
    novaInflacao: novaInflacao * 0.8 + mediaInflacao * 0.2,
    novoHistoricoInflacao
  };
}

// Calcula a arrecadação e gastos para atualizar o caixa
export function calcularCaixa(economy) {
  // Arrecadação via impostos
  const arrecadacao = economy.pib * (economy.taxaImposto / 100) * 0.017;
  
  // Gastos com investimento público
  let gastoInvestimento = 0;
  
  if (economy.investimentoPublico > 0) {
    if (economy.investimentoPublico <= 15) {
      gastoInvestimento = economy.pib * (economy.investimentoPublico / 100) * 0.015;
    } else {
      const baseGasto = economy.pib * (15 / 100) * 0.015;
      const fatorExtra = 2.0;
      const excedenteInvestimento = economy.investimentoPublico - 15;
      const gastoExcedente = economy.pib * (excedenteInvestimento / 100) * 0.015 * fatorExtra;
      
      gastoInvestimento = baseGasto + gastoExcedente;
    }
  }
  
  // Retorna o novo valor de caixa (sem modificar o objeto original)
  return economy.caixa + arrecadacao - gastoInvestimento;
}

// Calcula a popularidade do governo com base nas variáveis econômicas
export function calcularPopularidade(economy) {
  let novaPopularidade = economy.popularidade;
  
  // Efeito do crescimento na popularidade
  if (economy.crescimentoTrimestral > 0) {
    novaPopularidade += economy.crescimentoTrimestral * 100 * 0.2;
  } else if (economy.crescimentoTrimestral < 0) {
    novaPopularidade += economy.crescimentoTrimestral * 100 * 0.3;
  }
  
  // Efeito da inflação na popularidade
  const inflacaoIdeal = 0.04;
  const diferencaInflacao = economy.inflacao - inflacaoIdeal;
  if (diferencaInflacao > 0) {
    novaPopularidade -= diferencaInflacao * 100 * 0.25;
  } else if (diferencaInflacao < 0 && economy.inflacao > 0) {
    novaPopularidade += Math.abs(diferencaInflacao) * 100 * 0.1;
  }
  
  // Efeito dos impostos na popularidade
  const impostoIdeal = 40;
  const diferencaImposto = economy.taxaImposto - impostoIdeal;
  if (diferencaImposto > 0) {
    novaPopularidade -= diferencaImposto * 0.2;
  } else if (diferencaImposto < 0) {
    novaPopularidade += Math.abs(diferencaImposto) * 0.1;
  }
  
  // Efeito do investimento público na popularidade
  const investimentoReferencia = Math.round(economy.pib / 3.33);
  const difInvestimento = economy.investimentoPublico - investimentoReferencia;
  const taxaResposta = Math.tanh(difInvestimento / 10) * 0.8;
  novaPopularidade += taxaResposta * Math.abs(difInvestimento) * 0.15;
  
  // Efeito do desemprego na popularidade
  if (economy.desemprego !== undefined) {
    const desempregoIdeal = 15; // Considerando o novo padrão de desemprego mais alto
    const diferencaDesemprego = economy.desemprego - desempregoIdeal;
    
    if (diferencaDesemprego > 0) {
      // Desemprego acima do ideal reduz popularidade drasticamente
      // Usando função não-linear para aumentar o impacto de desemprego muito alto
      const fatorPenalidade = 1 + Math.pow(diferencaDesemprego / 10, 1.5);
      novaPopularidade -= diferencaDesemprego * 0.3 * fatorPenalidade;
    } else if (diferencaDesemprego < 0) {
      // Desemprego abaixo do ideal aumenta popularidade, mas com impacto menor
      novaPopularidade += Math.abs(diferencaDesemprego) * 0.3;
    }
    
    // Efeito combinado de desemprego alto + inflação alta (miséria econômica)
    if (economy.desemprego > 30 && economy.inflacao > 0.08) {
      const indiceMiseria = (economy.desemprego - 30) * (economy.inflacao - 0.08) * 100;
      novaPopularidade -= indiceMiseria * 0.2;
    }
  }
  
  // Variação aleatória
  const variacaoAleatoria = (Math.random() - 0.5) * 0.5;
  novaPopularidade += variacaoAleatoria;
  
  // Força de retorno para o equilíbrio (50%)
  const distanciaDe50 = Math.abs(novaPopularidade - 50);
  const forcaDeRetorno = distanciaDe50 * distanciaDe50 * 0.002;
  
  if (novaPopularidade > 50) {
    novaPopularidade -= forcaDeRetorno;
  } else if (novaPopularidade < 50) {
    novaPopularidade += forcaDeRetorno;
  }
  
  // Limite entre 1% e 99%
  novaPopularidade = Math.max(1, Math.min(99, novaPopularidade));
  
  // Cria novo histórico para média móvel (imutabilidade)
  const novoHistoricoPopularidade = [...economy.historicoPopularidade, novaPopularidade];
  if (novoHistoricoPopularidade.length > TAMANHO_HISTORICO) {
    novoHistoricoPopularidade.shift();
  }
  
  const mediaPopularidade = calcularMediaMovel(novoHistoricoPopularidade);
  
  // Retorna tanto o novo valor quanto o histórico atualizado
  return {
    novaPopularidade: novaPopularidade * 0.7 + mediaPopularidade * 0.3,
    novoHistoricoPopularidade
  };
}

// Atualiza a distribuição setorial do PIB e as necessidades do país
export function atualizarDistribuicaoSetorial(economy) {
  // Cria uma cópia do objeto economy para realizar as alterações (imutabilidade)
  const updatedEconomy = { ...economy };
  
  // Variação mensal aleatória na distribuição setorial
  const variacaoCommodities = Math.floor(Math.random() * 3) - 1; // -1, 0, ou 1
  const variacaoManufaturas = Math.floor(Math.random() * 3) - 1; // -1, 0, ou 1
  
  updatedEconomy.commodities += variacaoCommodities;
  updatedEconomy.manufaturas += variacaoManufaturas;
  
  // Recalcula serviços para manter o total em 100%
  updatedEconomy.servicos = 100 - updatedEconomy.commodities - updatedEconomy.manufaturas;
  
  // Ajusta os limites setoriais (usando uma função auxiliar pura)
  const ajustados = ajustarLimitesSetoriais({
    commodities: updatedEconomy.commodities,
    manufaturas: updatedEconomy.manufaturas,
    servicos: updatedEconomy.servicos
  });
  
  updatedEconomy.commodities = ajustados.commodities;
  updatedEconomy.manufaturas = ajustados.manufaturas;
  updatedEconomy.servicos = ajustados.servicos;
  
  // Atualiza as percentagens das necessidades do país com pequena variação aleatória
  const variacaoPercentualCommodities = (Math.random() * 0.4) - 0.2; // -0.2 a +0.2
  const variacaoPercentualManufaturas = (Math.random() * 0.4) - 0.2; // -0.2 a +0.2
  
  updatedEconomy.percentualNecessidadeCommodities += variacaoPercentualCommodities;
  updatedEconomy.percentualNecessidadeManufaturas += variacaoPercentualManufaturas;
  
  // Limites para as percentagens de necessidades
  updatedEconomy.percentualNecessidadeCommodities = Math.max(25, Math.min(40, updatedEconomy.percentualNecessidadeCommodities));
  updatedEconomy.percentualNecessidadeManufaturas = Math.max(25, Math.min(40, updatedEconomy.percentualNecessidadeManufaturas));
  
  // Atualiza os valores absolutos das necessidades
  updatedEconomy.necessidadeCommodities = updatedEconomy.pib * (updatedEconomy.percentualNecessidadeCommodities / 100);
  updatedEconomy.necessidadeManufaturas = updatedEconomy.pib * (updatedEconomy.percentualNecessidadeManufaturas / 100);
  
  return updatedEconomy;
}

// Função auxiliar pura que ajusta os limites da distribuição setorial
export function ajustarLimitesSetoriais(setores) {
  // Cria uma cópia do objeto setores para realizar alterações (imutabilidade)
  const ajustados = { ...setores };
  
  // Limites para commodities (20-50%)
  if (ajustados.commodities < 20) { 
    const ajuste = 20 - ajustados.commodities;
    ajustados.commodities = 20;
    ajustados.servicos -= ajuste / 2;
    ajustados.manufaturas -= ajuste / 2;
  } else if (ajustados.commodities > 50) {
    const ajuste = ajustados.commodities - 50;
    ajustados.commodities = 50;
    ajustados.servicos += ajuste / 2;
    ajustados.manufaturas += ajuste / 2;
  }
  
  // Limites para manufaturas (20-50%)
  if (ajustados.manufaturas < 20) {
    const ajuste = 20 - ajustados.manufaturas;
    ajustados.manufaturas = 20;
    ajustados.servicos -= ajuste / 2;
    ajustados.commodities -= ajuste / 2;
  } else if (ajustados.manufaturas > 50) {
    const ajuste = ajustados.manufaturas - 50;
    ajustados.manufaturas = 50;
    ajustados.servicos += ajuste / 2;
    ajustados.commodities += ajuste / 2;
  }
  
  // Limites para serviços (20-50%)
  if (ajustados.servicos < 20) {
    const ajuste = 20 - ajustados.servicos;
    ajustados.servicos = 20;
    ajustados.commodities -= ajuste / 2;
    ajustados.manufaturas -= ajuste / 2;
  } else if (ajustados.servicos > 50) {
    const ajuste = ajustados.servicos - 50;
    ajustados.servicos = 50;
    ajustados.commodities += ajuste / 2;
    ajustados.manufaturas += ajuste / 2;
  }
  
  // Arredonda para inteiros e garante total de 100%
  ajustados.commodities = Math.round(ajustados.commodities);
  ajustados.manufaturas = Math.round(ajustados.manufaturas);
  ajustados.servicos = 100 - ajustados.commodities - ajustados.manufaturas;
  
  return ajustados;
}

// Avalia e atualiza a classificação de crédito do país com base na inflação, dívida e crescimento
export function atualizarClassificacaoCredito(economy) {
  const dividaPIB = economy.dividaPublica / economy.pib;
  const inflacao = economy.inflacao * 100; // Convertendo para percentual
  const crescimentoTrimestral = economy.crescimentoTrimestral * 100; // Convertendo para percentual
  
  // Determinação da nota base com base APENAS na inflação
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
    // Para inflação acima de 15%
    notaBase = "C"; // Por padrão é C, mas pode ser D dependendo da análise posterior
  }
  
  // Ajuste pela dívida e crescimento (reduz a nota base)
  const niveis = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC", "C", "D"];
  let indiceNota = niveis.indexOf(notaBase);
  
  // Impacto da dívida na classificação
  if (dividaPIB > 0.3 && dividaPIB <= 0.6) {
    // Dívida moderada: reduz 1 nível
    indiceNota += 1;
  } else if (dividaPIB > 0.6 && dividaPIB <= 0.9) {
    // Dívida alta: reduz 2 níveis
    indiceNota += 2;
  } else if (dividaPIB > 0.9 && dividaPIB <= 1.2) {
    // Dívida muito alta: reduz 3 níveis
    indiceNota += 3;
  } else if (dividaPIB > 1.2) {
    // Dívida extremamente alta: reduz 4 níveis
    indiceNota += 4;
  }
  
  // Impacto do crescimento negativo na classificação
  if (crescimentoTrimestral < 0) {
    // Quanto mais negativo o crescimento, maior o impacto na nota
    if (crescimentoTrimestral >= -1) {
      // Recessão leve (-1% a 0%): reduz 1 nível
      indiceNota += 1;
    } else if (crescimentoTrimestral >= -3) {
      // Recessão moderada (-3% a -1%): reduz 2 níveis
      indiceNota += 2;
    } else if (crescimentoTrimestral >= -5) {
      // Recessão forte (-5% a -3%): reduz 3 níveis
      indiceNota += 3;
    } else {
      // Recessão profunda (abaixo de -5%): reduz 4 níveis
      indiceNota += 4;
    }
    
    // Caso especial: Estagflação (crescimento negativo + inflação alta)
    if (inflacao > 7) {
      // Penalidade adicional para estagflação
      indiceNota += 1;
    }
  }
  
  // Se a inflação for extrema (acima de 15%) e a tendência for de alta ou instabilidade, 
  // muda para "D" independentemente da dívida
  if (inflacao > 15 && economy.historicoInflacao.length >= 3) {
    const ultimas3 = economy.historicoInflacao.slice(-3).map(i => i * 100); // Convertendo para percentual
    // Verifica se há tendência de alta ou instabilidade
    if (ultimas3[2] > ultimas3[0] || Math.abs(ultimas3[2] - ultimas3[1]) > 2) { // 2 pontos percentuais
      return "D";
    }
  }
  
  // Caso especial: Tripla ameaça - inflação alta + dívida alta + crescimento muito negativo
  if (inflacao > 9 && dividaPIB > 0.9 && crescimentoTrimestral < -3) {
    return "D"; // Situação crítica: default ou próximo disso
  }
  
  // Garantir que o índice não ultrapasse o tamanho do array
  indiceNota = Math.min(indiceNota, niveis.length - 1);
  
  return niveis[indiceNota];
}

// Instância global para compatibilidade com o código existente
export const economy = createInitialEconomy();