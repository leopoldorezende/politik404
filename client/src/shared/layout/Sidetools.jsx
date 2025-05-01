import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import '../../shared/styles/Sidetools.css';

const Sidetools = ({ onClose, isActive }) => {
  const [activeTab, setActiveTab] = useState('economy');
  const dispatch = useDispatch();
  
  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  const latestEconomyUpdate = useSelector(state => state.game.latestEconomyUpdate);
  const economicEvents = useSelector(state => state.game.economicEvents);
  
  // Dados econômicos do país do jogador
  const [economyData, setEconomyData] = useState({
    gdp: 0,
    gdpGrowth: 0,
    treasury: 0,
    debt: 0,
    inflation: 0,
    unemployment: 0,
    popularity: 0,
    commodities: 0,
    manufacturing: 0,
    resources: 0,
    technology: 0,
    interestRate: 0,
    taxRate: 0,
    publicServices: 0
  });
  
  // Dados militares do país do jogador
  const [militaryData, setMilitaryData] = useState({
    army: 0,
    navy: 0,
    airforce: 0,
    missiles: 0,
    nuclear: 'Não'
  });
  
  // Atualiza os dados quando o país mudar
  useEffect(() => {
    if (myCountry && countriesData && countriesData[myCountry]) {
      const country = countriesData[myCountry];
      
      // Atualiza dados econômicos
      if (country.economy) {
        setEconomyData({
          gdp: country.economy.gdp ? `${country.economy.gdp.value} ${country.economy.gdp.unit}` : 'N/A',
          gdpGrowth: country.economy.gdpGrowth || 0,
          treasury: country.economy.treasury ? `${country.economy.treasury.value} ${country.economy.treasury.unit}` : 'N/A',
          debt: country.economy.publicDebt ? `${country.economy.publicDebt.value} ${country.economy.publicDebt.unit}` : 'N/A',
          inflation: country.economy.inflation || 0,
          unemployment: country.economy.unemployment || 0,
          popularity: country.economy.popularity || 0,
          commodities: country.economy.commodities ? country.economy.commodities.value : 0,
          manufacturing: country.economy.manufacturing ? country.economy.manufacturing.value : 0,
          resources: country.economy.naturalResources || 0,
          technology: country.economy.technologyLevel || 0,
          interestRate: country.economy.interestRate || 0,
          taxRate: country.economy.taxBurden || 0,
          publicServices: country.economy.publicServices || 0
        });
      }
      
      // Atualiza dados militares
      if (country.military) {
        setMilitaryData({
          army: country.military.army || 0,
          navy: country.military.navy || 0,
          airforce: country.military.airforce || 0,
          missiles: country.military.missiles || 0,
          nuclear: country.military.nuclearCapability ? 'Sim' : 'Não'
        });
      }
    }
  }, [myCountry, countriesData, latestEconomyUpdate]); // Adicionado latestEconomyUpdate como dependência

  // Solicita dados econômicos atualizados ao entrar na sala
  useEffect(() => {
    if (myCountry) {
      // Solicita dados econômicos completos
      dispatch({ type: 'socket/getEconomyData' });
      
      // Configura um intervalo para solicitar atualizações a cada 30 segundos
      const interval = setInterval(() => {
        dispatch({ type: 'socket/getEconomyData' });
      }, 30000);
      
      // Limpa o intervalo ao desmontar
      return () => clearInterval(interval);
    }
  }, [myCountry, dispatch]);

  // Funções para ajustar parâmetros econômicos
  const handleAdjustInterestRate = (adjustment) => {
    dispatch({ 
      type: 'socket/adjustInterestRate', 
      payload: { adjustment }
    });
  };
  
  const handleAdjustTaxBurden = (adjustment) => {
    dispatch({ 
      type: 'socket/adjustTaxBurden', 
      payload: { adjustment }
    });
  };
  
  const handleAdjustPublicServices = (adjustment) => {
    dispatch({ 
      type: 'socket/adjustPublicServices', 
      payload: { adjustment }
    });
  };

  // Formata o histórico de taxas de crescimento para exibição
  const formatGrowthHistory = () => {
    if (!myCountry || !economicEvents) return "Sem dados históricos";
    
    // Filtra eventos relevantes para o país
    const countryEvents = economicEvents
      .filter(event => event.country === myCountry)
      .slice(-5); // Mantém apenas os 5 mais recentes
    
    if (countryEvents.length === 0) {
      return "Sem dados históricos";
    }
    
    // Formata os dados para exibição
    return countryEvents.map((event, index) => (
      <div key={index} className="economic-event">
        <span className="event-type">{event.event.type}</span>
        <span className="event-impact">Impacto: {event.event.impact}</span>
        <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
      </div>
    ));
  };
  
  return (
    <div id="sidetools" className={isActive ? 'active' : ''}>
      {/* Botão de recolher */}
      <button className="close-button" onClick={onClose}>
        <span className="material-icons">chevron_left</span>
      </button>
      
      <h2 id="player-country-display" className="player-country-display">
        {myCountry || 'País não selecionado'}
      </h2>
      
      <div className="tabs">
        <div 
          className={`tab ${activeTab === 'economy' ? 'active' : ''}`}
          onClick={() => setActiveTab('economy')}
        >
          <span className="material-icons">monetization_on</span>
        </div>
        <div 
          className={`tab ${activeTab === 'politics' ? 'active' : ''}`}
          onClick={() => setActiveTab('politics')}
        >
          <span className="material-icons">account_balance</span>
        </div>
        <div 
          className={`tab ${activeTab === 'war' ? 'active' : ''}`}
          onClick={() => setActiveTab('war')}
        >
          <span className="material-icons">military_tech</span>
        </div>
        <div 
          className={`tab ${activeTab === 'ships' ? 'active' : ''}`}
          onClick={() => setActiveTab('ships')}
        >
          <span className="material-icons">directions_boat</span>
        </div>
      </div>

      <div className="tab-contents">
        <div id="economy" className={`tab-content ${activeTab === 'economy' ? 'active' : ''}`}>
          <h3>Economia</h3>
          <div className="economy-stats">
            <p>PIB: <span id="gdp-value">{economyData.gdp}</span> (Growth: <span id="gdp-growth">{economyData.gdpGrowth}</span>%)</p>
            <p>Tesouro: <span id="treasury-value">{economyData.treasury}</span></p>
            <p>Dívida Pública: <span id="debt-value">{economyData.debt}</span></p>
            <p>Inflação: <span id="inflation-value">{economyData.inflation}%</span></p>
            <p>Desemprego: <span id="unemployment-value">{economyData.unemployment}%</span></p>
            <p>Popularidade: <span id="popularity-value">{economyData.popularity}%</span></p>
          </div>
          <div className="economy-resources">
            <p>Commodities: <span id="commodities-value">{economyData.commodities}</span></p>
            <p>Manufatura: <span id="manufacturing-value">{economyData.manufacturing}</span></p>
            <p>Recursos Naturais: <span id="resources-value">{economyData.resources}</span></p>
            <p>Nível Tecnológico: <span id="technology-value">{economyData.technology}</span></p>
          </div>
          
          {/* Seção de controles econômicos */}
          <div className="economy-controls">
            <h4>Controles Econômicos</h4>
            <div className="control-group">
              <p>Taxa de Juros: <span id="interest-rate">{economyData.interestRate}%</span></p>
              <div className="control-buttons">
                <button onClick={() => handleAdjustInterestRate(-0.5)} className="control-btn decrease">-0.5%</button>
                <button onClick={() => handleAdjustInterestRate(0.5)} className="control-btn increase">+0.5%</button>
              </div>
            </div>
            
            <div className="control-group">
              <p>Impostos: <span id="tax-rate">{economyData.taxRate}%</span></p>
              <div className="control-buttons">
                <button onClick={() => handleAdjustTaxBurden(-1)} className="control-btn decrease">-1%</button>
                <button onClick={() => handleAdjustTaxBurden(1)} className="control-btn increase">+1%</button>
              </div>
            </div>
            
            <div className="control-group">
              <p>Serviços Públicos: <span id="public-services-value">{economyData.publicServices}%</span></p>
              <div className="control-buttons">
                <button onClick={() => handleAdjustPublicServices(-1)} className="control-btn decrease">-1%</button>
                <button onClick={() => handleAdjustPublicServices(1)} className="control-btn increase">+1%</button>
              </div>
            </div>
          </div>
          
          {/* Histórico de eventos econômicos */}
          <div className="economic-events">
            <h4>Eventos Econômicos Recentes</h4>
            <div className="events-list">
              {formatGrowthHistory()}
            </div>
            
            {/* Indicador de última atualização */}
            <div className="last-update">
              <p>Última atualização: {
                latestEconomyUpdate 
                  ? new Date(latestEconomyUpdate.timestamp).toLocaleTimeString() 
                  : 'Aguardando dados...'
              }</p>
            </div>
          </div>
        </div>
        
        <div id="politics" className={`tab-content ${activeTab === 'politics' ? 'active' : ''}`}>
          <h3>Política</h3>
          <div className="politics-container">
            {myCountry && countriesData && countriesData[myCountry]?.politics ? (
              <>
                <div className="politics-stats">
                  <h4>Apoio Político</h4>
                  <div className="support-info">
                    <div className="support-item">
                      <span>Parlamento:</span>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{width: `${countriesData[myCountry].politics.parliamentSupport}%`}}></div>
                      </div>
                      <span>{countriesData[myCountry].politics.parliamentSupport}%</span>
                    </div>
                    <div className="support-item">
                      <span>Mídia:</span>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{width: `${countriesData[myCountry].politics.mediaSupport}%`}}></div>
                      </div>
                      <span>{countriesData[myCountry].politics.mediaSupport}%</span>
                    </div>
                  </div>
                  
                  <div className="protests-info">
                    <p>Protestos: {countriesData[myCountry].politics.protests.value} {countriesData[myCountry].politics.protests.unit}</p>
                  </div>
                </div>
                
                <div className="opposition-info">
                  <h4>Oposição</h4>
                  <p>Força da Oposição: {countriesData[myCountry].politics.opposition.strength}%</p>
                  <p>Conexões Estrangeiras: {countriesData[myCountry].politics.opposition.foreignConnections.join(', ')}</p>
                </div>
                
                <div className="alliances-info">
                  <h4>Alianças</h4>
                  {countriesData[myCountry].politics.economicAlliances?.length > 0 ? (
                    <>
                      <p>Alianças Econômicas:</p>
                      <ul>
                        {countriesData[myCountry].politics.militaryAlliances?.map((alliance, index) => (
                          <li key={index}>{typeof alliance === 'string' ? alliance : alliance.country}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p>Sem alianças econômicas.</p>
                  )}
                  
                  {countriesData[myCountry].politics.militaryAlliances?.length > 0 ? (
                    <>
                      <p>Alianças Militares:</p>
                      <ul>
                        {countriesData[myCountry].politics.militaryAlliances?.map((alliance, index) => (
                          <li key={index}>{typeof alliance === 'string' ? alliance : alliance.country}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p>Sem alianças militares.</p>
                  )}
                </div>
              </>
            ) : (
              <p>Selecione um país para ver informações políticas.</p>
            )}
          </div>
        </div>
        
        <div id="war" className={`tab-content ${activeTab === 'war' ? 'active' : ''}`}>
          <h3>Militar</h3>
          <div className="military-stats">
            <h4>Forças Armadas</h4>
            <p>Exército: <span id="army-value">{militaryData.army}</span>%</p>
            <p>Marinha: <span id="navy-value">{militaryData.navy}</span>%</p>
            <p>Força Aérea: <span id="airforce-value">{militaryData.airforce}</span>%</p>
            <p>Mísseis: <span id="missiles-value">{militaryData.missiles}</span>%</p>
            <p>Capacidade Nuclear: <span id="nuclear-status" className={militaryData.nuclear === 'Sim' ? 'status-yes' : 'status-no'}>{militaryData.nuclear}</span></p>
          </div>
          <div className="war-actions">
            <h4>Operações Militares</h4>
            <select id="target-country">
              <option value="">Selecione um alvo</option>
              {countriesData && Object.keys(countriesData)
                .filter(country => country !== myCountry)
                .map((country, index) => (
                  <option key={index} value={country}>{country}</option>
                ))
              }
            </select>
            <button className="action-btn danger">Declarar Guerra</button>
          </div>
        </div>
        
        <div id="ships" className={`tab-content ${activeTab === 'ships' ? 'active' : ''}`}>
          <h3>Navios</h3>
          <div className="ships-info">
            <h4>Frotas Navais</h4>
            <p>Cada jogador controla até 3 navios que podem ser posicionados estrategicamente nos oceanos.</p>
          </div>
          
          <div className="my-ships">
            <h4>Meus Navios</h4>
            <div id="ships-list">
              <p>Implementação de navios em progresso...</p>
            </div>
          </div>
          
          <div className="ships-actions">
            <h4>Ações Navais</h4>
            <div className="ship-buttons">
              <button id="locate-ships" className="action-btn">Localizar Meus Navios</button>
              <button id="reset-ships" className="action-btn">Reposicionar Navios</button>
            </div>
          </div>
          
          <div className="enemy-ships">
            <h4>Navios Inimigos</h4>
            <div id="enemy-ships-list">
              <p>Nenhum navio inimigo detectado.</p>
            </div>
          </div>
          
          <div className="ship-instructions">
            <h4>Instruções</h4>
            <ul>
              <li>Arraste navios para movê-los pelo mapa</li>
              <li>Navios não podem ser posicionados em terra</li>
              <li>O círculo ao redor do navio representa seu raio de ação</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidetools;