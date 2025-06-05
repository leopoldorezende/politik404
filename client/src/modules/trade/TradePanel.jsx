/**
 * TradePanel.jsx - Simplificado usando hooks diretos
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useEconomy, useTradeAgreements } from '../../hooks/useEconomy';
import { socketApi } from '../../services/socketClient';
import './TradePanel.css';

const TradePanel = ({ onOpenCardsPopup }) => {
  // Estados básicos do Redux
  const myCountry = useSelector(state => state.game?.myCountry);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  
  // Hooks diretos para dados
  const { economicIndicators, formatPercent } = useEconomy(
    currentRoom?.name, 
    myCountry
  );
  
  // Formatação específica para valores em bilhões com 2 casas decimais
  const formatCurrency = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00';
    return Number(value).toFixed(2);
  };
  
  const { agreements, refresh: refreshAgreements } = useTradeAgreements(
    currentRoom?.name
  );
  
  // Estado local
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Atualizar acordos automaticamente quando economicIndicators mudam
  React.useEffect(() => {
    if (currentRoom?.name && economicIndicators) {
      refreshAgreements();
    }
  }, [currentRoom?.name, economicIndicators?.tradeStats, refreshAgreements]);

  // Função para cancelar acordo comercial
  const handleCancelAgreement = (agreementId) => {
    if (window.confirm('Tem certeza que deseja cancelar este acordo comercial?')) {
      setIsSubmitting(true);
      
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('cancelTradeAgreement', agreementId);
      }
      
      setTimeout(() => {
        setIsSubmitting(false);
        refreshAgreements();
      }, 1000);
    }
  };

  // Formatar valor com sinal (2 casas decimais)
  const formatValueWithSign = (value) => {
    if (value === undefined || value === null) return '0.00';
    const num = Number(value);
    return (num >= 0 ? '+' : '') + num.toFixed(2) + ' bi';
  };

  if (!myCountry) {
    return (
      <div className="trade-panel">
        <h3>Comércio Internacional</h3>
        <p>Selecione um país para gerenciar o comércio.</p>
      </div>
    );
  }

  if (!economicIndicators) {
    return (
      <div className="trade-panel">
        <p>Carregando dados econômicos...</p>
      </div>
    );
  }

  // Filtrar apenas acordos originados pelo meu país
  const myAgreements = agreements.filter(agreement => 
    agreement.originCountry === myCountry && agreement.country !== myCountry
  );

  return (
    <div className="trade-panel">
      
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
        <button 
          onClick={() => onOpenCardsPopup && onOpenCardsPopup('acordos-comerciais')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Ver Acordos
        </button>
      </div>

      <div className="trade-balance-section">

        <div className="balance-item">
          <div className="balance-header">
            <span className="balance-title">Commodities</span>
            <div className={`balance-value ${economicIndicators.commoditiesBalance >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economicIndicators.commoditiesBalance)}
            </div>
          </div>
          <div className="balance-details">
            <div className="balance-row">
              <span className="balance-label">Produção:</span>
              <div className="balance-values-container">
                <span className="balance-number">{formatCurrency(economicIndicators.commoditiesOutput)} bi</span>
                <span className="balance-percent">
                  ({Math.round((economicIndicators.commoditiesOutput / economicIndicators.gdp) * 100)}% PIB)
                </span>
              </div>
            </div>
            
            {/* Importações de commodities */}
            {economicIndicators.tradeStats.commodityImports > 0 && (
              <div className="balance-row">
                <span className="balance-label">Importações:</span>
                <div className="balance-values-container">
                  <span className={`balance-number ${economicIndicators.commoditiesBalance < 0 ? 'positive' : 'negative'}`}>+{formatCurrency(economicIndicators.tradeStats.commodityImports)} bi</span>
                </div>
              </div>
            )}
            
            {/* Exportações de commodities */}
            {economicIndicators.tradeStats.commodityExports > 0 && (
              <div className="balance-row">
                <span className="balance-label">Exportações:</span>
                <div className="balance-values-container">
                  <span className={`balance-number ${economicIndicators.commoditiesBalance > 0 ? 'positive' : 'negative'}`}>-{formatCurrency(economicIndicators.tradeStats.commodityExports)} bi</span>
                </div>
              </div>
            )}
            
            <div className="balance-row">
              <span className="balance-label">Consumo:</span>
              <div className="balance-values-container">
                <span className="balance-number">{formatCurrency(economicIndicators.commoditiesNeeds)} bi</span>
                <span className="balance-percent">
                  ({Math.round((economicIndicators.commoditiesNeeds / economicIndicators.gdp) * 100)}% PIB)
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="balance-item">
          <div className="balance-header">
            <span className="balance-title">Manufaturas</span>
            <div className={`balance-value ${economicIndicators.manufacturesBalance >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economicIndicators.manufacturesBalance)}
            </div>
          </div>
          <div className="balance-details">
            <div className="balance-row">
              <span className="balance-label">Produção:</span>
              <div className="balance-values-container">
                <span className="balance-number">{formatCurrency(economicIndicators.manufacturesOutput)} bi</span>
                <span className="balance-percent">
                  ({Math.round((economicIndicators.manufacturesOutput / economicIndicators.gdp) * 100)}% PIB)
                </span>
              </div>
            </div>
            
            {/* Importações de manufaturas */}
            {economicIndicators.tradeStats.manufactureImports > 0 && (
              <div className="balance-row">
                <span className="balance-label">Importações:</span>
                <div className="balance-values-container">
                  <span className={`balance-number ${economicIndicators.manufacturesBalance < 0 ? 'positive' : 'negative'}`}>+{formatCurrency(economicIndicators.tradeStats.manufactureImports)} bi</span>
                </div>
              </div>
            )}
            
            {/* Exportações de manufaturas */}
            {economicIndicators.tradeStats.manufactureExports > 0 && (
              <div className="balance-row">
                <span className="balance-label">Exportações:</span>
                <div className="balance-values-container">
                  <span className={`balance-number ${economicIndicators.manufacturesBalance > 0 ? 'positive' : 'negative'}`}>-{formatCurrency(economicIndicators.tradeStats.manufactureExports)} bi</span>
                </div>
              </div>
            )}
            
            <div className="balance-row">
              <span className="balance-label">Consumo:</span>
              <div className="balance-values-container">
                <span className="balance-number">{formatCurrency(economicIndicators.manufacturesNeeds)} bi</span>
                <span className="balance-percent">
                  ({Math.round((economicIndicators.manufacturesNeeds / economicIndicators.gdp) * 100)}% PIB)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="balance-item">
          <div className="balance-header">
            <span className="balance-title">Serviços</span>
            <div className="balance-value">
              &nbsp;
            </div>
          </div>
          <div className="balance-details">
            <div className="balance-row">
              <span className="balance-label">Produção:</span>
              <div className="balance-values-container">
                <span className="balance-number">{formatCurrency(economicIndicators.servicesOutput)} bi</span>
                <span className="balance-percent">
                  ({Math.round((economicIndicators.servicesOutput / economicIndicators.gdp) * 100)}% PIB)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TradePanel;