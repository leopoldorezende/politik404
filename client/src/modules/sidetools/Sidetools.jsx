import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import EconomyPanel from '../economy/EconomyPanel';
import PoliticsPanel from '../politics/PoliticsPanel';
import TradePanel from '../trade/TradePanel';
import MilitaryPanel from '../military/MilitaryPanel';
import './Sidetools.css';

const Sidetools = ({ onClose, isActive, myCountry }) => {
  const [activeTab, setActiveTab] = useState('economy');
  const dispatch = useDispatch();
  
  // Dados do Redux
  const countriesData = useSelector(state => state.game.countriesData);
  
  // Resolver problema de scroll quando mudar de tabs
  useEffect(() => {
    // Quando mudar de tab, scroll para o topo
    const tabContent = document.querySelector('.tab-content.active');
    if (tabContent) {
      tabContent.scrollTop = 0;
    }
  }, [activeTab]);

  return (
    <div id="sidetools" className={isActive ? 'active' : ''}>
      {/* Botão de recolher */}
      <button className="close-button" onClick={onClose}>
        <span className="material-icons">chevron_left</span>
      </button>
      
      <h2 id="player-country-display" className="sidebar-title">
        {myCountry || 'País não selecionado'}
      </h2>
      
      <div className="tabs">
        <div 
          className={`tab ${activeTab === 'economy' ? 'active' : ''}`}
          onClick={() => setActiveTab('economy')}
          title="Economia"
        >
          <span className="material-icons">monetization_on</span>
        </div>
        <div 
          className={`tab ${activeTab === 'politics' ? 'active' : ''}`}
          onClick={() => setActiveTab('politics')}
          title="Política"
        >
          <span className="material-icons">account_balance</span>
        </div>
        <div 
          className={`tab ${activeTab === 'trade' ? 'active' : ''}`}
          onClick={() => setActiveTab('trade')}
          title="Comércio"
        >
          <span className="material-icons">directions_boat</span>
        </div>
        <div 
          className={`tab ${activeTab === 'military' ? 'active' : ''}`}
          onClick={() => setActiveTab('military')}
          title="Militar"
        >
          <span className="material-icons">military_tech</span>
        </div>
      </div>

      <div className="tab-contents">
        {/* Painel de Economia - Usando nosso novo componente */}
        <div className={`tab-content ${activeTab === 'economy' ? 'active' : ''}`}>
          <EconomyPanel />
        </div>
        
        {/* Painel de Política - Usando nosso novo componente */}
        <div className={`tab-content ${activeTab === 'politics' ? 'active' : ''}`}>
          <PoliticsPanel />
        </div>
        
        {/* Painel Trade - Usando nosso novo componente */}
        <div className={`tab-content ${activeTab === 'trade' ? 'active' : ''}`}>
          <TradePanel />
        </div>
        
        {/* Painel Militar - Usando nosso novo componente */}
        <div className={`tab-content ${activeTab === 'military' ? 'active' : ''}`}>
          <MilitaryPanel />
        </div>
        
      </div>
    </div>
  );
};

export default Sidetools;