import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { COUNTRY_STATE_EVENTS } from '../../store/socketReduxMiddleware';
import { 
  selectCountryState, 
  selectCountryStateLoading,
  selectLastUpdated
} from '../country/countryStateSlice';
import { socketApi } from '../../services/socketClient';
import './EconomyPanel.css';

const EconomyPanel = () => {
  const dispatch = useDispatch();
  
  // Seletores para obter dados de vários reducers
  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  
  // Estados em tempo real do país
  const countryState = useSelector(state => 
    selectCountryState(state, currentRoom?.name, myCountry)
  );
  const loading = useSelector(selectCountryStateLoading);
  
  // Estado local para mudanças nos controles deslizantes e emissão de títulos
  const [interestRate, setInterestRate] = useState(5.0);
  const [taxRate, setTaxRate] = useState(25);
  const [publicServices, setPublicServices] = useState(30);
  const [bondAmount, setBondAmount] = useState('');
  const [isIssuingBonds, setIsIssuingBonds] = useState(false);
  const [bondsError, setBondsError] = useState('');
  
  // Assinar para atualizações quando o componente montar
  useEffect(() => {
    if (currentRoom?.name) {
      console.log('Subscribing to country states for room:', currentRoom.name);
      dispatch({ type: COUNTRY_STATE_EVENTS.SUBSCRIBE, payload: currentRoom.name });
      
      // Cancelar assinatura ao desmontar
      return () => {
        console.log('Unsubscribing from country states for room:', currentRoom.name);
        dispatch({ type: COUNTRY_STATE_EVENTS.UNSUBSCRIBE, payload: currentRoom.name });
      };
    }
  }, [currentRoom?.name, dispatch]);
  
  // Escutar eventos de economia do socket
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    const handleDebtBondsIssued = (data) => {
      setIsIssuingBonds(false);
      setBondAmount('');
      setBondsError('');
      console.log('Debt bonds issued successfully:', data);
    };
    
    const handleError = (error) => {
      if (error.includes('bond') || error.includes('debt')) {
        setIsIssuingBonds(false);
        setBondsError(error);
      }
    };
    
    socket.on('debtBondsIssued', handleDebtBondsIssued);
    socket.on('error', handleError);
    
    return () => {
      socket.off('debtBondsIssued', handleDebtBondsIssued);
      socket.off('error', handleError);
    };
  }, []);
  
  // Funções para ajustar os parâmetros econômicos
  const handleInterestRateChange = (newRate) => {
    setInterestRate(parseFloat(newRate));
  };
  
  const handleTaxRateChange = (newRate) => {
    setTaxRate(parseInt(newRate));
  };
  
  const handlePublicServicesChange = (newLevel) => {
    setPublicServices(parseInt(newLevel));
  };
  
  // Função para emitir títulos de dívida
  const handleIssueDebtBonds = () => {
    const amount = parseFloat(bondAmount);
    
    if (!amount || amount <= 0 || amount > 1000) {
      setBondsError('Valor deve estar entre 0 e 1000 bilhões');
      return;
    }
    
    setIsIssuingBonds(true);
    setBondsError('');
    
    // Emitir evento via socket
    const socket = socketApi.getSocketInstance();
    if (socket) {
      socket.emit('issueDebtBonds', { bondAmount: amount });
    }
  };
  
  // Obtém dados econômicos formatados do país (dados estáticos para outros campos)
  const getStaticEconomyData = () => {
    if (!myCountry || !countriesData || !countriesData[myCountry]) {
      return null;
    }
    
    return countriesData[myCountry].economy || null;
  };
  
  // Renderiza painel de economia
  const staticEconomyData = getStaticEconomyData();
  
  if (!myCountry) {
    return (
      <div className="economy-panel loading">
        <h3>Economia</h3>
        <p>Selecione um país para ver dados econômicos</p>
      </div>
    );
  }
  
  if (loading && !countryState) {
    return (
      <div className="economy-panel loading">
        <h3>Economia</h3>
        <p>Carregando dados econômicos...</p>
      </div>
    );
  }
  
  return (
    <div className="economy-panel">
      
      <div className="economy-controls">
        
        <div className="control-group">
          <label>
            Taxa de Juros: <span className="current-value">{interestRate}%</span>
          </label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="20"
              step="0.25"
              value={interestRate}
              onChange={(e) => handleInterestRateChange(e.target.value)}
            />
            <button 
              disabled={staticEconomyData && interestRate === staticEconomyData.interestRate}
            >
              Aplicar
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <label>
            Carga Tributária: <span className="current-value">{taxRate}%</span>
          </label>
          <div className="slider-container">
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={taxRate}
              onChange={(e) => handleTaxRateChange(e.target.value)}
            />
            <button 
              disabled={staticEconomyData && taxRate === staticEconomyData.taxBurden}
            >
              Aplicar
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <label>
            Serviços Públicos: <span className="current-value">{publicServices}%</span>
          </label>
          <div className="slider-container">
            <input
              type="range"
              min="10"
              max="60"
              step="1"
              value={publicServices}
              onChange={(e) => handlePublicServicesChange(e.target.value)}
            />
            <button 
              disabled={staticEconomyData && publicServices === staticEconomyData.publicServices}
            >
              Aplicar
            </button>
          </div>
        </div>
        
        {/* Seção para emissão de títulos de dívida */}
        <div className="control-group">
          <label>
            Emissão de Títulos de Dívida:
          </label>
          <div className="debt-bonds-container">
            <input
              type="number"
              placeholder="Valor em bilhões"
              min="0"
              max="1000"
              step="0.1"
              value={bondAmount}
              onChange={(e) => setBondAmount(e.target.value)}
              disabled={isIssuingBonds}
            />
            <button 
              className="action-btn"
              onClick={handleIssueDebtBonds}
              disabled={isIssuingBonds || !bondAmount}
            >
              {isIssuingBonds ? 'Emitindo...' : 'Emitir títulos'}
            </button>
          </div>
          {bondsError && (
            <div className="error-message">
              {bondsError}
            </div>
          )}
          <div className="bonds-info">
            <small>
              • Valor será adicionado ao Tesouro<br/>
              • 110% do valor será adicionado à Dívida Pública
            </small>
          </div>
        </div>
      </div>
      
      <br />
      
      <div className="economy-overview">
        <div className="stat-group">
          <span>PIB:</span>
          {countryState?.economy ? (
            <>
              {countryState.economy.gdp.value} {countryState.economy.gdp.unit}
              <span className={`stat-value ${staticEconomyData?.gdpGrowth >= 0 ? 'positive' : 'negative'}`}>
                {staticEconomyData?.gdpGrowth >= 0 ? '+' : ''}{staticEconomyData?.gdpGrowth || 0}%
              </span>
            </>
          ) : (
            <>
              {staticEconomyData?.gdp?.value || 0} {staticEconomyData?.gdp?.unit || 'bilhões'}
              <span className={`stat-value ${staticEconomyData?.gdpGrowth >= 0 ? 'positive' : 'negative'}`}>
                {staticEconomyData?.gdpGrowth >= 0 ? '+' : ''}{staticEconomyData?.gdpGrowth || 0}%
              </span>
            </>
          )}
        </div>
          
        <div className="stat-group">
          <div className="stat">
            <span className="stat-label">Inflação:</span>
            <span className={`stat-value ${staticEconomyData?.inflation <= 3 ? 'positive' : 'negative'}`}>
              {staticEconomyData?.inflation || 0}%
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Desemprego:</span>
            <span className={`stat-value ${staticEconomyData?.unemployment <= 5 ? 'positive' : 'negative'}`}>
              {staticEconomyData?.unemployment || 0}%
            </span>
          </div>
        </div>
        
        <div className="stat-group">
          <div className="stat">
            <span className="stat-label">Tesouro:</span>
            <span className="stat-value">
              {countryState?.economy ? (
                <>
                  {countryState.economy.treasury.value} {countryState.economy.treasury.unit}
                </>
              ) : (
                <>
                  {staticEconomyData?.treasury?.value || 0} {staticEconomyData?.treasury?.unit || 'bilhões'}
                </>
              )}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Dívida Pública:</span>
            <span className={`stat-value ${staticEconomyData?.publicDebtToGdp <= 60 ? 'positive' : 'negative'}`}>
              {staticEconomyData?.publicDebt?.value || 0} {staticEconomyData?.publicDebt?.unit || 'bilhões'} 
              ({staticEconomyData?.publicDebtToGdp || 0}% do PIB)
            </span>
          </div>
        </div>
        
        <div className="stat-group">
          <div className="stat">
            <span className="stat-label">Popularidade:</span>
            <span className={`stat-value ${staticEconomyData?.popularity >= 50 ? 'positive' : 'negative'}`}>
              {staticEconomyData?.popularity || 0}%
            </span>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default EconomyPanel;