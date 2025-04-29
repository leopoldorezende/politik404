import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import '../../assets/styles/CountryDetails.css';

const CountryDetails = () => {
  const selectedCountry = useSelector(state => state.game.selectedCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  const players = useSelector(state => state.game.players);
  
  const [countryOwner, setCountryOwner] = useState(null);
  
  // Encontra o proprietário do país selecionado
  useEffect(() => {
    if (selectedCountry && players && players.length > 0) {
      const owner = players.find(player => {
        // Se player for um objeto
        if (typeof player === 'object' && player.country === selectedCountry) {
          return true;
        }
        
        // Se player for uma string formatada como "username (country)"
        if (typeof player === 'string') {
          const match = player.match(/^(.*) \((.*)\)$/);
          if (match && match[2] === selectedCountry) {
            return true;
          }
        }
        
        return false;
      });
      
      if (owner) {
        // Extrai o nome do usuário
        if (typeof owner === 'object') {
          setCountryOwner(owner.username);
        } else if (typeof owner === 'string') {
          const match = owner.match(/^(.*) \((.*)\)$/);
          if (match) {
            setCountryOwner(match[1]);
          }
        }
      } else {
        setCountryOwner(null);
      }
    } else {
      setCountryOwner(null);
    }
  }, [selectedCountry, players]);
  
  if (!selectedCountry || !countriesData || !countriesData[selectedCountry]) {
    return (
      <div className="country-not-selected">
        <p>Selecione um país no mapa para ver detalhes.</p>
      </div>
    );
  }
  
  const country = countriesData[selectedCountry];
  
  return (
    <div className="country-details">
      <h3>{country.name}</h3>
      
      {countryOwner && (
        <p className="player-name">Controlado por: {countryOwner}</p>
      )}
      
      <div className="country-info">
        <div className="country-stats">
          <p><strong>População:</strong> {country.population?.toLocaleString()} habitantes</p>
          {country.hdi && <p><strong>IDH:</strong> {country.hdi}</p>}
        </div>

        {country.military && (
          <div className="military-section">
            <h4>Poder Militar</h4>
            <div className="military-bars">
              <div className="military-stat">
                <span>Exército:</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${country.military.army}%`}}></div>
                </div>
                <span>{country.military.army}%</span>
              </div>
              
              <div className="military-stat">
                <span>Marinha:</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${country.military.navy}%`}}></div>
                </div>
                <span>{country.military.navy}%</span>
              </div>
              
              <div className="military-stat">
                <span>Força Aérea:</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${country.military.airforce}%`}}></div>
                </div>
                <span>{country.military.airforce}%</span>
              </div>
              
              <div className="military-stat">
                <span>Mísseis:</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${country.military.missiles}%`}}></div>
                </div>
                <span>{country.military.missiles}%</span>
              </div>
              
              <p className="nuclear-status">
                <strong>Capacidade Nuclear:</strong> 
                <span className={country.military.nuclearCapability ? 'status-yes' : 'status-no'}>
                  {country.military.nuclearCapability ? 'Sim' : 'Não'}
                </span>
              </p>
            </div>
          </div>
        )}

        {country.borders && country.borders.length > 0 && (
          <div className="borders-section">
            <h4>Fronteiras</h4>
            <ul className="borders-list">
              {country.borders.map((border, index) => (
                <li key={index} className={border.enabled ? 'enabled' : 'disabled'}>
                  {border.country} 
                  <span className="border-type">({border.type})</span>
                  <span className="border-status">
                    {border.enabled ? '✓ Aberta' : '✕ Fechada'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {country.economy && (
          <div className="economy-section">
            <h4>Economia</h4>
            <p><strong>PIB:</strong> {country.economy.gdp?.value} {country.economy.gdp?.unit}</p>
            <p><strong>Crescimento:</strong> {country.economy.gdpGrowth}%</p>
            <p><strong>Inflação:</strong> {country.economy.inflation}%</p>
            <p><strong>Desemprego:</strong> {country.economy.unemployment}%</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountryDetails;