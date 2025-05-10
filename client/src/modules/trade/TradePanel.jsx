import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import './TradePanel.css';

const TradePanel = () => {
  // Estados Redux com fallbacks seguros
  const myCountry = useSelector(state => state.game?.myCountry || 'Seu País');
  const players = useSelector(state => state.game?.players || []);
  
  // Estado local
  const [targetCountry, setTargetCountry] = useState('');
  
  // Versão minimalista quando não há país selecionado
  if (!myCountry || myCountry === 'Seu País') {
    return (
      <div className="trade-panel">
        <h3>Comércio Internacional</h3>
        <p>Selecione um país para gerenciar o comércio.</p>
      </div>
    );
  }
  
  return (
    <div className="trade-panel">

          <h4>Exportação </h4>
          <div className="form-section">
            <div className="form-row">
            <label>
              <select 
                name="targetCountry"
                value={targetCountry}
                onChange={(e) => setTargetCountry(e.target.value)}
              >
                <option value="">Selecione um país</option>
                {players
                  .filter(player => {
                    if (typeof player === 'object') {
                      return player.username !== sessionStorage.getItem('username');
                    }
                    return false;
                  })
                  .map(player => typeof player === 'object' ? player.country : null)
                  .filter(Boolean)
                  .map((country, index) => (
                    <option key={index} value={country}>{country}</option>
                  ))}
              </select>
            </label>
          </div>
          
          <div className="form-actions">
            <button disabled={!targetCountry}>
              Criar acordo exportação
            </button>
          </div>
        </div>

        <h4>Importação </h4>
        <div className="form-section">
          <div className="form-row">
          <label>
            <select 
              name="targetCountry"
              value={targetCountry}
              onChange={(e) => setTargetCountry(e.target.value)}
            >
              <option value="">Selecione um país</option>
              {players
                .filter(player => {
                  if (typeof player === 'object') {
                    return player.username !== sessionStorage.getItem('username');
                  }
                  return false;
                })
                .map(player => typeof player === 'object' ? player.country : null)
                .filter(Boolean)
                .map((country, index) => (
                  <option key={index} value={country}>{country}</option>
                ))}
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button disabled={!targetCountry}>
            Criar acordo importação
          </button>
        </div>
        </div>
        
        <div className="agreements-list">
          <h4>Acordos de Importação Ativos</h4>
          <div className="no-data">
            <p>Nenhum acordo de importação ativo</p>
          </div>
        </div>
      </div>
  );
};

export default TradePanel;