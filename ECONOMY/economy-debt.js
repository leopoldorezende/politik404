// debt.js (modificado para múltiplos países)
// ==========================================
// DEBT MODULE - Gerenciamento de dívidas e títulos
// ==========================================

import { economy, dataInicial, DURACAO_DIVIDA_MESES } from './economy-economy.js';
import { countryManager } from './economy-countries.js';
import { atualizarDisplay, atualizarTabelaDividas } from './economy-ui.js';

/**
 * Calcula o pagamento mensal para um empréstimo
 * @param {number} principal - Valor principal do empréstimo
 * @param {number} taxaJurosAnual - Taxa de juros anual
 * @param {number} meses - Duração em meses
 * @returns {number} - Valor do pagamento mensal
 */
export function calcularPagamentoMensal(principal, taxaJurosAnual, meses) {
  const taxaMensal = taxaJurosAnual / 100 / 12;
  return principal * taxaMensal * Math.pow(1 + taxaMensal, meses) / (Math.pow(1 + taxaMensal, meses) - 1);
}

/**
 * Emite novos títulos da dívida pública para a economia ativa
 */
export function emitirTitulos() {
  // Obtém a economia ativa
  const activeEconomy = countryManager.getActiveCountry();
  
  // Para compatibilidade, continua usando a função original mas passando a economia ativa
  emitirTitulosParaEconomia(activeEconomy);
  
  // Sincroniza a economia global para compatibilidade
  Object.assign(economy, activeEconomy);
}

/**
 * Emite novos títulos para uma economia específica
 * @param {Object} economyInstance - Instância da economia
 * @param {number|null} valorPersonalizado - Valor personalizado (opcional)
 * @returns {boolean} - Se a operação foi bem-sucedida
 */
export function emitirTitulosParaEconomia(economyInstance, valorPersonalizado = null) {
  const valor = valorPersonalizado !== null 
    ? valorPersonalizado 
    : parseFloat(document.getElementById('valorTitulos').value);
    
  if (isNaN(valor) || valor <= 0) {
    alert("Por favor, insira um valor válido maior que zero.");
    return false;
  }
  
  // Verifica se pode emitir dívida com base na relação dívida/PIB
  const dividaPIB = economyInstance.dividaPublica / economyInstance.pib;
  // Verificação adicional: o novo valor não pode fazer a dívida ultrapassar 120% do PIB
  const novaDividaPIB = (economyInstance.dividaPublica + valor) / economyInstance.pib;
  
  if (novaDividaPIB > 1.2 || !economyInstance.podeEmitirDivida) {
    alert("Não é possível emitir mais títulos! A emissão faria a dívida ultrapassar 120% do PIB ou o país está em situação de calote.");
    return false;
  }
  
  const dataEmissao = new Date(dataInicial);
  dataEmissao.setDate(dataInicial.getDate() + economyInstance.turno);
  
  // Calcula a taxa de juros efetiva baseada na dívida/PIB
  let taxaJurosEfetiva = economyInstance.taxaJuros;
  
  // Adiciona premium de risco baseado na classificação de crédito
  switch(economyInstance.classificacaoCredito) {
    case "AAA":
      // Nenhum adicional
      break;
    case "AA":
      taxaJurosEfetiva += 0.5;
      break;
    case "A":
      taxaJurosEfetiva += 1.0;
      break;
    case "BBB":
      taxaJurosEfetiva += 2.0;
      break;
    case "BB":
      taxaJurosEfetiva += 3.5;
      break;
    case "B":
      taxaJurosEfetiva += 5.0;
      break;
    case "CCC":
      taxaJurosEfetiva += 8.0;
      break;
    case "CC":
      taxaJurosEfetiva += 12.0;
      break;
    case "C":
      taxaJurosEfetiva += 18.0;
      break;
    case "D":
      taxaJurosEfetiva += 25.0;
      break;
    default:
      taxaJurosEfetiva += 5.0;
  }
  
  // Adicional por dívida alta
  if (dividaPIB > 0.6) {
    taxaJurosEfetiva += (dividaPIB - 0.6) * 20; // juros sobem proporcionalmente
  }
  
  const novaDivida = {
    id: economyInstance.proximoIdDivida++,
    dataEmissao: dataEmissao,
    valorOriginal: valor,
    valorRestante: valor,
    taxaJuros: taxaJurosEfetiva,
    parcelasRestantes: DURACAO_DIVIDA_MESES,
    pagamentoMensal: calcularPagamentoMensal(valor, taxaJurosEfetiva, DURACAO_DIVIDA_MESES)
  };
  
  economyInstance.registroDividas.push(novaDivida);
  economyInstance.caixa += valor;
  economyInstance.dividaPublica += valor;
  
  // Atualiza a interface apenas se for a economia ativa
  if (economyInstance === countryManager.getActiveCountry()) {
    atualizarDisplay();
    atualizarTabelaDividas();
  }
  
  return true;
}

/**
 * Emite títulos de emergência quando o caixa está próximo de zero
 * @param {Object} economyInstance - Instância da economia
 * @param {number} valor - Valor a ser emitido
 */
export function emitirTitulosEmergencia(economyInstance, valor) {
  // Compatibilidade com o código antigo
  if (!economyInstance && typeof valor !== 'number') {
    economyInstance = countryManager.getActiveCountry();
    valor = economyInstance;
  }
  
  // Verifica se pode emitir dívida com base na relação dívida/PIB
  const dividaPIB = economyInstance.dividaPublica / economyInstance.pib;
  
  // Verificação adicional: o novo valor não pode fazer a dívida ultrapassar 120% do PIB
  const novaDividaPIB = (economyInstance.dividaPublica + valor) / economyInstance.pib;
  
  if (novaDividaPIB > 1.2 || !economyInstance.podeEmitirDivida) {
    // Se não pode emitir, apenas zera o caixa e retorna
    economyInstance.caixa = 0;
    
    // Atualiza a interface apenas se for a economia ativa
    if (economyInstance === countryManager.getActiveCountry()) {
      atualizarDisplay();
    }
    return;
  }
  
  const dataEmissao = new Date(dataInicial);
  dataEmissao.setDate(dataInicial.getDate() + economyInstance.turno);
  
  // Calcula a taxa de juros efetiva baseada na dívida/PIB
  let taxaJurosEfetiva = economyInstance.taxaJuros;
  
  // Adiciona premium de risco baseado na classificação de crédito
  // Em situação de emergência, o spread é ainda maior
  switch(economyInstance.classificacaoCredito) {
    case "AAA":
      taxaJurosEfetiva += 1.0; // Premium de emergência
      break;
    case "AA":
      taxaJurosEfetiva += 2.0;
      break;
    case "A":
      taxaJurosEfetiva += 3.0;
      break;
    case "BBB":
      taxaJurosEfetiva += 5.0;
      break;
    case "BB":
      taxaJurosEfetiva += 8.0;
      break;
    case "B":
      taxaJurosEfetiva += 12.0;
      break;
    case "CCC":
      taxaJurosEfetiva += 18.0;
      break;
    case "CC":
      taxaJurosEfetiva += 25.0;
      break;
    case "C":
      taxaJurosEfetiva += 35.0;
      break;
    case "D":
      taxaJurosEfetiva += 50.0; // Praticamente impossível
      break;
    default:
      taxaJurosEfetiva += 10.0;
  }
  
  // Adicional por dívida alta
  if (dividaPIB > 0.6) {
    taxaJurosEfetiva += (dividaPIB - 0.6) * 20; // juros sobem proporcionalmente
  }
  
  const novaDivida = {
    id: economyInstance.proximoIdDivida++,
    dataEmissao: dataEmissao,
    valorOriginal: valor,
    valorRestante: valor,
    taxaJuros: taxaJurosEfetiva,
    parcelasRestantes: DURACAO_DIVIDA_MESES,
    pagamentoMensal: calcularPagamentoMensal(valor, taxaJurosEfetiva, DURACAO_DIVIDA_MESES)
  };
  
  economyInstance.registroDividas.push(novaDivida);
  economyInstance.caixa += valor;
  economyInstance.dividaPublica += valor;
  
  // Atualiza a interface apenas se for a economia ativa
  if (economyInstance === countryManager.getActiveCountry()) {
    atualizarDisplay();
    atualizarTabelaDividas();
  }
}

/**
 * Processa os pagamentos mensais das dívidas
 * @param {Object} economyInstance - Instância da economia
 * @returns {number} - Total pago no mês
 */
export function processarPagamentosDividas(economyInstance) {
  // Compatibilidade com código antigo
  if (!economyInstance) {
    economyInstance = countryManager.getActiveCountry();
  }
  
  if (economyInstance.turno % 30 !== 0 || economyInstance.registroDividas.length === 0) return 0;
  
  let pagamentoTotal = 0;
  let pagamentoJurosTotal = 0;
  let pagamentoPrincipalTotal = 0;
  
  for (let i = 0; i < economyInstance.registroDividas.length; i++) {
    const divida = economyInstance.registroDividas[i];
    
    if (divida.parcelasRestantes > 0) {
      const taxaMensal = divida.taxaJuros / 100 / 12;
      const pagamentoJuros = divida.valorRestante * taxaMensal;
      const pagamentoPrincipal = divida.pagamentoMensal - pagamentoJuros;
      
      // Acumula os totais para exibição
      pagamentoJurosTotal += pagamentoJuros;
      pagamentoPrincipalTotal += pagamentoPrincipal;
      
      divida.valorRestante -= pagamentoPrincipal;
      if (divida.valorRestante < 0.01) divida.valorRestante = 0;
      divida.parcelasRestantes--;
      pagamentoTotal += divida.pagamentoMensal;
    }
  }
  
  economyInstance.registroDividas = economyInstance.registroDividas.filter(divida => divida.parcelasRestantes > 0);
  
  // Atualiza a interface apenas se for a economia ativa
  if (economyInstance === countryManager.getActiveCountry()) {
    // Atualiza a interface para mostrar quanto está sendo pago em juros vs principal
    if (document.getElementById('pagamentoJurosValue')) {
      document.getElementById('pagamentoJurosValue').textContent = pagamentoJurosTotal.toFixed(2);
      document.getElementById('pagamentoPrincipalValue').textContent = pagamentoPrincipalTotal.toFixed(2);
    }
  }
  
  // Verificar se há dinheiro suficiente para pagar as dívidas
  if (economyInstance.caixa < pagamentoTotal) {
    // Cálculo do valor faltante para pagamento das dívidas
    const valorFaltante = pagamentoTotal - economyInstance.caixa;
    economyInstance.caixa = 0;
    
    // Juros altos tornam os títulos de emergência mais caros
    // Multiplica o valor faltante por um fator que cresce com a taxa de juros
    let fatorJurosAltos = 1.0;
    
    // Fator baseado na taxa de juros média ponderada das dívidas existentes
    if (economyInstance.registroDividas.length > 0) {
      const jurosTotal = economyInstance.registroDividas.reduce((sum, divida) => sum + (divida.valorRestante * divida.taxaJuros), 0);
      const saldoTotal = economyInstance.registroDividas.reduce((sum, divida) => sum + divida.valorRestante, 0);
      const jurosMedio = saldoTotal > 0 ? (jurosTotal / saldoTotal) : economyInstance.taxaJuros;
      
      // O fator cresce mais rapidamente com juros mais altos
      fatorJurosAltos = 1 + Math.max(0, (jurosMedio - 8) / 16);
    } else {
      fatorJurosAltos = 1 + Math.max(0, (economyInstance.taxaJuros - 8) / 16);
    }
    
    // Penalidade extra se a dívida já estiver alta
    const dividaPIB = economyInstance.dividaPublica / economyInstance.pib;
    if (dividaPIB > 0.8) {
      fatorJurosAltos *= (1 + (dividaPIB - 0.8) * 0.5);
    }
    
    const valorEmitir = Math.ceil(valorFaltante * fatorJurosAltos);
    
    // Registra no console ou em um log visível o quanto o fator de juros aumentou o valor
    console.log(`Emitindo títulos de emergência: Valor original: ${valorFaltante.toFixed(2)}, Valor com fator de juros (${fatorJurosAltos.toFixed(2)}): ${valorEmitir.toFixed(2)}`);
    
    emitirTitulosEmergencia(economyInstance, valorEmitir);
  } else {
    economyInstance.caixa -= pagamentoTotal;
  }
  
  atualizarDividaPublicaTotal(economyInstance);
  
  // Atualiza a interface apenas se for a economia ativa
  if (economyInstance === countryManager.getActiveCountry()) {
    atualizarTabelaDividas();
  }
  
  return pagamentoTotal;
}

/**
 * Atualiza o valor total da dívida pública, incluindo os juros futuros
 * @param {Object} economyInstance - Instância da economia
 */
export function atualizarDividaPublicaTotal(economyInstance) {
  // Compatibilidade com código antigo
  if (!economyInstance) {
    economyInstance = countryManager.getActiveCountry();
  }
  
  // Valor apenas do principal restante (método original)
  const principalRestante = economyInstance.registroDividas.reduce((total, divida) => total + divida.valorRestante, 0);
  
  // Cálculo incluindo todos os juros futuros
  let dividaTotalComJuros = 0;
  
  economyInstance.registroDividas.forEach(divida => {
    // Pagamento mensal total ao longo da vida do empréstimo
    const pagamentoTotalFuturo = divida.pagamentoMensal * divida.parcelasRestantes;
    dividaTotalComJuros += pagamentoTotalFuturo;
  });
  
  // Atualiza o valor da dívida para incluir os juros futuros
  economyInstance.dividaPublica = dividaTotalComJuros;
  
  // Armazena o valor do principal para referência, se necessário
  economyInstance.principalDivida = principalRestante;
  
  // Atualiza a interface se for a economia ativa
  if (economyInstance === countryManager.getActiveCountry()) {
    if (document.getElementById('principalDividaValue')) {
      document.getElementById('principalDividaValue').textContent = principalRestante.toFixed(2);
    }
  }
}