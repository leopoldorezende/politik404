import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  ECONOMY_EVENTS 
} from '../../store/socketReduxMiddleware';
import './EconomyPanel.css';

const EconomyPanel = () => {
  const dispatch = useDispatch();
  
  // Seletores para obter dados de vários reducers
  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  const economicEvents = useSelector(state => state.economy.events);
  
  // Estado local para mudanças nos controles deslizantes
  const [interestRate, setInterestRate] = useState(5.0);
  const [taxRate, setTaxRate] = useState(25);
  const [publicServices, setPublicServices] = useState(30);
  
  // Dados econômicos do país do jogador
  useEffect(() => {
    if (myCountry && countriesData && countriesData[myCountry]) {
      const economy = countriesData[myCountry].economy;
      
      // Inicializa os controles deslizantes com os valores atuais
      setInterestRate(economy.interestRate || 5.0);
      setTaxRate(economy.taxBurden || 25);
      setPublicServices(economy.publicServices || 30);
    }
  }, [myCountry, countriesData]);
  
  // Solicita dados econômicos atualizados ao montar o componente
  useEffect(() => {
    if (myCountry) {
      dispatch({ type: ECONOMY_EVENTS.GET_ECONOMY_DATA });
      
      // Configura um intervalo para solicitar atualizações periódicas
      const interval = setInterval(() => {
        dispatch({ type: ECONOMY_EVENTS.GET_ECONOMY_DATA });
      }, 30000); // A cada 30 segundos
      
      return () => clearInterval(interval);
    }
  }, [myCountry, dispatch]);
  
  // Obtém dados econômicos formatados do país
  const getEconomyData = () => {
    if (!myCountry || !countriesData || !countriesData[myCountry]) {
      return null;
    }
    
    return countriesData[myCountry].economy || null;
  };
  
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
  
  // Funções para enviar os ajustes ao servidor
  const applyInterestRateChange = () => {
    dispatch({ 
      type: ECONOMY_EVENTS.ADJUST_INTEREST_RATE, 
      payload: interestRate 
    });
    setLastAdjusted('interest');
  };
  
  const applyTaxRateChange = () => {
    dispatch({ 
      type: ECONOMY_EVENTS.ADJUST_TAX_BURDEN, 
      payload: taxRate 
    });
    setLastAdjusted('tax');
  };
  
  const applyPublicServicesChange = () => {
    dispatch({ 
      type: ECONOMY_EVENTS.ADJUST_PUBLIC_SERVICES, 
      payload: publicServices 
    });
    setLastAdjusted('services');
  };
  
  // Formata eventos econômicos para exibição
  const formatEconomicEvents = () => {
    if (!economicEvents || economicEvents.length === 0) {
      return <p className="no-events">Nenhum evento econômico recente</p>;
    }
    
    // Filtra apenas eventos para o país atual
    const countryEvents = economicEvents
      .filter(event => event.country === myCountry)
      .slice(-5); // Apenas os 5 mais recentes
      
    if (countryEvents.length === 0) {
      return <p className="no-events">Nenhum evento econômico para seu país</p>;
    }
    
    return (
      <div className="events-list">
        {countryEvents.map((event, index) => (
          <div key={index} className="event-item">
            <span className="event-type">{event.event.type}</span>
            <span className="event-impact">
              Impacto: {event.event.impact > 0 ? '+' : ''}{event.event.impact}%
            </span>
            <span className="event-time">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    );
  };
  
  // Renderiza painel de economia
  const economyData = getEconomyData();
  
  if (!economyData) {
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
              onClick={applyInterestRateChange}
              disabled={interestRate === economyData.interestRate}
            >
              Aplicar
            </button>
          </div>
          {/* <p className="control-info">
            A taxa de juros afeta a inflação, o crescimento e o custo da dívida pública.
          </p> */}
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
              onClick={applyTaxRateChange}
              disabled={taxRate === economyData.taxBurden}
            >
              Aplicar
            </button>
          </div>
          {/* <p className="control-info">
            Impostos mais altos aumentam a receita do governo, mas podem reduzir o crescimento econômico e a popularidade.
          </p> */}
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
              onClick={applyPublicServicesChange}
              disabled={publicServices === economyData.publicServices}
            >
              Aplicar
            </button>
          </div>
          {/* <p className="control-info">
            Mais serviços públicos aumentam a popularidade, mas requerem maior gasto público.
          </p> */}
        </div>
        <button 
            className="action-btn"
            onClick={() => {
            }}
          >
            Emitir título de dívida
          </button>
      </div>
      
      <br />
      


      <div className="economy-overview">
        <div className="stat-group">
                
            <span>PIB:</span>
            {economyData.gdp?.value || 0} {economyData.gdp?.unit || 'bilhões'}

            <span className={`stat-value ${economyData.gdpGrowth >= 0 ? 'positive' : 'negative'}`}>
              {economyData.gdpGrowth >= 0 ? '+' : ''}{economyData.gdpGrowth || 0}%
            </span>
            
        </div>
          
        <div className="stat-group">
          <div className="stat">
            <span className="stat-label">Inflação:</span>
            <span className={`stat-value ${economyData.inflation <= 3 ? 'positive' : 'negative'}`}>
              {economyData.inflation || 0}%
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Desemprego:</span>
            <span className={`stat-value ${economyData.unemployment <= 5 ? 'positive' : 'negative'}`}>
              {economyData.unemployment || 0}%
            </span>
          </div>
        </div>
        
        <div className="stat-group">
          <div className="stat">
            <span className="stat-label">Tesouro:</span>
            <span className="stat-value">
              {economyData.treasury?.value || 0} {economyData.treasury?.unit || 'bilhões'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Dívida Pública:</span>
            <span className={`stat-value ${economyData.publicDebtToGdp <= 60 ? 'positive' : 'negative'}`}>
              {economyData.publicDebt?.value || 0} {economyData.publicDebt?.unit || 'bilhões'} 
              ({economyData.publicDebtToGdp || 0}% do PIB)
            </span>
          </div>
        </div>
        
        <div className="stat-group">
          <div className="stat">
            <span className="stat-label">Popularidade:</span>
            <span className={`stat-value ${economyData.popularity >= 50 ? 'positive' : 'negative'}`}>
              {economyData.popularity || 0}%
            </span>
          </div>
        </div>
      </div>
      
    
      
    </div>
  );
};

export default EconomyPanel;