import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import './DefensePanel.css';

const DefensePanel = ({ onOpenCardsPopup }) => {
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
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
        <button 
          onClick={() => onOpenCardsPopup && onOpenCardsPopup('acordos-defesa')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Acordos de Defesa
        </button>
      </div>

      <div className="forces-section">
        <h4>Forças Armadas</h4>
        
        <div className="defense-bars">
          Aqui vem os cards de:
          <br />
          - Alianças
          <br />
          - Cooperação
          <br />
          - Espionagem mútua (sua e da Cooperação)
          <br />
          - Dados das ingerências


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


  
    </div>
  );
};

export default DefensePanel;