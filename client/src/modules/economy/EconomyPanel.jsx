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

// Import centralized formatters
const formatCurrency = (value, decimals = 1) => {
  if (value === undefined || value === null || isNaN(value)) return '0.0';
  return Number(value).toFixed(decimals);
};

const formatPercent = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0.0%';
  return Number(value).toFixed(1) + '%';
};

const formatValueWithSign = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0.0';
  const num = Number(value);
  return (num >= 0 ? '+' : '') + num.toFixed(1);
};

const getCreditRatingColor = (rating) => {
  if (['AAA', 'AA', 'A'].includes(rating)) return '#28a745';
  if (rating === 'BBB') return '#ffc107';
  if (['BB', 'B'].includes(rating)) return '#fd7e14';
  return '#dc3545';
};

/**
 * EconomyPanel.jsx (Corrigido)
 * Interface principal para controle econômico
 * Sincronizada com dados do countryStateManager do servidor
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
  
  // Parâmetros locais (antes de aplicar) - CORRIGIDO: Inicializa com dados do servidor
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
  // SINCRONIZAÇÃO COM DADOS DO SERVIDOR (CORRIGIDA)
  // ======================================================================
  
  // Sincronizar parâmetros locais com dados vindos do servidor
  useEffect(() => {
    if (economicIndicators) {
      const newParams = {
        interestRate: economicIndicators.interestRate || 8.0,
        taxBurden: economicIndicators.taxBurden || 40.0,
        publicServices: economicIndicators.publicServices || 30.0
      };
      
      // Só atualiza se os valores realmente mudaram para evitar loops
      if (JSON.stringify(newParams) !== JSON.stringify(localParameters)) {
        setLocalParameters(newParams);
        
        // Limpar pending updates quando dados do servidor chegam
        setPendingUpdates(new Set());
      }
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
  
   // Solicitar dados de dívida quando o componente montar
  useEffect(() => {
    if (currentRoom?.name && myCountry) {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        // Solicitar resumo de dívidas
        socket.emit('getDebtSummary');
        console.log(`[ECONOMY] Solicitando resumo de dívidas para ${myCountry}`);
      }
    }
  }, [currentRoom?.name, myCountry]);

  // ======================================================================
  // HANDLERS DE COMANDOS (CORRIGIDOS - enviam eventos corretos)
  // ======================================================================
  
  /**
   * CORRIGIDO: Aplica todas as mudanças de parâmetros econômicos de uma vez
   */
  const applyAllParameters = useCallback(async () => {
    if (!currentRoom?.name || !myCountry) return;
    
    const parameters = [
      { name: 'interestRate', value: localParameters.interestRate, min: 0, max: 25 },
      { name: 'taxBurden', value: localParameters.taxBurden, min: 0, max: 60 },
      { name: 'publicServices', value: localParameters.publicServices, min: 0, max: 60 }
    ];
    
    // Validar todos os parâmetros
    for (const param of parameters) {
      if (isNaN(param.value) || param.value < param.min || param.value > param.max) {
        MessageService.showError(`${param.name} deve estar entre ${param.min}% e ${param.max}%`);
        return;
      }
    }

    setPendingUpdates(new Set(['interestRate', 'taxBurden', 'publicServices']));
    
    try {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        // ✅ USAR ESTRUTURA CORRETA que o servidor espera
        for (const param of parameters) {
          socket.emit('updateEconomicParameter', {
            parameter: param.name,
            value: param.value
            // ❌ NÃO enviar roomName e countryName - servidor obtém automaticamente
          });
          
          console.log(`[ECONOMY] Enviando: ${param.name} = ${param.value}%`);
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar parâmetros:', error);
      MessageService.showError(`Erro ao atualizar parâmetros: ${error.message}`);
      setPendingUpdates(new Set());
    }
  }, [currentRoom?.name, myCountry, localParameters]);

  /**
   * Cancela as alterações e restaura valores do servidor
   */
  const cancelChanges = useCallback(() => {
    if (economicIndicators) {
      setLocalParameters({
        interestRate: economicIndicators.interestRate || 8.0,
        taxBurden: economicIndicators.taxBurden || 40.0,
        publicServices: economicIndicators.publicServices || 30.0
      });
    }
  }, [economicIndicators]);
  
  /**
   * CORRIGIDO: Emite títulos de dívida
   */
  const handleIssueBonds = useCallback(async () => {
    const amount = parseFloat(bondAmount);
    
    if (!amount || amount <= 0 || amount > 1000) {
      MessageService.showError('Valor deve estar entre 0 e 1000 bilhões');
      return;
    }
    
    setIsIssuingBonds(true);
    
    try {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        // ✅ USAR ESTRUTURA CORRETA que o servidor espera
        socket.emit('issueDebtBonds', { 
          bondAmount: amount
          // ❌ NÃO enviar isEmergency se não for usado pelo servidor
        });
        
        console.log(`[ECONOMY] Emitindo ${amount} bi USD em títulos`);
        setBondAmount('');
      }
    } catch (error) {
      console.error('Erro ao emitir títulos:', error);
      MessageService.showError('Erro ao emitir títulos: ' + error.message);
      setIsIssuingBonds(false);
    }
  }, [bondAmount]);
  
  /**
   * CORRIGIDO: Abre popup de dívidas com dados corretos
   */
  const handleOpenDebtPopup = useCallback(() => {
    if (economicIndicators && debtSummary && onOpenDebtPopup) {
      console.log('[ECONOMY] Abrindo popup de dívidas:', { debtSummary, economicIndicators });
      
      // Usar dados vindos do servidor via Redux
      onOpenDebtPopup(debtSummary, debtSummary.contracts || [], economicIndicators);
    } else {
      console.warn('[ECONOMY] Dados insuficientes para abrir popup de dívidas:', { 
        hasEconomicIndicators: !!economicIndicators, 
        hasDebtSummary: !!debtSummary,
        hasCallback: !!onOpenDebtPopup 
      });
      MessageService.showWarning('Aguardando dados de dívida...');
    }
  }, [economicIndicators, debtSummary, onOpenDebtPopup]);
  
  // ======================================================================
  // EVENTOS DO SERVIDOR (CORRIGIDOS)
  // ======================================================================
  
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    // CORRIGIDO: Handler para confirmação de emissão de títulos
    const handleDebtBondsIssued = (data) => {
      console.log('[ECONOMY] Títulos emitidos confirmados:', data);
      
      const { success, bondAmount: issuedAmount, newTreasury, newPublicDebt, message } = data;
      
      if (success) {
        MessageService.showSuccess(`Títulos emitidos: ${issuedAmount} bi USD`, 4000);
        
        // ADICIONAR: Solicitar resumo atualizado de dívidas
        setTimeout(() => {
          const socket = socketApi.getSocketInstance();
          if (socket) {
            socket.emit('getDebtSummary');
            console.log('[ECONOMY] Solicitando resumo atualizado após emissão');
          }
        }, 500);
      } else {
        MessageService.showError(message || 'Falha na emissão de títulos');
      }
      
      setIsIssuingBonds(false);
    };
    
    // CORRIGIDO: Handler para confirmação de parâmetros
    const handleParameterUpdated = (data) => {
      console.log('[ECONOMY] Parâmetro confirmado:', data);
      
      const { countryName, roomName, parameter, value } = data;
      
      // Só processar se for para o país atual
      if (countryName === myCountry && roomName === currentRoom?.name) {
        // Remover dos pending updates
        setPendingUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(parameter);
          return newSet;
        });
        
        // Atualizar parâmetro local se necessário
        setLocalParameters(prev => ({
          ...prev,
          [parameter]: value
        }));
      }
    };
    
    // CORRIGIDO: Handler para títulos de emergência
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
  // VALIDAÇÕES E CHECKS (CORRIGIDOS)
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
  
  // ======================================================================
  // VALIDAÇÕES DE VALORES (ADICIONADAS)
  // ======================================================================
  
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
  
  // Verificar se algum parâmetro foi alterado
  const hasChanges = Math.abs(localParameters.interestRate - (economicIndicators.interestRate || 8.0)) >= 0.1 ||
                  Math.abs(localParameters.taxBurden - (economicIndicators.taxBurden || 40.0)) >= 0.1 ||
                  Math.abs(localParameters.publicServices - (economicIndicators.publicServices || 30.0)) >= 0.1;
  
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
            <span className="value">{formatCurrency(safeIndicators.gdp)} bi</span>
            <span className={`growth ${safeIndicators.gdpGrowth >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(safeIndicators.gdpGrowth)}% anual
            </span>
          </div>
        </div>
        
        <div className="indicator">
          <label>Tesouro:</label>
          <span className={`value ${safeIndicators.treasury >= 0 ? '' : 'negative'}`}>
            {formatCurrency(safeIndicators.treasury)} bi
          </span>
        </div>
        
        <div className="indicator">
          <label>Dívida Pública:</label>
          <div className="indicator-value">
            <span className="value">{formatCurrency(safeIndicators.publicDebt)} bi</span>
            <span className="debt-ratio">
              {formatPercent((safeIndicators.publicDebt / safeIndicators.gdp) * 100)} PIB
            </span>
          </div>
        </div>
        
        <div className="indicator">
          <label>Inflação:</label>
          <span className={`value ${safeIndicators.inflation > 5 ? 'negative' : 'positive'}`}>
            {formatPercent(safeIndicators.inflation)}
          </span>
        </div>
        
        <div className="indicator">
          <label>Desemprego:</label>
          <span className={`value ${safeIndicators.unemployment > 10 ? 'negative' : 'positive'}`}>
            {formatPercent(safeIndicators.unemployment)}
          </span>
        </div>
        
        <div className="indicator">
          <label>Popularidade:</label>
          <span className={`value ${safeIndicators.popularity > 50 ? 'positive' : 'negative'}`}>
            {formatPercent(safeIndicators.popularity)}
          </span>
        </div>
        
        <div className="indicator credit-indicator">
          <label>Rating:</label>
          <span 
            className="credit-rating" 
            style={{ color: getCreditRatingColor(safeIndicators.creditRating) }}
          >
            {safeIndicators.creditRating}
          </span>
        </div>
      </div>
      
      {/* Controles Econômicos (CORRIGIDOS) */}
      <div className="economic-controls">
        <div className="control-group">
          <label>Taxa de Juros: {formatPercent(localParameters.interestRate)}</label>
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
              disabled={pendingUpdates.size > 0}
            />
          </div>
        </div>
        
        <div className="control-group">
          <label>Carga Tributária: {formatPercent(localParameters.taxBurden)}</label>
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
              disabled={pendingUpdates.size > 0}
            />
          </div>
        </div>
        
        <div className="control-group">
          <label>Investimento Público: {formatPercent(localParameters.publicServices)}</label>
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
              disabled={pendingUpdates.size > 0}
            />
          </div>
        </div>
        
        {/* Botões para aplicar e cancelar parâmetros */}
        {hasChanges && (
          <div className="apply-parameters">
            <button 
              onClick={cancelChanges}
              disabled={pendingUpdates.size > 0}
              className="btn-cancel-parameters"
            >
              Cancelar
            </button>
            <button 
              onClick={applyAllParameters}
              disabled={pendingUpdates.size > 0}
              className="btn-apply-parameters"
            >
              {pendingUpdates.size > 0 ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        )}
      </div>
      
      {/* Emissão de Títulos (CORRIGIDA) */}
      <div className="bonds-section">
        <h4>Emitir dívida pública</h4>
        
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
              Capacidade: {formatPercent(Math.max(0, 120 - (safeIndicators.publicDebt / safeIndicators.gdp) * 100))} restante
            </small>
          </div>
        )}
        
        {/* Botão de resumo de dívidas (CORRIGIDO) */}
        {debtSummary && debtSummary.numberOfContracts > 0 && (
          <button 
            className="debt-summary-btn"
            onClick={handleOpenDebtPopup}
          >
            Ver Dívidas ({debtSummary.numberOfContracts} {debtSummary.numberOfContracts === 1 ? 'contrato' : 'contratos'})
          </button>
        )}
      </div>
      
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
          <div>💰 PIB: {formatCurrency(safeIndicators.gdp)} | Tesouro: {formatCurrency(safeIndicators.treasury)}</div>
          <div>📊 Inflação: {formatPercent(safeIndicators.inflation)} | Desemprego: {formatPercent(safeIndicators.unemployment)} | Rating: {safeIndicators.creditRating}</div>
          <div>👥 Popularidade: {formatPercent(safeIndicators.popularity)}</div>
          <div>📄 Dívidas: {debtSummary?.numberOfContracts || 0} contratos</div>
          <div>🔧 Parâmetros: Juros {formatPercent(safeIndicators.interestRate)} | Impostos {formatPercent(safeIndicators.taxBurden)} | Serviços {formatPercent(safeIndicators.publicServices)}</div>
          <div>🕐 Última atualização: {new Date(lastUpdated).toLocaleTimeString()}</div>
          <div>🔄 Pending: {pendingUpdates.size > 0 ? Array.from(pendingUpdates).join(', ') : 'Nenhum'}</div>
        </div>
      )}
    </div>
  );
};

export default EconomyPanel;