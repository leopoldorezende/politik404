import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { socketApi } from '../../services/socketClient';
import Popup from '../../ui/popup/Popup';
import MessageService from '../../ui/toast/messageService';
import './ActionMenu.css';

/**
 * ActionMenu - Component with action icons at the bottom of GamePage
 * Displays a menu of options when an action icon is clicked
 */
const ActionMenu = ({ onOpenSideview, onSetActiveTab }) => {
  const dispatch = useDispatch();
  const [activeMenu, setActiveMenu] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef(null);
  
  // Estados para o popup
  const [popupType, setPopupType] = useState(null); // 'export', 'import', 'alliance', etc.
  const [tradeType, setTradeType] = useState('commodity'); // 'commodity' ou 'manufacture'
  const [tradeAmount, setTradeAmount] = useState('');
  const [currentOption, setCurrentOption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Novos estados para controle de cooldown das propostas
  const [lastExportProposal, setLastExportProposal] = useState(0);
  const [lastImportProposal, setLastImportProposal] = useState(0);
  const [exportRemainingTime, setExportRemainingTime] = useState(0);
  const [importRemainingTime, setImportRemainingTime] = useState(0);
  const [countdownActive, setCountdownActive] = useState(false);
  
  // Constante para definir o tempo de cooldown (15 segundos)
  const PROPOSAL_COOLDOWN = 15000; 
  
  // Selecionar dados do Redux
  const myCountry = useSelector(state => state.game?.myCountry || '');
  const selectedCountry = useSelector(state => state.game?.selectedCountry || '');
  const players = useSelector(state => state.game?.players || []);

  // Verificar se o país selecionado é o país do próprio jogador
  const isOwnCountrySelected = myCountry && selectedCountry && myCountry === selectedCountry;

  // Check if screen is mobile on mount and when window resizes
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1200);
    };
    
    // Initial check
    checkMobile();
    
    // Listen for window resize
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Configure socket event listener for trade proposal responses
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    const handleTradeProposalResponse = (response) => {
      setIsSubmitting(false);
      
      if (response.accepted) {
        MessageService.showSuccess(`Proposta de ${currentOption === 'export' ? 'exportação' : 'importação'} aceita por ${selectedCountry}!`);
        
        // Redirecionar para o painel de comércio após acordo aceito
        handleClosePopup();
        redirectToTradePanel();
      } else {
        MessageService.showWarning(`${selectedCountry} recusou sua proposta de ${currentOption === 'export' ? 'exportação' : 'importação'}.`);
      }
    };
    
    socket.on('tradeProposalResponse', handleTradeProposalResponse);
    
    return () => {
      socket.off('tradeProposalResponse', handleTradeProposalResponse);
    };
  }, [currentOption, selectedCountry]);

  // Efeito para atualizar os cronômetros de cooldown
  useEffect(() => {
    let timer;
    
    if (countdownActive) {
      timer = setInterval(() => {
        const now = Date.now();
        
        // Calcular o tempo restante para exportação
        if (lastExportProposal > 0) {
          const timeElapsed = now - lastExportProposal;
          if (timeElapsed < PROPOSAL_COOLDOWN) {
            setExportRemainingTime(Math.ceil((PROPOSAL_COOLDOWN - timeElapsed) / 1000));
          } else {
            setExportRemainingTime(0);
          }
        }
        
        // Calcular o tempo restante para importação
        if (lastImportProposal > 0) {
          const timeElapsed = now - lastImportProposal;
          if (timeElapsed < PROPOSAL_COOLDOWN) {
            setImportRemainingTime(Math.ceil((PROPOSAL_COOLDOWN - timeElapsed) / 1000));
          } else {
            setImportRemainingTime(0);
          }
        }
        
        // Se ambos os cronômetros chegarem a zero, podemos parar o intervalo
        if ((lastExportProposal === 0 || now - lastExportProposal >= PROPOSAL_COOLDOWN) && 
            (lastImportProposal === 0 || now - lastImportProposal >= PROPOSAL_COOLDOWN)) {
          setCountdownActive(false);
          clearInterval(timer);
        }
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdownActive, lastExportProposal, lastImportProposal]);

  // Define the action menu options
  const menuOptions = {
    trade: ['import', 'export'],
    hybrid: ['sabotage', 'interference', 'disinformation'],
    attack: ['missiles', 'maritime', 'ground', 'aerial']
  };

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

  // Handle icon click to toggle menu
  const handleIconClick = (menuType) => {
    // Special case for map icon - open sideview with country tab
    if (menuType === 'map') {
      // Close any open menu
      setActiveMenu(null);
      // Then open sideview with country tab
      onOpenSideview();
      onSetActiveTab('country');
      return;
    }
    
    // If clicking the active menu, close it
    if (activeMenu === menuType) {
      setActiveMenu(null);
    } else {
      // Otherwise, open the clicked menu
      setActiveMenu(menuType);
    }
  };

  // Função para verificar se uma proposta está em cooldown
  const isProposalInCooldown = (proposalType) => {
    const now = Date.now();
    
    if (proposalType === 'export') {
      return lastExportProposal > 0 && now - lastExportProposal < PROPOSAL_COOLDOWN;
    } else if (proposalType === 'import') {
      return lastImportProposal > 0 && now - lastImportProposal < PROPOSAL_COOLDOWN;
    }
    
    return false;
  };

  // Função para abrir popup
  const handleOpenPopup = (type, option) => {
    // Verificar se existe um país selecionado
    if (!selectedCountry) {
      MessageService.showWarning('Selecione um país no mapa primeiro');
      return;
    }
    
    // Fechar menu ativo
    setActiveMenu(null);
    
    // Abrir popup
    setPopupType(type);
    setCurrentOption(option);
    setTradeType('commodity'); // reset para o valor padrão
    setTradeAmount(''); // limpar o valor anterior
    setIsSubmitting(false); // resetar estado de submissão
    
    // Se for uma proposta de comércio, verificar se há cooldown ativo
    // e ativar o cronômetro se necessário
    if (type === 'trade' && (option === 'export' || option === 'import')) {
      if (isProposalInCooldown(option)) {
        setCountdownActive(true);
      }
    }
  };

  // Função para fechar popup
  const handleClosePopup = () => {
    setPopupType(null);
    setCurrentOption('');
    setIsSubmitting(false);
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

  // Função para enviar proposta de comércio
  const handleSendTradeProposal = () => {
    const amount = parseFloat(tradeAmount);
    if (!amount || amount <= 0) {
      MessageService.showError('Por favor, insira um valor válido maior que zero.');
      return;
    }
    
    // Verificar se a proposta está em cooldown
    if (isProposalInCooldown(currentOption)) {
      MessageService.showWarning(`Aguarde ${currentOption === 'export' ? exportRemainingTime : importRemainingTime} segundos antes de enviar uma nova proposta de ${currentOption === 'export' ? 'exportação' : 'importação'}.`);
      return;
    }
    
    // Desabilitar o botão enquanto processa
    setIsSubmitting(true);
    
    // Enviar proposta de acordo comercial via socket API
    socketApi.sendTradeProposal({
      type: currentOption, // 'export' ou 'import'
      product: tradeType, // 'commodity' ou 'manufacture'
      targetCountry: selectedCountry,
      value: amount,
      originCountry: myCountry
    });
    
    // Registrar o timestamp da proposta enviada
    const now = Date.now();
    if (currentOption === 'export') {
      setLastExportProposal(now);
    } else if (currentOption === 'import') {
      setLastImportProposal(now);
    }
    
    // Ativar o cronômetro
    setCountdownActive(true);
    
    // Fechar o popup após enviar a proposta
    handleClosePopup();
    
    // Mostrar mensagem de confirmação
    MessageService.showInfo(`Proposta de ${currentOption === 'export' ? 'exportação' : 'importação'} enviada para ${selectedCountry}.`);
  };

  // Função para finalizar aliança militar
  const handleSignAlliance = () => {
    MessageService.showSuccess(`Aliança militar com ${selectedCountry} assinada! Em caso de guerra, os países são obrigados a prestar assistência mútua.`);
    handleClosePopup();
  };

  // Handle option click
  const handleOptionClick = (option) => {
    console.log(`Selected option: ${option}`);
    
    // Abrir popup correspondente para opções de comércio
    if (option === 'export' || option === 'import') {
      handleOpenPopup('trade', option);
    } else {
      // Para outras opções, apenas fechar o menu por enquanto
      setActiveMenu(null);
    }
  };

  // Close menu when clicking outside
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

  // Get label for each option
  const getOptionLabel = (option) => {
    const labels = {
      // Trade options
      'import': 'Importação',
      'export': 'Exportação',
      
      // Hybrid war options
      'sabotage': 'Sabotagem',
      'interference': 'Ingerência',
      'disinformation': 'Desinformação',
      
      // Military attack options
      'missiles': 'Mísseis',
      'maritime': 'Marítimo',
      'ground': 'Terrestre',
      'aerial': 'Aéreo'
    };
    
    return labels[option] || option;
  };

  // Get icon for each action type
  const getActionIcon = (action) => {
    const icons = {
      'trade': 'directions_boat',
      'hybrid': 'public_off',
      'attack': 'gps_fixed',
      'map': 'map',
      'alliance': 'handshake'
    };
    
    return icons[action] || 'help';
  };

  // Get title for each action type
  const getActionTitle = (action) => {
    const titles = {
      'trade': 'Acordo Comercial',
      'hybrid': 'Guerra Híbrida',
      'attack': 'Ataque Bélico',
      'map': 'Ver País Selecionado',
      'alliance': 'Aliança Militar'
    };
    
    return titles[action] || '';
  };
  
  // Obtém o título do popup baseado no tipo e opção
  const getPopupTitle = () => {
    if (currentOption === 'export') {
      return `Exportar para ${selectedCountry}`;
    } else if (currentOption === 'import') {
      return `Importar de ${selectedCountry}`;
    } else if (popupType === 'alliance') {
      return `Aliança Militar com ${selectedCountry}`;
    } else {
      return 'Ação';
    }
  };
  
  // Renderiza o conteúdo do popup com base no tipo
  const renderPopupContent = () => {
    switch (popupType) {
      case 'alliance':
        return (
          <>
            <div className="popup-info">
              <ul className="popup-info-list">
                <li>Em caso de guerra, os países aliados são <strong>obrigados</strong> a prestar assistência militar. A aliança fortalece a posição diplomática internacional de ambos os países.</li>
              </ul>
            </div>

            <div className="popup-actions">
              <button onClick={handleSignAlliance}>
                Assinar Aliança
              </button>
            </div>
          </>
        );
      case 'trade':
        if (currentOption === 'export' || currentOption === 'import') {
          const isTargetControlledByPlayer = isCountryControlledByPlayer();
          const inCooldown = isProposalInCooldown(currentOption);
          const remainingTime = currentOption === 'export' ? exportRemainingTime : importRemainingTime;
          
          // Renderizar mensagem de cooldown se necessário
          if (inCooldown) {
            return (
              <div className="cooldown-message">
                <p>
                  Você precisa aguardar antes de enviar uma nova proposta de {currentOption === 'export' ? 'exportação' : 'importação'}.
                </p>
                <div className="cooldown-timer">
                  <span className="material-icons">timer</span>
                  <span className="countdown">{remainingTime} segundos</span>
                </div>
                <p>
                  Por favor, aguarde o fim deste período de espera para enviar uma nova proposta comercial.
                </p>
              </div>
            );
          }
          
          // Renderizar o formulário normal se não estiver em cooldown
          return (
            <>
              <div className="popup-form-group">
                <label>Tipo de produto:</label>
                <div className="radio-options">
                  <label className="radio-option">
                    <input 
                      type="radio" 
                      name="tradeType" 
                      value="commodity" 
                      checked={tradeType === 'commodity'}
                      onChange={() => setTradeType('commodity')}
                    />
                    Commoditie
                  </label>
                  <label className="radio-option">
                    <input 
                      type="radio" 
                      name="tradeType" 
                      value="manufacture" 
                      checked={tradeType === 'manufacture'}
                      onChange={() => setTradeType('manufacture')}
                    />
                    Manufatura
                  </label>
                </div>
              </div>

              <div className="popup-form-group">
                <label>USD para {currentOption === 'export' ? 'exportação' : 'importação'} mensal:</label>
                <input 
                  type="number" 
                  value={tradeAmount} 
                  onChange={(e) => setTradeAmount(e.target.value)}
                  min="1"
                  placeholder="Digite o valor em USD"
                />
              </div>

              <div className="popup-info">
                <p>
                  {isTargetControlledByPlayer 
                    ? `${selectedCountry} é controlado por outro jogador e precisará aprovar esta proposta.`
                    : `${selectedCountry} é controlado pelo sistema e poderá aprovar ou recusar esta proposta.`
                  }
                </p>
              </div>

              <div className="popup-actions">
                <button 
                  onClick={handleSendTradeProposal}
                  disabled={isSubmitting || !tradeAmount || tradeAmount <= 0}
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Proposta'}
                </button>
              </div>
            </>
          );
        }
        return <p>Opção de comércio não reconhecida</p>;
      
      // Adicione outros casos para outros tipos de popup conforme necessário
      default:
        return <p>Tipo de ação desconhecido</p>;
    }
  };

  // Se o país selecionado é o próprio país do jogador, não renderizar o ActionMenu
  if (isOwnCountrySelected) {
    return null;
  }

  return (
    <>
      <div className="action-menu-container" ref={menuRef}>
        {/* Options menu - positioned above the icons */}
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

        {/* Action icons */}
        <div className="action-icons">
          <button 
            className={`action-icon ${activeMenu === 'trade' ? 'active' : ''}`}
            onClick={() => handleIconClick('trade')}
            title={getActionTitle('trade')}
          >
            <span className="material-icons">{getActionIcon('trade')}</span>
          </button>
          
          {/* Novo botão de Aliança Militar */}
          <button 
            className="action-icon"
            onClick={() => handleOpenPopup('alliance')}
            title={getActionTitle('alliance')}
          >
            <span className="material-icons">{getActionIcon('alliance')}</span>
          </button>
          
          <button 
            className={`action-icon ${activeMenu === 'hybrid' ? 'active' : ''}`}
            onClick={() => handleIconClick('hybrid')}
            title={getActionTitle('hybrid')}
          >
            <span className="material-icons">{getActionIcon('hybrid')}</span>
          </button>
          
          <button 
            className={`action-icon ${activeMenu === 'attack' ? 'active' : ''}`}
            onClick={() => handleIconClick('attack')}
            title={getActionTitle('attack')}
          >
            <span className="material-icons">{getActionIcon('attack')}</span>
          </button>
          
          {/* Map icon to open sideview with country information - only on mobile */}
          {isMobile && (
            <button 
              className="action-icon"
              onClick={() => handleIconClick('map')}
              title={getActionTitle('map')}
            >
              <span className="material-icons">{getActionIcon('map')}</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Popup para diferentes ações - agora usando o novo componente Popup */}
      <Popup 
        isOpen={popupType !== null} 
        onClose={handleClosePopup} 
        title={getPopupTitle()}
      >
        {renderPopupContent()}
      </Popup>
    </>
  );
};

export default ActionMenu;