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
  
  // Estados dinâmicos do país - ESTA É A FONTE PRINCIPAL DOS DADOS
  const countryState = useSelector(state => 
    myCountry ? selectCountryState(state, currentRoom?.name, myCountry) : null
  );
  const loading = useSelector(selectCountryStateLoading);
  const lastUpdated = useSelector(state => selectLastUpdated(state, currentRoom?.name));
  
  // Estados locais - MODIFICADO para incluir valores atuais aplicados
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
  const [pendingUpdates, setPendingUpdates] = useState(new Set());
  
  // Estado para controlar as dívidas emitidas localmente
  const [localDebtContracts, setLocalDebtContracts] = useState([]);
  const [localPublicDebt, setLocalPublicDebt] = useState(0);
  
  // Assinar para atualizações quando o componente montar
  useEffect(() => {
    if (currentRoom?.name) {
      dispatch({ type: COUNTRY_STATE_EVENTS.SUBSCRIBE, payload: currentRoom.name });
      
      return () => {
        dispatch({ type: COUNTRY_STATE_EVENTS.UNSUBSCRIBE, payload: currentRoom.name });
      };
    }
  }, [currentRoom?.name, dispatch]);
  

  // Calcular número de contratos de dívida - ATUALIZADO para usar apenas contratos locais
  const getNumberOfDebtContracts = useCallback(() => {
    // Usar apenas contratos reais armazenados localmente
    return localDebtContracts.length;
  }, [localDebtContracts]);

  // Função para obter valor numérico de propriedade que pode estar em diferentes formatos
  const getNumericValue = useCallback((property) => {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  }, []);
  
  // Função para obter dados econômicos - PRIORIZA DADOS DINÂMICOS DO SERVIDOR
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
    
    return {
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
      
      // DADOS ESTÁTICOS (do JSON - raramente mudam)
      inflation: getDynamicOrStatic(null, 'inflation', 2.8),
      unemployment: getDynamicOrStatic(null, 'unemployment', 12.5),
      gdpGrowth: getDynamicOrStatic(null, 'gdpGrowth', 0.5),
      popularity: getDynamicOrStatic(null, 'popularity', 50),
      creditRating: staticData.creditRating || 'A',
      publicDebt: getDynamicOrStatic(null, 'publicDebt', 0),
      
      // Parâmetros de política - MODIFICADO para usar valores aplicados primeiro
      taxBurden: appliedParameters.taxBurden,
      publicServices: appliedParameters.publicServices,
      interestRate: appliedParameters.interestRate,
      
      // Usar dívida local se houver emissões recentes
      publicDebt: localPublicDebt > 0 ? localPublicDebt : getDynamicOrStatic(null, 'publicDebt', 0),
    };
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
    
    // REMOVIDO: Inicialização da dívida local com dados estáticos
    // Para que apenas contratos reais sejam considerados
    
    // Só atualiza se ainda não foram alterados
    if (appliedParameters.interestRate === 8.0 && appliedParameters.taxBurden === 40.0 && appliedParameters.publicServices === 30.0) {
      setLocalParameters(initialParams);
      setAppliedParameters(initialParams);
    }
  }, [myCountry, countriesData, getNumericValue]); // Removido appliedParameters da dependência para evitar loop
  
  // Aplicar mudanças nos parâmetros econômicos - CORRIGIDO para persistir no servidor
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
        
        showSuccess(`${parameterNames[parameter]} alterada para ${newValue}${parameter !== 'interestRate' ? '%' : '%'}`);
        
        // Atualizar também os dados estáticos localmente para persistência (CORREÇÃO: criar cópia)
        if (countriesData[myCountry] && countriesData[myCountry].economy) {
          // Criar uma cópia mutável do objeto ao invés de modificar diretamente
          const updatedCountryData = JSON.parse(JSON.stringify(countriesData[myCountry]));
          updatedCountryData.economy[parameter] = newValue;
          
          // Atualizar o estado Redux com os novos dados
          dispatch({
            type: 'game/setCountriesData',
            payload: {
              ...countriesData,
              [myCountry]: updatedCountryData
            }
          });
        }
      }
    } catch (error) {
      showError(`Erro ao atualizar ${parameter}: ${error.message}`);
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
  }, [currentRoom?.name, myCountry, countriesData]);
  
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
      
      // Atualizar dívida local imediatamente
      setLocalPublicDebt(data.newPublicDebt);
      
      // Criar um novo contrato de dívida local
      const newContract = {
        id: `contract-${Date.now()}`,
        originalValue: data.bondAmount,
        remainingValue: data.bondAmount,
        interestRate: 8 + (Math.random() * 4), // Simular taxa baseada no rating
        monthlyPayment: data.bondAmount * 0.012, // Aproximação de pagamento mensal
        remainingInstallments: 120, // 10 anos
        issueDate: new Date()
      };
      
      setLocalDebtContracts(prev => [...prev, newContract]);
    };
    
    const handleParameterUpdated = (data) => {
      // Confirmar que o parâmetro foi atualizado no servidor
      if (data.countryName === myCountry && data.roomName === currentRoom?.name) {
        console.log(`Parâmetro ${data.parameter} confirmado no servidor:`, data.value);
        
        // Remove from pending updates
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
  
  // Função para abrir popup de dívidas via callback - ATUALIZADO para usar apenas contratos locais
  const handleOpenDebtPopup = useCallback(() => {
    const economicData = getEconomicData();
    if (economicData && onOpenDebtPopup) {
      // MODIFICADO: Usar apenas contratos reais armazenados localmente
      const debtRecords = localDebtContracts;
      const numberOfContracts = localDebtContracts.length;
      
      // Criar resumo das dívidas baseado apenas em contratos reais
      const debtSummary = {
        totalMonthlyPayment: debtRecords.reduce((sum, debt) => sum + (debt.monthlyPayment || 0), 0),
        principalRemaining: debtRecords.reduce((sum, debt) => sum + (debt.remainingValue || 0), 0),
        totalFuturePayments: debtRecords.reduce((sum, debt) => 
          sum + ((debt.monthlyPayment || 0) * (debt.remainingInstallments || 0)), 0
        ),
        debtToGdpRatio: (economicData.publicDebt / economicData.gdp) * 100,
        numberOfDebts: numberOfContracts
      };
      
      // Chamar o callback passando os dados para o GamePage
      onOpenDebtPopup(debtSummary, debtRecords, economicData);
    }
  }, [getEconomicData, onOpenDebtPopup, localDebtContracts]);
  
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
  
  const numberOfContracts = getNumberOfDebtContracts();
  
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
      
      {/* Controles Econômicos - CORRIGIDO para mostrar valores aplicados */}
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
        
        {/* MODIFICADO: Botão só aparece se houver contratos reais */}
        {numberOfContracts > 0 && (
          <button 
            className="debt-summary-btn"
            onClick={handleOpenDebtPopup}
          >
            Ver Dívidas ({numberOfContracts} {numberOfContracts === 1 ? 'contrato' : 'contratos'})
          </button>
        )}
      </div>
      
      {/* Balanço Setorial - AGORA COM DADOS DINÂMICOS ATUALIZADOS */}
      <div className="sectoral-balance">
        <h4>Balanço Setorial (Atualizado)</h4>
        
        <div className="sector-item">
          <div className="sector-header">
            <span>Commodities</span>
            <span className={`balance-value ${economicData.commoditiesBalance >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economicData.commoditiesBalance)} bi
            </span>
          </div>
          <div className="sector-details">
            <small>Prod: {formatCurrency(economicData.commoditiesOutput)} bi</small>
            <small>Cons: {formatCurrency(economicData.commoditiesNeeds)} bi</small>
            {economicData.tradeStats && (economicData.tradeStats.commodityImports > 0 || economicData.tradeStats.commodityExports > 0) && (
              <small>Comércio: 
                {economicData.tradeStats.commodityImports > 0 && ` +${economicData.tradeStats.commodityImports.toFixed(1)} imp`}
                {economicData.tradeStats.commodityExports > 0 && ` -${economicData.tradeStats.commodityExports.toFixed(1)} exp`}
              </small>
            )}
          </div>
        </div>
        
        <div className="sector-item">
          <div className="sector-header">
            <span>Manufaturas</span>
            <span className={`balance-value ${economicData.manufacturesBalance >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economicData.manufacturesBalance)} bi
            </span>
          </div>
          <div className="sector-details">
            <small>Prod: {formatCurrency(economicData.manufacturesOutput)} bi</small>
            <small>Cons: {formatCurrency(economicData.manufacturesNeeds)} bi</small>
            {economicData.tradeStats && (economicData.tradeStats.manufactureImports > 0 || economicData.tradeStats.manufactureExports > 0) && (
              <small>Comércio: 
                {economicData.tradeStats.manufactureImports > 0 && ` +${economicData.tradeStats.manufactureImports.toFixed(1)} imp`}
                {economicData.tradeStats.manufactureExports > 0 && ` -${economicData.tradeStats.manufactureExports.toFixed(1)} exp`}
              </small>
            )}
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
            <small>Não comercializável ({formatPercent(economicData.services)} PIB)</small>
          </div>
        </div>
      </div>
      
      {/* Debug info - apenas informações essenciais */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ fontSize: '10px', color: '#666', marginTop: '10px', padding: '8px', background: 'rgba(255,255,255,0.1)' }}>
          <div>✅ Dados dinâmicos: {countryState?.economy ? 'Atualizando' : 'Não disponível'}</div>
          <div>📊 PIB atual: {formatCurrency(economicData.gdp)} bi</div>
          <div>💰 Tesouro atual: {formatCurrency(economicData.treasury)} bi</div>
          <div>⚖️ Balanços: Commodities {formatValueWithSign(economicData.commoditiesBalance)}, Manufaturas {formatValueWithSign(economicData.manufacturesBalance)}</div>
          <div>📄 Contratos de dívida: {numberOfContracts} (Locais: {localDebtContracts.length})</div>
          <div>💳 Dívida local: {formatCurrency(localPublicDebt)} bi</div>
          <div>🔧 Parâmetros aplicados: Juros {appliedParameters.interestRate}%, Impostos {appliedParameters.taxBurden}%, Serviços {appliedParameters.publicServices}%</div>
          <div>🕐 Última atualização: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'N/A'}</div>
        </div>
      )}
    </div>
  );
};

export default AdvancedEconomyPanel;