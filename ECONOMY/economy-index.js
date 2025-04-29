// index.js (modificado)
import { economy } from './economy-economy.js';
import { countryManager, carregarPaisesDoJSON } from './economy-countries.js';
import { 
  atualizarDisplay, 
  atualizarTabelaDividas, 
  updateJuros, 
  updateImposto, 
  updateInvestimento, 
  criarSeletorPaises,
  atualizarOpcoesSeletorPaises
} from './economy-ui.js';
import { emitirTitulos } from './economy-debt.js';
import { avancarTurno, toggleAutoPlay } from './economy-game.js';

/**
 * Inicializa o jogo quando a página carrega
 */
window.addEventListener('DOMContentLoaded', async () => {
  // Adiciona seletor de países ao DOM
  const headerPainel = document.getElementById('status');
  if (headerPainel) {
    criarSeletorPaises(headerPainel);
  }
  
  // Carrega os países do arquivo JSON
  await carregarPaisesDoJSON('economy-countries-data.json');
  
  // Verifica se foi possível carregar algum país
  if (countryManager.getAllCountryIds().length === 0) {
    console.error('Erro: Nenhum país encontrado no arquivo JSON.');
    alert('Erro: Não foi possível carregar nenhum país do arquivo JSON.');
    return;
  }
  
  // Atualiza o seletor com os países carregados
  atualizarOpcoesSeletorPaises();
  
  // Sincroniza economia global para compatibilidade
  Object.assign(economy, countryManager.getActiveCountry());
  
  // Inicializar displays
  atualizarDisplay();
  atualizarTabelaDividas();
  
  // Event listeners para os sliders
  document.getElementById('sliderJuros').addEventListener('input', (e) => {
    updateJuros(e.target.value);
  });
  
  document.getElementById('sliderImposto').addEventListener('input', (e) => {
    updateImposto(e.target.value);
  });
  
  document.getElementById('sliderInvestimento').addEventListener('input', (e) => {
    updateInvestimento(e.target.value);
  });
  
  // Event listeners para os botões
  document.getElementById('botaoEmitirTitulos').addEventListener('click', emitirTitulos);
  document.getElementById('botaoProximoTurno').addEventListener('click', avancarTurno);
  document.getElementById('autoPlay').addEventListener('click', toggleAutoPlay);
});

// Exporta as principais funções e variáveis para acesso global
export { economy, countryManager };