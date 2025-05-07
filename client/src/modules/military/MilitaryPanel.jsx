import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { MILITARY_EVENTS } from '../../store/socketReduxMiddleware';
import './MilitaryPanel.css';

const MilitaryPanel = () => {
  const dispatch = useDispatch();
  
  // Selecionar dados do Redux
  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  const militaryForces = useSelector(state => state.military.forces);
  
  // Estados locais
  const [activeTab, setActiveTab] = useState('investment');
  const [targetCountry, setTargetCountry] = useState('');
  const [investmentType, setInvestmentType] = useState('army');
  const [investmentAmount, setInvestmentAmount] = useState(10);
  const [warStrategy, setWarStrategy] = useState('attack');

  // Solicitar dados militares ao montar componente
  useEffect(() => {
    if (myCountry) {
      dispatch({ type: MILITARY_EVENTS.GET_MILITARY_DATA });
    }
  }, [myCountry, dispatch]);

  // Obter forças militares do país
  const getCountryForces = () => {
    // Primeiro tentar do estado military.forces
    if (militaryForces && militaryForces[myCountry]) {
      return militaryForces[myCountry];
    }
    
    // Fallback para os dados do país
    if (countriesData && countriesData[myCountry] && countriesData[myCountry].military) {
      return {
        army: countriesData[myCountry].military.army || 0,
        navy: countriesData[myCountry].military.navy || 0,
        airforce: countriesData[myCountry].military.airforce || 0,
        missiles: countriesData[myCountry].military.missiles || 0,
        nuclear: countriesData[myCountry].military.nuclearCapability || false
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

  // Executar ação militar
  const executeAction = () => {
    if (activeTab === 'investment') {
      // Enviar ação de investimento militar
      dispatch({
        type: MILITARY_EVENTS.INVEST_MILITARY,
        payload: {
          country: myCountry,
          type: investmentType,
          amount: investmentAmount,
          timestamp: Date.now()
        }
      });
    } 
    else if (activeTab === 'war') {
      // Enviar ação de guerra baseada na estratégia selecionada
      dispatch({
        type: MILITARY_EVENTS.ATTACK_COUNTRY,
        payload: {
          country: myCountry,
          target: targetCountry,
          strategy: warStrategy,
          timestamp: Date.now()
        }
      });
    }
    
    // Atualizar dados após a ação
    setTimeout(() => {
      dispatch({ type: MILITARY_EVENTS.GET_MILITARY_DATA });
    }, 1000);
  };

  // Renderizar painel militar
  const forces = getCountryForces();
  
  if (!myCountry) {
    return (
      <div className="military-panel loading">
        <h3>Militar</h3>
        <p>Selecione um país para ver informações militares</p>
      </div>
    );
  }

  return (
    <div className="military-panel">
      <div className="forces-section">
        <h4>Forças Armadas</h4>
        
        <div className="military-bars">
          <div className="military-stat">
            <span>Exército:</span>
            <div className="progress-bar">
              <div 
                className={`progress-fill ${forces.army >= 70 ? 'high' : forces.army >= 40 ? 'medium' : 'low'}`}
                style={{width: `${forces.army}%`}}
              ></div>
            </div>
            <span>{forces.army}%</span>
          </div>
          
          <div className="military-stat">
            <span>Marinha:</span>
            <div className="progress-bar">
              <div 
                className={`progress-fill ${forces.navy >= 70 ? 'high' : forces.navy >= 40 ? 'medium' : 'low'}`}
                style={{width: `${forces.navy}%`}}
              ></div>
            </div>
            <span>{forces.navy}%</span>
          </div>
          
          <div className="military-stat">
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
            value={investmentAmount} 
            onChange={(e) => setInvestmentAmount(parseInt(e.target.value))}
          />
        </div>
        
        <button 
          className="action-btn" 
        >
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

export default MilitaryPanel;