import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { POLITICS_EVENTS } from '../../store/middleware/socketMiddleware';
import '../../shared/styles/PoliticsPanel.css';

const PoliticsPanel = () => {
  const dispatch = useDispatch();
  
  // Selecionar dados do Redux
  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  const alliances = useSelector(state => state.politics.alliances);
  const approval = useSelector(state => state.politics.approval);
  const instability = useSelector(state => state.politics.instability);
  const diplomacy = useSelector(state => state.politics.diplomacy);
  const sanctions = useSelector(state => state.politics.sanctions);
  const treaties = useSelector(state => state.politics.treaties);
  const politicalEvents = useSelector(state => state.politics.events);

  // Estados locais
  const [selectedAction, setSelectedAction] = useState('');
  const [targetCountry, setTargetCountry] = useState('');
  const [actionDetails, setActionDetails] = useState('');
  const [activeTab, setActiveTab] = useState('domestic');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [lastAction, setLastAction] = useState(null);

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

  // Verificar se um país está sob sanções
  const isUnderSanctions = (country) => {
    if (!sanctions || sanctions.length === 0) return false;
    
    return sanctions.some(sanction => 
      sanction.targetCountry === country && sanction.imposedBy === myCountry
    );
  };

  // Verificar se existe um tratado com um país
  const hasTreatyWith = (country) => {
    if (!treaties || treaties.length === 0) return false;
    
    return treaties.some(treaty => 
      (treaty.countries.includes(myCountry) && treaty.countries.includes(country))
    );
  };

  // Obter alianças de um país
  const getCountryAlliances = () => {
    if (!alliances || !alliances[myCountry]) return { economic: [], military: [] };
    
    return alliances[myCountry];
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

  // Obter eventos políticos recentes
  const getRecentEvents = () => {
    if (!politicalEvents || politicalEvents.length === 0) {
      return [];
    }
    
    return politicalEvents
      .filter(event => event.country === myCountry)
      .slice(-5); // Retorna os 5 mais recentes
  };

  // Handlers de ação
  const handleActionChange = (event) => {
    setSelectedAction(event.target.value);
    setShowConfirmation(false);
  };

  const handleTargetChange = (event) => {
    setTargetCountry(event.target.value);
    setShowConfirmation(false);
  };

  const handleDetailsChange = (event) => {
    setActionDetails(event.target.value);
    setShowConfirmation(false);
  };

  // Pré-validação da ação
  const validateAction = () => {
    if (!selectedAction) {
      return { valid: false, message: 'Selecione uma ação.' };
    }
    
    if (selectedAction !== 'propaganda' && !targetCountry) {
      return { valid: false, message: 'Selecione um país alvo.' };
    }
    
    if (['treaty', 'alliance'].includes(selectedAction) && !actionDetails) {
      return { valid: false, message: 'Forneça detalhes sobre o tratado ou aliança.' };
    }
    
    if (selectedAction === 'sanctions' && isUnderSanctions(targetCountry)) {
      return { valid: false, message: 'Este país já está sob sanções.' };
    }
    
    if (selectedAction === 'treaty' && hasTreatyWith(targetCountry)) {
      return { valid: false, message: 'Já existe um tratado com este país.' };
    }
    
    return { valid: true };
  };

  // Preparar confirmação
  const prepareAction = () => {
    const validation = validateAction();
    
    if (!validation.valid) {
      alert(validation.message);
      return;
    }
    
    let message = '';
    
    switch (selectedAction) {
      case 'propaganda':
        message = `Iniciar campanha de propaganda nacional para aumentar aprovação popular por ${actionDetails || '10 pontos'}?`;
        break;
      case 'sanctions':
        message = `Impor sanções econômicas contra ${targetCountry}? Isso afetará as relações diplomáticas negativamente.`;
        break;
      case 'alliance':
        message = `Propor aliança com ${targetCountry}? Detalhes da proposta: ${actionDetails}`;
        break;
      case 'treaty':
        message = `Propor tratado com ${targetCountry}? Termos: ${actionDetails}`;
        break;
      case 'close_borders':
        message = `Fechar fronteiras com ${targetCountry}? Isso afetará severamente as relações.`;
        break;
      default:
        message = `Executar ${selectedAction} direcionado a ${targetCountry || 'interno'}?`;
    }
    
    setConfirmationMessage(message);
    setShowConfirmation(true);
  };

  // Executar ação
  const executeAction = () => {
    // Preparar ação para o servidor
    const actionPayload = {
      sourceCountry: myCountry,
      targetCountry: targetCountry || null,
      details: actionDetails || null,
      timestamp: Date.now()
    };
    
    // Usar o tipo de evento apropriado com base na ação selecionada
    switch (selectedAction) {
      case 'propaganda':
        dispatch({ 
          type: POLITICS_EVENTS.START_PROPAGANDA, 
          payload: actionPayload 
        });
        break;
      case 'sanctions':
        dispatch({ 
          type: POLITICS_EVENTS.IMPOSE_SANCTIONS, 
          payload: actionPayload 
        });
        break;
      case 'alliance':
        dispatch({ 
          type: POLITICS_EVENTS.CREATE_ALLIANCE, 
          payload: { 
            ...actionPayload, 
            allianceType: actionDetails.toLowerCase().includes('econom') ? 'economic' : 'military' 
          } 
        });
        break;
      case 'treaty':
        dispatch({ 
          type: POLITICS_EVENTS.SIGN_TREATY, 
          payload: actionPayload 
        });
        break;
      case 'close_borders':
        dispatch({ 
          type: POLITICS_EVENTS.CLOSE_BORDERS, 
          payload: actionPayload 
        });
        break;
      case 'quell_protests':
        dispatch({ 
          type: POLITICS_EVENTS.QUELL_PROTESTS, 
          payload: actionPayload 
        });
        break;
    }
    
    // Armazenar a última ação para feedback
    setLastAction({
      type: selectedAction,
      target: targetCountry,
      details: actionDetails,
      timestamp: Date.now()
    });
    
    // Resetar o formulário
    setSelectedAction('');
    setTargetCountry('');
    setActionDetails('');
    setShowConfirmation(false);
  };

  // Cancelar ação
  const cancelAction = () => {
    setShowConfirmation(false);
  };

  // Formatar eventos políticos para exibição
  const formatPoliticalEvents = () => {
    const events = getRecentEvents();
    
    if (events.length === 0) {
      return <p className="no-events">Nenhum evento político recente</p>;
    }
    
    return (
      <div className="events-list">
        {events.map((event, index) => (
          <div key={index} className="event-item">
            <div className="event-header">
              <span className="event-type">{event.type}</span>
              <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="event-details">
              {event.target && <p>Alvo: {event.target}</p>}
              {event.effect && <p>Efeito: {event.effect}</p>}
              {event.description && <p>{event.description}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Renderizar informações de alianças
  const renderAlliances = () => {
    const countryAlliances = getCountryAlliances();
    
    return (
      <div className="alliances-section">
        <h4>Alianças Atuais</h4>
        
        <div className="alliance-group">
          <h5>Alianças Econômicas</h5>
          {countryAlliances.economic && countryAlliances.economic.length > 0 ? (
            <ul className="alliance-list">
              {countryAlliances.economic.map((ally, index) => (
                <li key={index} className="alliance-item">
                  <span className="alliance-country">{ally}</span>
                  <button className="small-btn danger">Romper</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data">Nenhuma aliança econômica</p>
          )}
        </div>
        
        <div className="alliance-group">
          <h5>Alianças Militares</h5>
          {countryAlliances.military && countryAlliances.military.length > 0 ? (
            <ul className="alliance-list">
              {countryAlliances.military.map((ally, index) => (
                <li key={index} className="alliance-item">
                  <span className="alliance-country">{ally}</span>
                  <button className="small-btn danger">Romper</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data">Nenhuma aliança militar</p>
          )}
        </div>
      </div>
    );
  };

  // Renderizar informações de tratados
  const renderTreaties = () => {
    const countryTreaties = treaties 
      ? treaties.filter(treaty => treaty.countries.includes(myCountry))
      : [];
    
    return (
      <div className="treaties-section">
        <h4>Tratados Vigentes</h4>
        
        {countryTreaties.length > 0 ? (
          <ul className="treaty-list">
            {countryTreaties.map((treaty, index) => (
              <li key={index} className="treaty-item">
                <div className="treaty-header">
                  <span className="treaty-name">{treaty.name || `Tratado #${index + 1}`}</span>
                  <button className="small-btn danger">Cancelar</button>
                </div>
                <div className="treaty-details">
                  <p>Países: {treaty.countries.filter(c => c !== myCountry).join(', ')}</p>
                  <p>Assinado em: {new Date(treaty.timestamp).toLocaleDateString()}</p>
                  {treaty.details && <p>Termos: {treaty.details}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-data">Nenhum tratado vigente</p>
        )}
      </div>
    );
  };

  // Renderizar informações de sanções
  const renderSanctions = () => {
    const activeSanctions = sanctions 
      ? sanctions.filter(s => s.imposedBy === myCountry || s.targetCountry === myCountry)
      : [];
    
    return (
      <div className="sanctions-section">
        <h4>Sanções Ativas</h4>
        
        {activeSanctions.length > 0 ? (
          <div className="sanctions-lists">
            <div className="sanctions-group">
              <h5>Sanções Impostas</h5>
              <ul className="sanctions-list">
                {activeSanctions
                  .filter(s => s.imposedBy === myCountry)
                  .map((sanction, index) => (
                    <li key={index} className="sanction-item">
                      <span>{sanction.targetCountry}</span>
                      <button className="small-btn">Levantar</button>
                    </li>
                  ))}
              </ul>
            </div>
            
            <div className="sanctions-group">
              <h5>Sanções Recebidas</h5>
              <ul className="sanctions-list">
                {activeSanctions
                  .filter(s => s.targetCountry === myCountry)
                  .map((sanction, index) => (
                    <li key={index} className="sanction-item">
                      <span>De {sanction.imposedBy}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="no-data">Nenhuma sanção ativa</p>
        )}
      </div>
    );
  };

  // Conteúdo principal do componente
  if (!myCountry) {
    return (
      <div className="politics-panel loading">
        <h3>Política</h3>
        <p>Selecione um país para ver informações políticas</p>
      </div>
    );
  }

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
                prepareAction();
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
                prepareAction();
              }}
            >
              Reprimir Protestos
            </button>
            
            <button 
              className="action-btn"
              onClick={() => {
                setActionDetails('');
                setTargetCountry('');
                prepareAction();
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