import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import AdvancedEconomyPanel from '../../modules/economy/AdvancedEconomyPanel';
import PoliticsPanel from '../../modules/politics/PoliticsPanel';
import TradePanel from '../../modules/trade/TradePanel';
import DefensePanel from '../../modules/defense/DefensePanel';
import './Sidetools.css';

const Sidetools = ({ onClose, isActive, myCountry, onOpenDebtPopup }) => {
  const [activeTab, setActiveTab] = useState('economy');

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
          className={`tab ${activeTab === 'trade' ? 'active' : ''}`}
          onClick={() => setActiveTab('trade')}
          title="Comércio"
        >
          <span className="material-icons">directions_boat</span>
        </div>
        <div 
          className={`tab ${activeTab === 'politics' ? 'active' : ''}`}
          onClick={() => setActiveTab('politics')}
          title="Política"
        >
          <span className="material-icons">account_balance</span>
        </div>
        <div 
          className={`tab ${activeTab === 'defense' ? 'active' : ''}`}
          onClick={() => setActiveTab('defense')}
          title="Militar"
        >
          <span className="material-icons">military_tech</span>
        </div>
      </div>

      <div className="tab-contents">
        {/* Painel de Economia - Usando nosso novo componente com callback para popup de dívidas */}
        <div className={`tab-content ${activeTab === 'economy' ? 'active' : ''}`}>
          <AdvancedEconomyPanel onOpenDebtPopup={onOpenDebtPopup} />
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
        <div className={`tab-content ${activeTab === 'defense' ? 'active' : ''}`}>
          <DefensePanel />
        </div>
        
      </div>
    </div>
  );
};

export default Sidetools;