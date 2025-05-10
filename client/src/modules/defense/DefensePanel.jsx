import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import './DefensePanel.css';

const DefensePanel = () => {
  // Selecionar dados do Redux
  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  
  // Estados locais
  const [targetCountry, setTargetCountry] = useState('');
  const [investmentType, setInvestmentType] = useState('army');
  const [investmentAmount, setInvestmentAmount] = useState(10);
  const [warStrategy, setWarStrategy] = useState('attack');

  // Obter forças militares do país
  const getCountryForces = () => {
    // Fallback para os dados do país
    if (countriesData && countriesData[myCountry] && countriesData[myCountry].defense) {
      return {
        army: countriesData[myCountry].defense.army || 0,
        navy: countriesData[myCountry].defense.navy || 0,
        airforce: countriesData[myCountry].defense.airforce || 0,
        missiles: countriesData[myCountry].defense.missiles || 0,
        nuclear: countriesData[myCountry].defense.nuclearCapability || false
      };
    }
    
    // Valor padrão se nada for encontrado
    return {
      army: 0,
      navy: 0,
      airforce: 0,
      missiles: 0,
      nuclear: false
    };
  };

  // Obter países disponíveis para ações militares
  const getAvailableTargets = () => {
    if (!countriesData) return [];
    
    return Object.keys(countriesData).filter(country => 
      country !== myCountry
    );
  };

  // Renderizar painel militar
  const forces = getCountryForces();
  
  if (!myCountry) {
    return (
      <div className="defense-panel loading">
        <h3>Militar</h3>
        <p>Selecione um país para ver informações militares</p>
      </div>
    );
  }

  return (
    <div className="defense-panel">
      <div className="forces-section">
        <h4>Forças Armadas</h4>
        
        <div className="defense-bars">
          <div className="defense-stat">
            <span>Exército:</span>
            <div className="progress-bar">
              <div 
                className={`progress-fill ${forces.army >= 70 ? 'high' : forces.army >= 40 ? 'medium' : 'low'}`}
                style={{width: `${forces.army}%`}}
              ></div>
            </div>
            <span>{forces.army}%</span>
          </div>
          
          <div className="defense-stat">
            <span>Marinha:</span>
            <div className="progress-bar">
              <div 
                className={`progress-fill ${forces.navy >= 70 ? 'high' : forces.navy >= 40 ? 'medium' : 'low'}`}
                style={{width: `${forces.navy}%`}}
              ></div>
            </div>
            <span>{forces.navy}%</span>
          </div>
          
          <div className="defense-stat">
            <span>Força Aérea:</span>
            <div className="progress-bar">
              <div 
                className={`progress-fill ${forces.airforce >= 70 ? 'high' : forces.airforce >= 40 ? 'medium' : 'low'}`}
                style={{width: `${forces.airforce}%`}}
              ></div>
            </div>
            <span>{forces.airforce}%</span>
          </div>
        </div>
        
        <div className="nuclear-status">
          <span>Capacidade Nuclear:</span>
          <span className={forces.nuclear ? 'status-yes' : 'status-no'}>
            {forces.nuclear ? 'Sim' : 'Não'}
          </span>
        </div>
      </div>


      <div className="investment-section">
        
        <div className="form-group">
        <h4>Investimento Militar</h4>
          <select 
            value={investmentType} 
            onChange={(e) => setInvestmentType(e.target.value)}
          >
            <option value="army">Exército</option>
            <option value="navy">Marinha</option>
            <option value="airforce">Aeronáutica</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>
            Selecionar Investimento: <span>{investmentAmount}%</span>
          </label>
          <input 
            type="range" 
            min="5" 
            max="50" 
            step="1" 
            value={investmentAmount} 
            onChange={(e) => setInvestmentAmount(parseInt(e.target.value))}
          />
        </div>
        
        <button className="action-btn">
          Investir
        </button>
      </div>
  
      <br />
      <div className="war-section">
        <h4>Ações de Guerra</h4>
        
        <div className="form-group">
          <label>País Alvo:</label>
          <select 
            value={targetCountry} 
            onChange={(e) => setTargetCountry(e.target.value)}
          >
            <option value="">Selecione um país</option>
            {getAvailableTargets().map((country, index) => (
              <option key={index} value={country}>{country}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Estratégia:</label>
          <select 
            value={warStrategy} 
            onChange={(e) => setWarStrategy(e.target.value)}
          >
            <option value="attack">Ataque Bélico</option>
            <option value="sabotage">Sabotagem Comercial</option>
            <option value="regime">Mudança de Regime</option>
            <option value="disinformation">Desinformação</option>
          </select>
        </div>
        
        <button 
          className="action-btn danger" 
          disabled={!targetCountry}
        >
          Iniciar Ação
        </button>
      </div>
    </div>
  );
};

export default DefensePanel;