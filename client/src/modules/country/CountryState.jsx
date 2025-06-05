/**
 * CountryState.jsx - Simplificado usando hook direto
 */

import React from 'react';
import { useSelector } from 'react-redux';
import { useEconomy } from '../../hooks/useEconomy';
import './CountryState.css';

const CountryState = ({ roomName, countryName }) => {
  // Estados básicos do Redux
  const myCountry = useSelector(state => state.game.myCountry);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  
  // Usar valores fornecidos ou padrão
  const room = roomName || currentRoom?.name;
  const country = countryName || myCountry;
  
  // Hook direto para dados (substitui toda complexidade do Redux)
  const { countryData, lastUpdated, loading } = useEconomy(room, country);
  
  // Função para obter valor numérico
  const getNumericValue = (property) => {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  };
  
 // Formatar valor com sinal (2 casas decimais)
  const formatValueWithSign = (value) => {
    if (value === undefined || value === null) return '0.00';
    return (value >= 0 ? '+' : '') + value.toFixed(2);
  };

  if (!room || !country) {
    return (
      <div className="country-state-display no-data">
        <p>Selecione uma partida e um país para ver seus indicadores.</p>
      </div>
    );
  }
  
  if (loading || !countryData) {
    return (
      <div className="country-state-display loading">
        <p>Carregando indicadores...</p>
      </div>
    );
  }
  
  const economy = countryData.economy || {};
  const defense = countryData.defense || {};
  const commerce = countryData.commerce || {};
  const politics = countryData.politics || {};
  
  return (
    <div className="country-state-display">
      
      {/* Seção de Economia */}
      <div className="state-section">
        <h3>Economia</h3>
        <div className="indicator">
          <span className="indicator-label">PIB:</span>
          <span className="indicator-value">
            {getNumericValue(economy.gdp).toFixed(2)}
          </span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Tesouro:</span>
          <span className="indicator-value">
            {getNumericValue(economy.treasury).toFixed(2)}
          </span>
        </div>
        
        {/* Indicadores de balanço comercial */}
        {economy.commoditiesBalance !== undefined && (
          <div className="indicator">
            <span className="indicator-label">Commodities:</span>
            <span className={`indicator-value ${getNumericValue(economy.commoditiesBalance) >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(getNumericValue(economy.commoditiesBalance))}
            </span>
          </div>
        )}
        
        {economy.manufacturesBalance !== undefined && (
          <div className="indicator">
            <span className="indicator-label">Manufaturas:</span>
            <span className={`indicator-value ${getNumericValue(economy.manufacturesBalance) >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(getNumericValue(economy.manufacturesBalance))}
            </span>
          </div>
        )}
{/* 
        {economy.servicesOutput !== undefined && (
          <div className="indicator">
            <span className="indicator-label">Produção de Serviços:</span>
            <span className="indicator-value desativate">
              {getNumericValue(economy.servicesOutput).toFixed(2)} bi
            </span>
          </div>
        )}
         */}
      </div>
      
      {/* Seção de Defesa */}
      <div className="state-section">
        <h3>Defesa</h3>
        <div className="indicator">
          <span className="indicator-label">Marinha:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${defense.navy || 20}%` }}
            ></div>
          </div>
          <span className="indicator-value">{defense.navy || 20}%</span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Exército:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${defense.army || 20}%` }}
            ></div>
          </div>
          <span className="indicator-value">{defense.army || 20}%</span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Aeronáutica:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${defense.airforce || 20}%` }}
            ></div>
          </div>
          <span className="indicator-value">{defense.airforce || 20}%</span>
        </div>
      </div>
      
      {/* Seção de Comércio */}
      <div className="state-section commerce-section">
        <h3>Comércio</h3>
        <div className="indicator">
          <span className="indicator-label">Exportação:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${commerce.exports || 15}%` }}
            ></div>
          </div>
          <span className="indicator-value">{commerce.exports || 15}%</span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Importação:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${commerce.imports || 15}%` }}
            ></div>
          </div>
          <span className="indicator-value">{commerce.imports || 15}%</span>
        </div>
      </div>
      
      {/* Seção de Política */}
      <div className="state-section politics-section">
        <h3>Política</h3>
        <div className="indicator">
          <span className="indicator-label">Parlamento:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${politics.parliament || 50}%` }}
            ></div>
          </div>
          <span className="indicator-value">{politics.parliament || 50}%</span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Imprensa:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${politics.media || 50}%` }}
            ></div>
          </div>
          <span className="indicator-value">{politics.media || 50}%</span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Oposição:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${politics.opposition || 25}%` }}
            ></div>
          </div>
          <span className="indicator-value">{politics.opposition || 25}%</span>
        </div>
      </div>
    </div>
  );
};

export default CountryState;