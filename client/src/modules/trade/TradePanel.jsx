import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import './TradePanel.css';

const TradePanel = () => {
  // Estados Redux com fallbacks seguros
  const myCountry = useSelector(state => state.game?.myCountry || 'Seu País');
  const players = useSelector(state => state.game?.players || []);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  const countryState = useSelector(state => {
    if (!currentRoom?.name || !myCountry) return null;
    return state.countryState?.roomStates?.[currentRoom.name]?.[myCountry] || null;
  });
  
  // Estado local
  const [targetCountry, setTargetCountry] = useState('');
  const [agreements, setAgreements] = useState([]);
  
  // Formatar valor com sinal
  const formatValueWithSign = (value) => {
    if (value === undefined || value === null) return '0';
    return (value >= 0 ? '+' : '') + value.toFixed(2) + ' bi';
  };
  
  // Formatar porcentagem
  const formatPercent = (value) => {
    if (value === undefined || value === null) return '0%';
    return value + '%';
  };
  
  // Versão minimalista quando não há país selecionado
  if (!myCountry || myCountry === 'Seu País') {
    return (
      <div className="trade-panel">
        <h3>Comércio Internacional</h3>
        <p>Selecione um país para gerenciar o comércio.</p>
      </div>
    );
  }
  
  // Se não temos dados de estado do país ainda
  if (!countryState || !countryState.economy) {
    return (
      <div className="trade-panel">
        <p>Carregando dados econômicos...</p>
      </div>
    );
  }
  
  // Dados econômicos
  const economy = countryState.economy;
  
  return (
    <div className="trade-panel">

      <div className="trade-agreements-section">
        <h4>Acordos Comerciais</h4>

        {agreements.length > 0 ? (
          <div className="agreements-list">
            {agreements.map((agreement, index) => (
              <div key={index} className={`trade-card ${agreement.type}`}>
                <h4>{agreement.country}</h4>
                <p>Tipo: {agreement.type === 'export' ? 'Exportação' : 'Importação'}</p>
                <p>Valor: {agreement.value} bi USD</p>
                <button className="action-btn danger">Cancelar Acordo</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-data">
            <p>Nenhum acordo comercial ativo</p>
          </div>
        )}
      </div>

      <div className="trade-balance-section">
        <h4>Balanço Comercial</h4>
        
        <div className="balance-item">
          <div className="balance-header">
            <span className="balance-title">Commodities</span>
            <div className={`balance-value ${economy.commoditiesBalance?.value >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economy.commoditiesBalance?.value)}
            </div>
          </div>
          <div className="balance-details">
            <div className="balance-row">
              <span className="balance-label">Produção:</span>
              <span className="balance-number">{economy.commoditiesOutput?.value || 0} bi</span>
            </div>
            <div className="balance-row">
              <span className="balance-label">Necessidade:</span>
              <span className="balance-number">{economy.commoditiesNeeds?.value || 0} bi</span>
              <span className="balance-percent">({economy.commoditiesNeeds?.percentValue || 0}% do PIB)</span>
            </div>
          </div>
        </div>
        
        <div className="balance-item">
          <div className="balance-header">
            <span className="balance-title">Manufaturas</span>
            <div className={`balance-value ${economy.manufacturesBalance?.value >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economy.manufacturesBalance?.value)}
            </div>
          </div>
          <div className="balance-details">
            <div className="balance-row">
              <span className="balance-label">Produção:</span>
              <span className="balance-number">{economy.manufacturesOutput?.value || 0} bi</span>
            </div>
            <div className="balance-row">
              <span className="balance-label">Necessidade:</span>
              <span className="balance-number">{economy.manufacturesNeeds?.value || 0} bi</span>
              <span className="balance-percent">({economy.manufacturesNeeds?.percentValue || 0}% do PIB)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="sectoral-distribution-section">
        <h4>Distribuição Setorial do PIB</h4>
        <div className="distribution-bars">
          <div className="sector-bar">
            <div className="sector-info">
              <span className="sector-label">Serviços:</span>
              <span className="sector-value">{formatPercent(economy.services?.value)}</span>
            </div>
            <div className="progress-container">
              <div 
                className="progress-fill services" 
                style={{ width: `${economy.services?.value || 0}%` }}
              ></div>
            </div>
            <span className="sector-output">{economy.servicesOutput?.value || 0} bi</span>
          </div>
          
          <div className="sector-bar">
            <div className="sector-info">
              <span className="sector-label">Commodities:</span>
              <span className="sector-value">{formatPercent(economy.commodities?.value)}</span>
            </div>
            <div className="progress-container">
              <div 
                className="progress-fill commodities" 
                style={{ width: `${economy.commodities?.value || 0}%` }}
              ></div>
            </div>
            <span className="sector-output">{economy.commoditiesOutput?.value || 0} bi</span>
          </div>
          
          <div className="sector-bar">
            <div className="sector-info">
              <span className="sector-label">Manufaturas:</span>
              <span className="sector-value">{formatPercent(economy.manufactures?.value)}</span>
            </div>
            <div className="progress-container">
              <div 
                className="progress-fill manufactures" 
                style={{ width: `${economy.manufactures?.value || 0}%` }}
              ></div>
            </div>
            <span className="sector-output">{economy.manufacturesOutput?.value || 0} bi</span>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default TradePanel;