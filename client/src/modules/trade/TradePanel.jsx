import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { socketApi } from '../../services/socketClient';
import './TradePanel.css';

const TradePanel = () => {
  // Estados Redux com fallbacks seguros
  const myCountry = useSelector(state => state.game?.myCountry);
  const players = useSelector(state => state.game?.players || []);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  const countriesData = useSelector(state => state.game.countriesData);
  
  // Estado dinâmico do país do jogador
  const countryState = useSelector(state => {
    if (!currentRoom?.name || !myCountry) return null;
    return state.countryState?.roomStates?.[currentRoom.name]?.[myCountry] || null;
  });
  
  // Acordos comerciais do Redux
  const tradeAgreements = useSelector(state => state.trade?.tradeAgreements || []);
  
  // Estado local
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  
  // Efeito para solicitar acordos comerciais ao montar o componente
  useEffect(() => {
    if (currentRoom?.name) {
      // Solicitar lista atualizada de acordos comerciais
      socketApi.getTradeAgreements();
    }
  }, [currentRoom, needsRefresh]);

  // Função para obter valor numérico de propriedade que pode estar em diferentes formatos
  const getNumericValue = (property) => {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  };
  
  // Função para cancelar acordo comercial
  const handleCancelAgreement = (agreementId) => {
    if (window.confirm('Tem certeza que deseja cancelar este acordo comercial?')) {
      setIsSubmitting(true);
      socketApi.cancelTradeAgreement(agreementId);
      
      // Atualizar após um curto período para permitir que o servidor processe
      setTimeout(() => {
        setIsSubmitting(false);
        setNeedsRefresh(prev => !prev); // Toggle para forçar refresh
      }, 1000);
    }
  };
  
  // Formatar valor com sinal e arredondar para 1 casa decimal
  const formatValueWithSign = (value) => {
    if (value === undefined || value === null) return '0';
    const num = Number(value);
    return (num >= 0 ? '+' : '') + num.toFixed(1) + ' bi';
  };
  
  // Formatar porcentagem
  const formatPercent = (value) => {
    if (value === undefined || value === null) return '0%';
    return Math.round(Number(value)) + '%';
  };
  
  // Versão minimalista quando não há país selecionado
  if (!myCountry) {
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

  // Dados econômicos - acessando de forma segura com fallbacks
  const economy = countryState.economy || {};
  
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
            {myAgreements.map((agreement, index) => (
              <div 
                key={`${agreement.id}-${index}`} 
                className={`trade-card ${agreement.type}`}
              >
                <p>
                  <b>{agreement.country}</b>
                  <br />
                  {agreement.type === 'export' ? 'Exportação' : 'Importação'} <span>de </span>
                  {agreement.product === 'commodity' ? 'Commodities' : 'Manufatura'}
                  <br />
                  <b>{agreement.value}</b> bi USD
                </p>
                <button 
                  className="action-btn cancel"
                  onClick={() => handleCancelAgreement(agreement.id)}
                  disabled={isSubmitting}
                >
                  ✕
                  {/* {isSubmitting ? '...' : '✕'} */}
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
        <h4>Balanço da Produção</h4>
        
        <div className="balance-item">
          <div className="balance-header">
            <span className="balance-title">Commodities</span>
            <div className={`balance-value ${getNumericValue(economy.commoditiesBalance) >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(getNumericValue(economy.commoditiesBalance))}
            </div>
          </div>
          <div className="balance-details">
            <div className="balance-row">
              <span className="balance-label">Produção:</span>
              <div className="balance-values-container">
                <span className="balance-number">{getNumericValue(economy.commoditiesOutput).toFixed(1)} bi</span>
              </div>
            </div>
            
            {/* Importações de commodities */}
            {tradeStatistics.commodityImports > 0 && (
              <div className="balance-row">
                <span className="balance-label">Importações:</span>
                <div className="balance-values-container">
                  <span className="balance-number positive">+{tradeStatistics.commodityImports.toFixed(1)} bi</span>
                </div>
              </div>
            )}
            
            {/* Exportações de commodities */}
            {tradeStatistics.commodityExports > 0 && (
              <div className="balance-row">
                <span className="balance-label">Exportações:</span>
                <div className="balance-values-container">
                  <span className="balance-number negative">-{tradeStatistics.commodityExports.toFixed(1)} bi</span>
                </div>
              </div>
            )}
            
            <div className="balance-row">
              <span className="balance-label">Necessidade:</span>
              <div className="balance-values-container">
                <span className="balance-number">{getNumericValue(economy.commoditiesNeeds).toFixed(1)} bi</span>
                <span className="balance-percent">
                  ({Math.round(getNumericValue(economy.commoditiesNeeds?.percentValue) || 0)}% PIB)
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="balance-item">
          <div className="balance-header">
            <span className="balance-title">Manufaturas</span>
            <div className={`balance-value ${getNumericValue(economy.manufacturesBalance) >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(getNumericValue(economy.manufacturesBalance))}
            </div>
          </div>
          <div className="balance-details">
            <div className="balance-row">
              <span className="balance-label">Produção:</span>
              <div className="balance-values-container">
                <span className="balance-number">{getNumericValue(economy.manufacturesOutput).toFixed(1)} bi</span>
              </div>
            </div>
            
            {/* Importações de manufaturas */}
            {tradeStatistics.manufactureImports > 0 && (
              <div className="balance-row">
                <span className="balance-label">Importações:</span>
                <div className="balance-values-container">
                  <span className="balance-number positive">+{tradeStatistics.manufactureImports.toFixed(1)} bi</span>
                </div>
              </div>
            )}
            
            {/* Exportações de manufaturas */}
            {tradeStatistics.manufactureExports > 0 && (
              <div className="balance-row">
                <span className="balance-label">Exportações:</span>
                <div className="balance-values-container">
                  <span className="balance-number negative">-{tradeStatistics.manufactureExports.toFixed(1)} bi</span>
                </div>
              </div>
            )}
            
            <div className="balance-row">
              <span className="balance-label">Necessidade:</span>
              <div className="balance-values-container">
                <span className="balance-number">{getNumericValue(economy.manufacturesNeeds).toFixed(1)} bi</span>
                <span className="balance-percent">
                  ({Math.round(getNumericValue(economy.manufacturesNeeds?.percentValue) || 0)}% PIB)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
{/* 
      <div className="sectoral-distribution-section">
        <h4>Distribuição Setorial do PIB</h4>
        <div className="distribution-bars">
          <div className="sector-bar">
            <div className="sector-info">
              <span className="sector-label">Serviços:</span>
              <span className="sector-value">{formatPercent(getNumericValue(economy.services))}</span>
            </div>
            <div className="progress-container">
              <div 
                className="progress-fill services" 
                style={{ width: `${getNumericValue(economy.services)}%` }}
              ></div>
            </div>
            <span className="sector-output">{getNumericValue(economy.servicesOutput).toFixed(1)} bi</span>
          </div>
          
          <div className="sector-bar">
            <div className="sector-info">
              <span className="sector-label">Commodities:</span>
              <span className="sector-value">{formatPercent(getNumericValue(economy.commodities))}</span>
            </div>
            <div className="progress-container">
              <div 
                className="progress-fill commodities" 
                style={{ width: `${getNumericValue(economy.commodities)}%` }}
              ></div>
            </div>
            <span className="sector-output">{getNumericValue(economy.commoditiesOutput).toFixed(1)} bi</span>
          </div>
          
          <div className="sector-bar">
            <div className="sector-info">
              <span className="sector-label">Manufaturas:</span>
              <span className="sector-value">{formatPercent(getNumericValue(economy.manufactures))}</span>
            </div>
            <div className="progress-container">
              <div 
                className="progress-fill manufactures" 
                style={{ width: `${getNumericValue(economy.manufactures)}%` }}
              ></div>
            </div>
            <span className="sector-output">{getNumericValue(economy.manufacturesOutput).toFixed(1)} bi</span>
          </div>
        </div>
      </div> */}
{/*       
      <div className="trade-benefits">
        <h4>Benefícios do Comércio Internacional</h4>
        <p>Importar produtos que você não produz em quantidade suficiente ajuda a suprir demandas internas e fortalecer a economia.</p>
        <p>Exportar produtos excedentes aumenta o PIB e permite acumulação de capital estrangeiro.</p>
        <p>Acordos comerciais inteligentes podem reduzir a inflação e estimular setores estratégicos da economia.</p>
      </div> */}
    </div>
  );
};

export default TradePanel;