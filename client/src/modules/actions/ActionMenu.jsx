import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedCountry } from '../game/gameState';
import ActionPopup from './ActionPopup';
import './ActionMenu.css';

/**
 * Menu principal de ações no jogo
 */
const ActionMenu = ({ onOpenSideview, onSetActiveTab }) => {
  const [activeMenu, setActiveMenu] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef(null);
  const dispatch = useDispatch();
  
  // Estados para o popup
  const [popupType, setPopupType] = useState(null);
  const [actionType, setActionType] = useState('');
  
  // Selecionar dados do Redux
  const myCountry = useSelector(state => state.game?.myCountry || '');
  const selectedCountry = useSelector(state => state.game?.selectedCountry || '');
  const players = useSelector(state => state.game?.players || []);

  // Verificar se o país selecionado é o próprio país do jogador
  const isOwnCountrySelected = myCountry && selectedCountry && myCountry === selectedCountry;

  // Definir opções de menu - CORRIGIDO
  const menuOptions = {
    trade: ['import', 'export'],
    alliance: ['cooperation', 'military'], // CORRIGIDO: 'allince' -> 'military'
    attack: ['interference', 'military'] // CORRIGIDO: mantém as opções corretas
  };
  
  // Verificar se a tela é mobile ao montar e quando redimensionar
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1200);
    };
    
    // Verificação inicial
    checkMobile();
    
    // Ouvir redimensionamento da janela
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Verificar se o país selecionado é controlado por um jogador
  const isCountryControlledByPlayer = () => {
    return players.some(player => {
      if (typeof player === 'object') {
        return player.country === selectedCountry;
      }
      if (typeof player === 'string') {
        const match = player.match(/\((.*)\)/);
        return match && match[1] === selectedCountry;
      }
      return false;
    });
  };

  // Manipulador de clique em ícone para alternar menu
  const handleIconClick = (menuType) => {
    // Caso especial para o ícone do mapa - abrir sideview com a guia do país
    if (menuType === 'map') {
      // Fechar qualquer menu aberto
      setActiveMenu(null);
      // Então abrir sideview com guia do país
      onOpenSideview();
      onSetActiveTab('country');
      return;
    }
    
    // Se clicar no menu ativo, fechá-lo
    if (activeMenu === menuType) {
      setActiveMenu(null);
    } else {
      // Caso contrário, abrir o menu clicado
      setActiveMenu(menuType);
    }
  };

  // Função para selecionar meu país usando a função global do MapView - SIMPLIFICADA
  const handleSelectMyCountry = () => {
    if (!myCountry) {
      console.warn('Nenhum país do jogador encontrado');
      return;
    }
    
    setActiveMenu(null); // Fechar qualquer menu aberto
    
    // Usar função global exposta pelo MapView
    if (window.selectCountryOnMap) {
      console.log(`Selecionando meu país via função global: ${myCountry}`);
      window.selectCountryOnMap(myCountry);
    } else {
      console.warn('Função selectCountryOnMap não disponível - fallback para Redux');
      // Fallback: apenas atualizar Redux sem animação
      dispatch(setSelectedCountry(myCountry));
    }
  };

  // Função para abrir popup
  const handleOpenPopup = (type, option = '') => {
    // Verificar se existe um país selecionado
    if (!selectedCountry) {
      alert('Selecione um país no mapa primeiro');
      return;
    }
    
    // Fechar menu ativo
    setActiveMenu(null);
    
    // Abrir popup
    setPopupType(type);
    setActionType(option);
  };

  // Função para fechar popup
  const handleClosePopup = () => {
    setPopupType(null);
    setActionType('');
  };

  // Função para redirecionar ao painel de comércio
  const redirectToTradePanel = () => {
    onOpenSideview();
    onSetActiveTab('tools');
    setTimeout(() => {
      // Encontrar e clicar na aba de comércio no sidetools, se disponível
      const tradeTab = document.querySelector('.tab[title="Comércio"]');
      if (tradeTab) {
        tradeTab.click();
      }
    }, 300);
  };

  // Manipulador de clique em opção - CORRIGIDO
  const handleOptionClick = (option) => {
    console.log(`Selected option: ${option}`);
    
    // Abrir popup correspondente para opções de comércio
    if (option === 'export' || option === 'import') {
      handleOpenPopup('trade', option);
    } 
    // CORRIGIDO: Opções de aliança
    else if (option === 'cooperation') {
      handleOpenPopup('alliance', 'cooperation');
    } else if (option === 'military' && activeMenu === 'alliance') {
      handleOpenPopup('alliance', 'military');
    } 
    // CORRIGIDO: Opções de ataque
    else if (option === 'interference') {
      handleOpenPopup('attack', 'interference');
    } else if (option === 'military' && activeMenu === 'attack') {
      handleOpenPopup('attack', 'military');
    }
  };

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Obter rótulo para cada opção - CORRIGIDO
  const getOptionLabel = (option) => {
    const labels = {
      // Trade options
      'import': 'Importação',
      'export': 'Exportação',
      
      // Alliance options
      'cooperation': 'Cooperação Estratégica',
      'military': activeMenu === 'alliance' ? 'Aliança Militar' : 'Ataque Militar', // CORRIGIDO: distingue contexto
      
      // Attack options
      'interference': 'Ingerência',
    };
    
    return labels[option] || option;
  };

  // Obter ícone para cada tipo de ação
  const getActionIcon = (action) => {
    const icons = {
      'trade': 'directions_boat',
      'alliance': 'handshake',
      'attack': 'gps_fixed',
      'map': 'map',
      'back': 'arrow_back',
    };
    
    return icons[action] || 'help';
  };

  // Obter título para cada tipo de ação
  const getActionTitle = (action) => {
    const titles = {
      'trade': 'Acordo Comercial',
      'alliance': 'Alianças e Cooperação',
      'attack': 'Operações Militares',
      'map': 'Visualizar País',
      'back': 'Selecionar Meu País', // CORRIGIDO: título mais claro
      'politicalPact': 'Pacto Político',
      'businessPartnership': 'Parceria Empresarial',
      'mediaControl': 'Controle de Mídia'
    };
              
    return titles[action] || '';
  };

  return (
    <>
      <div className="action-menu-container" ref={menuRef}>
        {/* Menu de opções - posicionado acima dos ícones */}
        {activeMenu && (
          <div className="action-options">
            {menuOptions[activeMenu].map((option, index) => (
              <button 
                key={index} 
                className="action-option"
                onClick={() => handleOptionClick(option)}
              >
                {getOptionLabel(option)}
              </button>
            ))}
          </div>
        )}

        {/* Ícones de ação */}
        {isOwnCountrySelected ? (
          <div className="action-icons">
            <button 
              className={`action-icon ${activeMenu === 'politicalPact' ? 'active' : ''}`}
              // onClick={() => handleIconClick('politicalPact')}
              title={getActionTitle('politicalPact')}
            >
              <span className="material-icons">gavel</span>
            </button>
            
            {/* Botão de Parcerias Empresariais */}
            <button 
              className={`action-icon ${activeMenu === 'businessPartnership' ? 'active' : ''}`}
              // onClick={() => handleIconClick('businessPartnership')}
              title={getActionTitle('businessPartnership')}
            >
              <span className="material-icons">corporate_fare</span>
            </button>
            
            <button 
              className={`action-icon ${activeMenu === 'mediaControl' ? 'active' : ''}`}
              // onClick={() => handleIconClick('mediaControl')}
              title={getActionTitle('mediaControl')}
            >
              <span className="material-icons">connected_tv</span>
            </button>
          </div>
        ) : (
          <div className="action-icons">
            {/* NOVO: Botão para selecionar meu país */}
            <button 
              className={'action-icon'}
              onClick={handleSelectMyCountry} // IMPLEMENTADO: seleciona meu país
              title={getActionTitle('back')}
              style={{position: 'absolute', marginLeft: -74}}
            >
              <span className="material-icons">{getActionIcon('back')}</span>
            </button>

            <button 
              className={`action-icon ${activeMenu === 'trade' ? 'active' : ''}`}
              onClick={() => handleIconClick('trade')}
              title={getActionTitle('trade')}
            >
              <span className="material-icons">{getActionIcon('trade')}</span>
            </button>
            
            {/* Botão de Alianças com menu suspenso */}
            <button 
              className={`action-icon ${activeMenu === 'alliance' ? 'active' : ''}`}
              onClick={() => handleIconClick('alliance')}
              title={getActionTitle('alliance')}
            >
              <span className="material-icons">{getActionIcon('alliance')}</span>
            </button>

            <button 
              className={`action-icon ${activeMenu === 'attack' ? 'active' : ''}`}
              onClick={() => handleIconClick('attack')}
              title={getActionTitle('attack')}
            >
              <span className="material-icons">{getActionIcon('attack')}</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Popup unificado para todas as ações */}
      <ActionPopup
        isOpen={popupType !== null}
        onClose={handleClosePopup}
        popupType={popupType}
        actionType={actionType}
        selectedCountry={selectedCountry}
        myCountry={myCountry}
        isCountryControlledByPlayer={isCountryControlledByPlayer()}
        redirectToTradePanel={redirectToTradePanel}
      />
    </>
  );
};

export default ActionMenu;