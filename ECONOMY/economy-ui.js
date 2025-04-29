// ui.js (modificado para múltiplos países)
// ==========================================
// UI MODULE - Gerenciamento da interface do usuário
// ==========================================

import { economy, dataInicial } from './economy-economy.js';
import { countryManager } from './economy-countries.js';

/**
 * Atualiza a taxa de juros com base no valor do slider
 * @param {string} value - Valor do slider de juros
 * @param {string|null} countryId - ID do país (opcional)
 */
export function updateJuros(value, countryId = null) {
  // Determina qual economia atualizar
  const economyToUpdate = countryId 
    ? countryManager.getCountry(countryId)
    : countryManager.getActiveCountry();
  
  economyToUpdate.taxaJuros = parseFloat(value);
  
  // Sincroniza com economia global para compatibilidade
  if (economyToUpdate === countryManager.getActiveCountry()) {
    economy.taxaJuros = economyToUpdate.taxaJuros;
    document.getElementById('jurosValue').textContent = economy.taxaJuros.toFixed(1);
  }
}

/**
 * Atualiza a taxa de imposto com base no valor do slider
 * @param {string} value - Valor do slider de imposto
 * @param {string|null} countryId - ID do país (opcional)
 */
export function updateImposto(value, countryId = null) {
  // Determina qual economia atualizar
  const economyToUpdate = countryId 
    ? countryManager.getCountry(countryId)
    : countryManager.getActiveCountry();
  
  economyToUpdate.taxaImposto = parseFloat(value);
  
  // Sincroniza com economia global para compatibilidade
  if (economyToUpdate === countryManager.getActiveCountry()) {
    economy.taxaImposto = economyToUpdate.taxaImposto;
    document.getElementById('impostoValue').textContent = economy.taxaImposto.toFixed(1);
  }
}

/**
 * Atualiza o nível de investimento público com base no valor do slider
 * @param {string} value - Valor do slider de investimento
 * @param {string|null} countryId - ID do país (opcional)
 */
export function updateInvestimento(value, countryId = null) {
  // Determina qual economia atualizar
  const economyToUpdate = countryId 
    ? countryManager.getCountry(countryId)
    : countryManager.getActiveCountry();
  
  economyToUpdate.investimentoPublico = parseFloat(value);
  
  // Sincroniza com economia global para compatibilidade
  if (economyToUpdate === countryManager.getActiveCountry()) {
    economy.investimentoPublico = economyToUpdate.investimentoPublico;
    document.getElementById('investimentoValue').textContent = economy.investimentoPublico.toFixed(1);
  }
}

/**
 * Atualiza todos os elementos da interface com os valores atuais
 * @param {string|null} countryId - ID do país (opcional)
 */
export function atualizarDisplay(countryId = null) {
  // Determina qual economia exibir
  const economyToDisplay = countryId 
    ? countryManager.getCountry(countryId)
    : countryManager.getActiveCountry();
  
  if (!economyToDisplay) return;
  
  // Atualiza data e rodada
  const dataAtual = new Date(dataInicial);
  dataAtual.setDate(dataInicial.getDate() + economyToDisplay.turno);
  document.getElementById('rodada').textContent = economyToDisplay.turno;
  document.getElementById('data').textContent = dataAtual.toLocaleDateString('pt-BR');
  
  // Atualiza indicadores econômicos principais
  document.getElementById('pibValue').textContent = economyToDisplay.pib.toFixed(2);
  document.getElementById('crescimentoValue').textContent = `${(economyToDisplay.crescimentoTrimestral * 100).toFixed(2)}%`;
  document.getElementById('inflacaoValue').textContent = `${(economyToDisplay.inflacao * 100).toFixed(2)}%`;
  document.getElementById('caixaValue').textContent = economyToDisplay.caixa.toFixed(2);
  document.getElementById('dividaValue').textContent = economyToDisplay.dividaPublica.toFixed(2);
  
  // Se temos o novo campo para principal da dívida, atualiza-o
  if (document.getElementById('principalDividaValue') && economyToDisplay.principalDivida !== undefined) {
    document.getElementById('principalDividaValue').textContent = economyToDisplay.principalDivida.toFixed(2);
  }
  
  // Atualiza desemprego
  document.getElementById('desempregoValue').textContent = `${economyToDisplay.desemprego.toFixed(1)}%`;

  // Atualiza popularidade
  document.getElementById('popularidadeValue').textContent = `${Math.round(economyToDisplay.popularidade)}%`;
  document.getElementById('popularidadeFill').style.width = `${economyToDisplay.popularidade}%`;
  
  // Atualiza controles UI para refletir a economia atual
  document.getElementById('sliderJuros').value = economyToDisplay.taxaJuros;
  document.getElementById('jurosValue').textContent = economyToDisplay.taxaJuros.toFixed(1);
  
  document.getElementById('sliderImposto').value = economyToDisplay.taxaImposto;
  document.getElementById('impostoValue').textContent = economyToDisplay.taxaImposto.toFixed(1);
  
  document.getElementById('sliderInvestimento').value = economyToDisplay.investimentoPublico;
  document.getElementById('investimentoValue').textContent = economyToDisplay.investimentoPublico.toFixed(1);
  
  // Atualiza setores econômicos
  atualizarSetoresEconomicos(economyToDisplay);
  
  // Atualiza a classificação de crédito e relação dívida/PIB
  const dividaPIB = economyToDisplay.dividaPublica / economyToDisplay.pib;
  document.getElementById('dividaPIBValue').textContent = `${(dividaPIB * 100).toFixed(2)}%`;
  document.getElementById('creditRatingValue').textContent = economyToDisplay.classificacaoCredito;
  
  // Atualiza a cor da classificação de crédito de acordo com o rating
  const ratingElement = document.getElementById('creditRatingValue');
  ratingElement.className = '';
  
  if (economyToDisplay.classificacaoCredito === 'AAA' || economyToDisplay.classificacaoCredito === 'AA' || economyToDisplay.classificacaoCredito === 'A') {
    ratingElement.classList.add('rating-high');
  } else if (economyToDisplay.classificacaoCredito === 'BBB') {
    ratingElement.classList.add('rating-medium');
  } else if (economyToDisplay.classificacaoCredito === 'BB' || economyToDisplay.classificacaoCredito === 'B') {
    ratingElement.classList.add('rating-low');
  } else {
    ratingElement.classList.add('rating-very-low');
  }
  
  // Sincroniza a economia global para compatibilidade
  if (economyToDisplay === countryManager.getActiveCountry()) {
    Object.assign(economy, economyToDisplay);
  }
}

/**
 * Atualiza a interface dos setores econômicos (produção, necessidades e saldos)
 * @param {Economy} economyInstance - Instância da economia
 */
export function atualizarSetoresEconomicos(economyInstance) {
  // Compatibilidade com código antigo
  if (!economyInstance) {
    economyInstance = countryManager.getActiveCountry();
  }
  
  // Calcula valores absolutos dos setores
  const commoditiesAbsoluto = (economyInstance.pib * economyInstance.commodities / 100).toFixed(2);
  const manufaturasAbsoluto = (economyInstance.pib * economyInstance.manufaturas / 100).toFixed(2);
  const servicosAbsoluto = (economyInstance.pib * economyInstance.servicos / 100).toFixed(2);
  
  // Atualiza percentuais
  document.getElementById('commoditiesValue').textContent = `${economyInstance.commodities}%`;
  document.getElementById('manufaturasValue').textContent = `${economyInstance.manufaturas}%`;
  document.getElementById('servicosValue').textContent = `${economyInstance.servicos}%`;
  
  // Atualiza valores absolutos
  document.getElementById('commoditiesAbsoluto').textContent = `${commoditiesAbsoluto} bi`;
  document.getElementById('manufaturasAbsoluto').textContent = `${manufaturasAbsoluto} bi`;
  document.getElementById('servicosAbsoluto').textContent = `${servicosAbsoluto} bi`;
  
  // Atualiza necessidades (valores absolutos)
  document.getElementById('necessidadeCommoditiesValue').textContent = `${economyInstance.necessidadeCommodities.toFixed(2)} bi`;
  document.getElementById('necessidadeManufaturasValue').textContent = `${economyInstance.necessidadeManufaturas.toFixed(2)} bi`;
  
  // Calcula e atualiza saldos
  const saldoCommodities = parseFloat(commoditiesAbsoluto) - economyInstance.necessidadeCommodities;
  const saldoManufaturas = parseFloat(manufaturasAbsoluto) - economyInstance.necessidadeManufaturas;
  
  // Formata saldos com sinal de + ou -
  const saldoCommoditiesFormatado = (saldoCommodities >= 0 ? '+' : '') + saldoCommodities.toFixed(2) + ' bi';
  const saldoManufaturasFormatado = (saldoManufaturas >= 0 ? '+' : '') + saldoManufaturas.toFixed(2) + ' bi';
  
  document.getElementById('saldoCommoditiesValue').textContent = saldoCommoditiesFormatado;
  document.getElementById('saldoManufaturasValue').textContent = saldoManufaturasFormatado;
  
  // Aplica classes CSS para colorir os saldos
  document.getElementById('saldoCommoditiesValue').className = saldoCommodities >= 0 ? 'saldo-positivo' : 'saldo-negativo';
  document.getElementById('saldoManufaturasValue').className = saldoManufaturas >= 0 ? 'saldo-positivo' : 'saldo-negativo';
}

/**
 * Atualiza a tabela de dívidas na interface
 * @param {Economy} economyInstance - Instância da economia
 */
export function atualizarTabelaDividas(economyInstance) {
  // Compatibilidade com código antigo
  if (!economyInstance) {
    economyInstance = countryManager.getActiveCountry();
  }
  
  const tbody = document.getElementById('corpoTabelaDividas');
  tbody.innerHTML = '';
  
  // Verifica se existe o elemento thead na tabela e o atualiza
  const thead = document.querySelector('#tabelaDividas thead');
  if (thead) {
    thead.innerHTML = `
      <tr>
        <th>ID</th>
        <th>Data Emissão</th>
        <th>Valor Original</th>
        <th>Valor Restante</th>
        <th>Juros</th>
        <th>Pagamento Mensal</th>
        <th>Parcelas Restantes</th>
        <th>Juros Futuros</th>
      </tr>
    `;
  }
  
  if (economyInstance.registroDividas.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="8" style="text-align: center;">Não há dívidas registradas.</td>';
    tbody.appendChild(row);
    document.getElementById('pagamentoMensalValue').textContent = '0.00';
    return;
  }
  
  let pagamentoMensalTotal = 0;
  let totalJurosFuturos = 0;
  
  economyInstance.registroDividas.forEach(divida => {
    // Calcula o custo total futuro (pagamento mensal * parcelas restantes)
    const custoTotalFuturo = divida.pagamentoMensal * divida.parcelasRestantes;
    // Calcula juros futuros (custo total futuro - valor restante)
    const jurosFuturos = custoTotalFuturo - divida.valorRestante;
    totalJurosFuturos += jurosFuturos;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${divida.id}</td>
      <td>${divida.dataEmissao.toLocaleDateString('pt-BR')}</td>
      <td>${divida.valorOriginal.toFixed(2)}</td>
      <td>${divida.valorRestante.toFixed(2)}</td>
      <td>${divida.taxaJuros.toFixed(2)}%</td>
      <td>${divida.pagamentoMensal.toFixed(2)}</td>
      <td>${divida.parcelasRestantes}</td>
      <td>${jurosFuturos.toFixed(2)}</td>
    `;
    
    tbody.appendChild(row);
    pagamentoMensalTotal += divida.pagamentoMensal;
  });
  
  document.getElementById('pagamentoMensalValue').textContent = pagamentoMensalTotal.toFixed(2);
  
  // Adiciona total de juros futuros, se o elemento existir
  if (document.getElementById('jurosFuturosValue')) {
    document.getElementById('jurosFuturosValue').textContent = totalJurosFuturos.toFixed(2);
  }
}

/**
 * Cria elemento de interface para selecionar países
 * @param {Element} container - Elemento HTML para conter o seletor
 */
export function criarSeletorPaises(container) {
  // Cria div contêiner para o seletor
  const seletorDiv = document.createElement('div');
  seletorDiv.className = 'seletor-paises';
  
  // Cria label
  const label = document.createElement('label');
  label.textContent = 'Selecionar País: ';
  label.htmlFor = 'seletor-pais';
  
  // Cria select
  const select = document.createElement('select');
  select.id = 'seletor-pais';
  
  // Adiciona evento de mudança
  select.addEventListener('change', (e) => {
    const novoPaisId = e.target.value;
    if (countryManager.setActiveCountry(novoPaisId)) {
      atualizarDisplay();
      atualizarTabelaDividas();
    }
  });
  
  // Adiciona os elementos ao contêiner
  seletorDiv.appendChild(label);
  seletorDiv.appendChild(select);
  container.appendChild(seletorDiv);
  
  // Atualiza as opções do seletor
  atualizarOpcoesSeletorPaises();
}

/**
 * Atualiza as opções do seletor de países
 */
export function atualizarOpcoesSeletorPaises() {
  const select = document.getElementById('seletor-pais');
  if (!select) return;
  
  // Limpa opções existentes
  select.innerHTML = '';
  
  // Adiciona uma opção para cada país
  countryManager.getAllCountryIds().forEach(id => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id; // Pode ser melhorado para mostrar nome do país
    
    // Seleciona o país ativo
    if (id === countryManager.activeCountryId) {
      option.selected = true;
    }
    
    select.appendChild(option);
  });
}