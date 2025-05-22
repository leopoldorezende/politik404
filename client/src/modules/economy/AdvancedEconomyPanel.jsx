import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { COUNTRY_STATE_EVENTS } from '../../store/socketReduxMiddleware';
import { 
  selectCountryState, 
  selectCountryStateLoading,
  selectLastUpdated
} from '../country/countryStateSlice';
import { socketApi } from '../../services/socketClient';
import { showSuccess, showError } from '../../ui/toast/messageService';
import './AdvancedEconomyPanel.css';

const AdvancedEconomyPanel = ({ onOpenDebtPopup }) => {
  const dispatch = useDispatch();
  
  // Dados do Redux com verificações de segurança - APENAS DO PRÓPRIO PAÍS
  const myCountry = useSelector(state => state.game?.myCountry);
  const currentRoom = useSelector(state => state.rooms?.currentRoom);
  const countriesData = useSelector(state => state.game?.countriesData);
  
  // Estados dinâmicos do país
  const countryState = useSelector(state => 
    myCountry ? selectCountryState(state, currentRoom?.name, myCountry) : null
  );
  const loading = useSelector(selectCountryStateLoading);
  
  // Estados locais
  const [localParameters, setLocalParameters] = useState({
    interestRate: 8.0,
    taxBurden: 40.0,
    publicServices: 30.0
  });
  const [bondAmount, setBondAmount] = useState('');
  const [isIssuingBonds, setIsIssuingBonds] = useState(false);
  
  // Assinar para atualizações quando o componente montar
  useEffect(() => {
    if (currentRoom?.name) {
      dispatch({ type: COUNTRY_STATE_EVENTS.SUBSCRIBE, payload: currentRoom.name });
      
      return () => {
        dispatch({ type: COUNTRY_STATE_EVENTS.UNSUBSCRIBE, payload: currentRoom.name });
      };
    }
  }, [currentRoom?.name, dispatch]);
  
  // Função para obter dados combinados (JSON + dinâmico)
  const getCombinedEconomicData = useCallback(() => {
    if (!myCountry || !countriesData?.[myCountry]) {
      return null;
    }
    
    const jsonData = countriesData[myCountry];
    const dynamicData = countryState?.economy || {};
    
    // Função auxiliar para obter valor
    const getValue = (jsonPath, dynamicPath, defaultValue = 0) => {
      // Primeiro tenta o valor dinâmico (calculado pelo servidor)
      if (dynamicPath && dynamicData[dynamicPath] !== undefined) {
        if (typeof dynamicData[dynamicPath] === 'object' && dynamicData[dynamicPath].value !== undefined) {
          return dynamicData[dynamicPath].value;
        } else if (typeof dynamicData[dynamicPath] === 'number') {
          return dynamicData[dynamicPath];
        }
      }
      
      // Depois tenta o valor do JSON
      if (jsonPath && jsonData.economy?.[jsonPath] !== undefined) {
        if (typeof jsonData.economy[jsonPath] === 'object' && jsonData.economy[jsonPath].value !== undefined) {
          return jsonData.economy[jsonPath].value;
        } else if (typeof jsonData.economy[jsonPath] === 'number') {
          return jsonData.economy[jsonPath];
        }
      }
      
      return defaultValue;
    };
    
    console.log(`[ADVANCED_ECONOMY] Getting data for ${myCountry}:`, {
      hasJsonData: !!jsonData.economy,
      hasDynamicData: !!countryState?.economy,
      jsonKeys: jsonData.economy ? Object.keys(jsonData.economy) : [],
      dynamicKeys: countryState?.economy ? Object.keys(countryState.economy) : []
    });
    
    return {
      // Indicadores principais (priorizar dinâmico, fallback para JSON)
      gdp: getValue('gdp', 'gdp', 100),
      treasury: getValue('treasury', 'treasury', 10),
      publicDebt: getValue('publicDebt', 'publicDebt', 0),
      
      // Indicadores estáticos do JSON (raramente mudam)
      inflation: getValue('inflation', null, 2.8),
      unemployment: getValue('unemployment', null, 12.5),
      gdpGrowth: getValue('gdpGrowth', null, 0.5),
      popularity: getValue('popularity', null, 50),
      creditRating: getValue('creditRating', null, 'A'),
      
      // Parâmetros de política (do JSON, podem ser alterados pelo jogador)
      taxBurden: getValue('taxBurden', null, 40),
      publicServices: getValue('publicServices', null, 30),
      interestRate: getValue('interestRate', null, 8),
      
      // Distribuição setorial (dinâmica + JSON)
      services: getValue('services', 'services', 35),
      commodities: getValue('commodities', 'commodities', 35),
      manufactures: getValue('manufactures', 'manufactures', 30),
      
      // Outputs setoriais (calculados dinamicamente)
      servicesOutput: getValue(null, 'servicesOutput', 0),
      commoditiesOutput: getValue(null, 'commoditiesOutput', 0),
      manufacturesOutput: getValue(null, 'manufacturesOutput', 0),
      
      // Necessidades internas (dinâmicas)
      commoditiesNeeds: getValue(null, 'commoditiesNeeds', 0),
      manufacturesNeeds: getValue(null, 'manufacturesNeeds', 0),
      
      // Balanços comerciais (calculados dinamicamente)
      commoditiesBalance: getValue(null, 'commoditiesBalance', 0),
      manufacturesBalance: getValue(null, 'manufacturesBalance', 0),
      
      // Estatísticas de comércio
      tradeStats: dynamicData.tradeStats || {
        commodityImports: 0,
        commodityExports: 0,
        manufactureImports: 0,
        manufactureExports: 0
      }
    };
  }, [myCountry, countriesData, countryState]);
  
  // Sincronizar parâmetros locais com dados do JSON
  useEffect(() => {
    const economicData = getCombinedEconomicData();
    if (economicData) {
      setLocalParameters({
        interestRate: economicData.interestRate,
        taxBurden: economicData.taxBurden,
        publicServices: economicData.publicServices
      });
    }
  }, [getCombinedEconomicData]);
  
  // Aplicar mudanças nos parâmetros econômicos
  const applyParameterChange = useCallback((parameter, value) => {
    if (!currentRoom?.name || !myCountry) return;
    
    const newValue = parseFloat(value);
    
    setLocalParameters(prev => ({
      ...prev,
      [parameter]: newValue
    }));
    
    showSuccess(`${parameter} alterado para ${newValue}`);
  }, [currentRoom?.name, myCountry]);
  
  // Emitir títulos de dívida
  const handleIssueBonds = useCallback(async () => {
    const amount = parseFloat(bondAmount);
    
    if (!amount || amount <= 0 || amount > 1000) {
      showError('Valor deve estar entre 0 e 1000 bilhões');
      return;
    }
    
    if (!currentRoom?.name || !myCountry) {
      showError('Erro: dados da sala ou país não encontrados');
      return;
    }
    
    setIsIssuingBonds(true);
    
    try {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('issueDebtBonds', { bondAmount: amount });
        showSuccess(`Emitindo ${amount} bi USD em títulos...`);
        setBondAmount('');
      }
    } catch (error) {
      showError('Erro ao emitir títulos: ' + error.message);
    } finally {
      setTimeout(() => setIsIssuingBonds(false), 2000);
    }
  }, [bondAmount, currentRoom?.name, myCountry]);
  
  // Escutar eventos de economia
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    const handleDebtBondsIssued = (data) => {
      showSuccess(`Títulos emitidos com sucesso! Nova dívida: ${data.newPublicDebt} bi`);
      setIsIssuingBonds(false);
    };
    
    socket.on('debtBondsIssued', handleDebtBondsIssued);
    
    return () => {
      socket.off('debtBondsIssued', handleDebtBondsIssued);
    };
  }, []);
  
  // Função para abrir popup de dívidas
  const handleOpenDebtPopup = useCallback(() => {
    if (onOpenDebtPopup) {
      const economicData = getCombinedEconomicData();
      if (economicData) {
        const debtSummary = {
          totalMonthlyPayment: 0,
          principalRemaining: economicData.publicDebt,
          totalFuturePayments: economicData.publicDebt * 1.1,
          debtToGdpRatio: economicData.publicDebt / economicData.gdp,
          numberOfDebts: economicData.publicDebt > 0 ? 1 : 0
        };
        onOpenDebtPopup(debtSummary, []);
      }
    }
  }, [onOpenDebtPopup, getCombinedEconomicData]);
  
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
  
  // Obter dados econômicos combinados
  const economicData = getCombinedEconomicData();
  
  if (!myCountry) {
    return (
      <div className="advanced-economy-panel">
        <h3>Economia Avançada</h3>
        <p>Você precisa estar controlando um país para ver os dados econômicos avançados.</p>
      </div>
    );
  }
  
  if (loading || !economicData) {
    return (
      <div className="advanced-economy-panel">
        <h3>Economia Avançada</h3>
        <p>Carregando dados econômicos...</p>
        {myCountry && <p><small>País: {myCountry}</small></p>}
        {countriesData?.[myCountry] && <p><small>Dados JSON: Disponíveis</small></p>}
      </div>
    );
  }
  
  return (
    <div className="advanced-economy-panel">
      
      {/* Indicadores Principais */}
      <div className="main-indicators">
        <div className="indicator">
          <label>PIB:</label>
          <div className="indicator-value">
            <span className="value">{formatCurrency(economicData.gdp)} bi</span>
            <span className={`growth ${economicData.gdpGrowth >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economicData.gdpGrowth)}% anual
            </span>
          </div>
        </div>
        
        <div className="indicator">
          <label>Tesouro:</label>
          <span className="value">{formatCurrency(economicData.treasury)} bi</span>
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
              disabled={localParameters.interestRate === economicData.interestRate}
            >
              Aplicar
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <label>Carga Tributária: {formatPercent(localParameters.taxBurden)}</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="70"
              step="0.5"
              value={localParameters.taxBurden}
              onChange={(e) => setLocalParameters(prev => ({
                ...prev,
                taxBurden: parseFloat(e.target.value)
              }))}
            />
            <button 
              onClick={() => applyParameterChange('taxBurden', localParameters.taxBurden)}
              disabled={localParameters.taxBurden === economicData.taxBurden}
            >
              Aplicar
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
              disabled={localParameters.publicServices === economicData.publicServices}
            >
              Aplicar
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
            disabled={isIssuingBonds || !bondAmount}
          >
            {isIssuingBonds ? 'Emitindo...' : 'Emitir'}
          </button>
        </div>
        
        {/* Botão para abrir popup de dívidas */}
        {economicData.publicDebt > 0 && (
          <button 
            className="debt-summary-btn"
            onClick={handleOpenDebtPopup}
          >
            Ver Dívidas ({formatCurrency(economicData.publicDebt)} bi)
          </button>
        )}
      </div>
      
      {/* Balanço Setorial */}
      <div className="sectoral-balance">
        <h4>Balanço Setorial</h4>
        
        <div className="sector-item">
          <div className="sector-header">
            <span>Commodities</span>
            <span className={`balance-value ${economicData.commoditiesBalance >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economicData.commoditiesBalance)}
            </span>
          </div>
          <div className="sector-details">
            <small>Prod: {formatCurrency(economicData.commoditiesOutput)} bi</small>
            <small>Cons: {formatCurrency(economicData.commoditiesNeeds)} bi</small>
          </div>
        </div>
        
        <div className="sector-item">
          <div className="sector-header">
            <span>Manufaturas</span>
            <span className={`balance-value ${economicData.manufacturesBalance >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economicData.manufacturesBalance)}
            </span>
          </div>
          <div className="sector-details">
            <small>Prod: {formatCurrency(economicData.manufacturesOutput)} bi</small>
            <small>Cons: {formatCurrency(economicData.manufacturesNeeds)} bi</small>
          </div>
        </div>
        
        <div className="sector-item">
          <div className="sector-header">
            <span>Serviços</span>
            <span className="balance-value">
              {formatCurrency(economicData.servicesOutput)} bi
            </span>
          </div>
          <div className="sector-details">
            <small>Não comercializável</small>
          </div>
        </div>
      </div>
      
      {/* Debug info - mostrar fonte dos dados */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
          <div>Dados JSON: {countriesData?.[myCountry]?.economy ? 'Disponível' : 'Não disponível'}</div>
          <div>Estado dinâmico: {countryState?.economy ? 'Disponível' : 'Não disponível'}</div>
          <div>PIB fonte: {countryState?.economy?.gdp ? 'Dinâmico' : 'JSON'}</div>
        </div>
      )}
    </div>
  );
};

export default AdvancedEconomyPanel;