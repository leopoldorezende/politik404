import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import './EconomyPanel.css';

const EconomyPanel = () => {
  // Seletores para obter dados de vários reducers
  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  
  // Estado local para mudanças nos controles deslizantes
  const [interestRate, setInterestRate] = useState(5.0);
  const [taxRate, setTaxRate] = useState(25);
  const [publicServices, setPublicServices] = useState(30);
  
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
  
  // Obtém dados econômicos formatados do país
  const getEconomyData = () => {
    if (!myCountry || !countriesData || !countriesData[myCountry]) {
      return null;
    }
    
    return countriesData[myCountry].economy || null;
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
              disabled={interestRate === economyData.interestRate}
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
              disabled={taxRate === economyData.taxBurden}
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
              disabled={publicServices === economyData.publicServices}
            >
              Aplicar
            </button>
          </div>
        </div>
        <button className="action-btn">
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