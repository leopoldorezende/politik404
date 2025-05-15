import React from 'react';
import { useSelector } from 'react-redux';
import CountryState from './CountryState';
import './CountryDetails.css';

const CountryDetails = () => {
  const selectedCountry = useSelector(state => state.game.selectedCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  const players = useSelector(state => state.game.players);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  
  // Função para obter o proprietário do país selecionado diretamente dos dados do Redux
  const getCountryOwner = () => {
    if (!selectedCountry || !players || players.length === 0) return null;
    
    const owner = players.find(player => {
      if (typeof player === 'object' && player.country === selectedCountry) {
        return true;
      }
      if (typeof player === 'string') {
        const match = player.match(/^(.*) \((.*)\)$/);
        return match && match[2] === selectedCountry;
      }
      return false;
    });
    
    if (!owner) return null;
    
    if (typeof owner === 'object') {
      return owner.username;
    } else if (typeof owner === 'string') {
      const match = owner.match(/^(.*) \((.*)\)$/);
      return match ? match[1] : null;
    }
    
    return null;
  };
  
  if (!selectedCountry || !countriesData || !countriesData[selectedCountry]) {
    return (
      <div className="country-not-selected">
        <p>Selecione um país no mapa para ver detalhes.</p>
      </div>
    );
  }
  
  const country = countriesData[selectedCountry];
  const countryOwner = getCountryOwner();
  
  return (
    <div className="country-details">
      <h3>{country.name}</h3>
      
      {countryOwner && (
        <p className="player-name">Controlado por: {countryOwner}</p>
      )}
      
      {/* Use o componente CountryState para mostrar os indicadores dinâmicos */}
      {currentRoom && (
        <CountryState
          roomName={currentRoom.name}
          countryName={selectedCountry}
        />
      )}
      
      <div className="country-info">
        <div className="country-stats">
          <p><strong>População:</strong> {country.population?.toLocaleString()} habitantes</p>
          {country.hdi && <p><strong>IDH:</strong> {country.hdi}</p>}
        </div>

      </div>
    </div>
  );
};

export default CountryDetails;