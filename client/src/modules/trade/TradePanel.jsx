import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { socketApi } from '../../services/socketClient';
import './TradePanel.css';

const TradePanel = () => {
  const dispatch = useDispatch();
  
  // Estados Redux com fallbacks seguros
  const myCountry = useSelector(state => state.game?.myCountry || 'Seu País');
  const players = useSelector(state => state.game?.players || []);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  const countryState = useSelector(state => {
    if (!currentRoom?.name || !myCountry) return null;
    return state.countryState?.roomStates?.[currentRoom.name]?.[myCountry] || null;
  });
  
  // Acordos comerciais do Redux
  const tradeAgreements = useSelector(state => state.trade?.tradeAgreements || []);
  const tradeStats = useSelector(state => state.trade?.tradeStats || {
    commodityImports: 0,
    commodityExports: 0,
    manufactureImports: 0,
    manufactureExports: 0,
  });
  
  // Efeito para solicitar acordos comerciais ao montar o componente
  useEffect(() => {
    if (currentRoom?.name) {
      // Solicitar lista atualizada de acordos comerciais
      socketApi.getTradeAgreements();
    }
  }, [currentRoom]);

  // Função para cancelar acordo comercial
  const handleCancelAgreement = (agreementId) => {
    if (confirm('Tem certeza que deseja cancelar este acordo comercial?')) {
      socketApi.cancelTradeAgreement(agreementId);
    }
  };
  
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
  
  // Filtramos apenas os acordos onde o meu país é o originCountry
  // Isso garante que veremos apenas os acordos que criamos, não os espelhados
  const myAgreements = tradeAgreements.filter(agreement => 
    agreement.originCountry === myCountry && agreement.country !== myCountry
  );

  // Dados econômicos
  const economy = countryState.economy;
  
  // Obter as estatísticas comerciais já calculadas pelo servidor
  const tradeStatistics = economy.tradeStats || {
    commodityImports: 0,
    commodityExports: 0,
    manufactureImports: 0,
    manufactureExports: 0
  };
  
  return (
    <div className="trade-panel">

      <div className="trade-agreements-section">
        <h4>Acordos Comerciais</h4>

        {myAgreements.length > 0 ? (
          <div className="agreements-list">
            {myAgreements.map((agreement) => (
              <div 
                key={agreement.id} 
                className={`trade-card ${agreement.type}`}
              >
                <h4>{agreement.country}</h4>
                <p>Tipo: {agreement.type === 'export' ? 'Exportação' : 'Importação'}</p>
                <p>Produto: {agreement.product === 'commodity' ? 'Commodities' : 'Manufatura'}</p>
                <p>Valor: {agreement.value} bi USD</p>
                <button 
                  className="action-btn danger"
                  onClick={() => handleCancelAgreement(agreement.id)}
                >
                  Cancelar Acordo
                </button>
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
            
            {/* Importações de commodities - usar valores calculados pelo servidor */}
            {tradeStatistics.commodityImports > 0 && (
              <div className="balance-row">
                <span className="balance-label trade-import">Total de Importações:</span>
                <span className="balance-number positive">+{tradeStatistics.commodityImports.toFixed(2)} bi</span>
              </div>
            )}
            
            {/* Exportações de commodities - usar valores calculados pelo servidor */}
            {tradeStatistics.commodityExports > 0 && (
              <div className="balance-row">
                <span className="balance-label trade-export">Total de Exportações:</span>
                <span className="balance-number negative">-{tradeStatistics.commodityExports.toFixed(2)} bi</span>
              </div>
            )}
            
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
            
            {/* Importações de manufaturas - usar valores calculados pelo servidor */}
            {tradeStatistics.manufactureImports > 0 && (
              <div className="balance-row">
                <span className="balance-label trade-import">Total de Importações:</span>
                <span className="balance-number positive">+{tradeStatistics.manufactureImports.toFixed(2)} bi</span>
              </div>
            )}
            
            {/* Exportações de manufaturas - usar valores calculados pelo servidor */}
            {tradeStatistics.manufactureExports > 0 && (
              <div className="balance-row">
                <span className="balance-label trade-export">Total de Exportações:</span>
                <span className="balance-number negative">-{tradeStatistics.manufactureExports.toFixed(2)} bi</span>
              </div>
            )}
            
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
      
      <div className="trade-benefits">
        <h4>Benefícios do Comércio Internacional</h4>
        <p>Importar produtos que você não produz em quantidade suficiente ajuda a suprir demandas internas e fortalecer a economia.</p>
        <p>Exportar produtos excedentes aumenta o PIB e permite acumulação de capital estrangeiro.</p>
        <p>Acordos comerciais inteligentes podem reduzir a inflação e estimular setores estratégicos da economia.</p>
      </div>
    </div>
  );
};

export default TradePanel;