import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { POLITICS_EVENTS } from '../../store/socketReduxMiddleware';
import './PoliticsPanel.css';

const PoliticsPanel = () => {
  const dispatch = useDispatch();
  
  // Selecionar dados do Redux
  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  const approval = useSelector(state => state.politics.approval);
  const instability = useSelector(state => state.politics.instability);
  const diplomacy = useSelector(state => state.politics.diplomacy);

  // Estados locais
  const [selectedAction, setSelectedAction] = useState('');
  const [targetCountry, setTargetCountry] = useState('');
  const [actionDetails, setActionDetails] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Buscar dados quando montar componente
  useEffect(() => {
    if (myCountry) {
      // Solicitar dados políticos ao servidor
      dispatch({ type: POLITICS_EVENTS.GET_ALLIANCES });
    }
  }, [myCountry, dispatch]);

  // Atualizar valores de estado local baseados nas mudanças de país
  useEffect(() => {
    if (myCountry && countriesData && countriesData[myCountry]) {
      // Resetar estado local quando o país mudar
      setSelectedAction('');
      setTargetCountry('');
      setActionDetails('');
      setShowConfirmation(false);
    }
  }, [myCountry, countriesData]);

  // Obter países disponíveis para ações diplomáticas
  const getAvailableCountries = () => {
    if (!countriesData) return [];
    
    return Object.keys(countriesData).filter(country => 
      country !== myCountry
    );
  };

  // Obter status de relações diplomáticas
  const getDiplomacyStatus = (targetCountry) => {
    if (!diplomacy || !diplomacy[myCountry] || !diplomacy[myCountry][targetCountry]) {
      return { status: 'neutral', score: 0 };
    }
    
    return diplomacy[myCountry][targetCountry];
  };


  // Formatação do status de aprovação
  const formatApprovalStatus = () => {
    // Dados de countriesData como fallback se approval não estiver disponível
    if (!approval || !approval[myCountry]) {
      if (countriesData && countriesData[myCountry] && countriesData[myCountry].politics) {
        const politics = countriesData[myCountry].politics;
        return {
          parliament: politics.parliamentSupport || 50,
          media: politics.mediaSupport || 50,
          popularity: politics.popularity || 50
        };
      }
      
      return { parliament: 50, media: 50, popularity: 50 };
    }
    
    return approval[myCountry];
  };

  // Formatação do nível de instabilidade
  const formatInstabilityStatus = () => {
    // Dados de countriesData como fallback se instability não estiver disponível
    if (!instability || !instability[myCountry]) {
      if (countriesData && countriesData[myCountry] && countriesData[myCountry].politics) {
        const politics = countriesData[myCountry].politics;
        const protestsValue = politics.protests ? politics.protests.value : 0;
        
        return {
          protests: protestsValue,
          opposition: politics.opposition ? politics.opposition.strength : 0
        };
      }
      
      return { protests: 0, opposition: 0 };
    }
    
    return instability[myCountry];
  };

  const approvalStatus = formatApprovalStatus();
  const instabilityStatus = formatInstabilityStatus();

  return (
    <div className="politics-panel">

        <div className="domestic-actions">
          <div className="action-buttons">
            <button 
              className="action-btn"
              onClick={() => {
                setSelectedAction('propaganda');
                setActionDetails('');
                setTargetCountry('');
              }}
            >
              Propaganda Patriótica
            </button>
            
            <button 
              className="action-btn"
              onClick={() => {
                setSelectedAction('quell_protests');
                setActionDetails('');
                setTargetCountry('');
              }}
            >
              Reprimir Protestos
            </button>
            
            <button 
              className="action-btn"
              onClick={() => {
                setActionDetails('');
                setTargetCountry('');
              }}
            >
              Subornar Parlamento
            </button>
          </div>
        </div>

        <div className="approval-section">
          <h4>Aprovação</h4>
          
          <div className="approval-bars">
            <div className="approval-item">
              <span>Parlamento:</span>
              <div className="progress-bar">
                <div 
                  className={`progress-fill ${approvalStatus.parliament >= 60 ? 'high' : approvalStatus.parliament >= 40 ? 'medium' : 'low'}`}
                  style={{width: `${approvalStatus.parliament}%`}}
                ></div>
              </div>
              <span>{approvalStatus.parliament}%</span>
            </div>
            
            <div className="approval-item">
              <span>Mídia:</span>
              <div className="progress-bar">
                <div 
                  className={`progress-fill ${approvalStatus.media >= 60 ? 'high' : approvalStatus.media >= 40 ? 'medium' : 'low'}`}
                  style={{width: `${approvalStatus.media}%`}}
                ></div>
              </div>
              <span>{approvalStatus.media}%</span>
            </div>
            
            <div className="approval-item">
              <span>Popularidade:</span>
              <div className="progress-bar">
                <div 
                  className={`progress-fill ${approvalStatus.popularity >= 60 ? 'high' : approvalStatus.popularity >= 40 ? 'medium' : 'low'}`}
                  style={{width: `${approvalStatus.popularity}%`}}
                ></div>
              </div>
              <span>{approvalStatus.popularity}%</span>
            </div>
          </div>
        </div>
        
        <div className="instability-section">
          <h4>Instabilidade Política</h4>
          
          <div className="instability-info">
            <div className="instability-item">
              <span>Protestos:</span>
              <div className="progress-bar">
                <div 
                  className={`progress-fill ${instabilityStatus.protests <= 2 ? 'low' : instabilityStatus.protests <= 5 ? 'medium' : 'high'}`}
                  style={{width: `${instabilityStatus.protests * 10}%`}}
                ></div>
              </div>
              <span>{instabilityStatus.protests} por mês</span>
            </div>
            
            <div className="instability-item">
              <span>Força da Oposição:</span>
              <div className="progress-bar">
                <div 
                  className={`progress-fill ${instabilityStatus.opposition <= 20 ? 'low' : instabilityStatus.opposition <= 50 ? 'medium' : 'high'}`}
                  style={{width: `${instabilityStatus.opposition}%`}}
                ></div>
              </div>
              <span>{instabilityStatus.opposition}%</span>
            </div>
          </div>
        </div>
      
    </div>
  );
};

export default PoliticsPanel;