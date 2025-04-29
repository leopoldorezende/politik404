// game.js (modificado para múltiplos países)
// ==========================================
// GAME MODULE - Lógica de avanço do jogo e controle de estado
// ==========================================

import { 
    economy, 
    dataInicial, 
    AUTO_PLAY_VELOCIDADE 
} from './economy-economy.js';
import { countryManager } from './economy-countries.js';
import { atualizarDisplay, atualizarTabelaDividas } from './economy-ui.js';
import { 
    processarPagamentosDividas, 
    emitirTitulosEmergencia,
    atualizarDividaPublicaTotal 
} from './economy-debt.js';
import { limitarComCurva, calcularMediaMovel } from './economy-utils.js';

// Variável para controlar o modo automático
export let intervalo = null;

/**
 * Alterna entre o modo automático e manual de avanço de turnos
 */
export function toggleAutoPlay() {
    const btn = document.getElementById('autoPlay');
    if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
        btn.textContent = 'Auto Play (1 turno/seg)';
    } else {
        intervalo = setInterval(avancarTurno, AUTO_PLAY_VELOCIDADE);
        btn.textContent = 'Parar Auto Play';
    }
}

/**
 * Avança um turno para todos os países
 */
export function avancarTurno() {
    // Obtém todos os países para avançar o turno de cada um
    const countryIds = countryManager.getAllCountryIds();
    
    // Avança o turno para cada país
    countryIds.forEach(id => {
        avancarTurnoPais(id);
    });
    
    // Atualiza a interface para o país ativo
    atualizarDisplay();
}

/**
 * Avança um turno para um país específico
 * @param {string} countryId - ID do país
 */
export function avancarTurnoPais(countryId) {
    const economyInstance = countryManager.getCountry(countryId);
    if (!economyInstance) return;
    
    economyInstance.turno++;

    // Atualiza o PIB com base no crescimento
    const crescimento = calcularCrescimento(economyInstance);
    economyInstance.pib *= 1 + crescimento;

    // Atualiza histórico do PIB
    economyInstance.historicoPIB.push(economyInstance.pib);
    if (economyInstance.historicoPIB.length > 20) {
        economyInstance.historicoPIB.shift();
    }

    // Atualiza crescimento trimestral a cada 90 turnos
    if (economyInstance.turno % 90 === 0) {
        economyInstance.crescimentoTrimestral = (economyInstance.pib - economyInstance.pibAnteriorTrimestre) / economyInstance.pibAnteriorTrimestre;
        economyInstance.pibAnteriorTrimestre = economyInstance.pib;
    }

    // Atualiza demais indicadores
    const { novaInflacao, novoHistoricoInflacao } = calcularInflacao(economyInstance);
    economyInstance.inflacao = novaInflacao;
    economyInstance.historicoInflacao = novoHistoricoInflacao;

    // Adiciona o cálculo de desemprego
    economyInstance.desemprego = calcularDesemprego(economyInstance);

    // Processamento mensal das dívidas
    if (economyInstance.turno % 30 === 0) {
        processarPagamentosDividas(economyInstance);
    }

    economyInstance.caixa = calcularCaixa(economyInstance);

    // Verificar se o caixa está negativo
    if (economyInstance.caixa <= 0) {
        economyInstance.caixa = 0;
        emitirTitulosEmergencia(economyInstance, 10); // Emite 10 bi em títulos
    }

    const { novaPopularidade, novoHistoricoPopularidade } = calcularPopularidade(economyInstance);
    economyInstance.popularidade = novaPopularidade;
    economyInstance.historicoPopularidade = novoHistoricoPopularidade;

    // Efeito da inflação alta no PIB
    if (economyInstance.inflacao > 0.1) {
        const excesso = economyInstance.inflacao - 0.1;
        const fatorPenalidade = 0.9998 - (excesso * 0.001);
        economyInstance.pib *= Math.max(0.9995, fatorPenalidade);
    }

    // Atualiza distribuição setorial mensalmente
    if (economyInstance.turno % 30 === 0) {
        const economyUpdated = atualizarDistribuicaoSetorial(economyInstance);
        // Copiar as propriedades atualizadas de volta para a instância
        Object.assign(economyInstance, economyUpdated);
    }

    // Atualiza os valores absolutos das necessidades com base no PIB atual
    economyInstance.necessidadeCommodities = economyInstance.pib * (economyInstance.percentualNecessidadeCommodities / 100);
    economyInstance.necessidadeManufaturas = economyInstance.pib * (economyInstance.percentualNecessidadeManufaturas / 100);

    // Atualiza a classificação de crédito do país
    economyInstance.classificacaoCredito = atualizarClassificacaoCredito(economyInstance);

    // Verifica se o país atingiu o ponto de calote
    const dividaPIB = economyInstance.dividaPublica / economyInstance.pib;
    if (dividaPIB > 1.2) {
        economyInstance.podeEmitirDivida = false;
    }
    
    // Sincroniza a economia global para compatibilidade
    if (countryId === countryManager.activeCountryId) {
        Object.assign(economy, economyInstance);
    }
}

/**
 * Calcula o crescimento econômico para uma economia específica
 * @param {Economy} economyInstance - Instância da economia
 * @returns {number} - Taxa de crescimento
 */
export function calcularCrescimento(economyInstance) {
    const taxaEquilibrioJuros = 8.0;
    const diferencaJuros = economyInstance.taxaJuros - taxaEquilibrioJuros;
    
    // Efeito dos juros no crescimento
    let efeitoJuros;
    if (economyInstance.taxaJuros <= 10) {
        efeitoJuros = -diferencaJuros * 0.0002;
    } else {
        const jurosExcesso = economyInstance.taxaJuros - 10;
        efeitoJuros = -(diferencaJuros * 0.0002) - (Math.pow(jurosExcesso, 1.5) * 0.0001);
    }
    
    // Efeito dos impostos no crescimento
    const diferencaImposto = economyInstance.taxaImposto - 40;
    const efeitoImposto = -diferencaImposto * 0.00015;
    
    // Efeito do investimento público no crescimento
    let efeitoInvestimento = 0;
    if (economyInstance.investimentoPublico >= 30) {
        efeitoInvestimento = economyInstance.investimentoPublico * 0.0001;
    } else {
        const deficit = 30 - economyInstance.investimentoPublico;
        const fatorPenalidade = 1 - Math.pow(deficit / 30, 1.5) * 0.5;
        efeitoInvestimento = economyInstance.investimentoPublico * 0.0001 * fatorPenalidade;
    }
    
    // Efeito da dívida pública na confiança dos investidores
    let efeitoDivida = 0;
    const dividaPIB = economyInstance.dividaPublica / economyInstance.pib;
    if (dividaPIB > 0.9) {
        efeitoDivida = -(dividaPIB - 0.9) * 0.05; // desaceleração do crescimento
    }
    
    const crescimentoBase = efeitoJuros + efeitoImposto + efeitoInvestimento + efeitoDivida;
    return crescimentoBase * 0.061; // Fator de ajuste para crescimento mais lento
}

/**
 * Calcula a inflação para uma economia específica
 * @param {Economy} economyInstance - Instância da economia
 * @returns {Object} - Contém novaInflacao e novoHistoricoInflacao
 */
export function calcularInflacao(economyInstance) {
    const taxaEquilibrioJuros = 8.0;
    const taxaEquilibrioImposto = 40.0;
    let novaInflacao = economyInstance.inflacao;
    
    // Efeito dos juros na inflação
    if (economyInstance.taxaJuros < taxaEquilibrioJuros) {
        const fatorAumento = 1 + ((taxaEquilibrioJuros - economyInstance.taxaJuros) * 0.03);
        novaInflacao *= fatorAumento;
    } else if (economyInstance.taxaJuros > taxaEquilibrioJuros) {
        if (economyInstance.taxaJuros <= 10) {
            const fatorReducao = 1 - ((economyInstance.taxaJuros - taxaEquilibrioJuros) * 0.025);
            novaInflacao *= Math.max(0.85, fatorReducao);
        } else {
            const jurosNormais = 10 - taxaEquilibrioJuros;
            const jurosExcesso = economyInstance.taxaJuros - 10;
            
            const reducaoInicial = 1 - (jurosNormais * 0.025);
            const reducaoAdicional = Math.pow(1.2, jurosExcesso) * 0.05;
            
            novaInflacao *= Math.max(0.65, reducaoInicial - reducaoAdicional);
        }
    }
    
    // Efeito dos impostos na inflação
    if (economyInstance.taxaImposto > taxaEquilibrioImposto) {
        const fatorReducao = 1 - ((economyInstance.taxaImposto - taxaEquilibrioImposto) * 0.003);
        novaInflacao *= Math.max(0.96, fatorReducao);
    } else if (economyInstance.taxaImposto < taxaEquilibrioImposto) {
        const fatorAumento = 1 + ((taxaEquilibrioImposto - economyInstance.taxaImposto) * 0.002);
        novaInflacao *= fatorAumento;
    }
    
    // Efeito do crescimento econômico na inflação
    const crescimentoEquilibrio = 0.02;
    
    if (economyInstance.crescimentoTrimestral > crescimentoEquilibrio) {
        const excesso = economyInstance.crescimentoTrimestral - crescimentoEquilibrio;
        const fatorEnfase = 1 + (excesso * 5);
        novaInflacao += excesso * 0.12 * fatorEnfase;
    } else if (economyInstance.crescimentoTrimestral > 0 && economyInstance.crescimentoTrimestral <= crescimentoEquilibrio) {
        novaInflacao += economyInstance.crescimentoTrimestral * 0.005;
    } else if (economyInstance.crescimentoTrimestral < 0) {
        novaInflacao -= Math.abs(economyInstance.crescimentoTrimestral) * 0.025;
    }
    
    // Efeito da dívida pública na inflação estrutural
    const dividaPIB = economyInstance.dividaPublica / economyInstance.pib;
    if (dividaPIB > 0.7) {
        const excessoDivida = dividaPIB - 0.7;
        novaInflacao += excessoDivida * 0.02;
    }
    
    // Variação aleatória e inércia inflacionária
    const variacaoAleatoria = (Math.random() - 0.5) * 0.0005;
    novaInflacao += variacaoAleatoria;
    novaInflacao = economyInstance.inflacao * 0.8 + novaInflacao * 0.2;
    
    // Limita a inflação usando a função auxiliar
    novaInflacao = limitarComCurva(novaInflacao, -0.02, 0.18, 0.04);
    
    // Cria novo histórico para média móvel (imutabilidade)
    const novoHistoricoInflacao = [...economyInstance.historicoInflacao, novaInflacao];
    if (novoHistoricoInflacao.length > 20) {
        novoHistoricoInflacao.shift();
    }
    
    const mediaInflacao = calcularMediaMovel(novoHistoricoInflacao);
    
    return {
        novaInflacao: novaInflacao * 0.8 + mediaInflacao * 0.2,
        novoHistoricoInflacao
    };
}

/**
 * Calcula o desemprego para uma economia específica
 * @param {Economy} economyInstance - Instância da economia
 * @returns {number} - Taxa de desemprego
 */
export function calcularDesemprego(economyInstance) {
    if (economyInstance.desemprego === undefined) {
        economyInstance.desemprego = 12.5;
    }
    
    // Implementação da função se ela não estiver definida no arquivo economy.js original
    // Este é apenas um exemplo simples
    let novoDesemprego = economyInstance.desemprego;
    
    // Efeito do crescimento no desemprego
    if (economyInstance.crescimentoTrimestral > 0) {
        // Crescimento reduz desemprego
        novoDesemprego -= economyInstance.crescimentoTrimestral * 5;
    } else {
        // Recessão aumenta desemprego rapidamente
        novoDesemprego += Math.abs(economyInstance.crescimentoTrimestral) * 8;
    }
    
    // Efeito da inflação no desemprego (curva de Phillips)
    if (economyInstance.inflacao < 0.05) {
        // Inflação baixa tende a manter desemprego alto
        novoDesemprego += (0.05 - economyInstance.inflacao) * 2;
    } else if (economyInstance.inflacao > 0.1) {
        // Inflação muito alta eventualmente também aumenta desemprego
        novoDesemprego += (economyInstance.inflacao - 0.1) * 3;
    } else {
        // Inflação moderada pode reduzir desemprego
        novoDesemprego -= (economyInstance.inflacao - 0.05) * 1;
    }
    
    // Efeito dos impostos no desemprego
    const impostoReferencia = 40;
    if (economyInstance.taxaImposto > impostoReferencia) {
        // Impostos altos podem aumentar desemprego
        novoDesemprego += (economyInstance.taxaImposto - impostoReferencia) * 0.05;
    }
    
    // Limites para a taxa de desemprego (entre 3% e 40%)
    novoDesemprego = Math.max(3, Math.min(40, novoDesemprego));
    
    // Inércia do desemprego (não muda muito rapidamente)
    return economyInstance.desemprego * 0.9 + novoDesemprego * 0.1;
}

/**
 * Calcula a arrecadação e gastos para atualizar o caixa
 * @param {Economy} economyInstance - Instância da economia
 * @returns {number} - Novo valor de caixa
 */
export function calcularCaixa(economyInstance) {
    // Arrecadação via impostos
    const arrecadacao = economyInstance.pib * (economyInstance.taxaImposto / 100) * 0.017;
    
    // Gastos com investimento público
    let gastoInvestimento = 0;
    
    if (economyInstance.investimentoPublico > 0) {
        if (economyInstance.investimentoPublico <= 15) {
            gastoInvestimento = economyInstance.pib * (economyInstance.investimentoPublico / 100) * 0.015;
        } else {
            const baseGasto = economyInstance.pib * (15 / 100) * 0.015;
            const fatorExtra = 2.0;
            const excedenteInvestimento = economyInstance.investimentoPublico - 15;
            const gastoExcedente = economyInstance.pib * (excedenteInvestimento / 100) * 0.015 * fatorExtra;
            
            gastoInvestimento = baseGasto + gastoExcedente;
        }
    }
    
    // Retorna o novo valor de caixa (sem modificar o objeto original)
    return economyInstance.caixa + arrecadacao - gastoInvestimento;
}

/**
 * Calcula a popularidade do governo com base nas variáveis econômicas
 * @param {Economy} economyInstance - Instância da economia
 * @returns {Object} - Contém novaPopularidade e novoHistoricoPopularidade
 */
export function calcularPopularidade(economyInstance) {
    let novaPopularidade = economyInstance.popularidade;
    
    // Efeito do crescimento na popularidade
    if (economyInstance.crescimentoTrimestral > 0) {
        novaPopularidade += economyInstance.crescimentoTrimestral * 100 * 0.2;
    } else if (economyInstance.crescimentoTrimestral < 0) {
        novaPopularidade += economyInstance.crescimentoTrimestral * 100 * 0.3;
    }
    
    // Efeito da inflação na popularidade
    const inflacaoIdeal = 0.04;
    const diferencaInflacao = economyInstance.inflacao - inflacaoIdeal;
    if (diferencaInflacao > 0) {
        novaPopularidade -= diferencaInflacao * 100 * 0.25;
    } else if (diferencaInflacao < 0 && economyInstance.inflacao > 0) {
        novaPopularidade += Math.abs(diferencaInflacao) * 100 * 0.1;
    }
    
    // Efeito dos impostos na popularidade
    const impostoIdeal = 40;
    const diferencaImposto = economyInstance.taxaImposto - impostoIdeal;
    if (diferencaImposto > 0) {
        novaPopularidade -= diferencaImposto * 0.2;
    } else if (diferencaImposto < 0) {
        novaPopularidade += Math.abs(diferencaImposto) * 0.1;
    }
    
    // Efeito do investimento público na popularidade
    const investimentoReferencia = Math.round(economyInstance.pib / 3.33);
    const difInvestimento = economyInstance.investimentoPublico - investimentoReferencia;
    const taxaResposta = Math.tanh(difInvestimento / 10) * 0.8;
    novaPopularidade += taxaResposta * Math.abs(difInvestimento) * 0.15;
    
    // Efeito do desemprego na popularidade
    if (economyInstance.desemprego !== undefined) {
        const desempregoIdeal = 15;
        const diferencaDesemprego = economyInstance.desemprego - desempregoIdeal;
        
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
        if (economyInstance.desemprego > 30 && economyInstance.inflacao > 0.08) {
            const indiceMiseria = (economyInstance.desemprego - 30) * (economyInstance.inflacao - 0.08) * 100;
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
    const novoHistoricoPopularidade = [...economyInstance.historicoPopularidade, novaPopularidade];
    if (novoHistoricoPopularidade.length > 20) {
        novoHistoricoPopularidade.shift();
    }
    
    const mediaPopularidade = calcularMediaMovel(novoHistoricoPopularidade);
    
    // Retorna tanto o novo valor quanto o histórico atualizado
    return {
        novaPopularidade: novaPopularidade * 0.7 + mediaPopularidade * 0.3,
        novoHistoricoPopularidade
    };
}

/**
 * Atualiza a distribuição setorial do PIB e as necessidades do país
 * @param {Economy} economyInstance - Instância da economia
 * @returns {Economy} - Economia com valores atualizados
 */
export function atualizarDistribuicaoSetorial(economyInstance) {
    // Cria uma cópia do objeto economy para realizar as alterações (imutabilidade)
    const updatedEconomy = { ...economyInstance };
    
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

/**
 * Função auxiliar pura que ajusta os limites da distribuição setorial
 * @param {Object} setores - Objeto com percentuais de setores
 * @returns {Object} - Setores ajustados
 */
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

/**
 * Avalia e atualiza a classificação de crédito do país
 * @param {Economy} economyInstance - Instância da economia
 * @returns {string} - Nova classificação de crédito
 */
export function atualizarClassificacaoCredito(economyInstance) {
    const dividaPIB = economyInstance.dividaPublica / economyInstance.pib;
    const inflacao = economyInstance.inflacao * 100; // Convertendo para percentual
    const crescimentoTrimestral = economyInstance.crescimentoTrimestral * 100; // Convertendo para percentual
    
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
if (inflacao > 15 && economyInstance.historicoInflacao.length >= 3) {
    const ultimas3 = economyInstance.historicoInflacao.slice(-3).map(i => i * 100); // Convertendo para percentual
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