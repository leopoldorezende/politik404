import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { COUNTRY_STATE_EVENTS } from '../../store/socketReduxMiddleware';
import { 
  selectCountryState, 
  selectCountryStateLoading,
  selectLastUpdated
} from '../country/countryStateSlice';
import { 
  selectCountryEconomy,
  selectCountryEconomicIndicators,
  selectCountryDebtSummary
} from '../economy/economySlice';
import { socketApi } from '../../services/socketClient';
import MessageService from '../../ui/toast/messageService';
import './EconomyPanel.css';

const AdvancedEconomyPanel = ({ onOpenDebtPopup }) => {
  const dispatch = useDispatch();
  
  // Dados do Redux com verificações de segurança - APENAS DO PRÓPRIO PAÍS
  const myCountry = useSelector(state => state.game?.myCountry);
  const currentRoom = useSelector(state => state.rooms?.currentRoom);
  const countriesData = useSelector(state => state.game?.countriesData);
  
  // Estados dinâmicos do país - FONTE PRINCIPAL DOS DADOS EM TEMPO REAL
  const countryState = useSelector(state => 
    myCountry ? selectCountryState(state, currentRoom?.name, myCountry) : null
  );
  const loading = useSelector(selectCountryStateLoading);
  const lastUpdated = useSelector(state => selectLastUpdated(state, currentRoom?.name));
  
  // Estados da economia avançada (Redux)
  const advancedEconomy = useSelector(state => 
    selectCountryEconomy(state, currentRoom?.name, myCountry)
  );
  const economicIndicators = useSelector(state => 
    selectCountryEconomicIndicators(state, currentRoom?.name, myCountry)
  );
  const debtSummary = useSelector(state => 
    selectCountryDebtSummary(state, currentRoom?.name, myCountry)
  );
  
  // Estados locais para controles
  const [localParameters, setLocalParameters] = useState({
    interestRate: 8.0,
    taxBurden: 40.0,
    publicServices: 30.0
  });
  const [appliedParameters, setAppliedParameters] = useState({
    interestRate: 8.0,
    taxBurden: 40.0,
    publicServices: 30.0
  });
  const [bondAmount, setBondAmount] = useState('');
  const [isIssuingBonds, setIsIssuingBonds] = useState(false);
  const [isEmergencyBonds, setIsEmergencyBonds] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState(new Set());
  
  // Estado para armazenar dados de dívidas detalhados
  const [detailedDebtData, setDetailedDebtData] = useState(null);
  const [showAdvancedIndicators, setShowAdvancedIndicators] = useState(true);
  
  // Assinar para atualizações quando o componente montar
  useEffect(() => {
    if (currentRoom?.name) {
      dispatch({ type: COUNTRY_STATE_EVENTS.SUBSCRIBE, payload: currentRoom.name });
      
      return () => {
        dispatch({ type: COUNTRY_STATE_EVENTS.UNSUBSCRIBE, payload: currentRoom.name });
      };
    }
  }, [currentRoom?.name, dispatch]);

  // Escutar eventos de resumo de dívidas
  useEffect(() => {
    const handleDebtSummaryReceived = (event) => {
      setDetailedDebtData(event.detail);
    };

    window.addEventListener('debtSummaryReceived', handleDebtSummaryReceived);
    
    return () => {
      window.removeEventListener('debtSummaryReceived', handleDebtSummaryReceived);
    };
  }, []);

  // Função para obter valor numérico de propriedade que pode estar em diferentes formatos
  const getNumericValue = useCallback((property) => {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  }, []);
  
  // Função para obter dados econômicos - INTEGRADA COM SISTEMA AVANÇADO
  const getEconomicData = useCallback(() => {
    if (!myCountry || !countriesData?.[myCountry]) {
      return null;
    }
    
    const staticData = countriesData[myCountry]?.economy || {};
    const dynamicData = countryState?.economy || {};
    
    // Função auxiliar que prioriza dados dinâmicos sobre estáticos
    const getDynamicOrStatic = (dynamicKey, staticKey, defaultValue = 0) => {
      // Primeiro tenta o valor dinâmico
      if (dynamicKey && dynamicData[dynamicKey] !== undefined && dynamicData[dynamicKey] !== null) {
        const dynamicValue = getNumericValue(dynamicData[dynamicKey]);
        if (dynamicValue !== 0 || dynamicData[dynamicKey] === 0) { // Aceita zero explícito
          return dynamicValue;
        }
      }
      
      // Depois tenta o valor estático
      if (staticKey && staticData[staticKey] !== undefined && staticData[staticKey] !== null) {
        return getNumericValue(staticData[staticKey]);
      }
      
      return defaultValue;
    };
    
    // Base economic data
    const baseData = {
      // DADOS DINÂMICOS (atualizados pelo servidor a cada 2s)
      gdp: getDynamicOrStatic('gdp', 'gdp', 100),
      treasury: getDynamicOrStatic('treasury', 'treasury', 10),
      
      // Distribuição setorial (dinâmica)
      services: getDynamicOrStatic('services', 'services', 35),
      commodities: getDynamicOrStatic('commodities', 'commodities', 35),
      manufactures: getDynamicOrStatic('manufactures', 'manufactures', 30),
      
      // Outputs setoriais (calculados dinamicamente pelo servidor)
      servicesOutput: getDynamicOrStatic('servicesOutput', null, 0),
      commoditiesOutput: getDynamicOrStatic('commoditiesOutput', null, 0),
      manufacturesOutput: getDynamicOrStatic('manufacturesOutput', null, 0),
      
      // Necessidades internas (calculadas dinamicamente)
      commoditiesNeeds: getDynamicOrStatic('commoditiesNeeds', null, 0),
      manufacturesNeeds: getDynamicOrStatic('manufacturesNeeds', null, 0),
      
      // Balanços comerciais (calculados dinamicamente com acordos comerciais)
      commoditiesBalance: getDynamicOrStatic('commoditiesBalance', null, 0),
      manufacturesBalance: getDynamicOrStatic('manufacturesBalance', null, 0),
      
      // Estatísticas de comércio (calculadas pelo servidor)
      tradeStats: dynamicData.tradeStats || {
        commodityImports: 0,
        commodityExports: 0,
        manufactureImports: 0,
        manufactureExports: 0
      },
      
      // Parâmetros de política econômica
      taxBurden: appliedParameters.taxBurden,
      publicServices: appliedParameters.publicServices,
      interestRate: appliedParameters.interestRate,
      
      // Dívida pública
      publicDebt: getDynamicOrStatic('publicDebt', 'publicDebt', 0),
      debtRecords: dynamicData.debtRecords || [],
    };

    // Advanced economic indicators from dynamic calculations
    const advancedData = {
      // INDICADORES AVANÇADOS (calculados pelo servidor)
      inflation: getDynamicOrStatic('inflation', 'inflation', 2.8),
      unemployment: getDynamicOrStatic('unemployment', 'unemployment', 12.5),
      gdpGrowth: getDynamicOrStatic('quarterlyGrowth', 'gdpGrowth', 0.5),
      popularity: getDynamicOrStatic('popularity', 'popularity', 50),
      creditRating: dynamicData.creditRating || staticData.creditRating || 'A',
      
      // Históricos econômicos
      gdpHistory: dynamicData.gdpHistory || [baseData.gdp],
      inflationHistory: dynamicData.inflationHistory || [baseData.inflation / 100],
      popularityHistory: dynamicData.popularityHistory || [baseData.popularity],
      unemploymentHistory: dynamicData.unemploymentHistory || [baseData.unemployment],
    };

    return { ...baseData, ...advancedData };
  }, [myCountry, countriesData, countryState, getNumericValue, lastUpdated, appliedParameters]);
  
  // Sincronizar parâmetros locais com dados do JSON - APENAS NA INICIALIZAÇÃO
  useEffect(() => {
    if (!myCountry || !countriesData?.[myCountry]) return;
    
    const staticData = countriesData[myCountry]?.economy || {};
    
    const initialParams = {
      interestRate: getNumericValue(staticData.interestRate) || 8.0,
      taxBurden: getNumericValue(staticData.taxBurden) || 40.0,
      publicServices: getNumericValue(staticData.publicServices) || 30.0
    };
    
    // Só atualiza se ainda não foram alterados
    if (appliedParameters.interestRate === 8.0 && appliedParameters.taxBurden === 40.0 && appliedParameters.publicServices === 30.0) {
      setLocalParameters(initialParams);
      setAppliedParameters(initialParams);
    }
  }, [myCountry, countriesData, getNumericValue]);
  
  // Aplicar mudanças nos parâmetros econômicos
  const applyParameterChange = useCallback(async (parameter, value) => {
    if (!currentRoom?.name || !myCountry) return;
    
    const newValue = parseFloat(value);
    
    // Adicionar aos pending updates
    setPendingUpdates(prev => new Set([...prev, parameter]));
    
    try {
      // Enviar para o servidor via socket
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('updateEconomicParameter', {
          roomName: currentRoom.name,
          countryName: myCountry,
          parameter: parameter,
          value: newValue
        });
        
        // Atualizar localmente imediatamente
        setAppliedParameters(prev => ({
          ...prev,
          [parameter]: newValue
        }));
        
        // Mostrar mensagem de sucesso
        const parameterNames = {
          interestRate: 'Taxa de Juros',
          taxBurden: 'Carga Tributária', 
          publicServices: 'Investimento Público'
        };
        
        MessageService.showSuccess(`${parameterNames[parameter]} alterada para ${newValue}${parameter !== 'interestRate' ? '%' : '%'}`);
      }
    } catch (error) {
      MessageService.showError(`Erro ao atualizar ${parameter}: ${error.message}`);
    } finally {
      // Remover dos pending updates após um tempo
      setTimeout(() => {
        setPendingUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(parameter);
          return newSet;
        });
      }, 1000);
    }
  }, [currentRoom?.name, myCountry]);
  
  // Emitir títulos de dívida com sistema avançado
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
          isEmergency: isEmergencyBonds
        });
        
        const bondType = isEmergencyBonds ? 'títulos de emergência' : 'títulos';
        MessageService.showSuccess(`Emitindo ${amount} bi USD em ${bondType}...`);
        setBondAmount('');
        setIsEmergencyBonds(false);
      }
    } catch (error) {
      MessageService.showError('Erro ao emitir títulos: ' + error.message);
    } finally {
      setTimeout(() => setIsIssuingBonds(false), 2000);
    }
  }, [bondAmount, currentRoom?.name, myCountry, isEmergencyBonds]);

  // Solicitar resumo detalhado de dívidas
  const handleGetDebtSummary = useCallback(() => {
    const socket = socketApi.getSocketInstance();
    if (socket) {
      socket.emit('getDebtSummary');
    }
  }, []);
  
  // Função para abrir popup de dívidas com dados avançados
  const handleOpenDebtPopup = useCallback(() => {
    const economicData = getEconomicData();
    if (economicData && onOpenDebtPopup) {
      // Solicitar dados detalhados do servidor
      handleGetDebtSummary();
      
      // Usar dados locais como fallback
      const debtRecords = economicData.debtRecords || [];
      const numberOfContracts = debtRecords.length;
      
      // Criar resumo das dívidas
      const fallbackDebtSummary = {
        totalMonthlyPayment: debtRecords.reduce((sum, debt) => sum + (debt.monthlyPayment || 0), 0),
        principalRemaining: debtRecords.reduce((sum, debt) => sum + (debt.remainingValue || debt.originalValue || 0), 0),
        totalFuturePayments: debtRecords.reduce((sum, debt) => 
          sum + ((debt.monthlyPayment || 0) * (debt.remainingInstallments || 0)), 0
        ),
        debtToGdpRatio: (economicData.publicDebt / economicData.gdp) * 100,
        numberOfDebts: numberOfContracts,
        averageInterestRate: numberOfContracts > 0 ? 
          debtRecords.reduce((sum, debt) => sum + (debt.interestRate || 0), 0) / numberOfContracts : 0
      };
      
      // Usar dados detalhados se disponíveis, senão usar fallback
      const finalDebtSummary = detailedDebtData || fallbackDebtSummary;
      const finalDebtRecords = detailedDebtData?.debtRecords || debtRecords;
      
      // Chamar o callback passando os dados para o GamePage
      onOpenDebtPopup(finalDebtSummary, finalDebtRecords, economicData);
    }
  }, [getEconomicData, onOpenDebtPopup, detailedDebtData, handleGetDebtSummary]);
  
  // Formatadores
  const formatCurrency = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0';
    return Number(value).toFixed(1);
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

  // Obter dados econômicos
  const economicData = getEconomicData();
  
  if (!myCountry) {
    return (
      <div className="advanced-economy-panel">
        <p>Você precisa estar controlando um país para ver os dados econômicos avançados.</p>
      </div>
    );
  }
  
  if (loading || !economicData) {
    return (
      <div className="advanced-economy-panel">
        <p>Carregando dados econômicos...</p>
        {myCountry && <p><small>País: {myCountry}</small></p>}
      </div>
    );
  }
  
  const numberOfContracts = economicData.debtRecords?.length || 0;
  
  return (
    <div className="advanced-economy-panel">
      
      {/* Indicadores Principais */}
      <div className="main-indicators">
        <div className="indicator">
          <label>PIB:</label>
          <div className="indicator-value">
            <span className="value">{formatCurrency(economicData.gdp)} bi</span>
            <span className={`growth ${economicData.gdpGrowth >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economicData.gdpGrowth)}% trimestre
            </span>
          </div>
        </div>
        
        <div className="indicator">
          <label>Tesouro:</label>
          <span className={`value ${economicData.treasury >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(economicData.treasury)} bi
          </span>
        </div>
        
        <div className="indicator">
          <label>Dívida Pública:</label>
          <div className="indicator-value">
            <span className="value">{formatCurrency(economicData.publicDebt)} bi</span>
            <span className="debt-ratio">
              {formatPercent((economicData.publicDebt / economicData.gdp) * 100)} PIB
            </span>
          </div>
        </div>
      </div>

      {/* Indicadores Avançados - NOVO */}
      {showAdvancedIndicators && (
        <div className="main-indicators">
          <div className="indicator">
            <label>Inflação:</label>
            <span className={`value ${economicData.inflation > 5 ? 'negative' : 'positive'}`}>
              {formatPercent(economicData.inflation)}
            </span>
          </div>
          
          <div className="indicator">
            <label>Desemprego:</label>
            <span className={`value ${economicData.unemployment > 10 ? 'negative' : 'positive'}`}>
              {formatPercent(economicData.unemployment)}
            </span>
          </div>
          
          <div className="indicator">
            <label>Popularidade:</label>
            <span className={`value ${economicData.popularity > 50 ? 'positive' : 'negative'}`}>
              {formatPercent(economicData.popularity)}
            </span>
          </div>
          
          <div className="indicator credit-indicator">
            <label>Rating:</label>
            <span 
              className="credit-rating" 
              style={{ color: getCreditRatingColor(economicData.creditRating) }}
            >
              {economicData.creditRating}
            </span>
          </div>
        </div>
      )}
      
      {/* Controles Econômicos */}
      <div className="economic-controls">
        <h4>Parâmetros Econômicos</h4>
        
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
            />
            <button 
              onClick={() => applyParameterChange('interestRate', localParameters.interestRate)}
              disabled={localParameters.interestRate === appliedParameters.interestRate || pendingUpdates.has('interestRate')}
            >
              {pendingUpdates.has('interestRate') ? 'Aplicando...' : 'Aplicar'}
            </button>
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
            />
            <button 
              onClick={() => applyParameterChange('taxBurden', localParameters.taxBurden)}
              disabled={localParameters.taxBurden === appliedParameters.taxBurden || pendingUpdates.has('taxBurden')}
            >
              {pendingUpdates.has('taxBurden') ? 'Aplicando...' : 'Aplicar'}
            </button>
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
            />
            <button 
              onClick={() => applyParameterChange('publicServices', localParameters.publicServices)}
              disabled={localParameters.publicServices === appliedParameters.publicServices || pendingUpdates.has('publicServices')}
            >
              {pendingUpdates.has('publicServices') ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Emissão de Títulos AVANÇADA */}
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
          
          {/* Checkbox para títulos de emergência */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={isEmergencyBonds}
              onChange={(e) => setIsEmergencyBonds(e.target.checked)}
              disabled={isIssuingBonds}
            />
            Emergência (taxa maior)
          </label>
          
          <button 
            className="btn-issue-bonds"
            onClick={handleIssueBonds}
            disabled={isIssuingBonds || !bondAmount}
          >
            {isIssuingBonds ? 'Emitindo...' : 
             isEmergencyBonds ? 'Emitir Emergência' : 'Emitir'}
          </button>
        </div>
        
        {/* Informações sobre taxa de juros */}
        <div style={{ fontSize: '11px', color: '#666', marginTop: '8px', textAlign: 'center' }}>
          Taxa base: {formatPercent(economicData.interestRate)} | Rating: {economicData.creditRating}
          {isEmergencyBonds && <div style={{ color: '#e74c3c' }}>⚠️ Títulos de emergência têm taxa maior</div>}
        </div>
        
        {/* Botão de resumo de dívidas */}
        {numberOfContracts > 0 && (
          <button 
            className="debt-summary-btn"
            onClick={handleOpenDebtPopup}
          >
            Ver Dívidas ({numberOfContracts} {numberOfContracts === 1 ? 'contrato' : 'contratos'})
          </button>
        )}
      </div>

      {/* Toggle para indicadores avançados */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <button 
          style={{ 
            background: 'none', 
            border: '1px solid rgba(52, 73, 94, 0.3)', 
            color: '#2c3e50', 
            padding: '4px 8px', 
            borderRadius: '4px', 
            fontSize: '10px',
            cursor: 'pointer'
          }}
          onClick={() => setShowAdvancedIndicators(!showAdvancedIndicators)}
        >
          {showAdvancedIndicators ? '🔽 Ocultar Avançados' : '🔼 Mostrar Avançados'}
        </button>
      </div>
      
      {/* Status de atualização em tempo real */}
      <div style={{ 
        fontSize: '10px', 
        color: '#7f8c8d', 
        textAlign: 'center', 
        marginTop: '10px',
        padding: '6px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '4px'
      }}>
        🔄 Atualizando em tempo real
        <br />
        <span style={{ fontSize: '9px' }}>
          Última atualização: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'N/A'}
        </span>
      </div>
    </div>
  );
};

export default AdvancedEconomyPanel;