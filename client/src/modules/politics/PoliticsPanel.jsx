import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import './PoliticsPanel.css';

const PoliticsPanel = () => {
  // Selecionar dados do Redux
  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  
  // Estados locais
  const [targetCountry, setTargetCountry] = useState('');

  // Função para obter valor numérico de propriedade que pode estar em diferentes formatos
  const getNumericValue = (property) => {
    if (property === undefined || property === null) return 0;
    if (typeof property === 'number') return property;
    if (typeof property === 'object' && property.value !== undefined) return property.value;
    return 0;
  };

  // Formatação do status de aprovação
  const formatApprovalStatus = () => {
    // Dados de countriesData como fallback se approval não estiver disponível
    if (countriesData && countriesData[myCountry] && countriesData[myCountry].politics) {
      const politics = countriesData[myCountry].politics;
      return {
        parliament: getNumericValue(politics.parliamentSupport) || 50,
        media: getNumericValue(politics.mediaSupport) || 50,
        popularity: getNumericValue(countriesData[myCountry].economy?.popularity) || 50
      };
    }
    
    return { parliament: 50, media: 50, popularity: 50 };
  };

  // Formatação do nível de instabilidade
  const formatInstabilityStatus = () => {
    // Dados de countriesData como fallback se instability não estiver disponível
    if (countriesData && countriesData[myCountry] && countriesData[myCountry].politics) {
      const politics = countriesData[myCountry].politics;
      
      // Obter valor de protestos (pode ser um número direto ou um objeto com value)
      let protestsValue = 0;
      if (politics.protests !== undefined) {
        protestsValue = getNumericValue(politics.protests);
      }
      
      // Obter valor de força da oposição (pode ser um número direto ou um objeto com strength)
      let oppositionStrength = 0;
      if (politics.opposition !== undefined) {
        if (typeof politics.opposition === 'object' && politics.opposition.strength !== undefined) {
          oppositionStrength = politics.opposition.strength;
        } else if (typeof politics.opposition === 'number') {
          oppositionStrength = politics.opposition;
        }
      }
      
      return {
        protests: protestsValue,
        opposition: oppositionStrength
      };
    }
    
    return { protests: 0, opposition: 0 };
  };

  const approvalStatus = formatApprovalStatus();
  const instabilityStatus = formatInstabilityStatus();

  return (
    <div className="politics-panel">

        <div className="domestic-actions">
          <div className="action-buttons">
            <button className="action-btn">
              Propaganda Patriótica
            </button>
            
            <button className="action-btn">
              Reprimir Protestos
            </button>
            
            <button className="action-btn">
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