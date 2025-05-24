import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { COUNTRY_STATE_EVENTS } from '../../store/socketReduxMiddleware';
import { 
  selectCountryEconomy,
  selectCountryEconomicIndicators,
  selectCountryDebtSummary,
  selectCountryStateLoading,
  selectLastUpdated
} from '../country/countryStateSlice';
import { socketApi } from '../../services/socketClient';
import MessageService from '../../ui/toast/messageService';
import './EconomyPanel.css';

/**
 * EconomyPanel.jsx (Simplificado)
 * Interface principal para controle econômico
 * Sliders só aplicam mudanças via botão "Aplicar"
 */
const EconomyPanel = ({ onOpenDebtPopup }) => {
  const dispatch = useDispatch();
  
  // ======================================================================
  // DADOS DO REDUX (fonte única de verdade)
  // ======================================================================
  
  const myCountry = useSelector(state => state.game?.myCountry);
  const currentRoom = useSelector(state => state.rooms?.currentRoom);
  
  // Dados econômicos vindos do servidor (via Redux cache)
  const economicIndicators = useSelector(state => 
    selectCountryEconomicIndicators(state, currentRoom?.name, myCountry)
  );
  const debtSummary = useSelector(state => 
    selectCountryDebtSummary(state, currentRoom?.name, myCountry)
  );
  const loading = useSelector(selectCountryStateLoading);
  const lastUpdated = useSelector(state => selectLastUpdated(state, currentRoom?.name));
  
  // ======================================================================
  // ESTADO LOCAL (SIMPLES - apenas valores dos sliders)
  // ======================================================================
  
  // Valores dos sliders (controlados apenas pelo usuário)
  const [sliderValues, setSliderValues] = useState({
    interestRate: 8.0,
    taxBurden: 40.0,
    publicServices: 30.0
  });
  
  // Valores aplicados no servidor (última aplicação bem-sucedida)
  const [appliedValues, setAppliedValues] = useState({
    interestRate: 8.0,
    taxBurden: 40.0,
    publicServices: 30.0
  });
  
  // Controle de UI
  const [bondAmount, setBondAmount] = useState('');
  const [isIssuingBonds, setIsIssuingBonds] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState(new Set());
  
  // Flag para inicialização (só inicializa os sliders uma vez)
  const [initialized, setInitialized] = useState(false);
  
  // ======================================================================
  // INICIALIZAÇÃO DOS SLIDERS (APENAS UMA VEZ)
  // ======================================================================
  
  // Inicializar sliders apenas uma vez com dados do servidor
  useEffect(() => {
    if (economicIndicators && !initialized) {
      const serverValues = {
        interestRate: economicIndicators.interestRate || 8.0,
        taxBurden: economicIndicators.taxBurden || 40.0,
        publicServices: economicIndicators.publicServices || 30.0
      };
      
      setSliderValues(serverValues);
      setAppliedValues(serverValues);
      setInitialized(true);
      
      console.log('[ECONOMY] Sliders inicializados com valores do servidor:', serverValues);
    }
  }, [economicIndicators, initialized]);
  
  // Assinar para atualizações quando o componente montar
  useEffect(() => {
    if (currentRoom?.name) {
      dispatch({ type: COUNTRY_STATE_EVENTS.SUBSCRIBE, payload: currentRoom.name });
      
      return () => {
        dispatch({ type: COUNTRY_STATE_EVENTS.UNSUBSCRIBE, payload: currentRoom.name });
      };
    }
  }, [currentRoom?.name, dispatch]);
  
  // ======================================================================
  // HANDLERS DOS SLIDERS (SIMPLES)
  // ======================================================================
  
  /**
   * Handler para mudança do slider (apenas atualiza valor local)
   */
  const handleSliderChange = useCallback((parameter, value) => {
    setSliderValues(prev => ({
      ...prev,
      [parameter]: parseFloat(value)
    }));
  }, []);
  
  /**
   * Handler para aplicar mudança (envia para servidor)
   */
  const handleApplyParameter = useCallback(async (parameter) => {
    if (!currentRoom?.name || !myCountry) return;
    
    const newValue = sliderValues[parameter];
    
    // Validações
    if (isNaN(newValue)) {
      MessageService.showError('Valor inválido');
      return;
    }
    
    let min = 0, max = 100;
    if (parameter === 'interestRate') {
      max = 25;
    } else if (parameter === 'taxBurden') {
      max = 60;
    } else if (parameter === 'publicServices') {
      max = 60;
    }
    
    if (newValue < min || newValue > max) {
      MessageService.showError(`Valor deve estar entre ${min}% e ${max}%`);
      return;
    }
    
    // Verificar se há diferença para aplicar
    if (Math.abs(newValue - appliedValues[parameter]) < 0.1) {
      MessageService.showInfo('Valor não alterado');
      return;
    }
    
    // Marcar como pendente
    setPendingUpdates(prev => new Set([...prev, parameter]));
    
    try {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('updateEconomicParameter', {
          parameter: parameter,
          value: newValue
        });
        
        console.log(`[ECONOMY] Aplicando: ${parameter} = ${newValue}% para ${myCountry}`);
      }
    } catch (error) {
      console.error(`Erro ao aplicar ${parameter}:`, error);
      MessageService.showError(`Erro ao aplicar ${parameter}: ${error.message}`);
      
      // Remover dos pending em caso de erro
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(parameter);
        return newSet;
      });
    }
  }, [sliderValues, appliedValues, currentRoom?.name, myCountry]);
  
  /**
   * CORRIGIDO: Emite títulos de dívida
   */
  const handleIssueBonds = useCallback(async () => {
    const amount = parseFloat(bondAmount);
    
    if (!amount || amount <= 0 || amount > 1000) {
      MessageService.showError('Valor deve estar entre 0 e 1000 bilhões');
      return;
    }
    
    if (!currentRoom?.name || !myCountry) {
      MessageService.showError('Erro: dados da sala ou país não encontrados');
      return;
    }
    
    setIsIssuingBonds(true);
    
    try {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('issueDebtBonds', { 
          bondAmount: amount,
          isEmergency: false
        });
        
        console.log(`[ECONOMY] Emitindo ${amount} bi USD em títulos para ${myCountry}`);
        setBondAmount('');
      }
    } catch (error) {
      console.error('Erro ao emitir títulos:', error);
      MessageService.showError('Erro ao emitir títulos: ' + error.message);
      setIsIssuingBonds(false);
    }
  }, [bondAmount, currentRoom?.name, myCountry]);
  
  /**
   * CORRIGIDO: Abre popup de dívidas com dados corretos
   */
  const handleOpenDebtPopup = useCallback(() => {
    if (economicIndicators && debtSummary && onOpenDebtPopup) {
      console.log('[ECONOMY] Abrindo popup de dívidas:', { debtSummary, economicIndicators });
      onOpenDebtPopup(debtSummary, debtSummary.contracts || [], economicIndicators);
    } else {
      console.warn('[ECONOMY] Dados insuficientes para abrir popup de dívidas');
      MessageService.showWarning('Aguardando dados de dívida...');
    }
  }, [economicIndicators, debtSummary, onOpenDebtPopup]);
  
  // ======================================================================
  // EVENTOS DO SERVIDOR (CORRIGIDOS)
  // ======================================================================
  
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    // Handler para confirmação de emissão de títulos
    const handleDebtBondsIssued = (data) => {
      console.log('[ECONOMY] Títulos emitidos confirmados:', data);
      
      const { success, bondAmount: issuedAmount, message } = data;
      
      if (success) {
        MessageService.showSuccess(`Títulos emitidos: ${issuedAmount} bi USD`, 4000);
      } else {
        MessageService.showError(message || 'Falha na emissão de títulos');
      }
      
      setIsIssuingBonds(false);
    };
    
    // Handler para confirmação de parâmetros aplicados
    const handleParameterUpdated = (data) => {
      console.log('[ECONOMY] Parâmetro confirmado pelo servidor:', data);
      
      const { countryName, roomName, parameter, value, success } = data;
      
      // Só processar se for para o país atual
      if (countryName === myCountry && roomName === currentRoom?.name) {
        // Remover dos pending updates
        setPendingUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(parameter);
          return newSet;
        });
        
        if (success !== false) {
          // Atualizar valor aplicado (confirmação do servidor)
          setAppliedValues(prev => ({
            ...prev,
            [parameter]: value
          }));
          
          const parameterNames = {
            interestRate: 'Taxa de Juros',
            taxBurden: 'Carga Tributária', 
            publicServices: 'Investimento Público'
          };
          
          const parameterName = parameterNames[parameter] || parameter;
          MessageService.showSuccess(`${parameterName} aplicada: ${value}%`);
        }
      }
    };
    
    // Handler para títulos de emergência
    const handleEmergencyBonds = (data) => {
      console.log('[ECONOMY] Títulos de emergência:', data);
      
      const { success, message } = data;
      
      if (success) {
        MessageService.showWarning(`Emergência: ${message}`, 6000);
      } else {
        MessageService.showError(message || 'Falha na emissão de títulos de emergência');
      }
      
      setIsIssuingBonds(false);
    };
    
    // Registrar handlers
    socket.on('debtBondsIssued', handleDebtBondsIssued);
    socket.on('economicParameterUpdated', handleParameterUpdated);
    socket.on('emergencyBondsIssued', handleEmergencyBonds);
    
    return () => {
      socket.off('debtBondsIssued', handleDebtBondsIssued);
      socket.off('economicParameterUpdated', handleParameterUpdated);
      socket.off('emergencyBondsIssued', handleEmergencyBonds);
    };
  }, [myCountry, currentRoom?.name]);
  
  // ======================================================================
  // UTILITÁRIOS DE FORMATAÇÃO (memoizados)
  // ======================================================================
  
  const formatters = useMemo(() => ({
    currency: (value) => {
      if (value === undefined || value === null || isNaN(value)) return '0.00';
      return Number(value).toFixed(2);  // ← ALTERADO PARA 2 CASAS DECIMAIS
    },
    
    percent: (value) => {
      if (value === undefined || value === null || isNaN(value)) return '0.00%';
      return Number(value).toFixed(2) + '%';  // ← ALTERADO PARA 2 CASAS DECIMAIS
    },
    
    valueWithSign: (value) => {
      if (value === undefined || value === null || isNaN(value)) return '0.00';
      const num = Number(value);
      return (num >= 0 ? '+' : '') + num.toFixed(2);  // ← ALTERADO PARA 2 CASAS DECIMAIS
    },
    
    creditRatingColor: (rating) => {
      if (['AAA', 'AA', 'A'].includes(rating)) return '#28a745';
      if (rating === 'BBB') return '#ffc107';
      if (['BB', 'B'].includes(rating)) return '#fd7e14';
      return '#dc3545';
    }
  }), []);
  
  // ======================================================================
  // VALIDAÇÕES E CHECKS
  // ======================================================================
  
  if (!myCountry) {
    return (
      <div className="advanced-economy-panel">
        <p>Você precisa estar controlando um país para ver os dados econômicos.</p>
      </div>
    );
  }
  
  if (loading || !economicIndicators) {
    return (
      <div className="advanced-economy-panel">
        <p>Carregando dados econômicos...</p>
        {myCountry && <p><small>País: {myCountry}</small></p>}
        {currentRoom && <p><small>Sala: {currentRoom.name}</small></p>}
      </div>
    );
  }
  
  // Verificar se há valores inválidos e mostrar fallbacks
  const safeIndicators = {
    gdp: economicIndicators.gdp || 100,
    treasury: economicIndicators.treasury || 10,
    publicDebt: economicIndicators.publicDebt || 0,
    inflation: economicIndicators.inflation || 0,
    unemployment: economicIndicators.unemployment || 0,
    popularity: economicIndicators.popularity || 50,
    creditRating: economicIndicators.creditRating || 'A',
    interestRate: economicIndicators.interestRate || 8.0,
    taxBurden: economicIndicators.taxBurden || 40.0,
    publicServices: economicIndicators.publicServices || 30.0,
    gdpGrowth: economicIndicators.gdpGrowth || 0
  };
  
  // ======================================================================
  // RENDER
  // ======================================================================
  
  return (
    <div className="advanced-economy-panel">
      
      {/* Indicadores Principais (dados do servidor) */}
      <div className="main-indicators">
        <div className="indicator">
          <label>PIB:</label>
          <div className="indicator-value">
            <span className="value">{formatters.currency(safeIndicators.gdp)} bi</span>
            <span className={`growth ${safeIndicators.gdpGrowth >= 0 ? 'positive' : 'negative'}`}>
              {formatters.valueWithSign(safeIndicators.gdpGrowth)}% anual
            </span>
          </div>
        </div>
        
        <div className="indicator">
          <label>Tesouro:</label>
          <span className={`value ${safeIndicators.treasury >= 0 ? '' : 'negative'}`}>
            {formatters.currency(safeIndicators.treasury)} bi
          </span>
        </div>
        
        <div className="indicator">
          <label>Dívida Pública:</label>
          <div className="indicator-value">
            <span className="value">{formatters.currency(safeIndicators.publicDebt)} bi</span>
            <span className="debt-ratio">
              {formatters.percent((safeIndicators.publicDebt / safeIndicators.gdp) * 100)} PIB
            </span>
          </div>
        </div>
        
        <div className="indicator">
          <label>Inflação:</label>
          <span className={`value ${safeIndicators.inflation > 5 ? 'negative' : 'positive'}`}>
            {formatters.percent(safeIndicators.inflation)}
          </span>
        </div>
        
        <div className="indicator">
          <label>Desemprego:</label>
          <span className={`value ${safeIndicators.unemployment > 10 ? 'negative' : 'positive'}`}>
            {formatters.percent(safeIndicators.unemployment)}
          </span>
        </div>
        
        <div className="indicator">
          <label>Popularidade:</label>
          <span className={`value ${safeIndicators.popularity > 50 ? 'positive' : 'negative'}`}>
            {formatters.percent(safeIndicators.popularity)}
          </span>
        </div>
        
        <div className="indicator credit-indicator">
          <label>Rating:</label>
          <span 
            className="credit-rating" 
            style={{ color: formatters.creditRatingColor(safeIndicators.creditRating) }}
          >
            {safeIndicators.creditRating}
          </span>
        </div>
      </div>
      
      {/* Controles Econômicos (SIMPLIFICADOS) */}
      <div className="economic-controls">
        <h4>Parâmetros Econômicos</h4>
        
        <div className="control-group">
          <label>Taxa de Juros: {formatters.percent(sliderValues.interestRate)}</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="25"
              step="0.25"
              value={sliderValues.interestRate}
              onChange={(e) => handleSliderChange('interestRate', e.target.value)}
              disabled={pendingUpdates.has('interestRate')}
            />
            <button 
              onClick={() => handleApplyParameter('interestRate')}
              disabled={
                Math.abs(sliderValues.interestRate - appliedValues.interestRate) < 0.1 || 
                pendingUpdates.has('interestRate')
              }
            >
              {pendingUpdates.has('interestRate') ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <label>Carga Tributária: {formatters.percent(sliderValues.taxBurden)}</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="60"
              step="0.5"
              value={sliderValues.taxBurden}
              onChange={(e) => handleSliderChange('taxBurden', e.target.value)}
              disabled={pendingUpdates.has('taxBurden')}
            />
            <button 
              onClick={() => handleApplyParameter('taxBurden')}
              disabled={
                Math.abs(sliderValues.taxBurden - appliedValues.taxBurden) < 0.1 || 
                pendingUpdates.has('taxBurden')
              }
            >
              {pendingUpdates.has('taxBurden') ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <label>Investimento Público: {formatters.percent(sliderValues.publicServices)}</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="60"
              step="0.5"
              value={sliderValues.publicServices}
              onChange={(e) => handleSliderChange('publicServices', e.target.value)}
              disabled={pendingUpdates.has('publicServices')}
            />
            <button 
              onClick={() => handleApplyParameter('publicServices')}
              disabled={
                Math.abs(sliderValues.publicServices - appliedValues.publicServices) < 0.1 || 
                pendingUpdates.has('publicServices')
              }
            >
              {pendingUpdates.has('publicServices') ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Emissão de Títulos */}
      <div className="bonds-section">
        <h4>Títulos da Dívida Pública</h4>
        
        <div className="bonds-controls">
          <input
            type="number"
            placeholder="Valor (bi USD)"
            min="0"
            max="1000"
            step="0.1"
            value={bondAmount}
            onChange={(e) => setBondAmount(e.target.value)}
            disabled={isIssuingBonds}
          />
          <button 
            className="btn-issue-bonds"
            onClick={handleIssueBonds}
            disabled={isIssuingBonds || !bondAmount || parseFloat(bondAmount) <= 0}
          >
            {isIssuingBonds ? 'Emitindo...' : 'Emitir'}
          </button>
        </div>
        
        {/* Informação sobre capacidade de endividamento */}
        {safeIndicators.publicDebt > 0 && (
          <div className="debt-info">
            <small>
              Capacidade: {formatters.percent(Math.max(0, 120 - (safeIndicators.publicDebt / safeIndicators.gdp) * 100))} restante
            </small>
          </div>
        )}
        
        {/* Botão de resumo de dívidas */}
        {debtSummary && debtSummary.numberOfContracts > 0 && (
          <button 
            className="debt-summary-btn"
            onClick={handleOpenDebtPopup}
          >
            Ver Dívidas ({debtSummary.numberOfContracts} {debtSummary.numberOfContracts === 1 ? 'contrato' : 'contratos'})
          </button>
        )}
      </div>
      
      {/* Debug info em desenvolvimento */}
      {process.env.NODE_ENV === 'development' && lastUpdated && (
        <div style={{ 
          fontSize: '10px', 
          color: '#666', 
          marginTop: '10px', 
          padding: '8px', 
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '4px'
        }}>
          <div>✅ Dados sincronizados com countryStateManager</div>
          <div>💰 PIB: {formatters.currency(safeIndicators.gdp)} | Tesouro: {formatters.currency(safeIndicators.treasury)}</div>
          <div>📊 Inflação: {formatters.percent(safeIndicators.inflation)} | Desemprego: {formatters.percent(safeIndicators.unemployment)} | Rating: {safeIndicators.creditRating}</div>
          <div>📄 Dívidas: {debtSummary?.numberOfContracts || 0} contratos</div>
          <div>🎛️ Sliders: Juros {formatters.percent(sliderValues.interestRate)} | Impostos {formatters.percent(sliderValues.taxBurden)} | Serviços {formatters.percent(sliderValues.publicServices)}</div>
          <div>✅ Aplicados: Juros {formatters.percent(appliedValues.interestRate)} | Impostos {formatters.percent(appliedValues.taxBurden)} | Serviços {formatters.percent(appliedValues.publicServices)}</div>
          <div>🕐 Última atualização: {new Date(lastUpdated).toLocaleTimeString()}</div>
          <div>🔄 Pending: {pendingUpdates.size > 0 ? Array.from(pendingUpdates).join(', ') : 'Nenhum'}</div>
        </div>
      )}
    </div>
  );
};

export default EconomyPanel;