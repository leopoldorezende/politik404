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
 * EconomyPanel.jsx (Otimizado)
 * Apenas exibe dados do servidor e envia comandos
 * Não faz cálculos próprios, usa dados do cache Redux
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
  // ESTADO LOCAL (apenas para UI, não para dados)
  // ======================================================================
  
  // Parâmetros locais (antes de aplicar)
  const [localParameters, setLocalParameters] = useState({
    interestRate: 8.0,
    taxBurden: 40.0,
    publicServices: 30.0
  });
  
  // Controle de UI
  const [bondAmount, setBondAmount] = useState('');
  const [isIssuingBonds, setIsIssuingBonds] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState(new Set());
  
  // ======================================================================
  // SINCRONIZAÇÃO COM DADOS DO SERVIDOR
  // ======================================================================
  
  // Sincronizar parâmetros locais com dados vindos do servidor
  useEffect(() => {
    if (economicIndicators) {
      setLocalParameters({
        interestRate: economicIndicators.interestRate || 8.0,
        taxBurden: economicIndicators.taxBurden || 40.0,
        publicServices: economicIndicators.publicServices || 30.0
      });
    }
  }, [economicIndicators?.interestRate, economicIndicators?.taxBurden, economicIndicators?.publicServices]);
  
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
  // HANDLERS DE COMANDOS (enviam para servidor)
  // ======================================================================
  
  /**
   * Aplica mudança de parâmetro econômico (envia comando ao servidor)
   */
  const applyParameterChange = useCallback(async (parameter, value) => {
    if (!currentRoom?.name || !myCountry) return;
    
    const newValue = parseFloat(value);
    
    // Marcar como pendente
    setPendingUpdates(prev => new Set([...prev, parameter]));
    
    try {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        // COMANDO: Enviar para servidor processar
        socket.emit('updateEconomicParameter', {
          roomName: currentRoom.name,
          countryName: myCountry,
          parameter: parameter,
          value: newValue
        });
        
        const parameterNames = {
          interestRate: 'Taxa de Juros',
          taxBurden: 'Carga Tributária', 
          publicServices: 'Investimento Público'
        };
        
        MessageService.showSuccess(`${parameterNames[parameter]} alterada para ${newValue}%`);
      }
    } catch (error) {
      MessageService.showError(`Erro ao atualizar ${parameter}: ${error.message}`);
    } finally {
      // Remover dos pending após um tempo
      setTimeout(() => {
        setPendingUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(parameter);
          return newSet;
        });
      }, 1000);
    }
  }, [currentRoom?.name, myCountry]);
  
  /**
   * Emite títulos de dívida (envia comando ao servidor)
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
        // COMANDO: Enviar para servidor processar
        socket.emit('issueDebtBonds', { bondAmount: amount });
        MessageService.showSuccess(`Emitindo ${amount} bi USD em títulos...`);
        setBondAmount('');
      }
    } catch (error) {
      MessageService.showError('Erro ao emitir títulos: ' + error.message);
    } finally {
      setTimeout(() => setIsIssuingBonds(false), 2000);
    }
  }, [bondAmount, currentRoom?.name, myCountry]);
  
  /**
   * Abre popup de dívidas (usa dados do Redux)
   */
  const handleOpenDebtPopup = useCallback(() => {
    if (economicIndicators && debtSummary && onOpenDebtPopup) {
      // Usar dados vindos do servidor via Redux
      onOpenDebtPopup(debtSummary, debtSummary.contracts || [], economicIndicators);
    }
  }, [economicIndicators, debtSummary, onOpenDebtPopup]);
  
  // ======================================================================
  // EVENTOS DO SERVIDOR
  // ======================================================================
  
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    const handleDebtBondsIssued = (data) => {
      MessageService.showSuccess(`Títulos emitidos! Nova dívida: ${data.newPublicDebt} bi`);
      setIsIssuingBonds(false);
    };
    
    const handleParameterUpdated = (data) => {
      if (data.countryName === myCountry && data.roomName === currentRoom?.name) {
        console.log(`Parâmetro ${data.parameter} confirmado no servidor:`, data.value);
        
        // Remover dos pending updates
        setPendingUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.parameter);
          return newSet;
        });
      }
    };
    
    socket.on('debtBondsIssued', handleDebtBondsIssued);
    socket.on('economicParameterUpdated', handleParameterUpdated);
    
    return () => {
      socket.off('debtBondsIssued', handleDebtBondsIssued);
      socket.off('economicParameterUpdated', handleParameterUpdated);
    };
  }, [myCountry, currentRoom?.name]);
  
  // ======================================================================
  // UTILITÁRIOS DE FORMATAÇÃO (memoizados)
  // ======================================================================
  
  const formatters = useMemo(() => ({
    currency: (value) => {
      if (value === undefined || value === null || isNaN(value)) return '0.0';
      return Number(value).toFixed(1);
    },
    
    percent: (value) => {
      if (value === undefined || value === null || isNaN(value)) return '0.0%';
      return Number(value).toFixed(1) + '%';
    },
    
    valueWithSign: (value) => {
      if (value === undefined || value === null || isNaN(value)) return '0.0';
      const num = Number(value);
      return (num >= 0 ? '+' : '') + num.toFixed(1);
    },
    
    creditRatingColor: (rating) => {
      if (['AAA', 'AA', 'A'].includes(rating)) return '#28a745';
      if (rating === 'BBB') return '#ffc107';
      if (['BB', 'B'].includes(rating)) return '#fd7e14';
      return '#dc3545';
    }
  }), []);
  
  // ======================================================================
  // CHECKS DE EXIBIÇÃO
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
      </div>
    );
  }
  
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
            <span className="value">{formatters.currency(economicIndicators.gdp)} bi</span>
            <span className={`growth ${economicIndicators.gdpGrowth >= 0 ? 'positive' : 'negative'}`}>
              {formatters.valueWithSign(economicIndicators.gdpGrowth)}% anual
            </span>
          </div>
        </div>
        
        <div className="indicator">
          <label>Tesouro:</label>
          <span className="value">{formatters.currency(economicIndicators.treasury)} bi</span>
        </div>
        
        <div className="indicator">
          <label>Dívida Pública:</label>
          <div className="indicator-value">
            <span className="value">{formatters.currency(economicIndicators.publicDebt)} bi</span>
            <span className="debt-ratio">
              {formatters.percent((economicIndicators.publicDebt / economicIndicators.gdp) * 100)} PIB
            </span>
          </div>
        </div>
        
        <div className="indicator">
          <label>Inflação:</label>
          <span className={`value ${economicIndicators.inflation > 5 ? 'negative' : 'positive'}`}>
            {formatters.percent(economicIndicators.inflation)}
          </span>
        </div>
        
        <div className="indicator">
          <label>Desemprego:</label>
          <span className={`value ${economicIndicators.unemployment > 10 ? 'negative' : 'positive'}`}>
            {formatters.percent(economicIndicators.unemployment)}
          </span>
        </div>
        
        <div className="indicator">
          <label>Popularidade:</label>
          <span className={`value ${economicIndicators.popularity > 50 ? 'positive' : 'negative'}`}>
            {formatters.percent(economicIndicators.popularity)}
          </span>
        </div>
        
        <div className="indicator credit-indicator">
          <label>Rating:</label>
          <span 
            className="credit-rating" 
            style={{ color: formatters.creditRatingColor(economicIndicators.creditRating) }}
          >
            {economicIndicators.creditRating}
          </span>
        </div>
      </div>
      
      {/* Controles Econômicos (comandos para servidor) */}
      <div className="economic-controls">
        <h4>Parâmetros Econômicos</h4>
        
        <div className="control-group">
          <label>Taxa de Juros: {formatters.percent(localParameters.interestRate)}</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="25"
              step="0.25"
              value={localParameters.interestRate}
              onChange={(e) => setLocalParameters(prev => ({
                ...prev,
                interestRate: parseFloat(e.target.value)
              }))}
            />
            <button 
              onClick={() => applyParameterChange('interestRate', localParameters.interestRate)}
              disabled={localParameters.interestRate === economicIndicators.interestRate || pendingUpdates.has('interestRate')}
            >
              {pendingUpdates.has('interestRate') ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <label>Carga Tributária: {formatters.percent(localParameters.taxBurden)}</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="60"
              step="0.5"
              value={localParameters.taxBurden}
              onChange={(e) => setLocalParameters(prev => ({
                ...prev,
                taxBurden: parseFloat(e.target.value)
              }))}
            />
            <button 
              onClick={() => applyParameterChange('taxBurden', localParameters.taxBurden)}
              disabled={localParameters.taxBurden === economicIndicators.taxBurden || pendingUpdates.has('taxBurden')}
            >
              {pendingUpdates.has('taxBurden') ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <label>Investimento Público: {formatters.percent(localParameters.publicServices)}</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="60"
              step="0.5"
              value={localParameters.publicServices}
              onChange={(e) => setLocalParameters(prev => ({
                ...prev,
                publicServices: parseFloat(e.target.value)
              }))}
            />
            <button 
              onClick={() => applyParameterChange('publicServices', localParameters.publicServices)}
              disabled={localParameters.publicServices === economicIndicators.publicServices || pendingUpdates.has('publicServices')}
            >
              {pendingUpdates.has('publicServices') ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Emissão de Títulos (comando para servidor) */}
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
            disabled={isIssuingBonds || !bondAmount}
          >
            {isIssuingBonds ? 'Emitindo...' : 'Emitir'}
          </button>
        </div>
        
        {/* Botão de resumo de dívidas (dados do Redux) */}
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
        <div style={{ fontSize: '10px', color: '#666', marginTop: '10px', padding: '8px', background: 'rgba(255,255,255,0.1)' }}>
          <div>✅ Dados do servidor via Redux Cache</div>
          <div>💰 PIB: {formatters.currency(economicIndicators.gdp)} bi | Tesouro: {formatters.currency(economicIndicators.treasury)} bi</div>
          <div>📄 Contratos: {debtSummary?.numberOfContracts || 0}</div>
          <div>🔧 Parâmetros: Juros {economicIndicators.interestRate}% | Impostos {economicIndicators.taxBurden}% | Serviços {economicIndicators.publicServices}%</div>
          <div>🕐 Última atualização: {new Date(lastUpdated).toLocaleTimeString()}</div>
        </div>
      )}
    </div>
  );
};

export default EconomyPanel;