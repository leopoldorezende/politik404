import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { COUNTRY_STATE_EVENTS } from '../../store/socketReduxMiddleware';
import { 
  selectCountryState, 
  selectCountryStateLoading,
  selectLastUpdated
} from './countryStateSlice';
import './CountryState.css';

/**
 * Componente para exibir os estados de um país
 */
const CountryState = ({ roomName, countryName }) => {
  const dispatch = useDispatch();
  
  // Seletores para obter dados de vários reducers
  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  
  // Se roomName e countryName não forem fornecidos, usar valores padrão
  const room = roomName || (currentRoom?.name || null);
  const country = countryName || myCountry || null;
  
  // Obter o estado do país (se disponível)
  const countryState = useSelector(state => selectCountryState(state, room, country));
  
  // Obter o timestamp da última atualização
  const lastUpdated = useSelector(state => selectLastUpdated(state, room));
  
  // Dados estáticos do país
  const staticCountryData = countriesData && country ? countriesData[country] : null;
  
  // Loading state
  const loading = useSelector(selectCountryStateLoading);
  
  // Assinar para atualizações quando o componente montar
  useEffect(() => {
    if (room) {
      dispatch({ type: COUNTRY_STATE_EVENTS.SUBSCRIBE, payload: room });
      
      // Cancelar assinatura ao desmontar
      return () => {
        dispatch({ type: COUNTRY_STATE_EVENTS.UNSUBSCRIBE, payload: room });
      };
    }
  }, [room, dispatch]);
  
  // Se não houver sala ou país selecionado, mostrar mensagem
  if (!room || !country) {
    return (
      <div className="country-state-display no-data">
        <p>Selecione uma partida e um país para ver seus indicadores.</p>
      </div>
    );
  }
  
  // Se ainda estiver carregando, mostrar loader
  if (loading && !countryState) {
    return (
      <div className="country-state-display loading">
        <p>Carregando indicadores...</p>
      </div>
    );
  }
  
  // Se não houver dados disponíveis, mostrar mensagem
  if (!countryState) {
    return (
      <div className="country-state-display no-data">
        <p>Não há dados disponíveis para este país.</p>
      </div>
    );
  }
  
  // Formatar valor com sinal
  const formatValueWithSign = (value) => {
    if (value === undefined || value === null) return '0';
    return (value >= 0 ? '+' : '') + value.toFixed(2) + ' bi';
  };
  
  return (
    <div className="country-state-display">
      <div className="last-updated">
        Última atualização: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'N/A'}
      </div>
      
      {/* Seção de Economia */}
      <div className="state-section">
        <h3>Economia</h3>
        <div className="indicator">
          <span className="indicator-label">PIB:</span>
          <span className="indicator-value">
            {countryState.economy.gdp.value} {countryState.economy.gdp.unit}
          </span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Tesouro:</span>
          <span className="indicator-value">
            {countryState.economy.treasury.value} {countryState.economy.treasury.unit}
          </span>
        </div>
        
        {/* Novos indicadores econômicos derivados */}
        {countryState.economy.commoditiesBalance && (
          <div className="indicator">
            <span className="indicator-label">Saldo de Commodities:</span>
            <span className={`indicator-value ${countryState.economy.commoditiesBalance.value >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(countryState.economy.commoditiesBalance.value)}
            </span>
          </div>
        )}
        
        {countryState.economy.manufacturesBalance && (
          <div className="indicator">
            <span className="indicator-label">Saldo de Manufaturas:</span>
            <span className={`indicator-value ${countryState.economy.manufacturesBalance.value >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(countryState.economy.manufacturesBalance.value)}
            </span>
          </div>
        )}
      </div>
      
      {/* Seção de Defesa */}
      <div className="state-section">
        <h3>Defesa</h3>
        <div className="indicator">
          <span className="indicator-label">Marinha:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${countryState.defense.navy}%` }}
            ></div>
          </div>
          <span className="indicator-value">{countryState.defense.navy}%</span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Exército:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${countryState.defense.army}%` }}
            ></div>
          </div>
          <span className="indicator-value">{countryState.defense.army}%</span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Aeronáutica:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${countryState.defense.airforce}%` }}
            ></div>
          </div>
          <span className="indicator-value">{countryState.defense.airforce}%</span>
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
              style={{ width: `${countryState.commerce.exports}%` }}
            ></div>
          </div>
          <span className="indicator-value">{countryState.commerce.exports}%</span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Importação:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${countryState.commerce.imports}%` }}
            ></div>
          </div>
          <span className="indicator-value">{countryState.commerce.imports}%</span>
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
              style={{ width: `${countryState.politics.parliament}%` }}
            ></div>
          </div>
          <span className="indicator-value">{countryState.politics.parliament}%</span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Imprensa:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${countryState.politics.media}%` }}
            ></div>
          </div>
          <span className="indicator-value">{countryState.politics.media}%</span>
        </div>
        <div className="indicator">
          <span className="indicator-label">Oposição:</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${countryState.politics.opposition}%` }}
            ></div>
          </div>
          <span className="indicator-value">{countryState.politics.opposition}%</span>
        </div>
      </div>
    </div>
  );
};

export default CountryState;