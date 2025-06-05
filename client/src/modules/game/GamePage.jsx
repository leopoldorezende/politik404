import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sideview from '../../ui/sideview/Sideview';
import Sidetools from '../../ui/sidetools/Sidetools';
import { PopupProvider } from '../../ui/popup/PopupManager';
import MapView from '../map/MapView';
import ActionMenu from '../actions/ActionMenu';
import CardsPopup from '../cards/CardsPopup';
import { usePlayerPoints } from '../../hooks/useCards';
import { loadCountriesData, loadCountriesCoordinates } from '../country/countryService';
import { setCountriesCoordinates } from './gameState';
import { socketApi } from '../../services/socketClient';
import TradeProposalPopup from '../trade/TradeProposalPopup';
import DebtSummaryPopup from '../economy/DebtSummaryPopup';
import MessageService from '../../ui/toast/messageService';
import './GamePage.css';


const GamePage = () => {
  const CLIENT_UPDATE_INTERVAL = 500;
  const dispatch = useDispatch();
  const myCountry = useSelector(state => state.game.myCountry);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  const rooms = useSelector(state => state.rooms.rooms);
  const players = useSelector(state => state.game.players);
  const countriesData = useSelector(state => state.game.countriesData);
  const tradeAgreements = useSelector(state => state.trade?.tradeAgreements || []);

  const [sideviewActive, setSideviewActive] = useState(true);
  const [sidetoolsActive, setSidetoolsActive] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showTimeupPopup, setShowTimeupPopup] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [tradeProposal, setTradeProposal] = useState(null);
  
  // Estados para o popup de dívidas
  const [showDebtPopup, setShowDebtPopup] = useState(false);
  const [debtPopupData, setDebtPopupData] = useState({
    debtSummary: null,
    debtRecords: null
  });

  // Estados para o popup de cards
  const [showCardsPopup, setShowCardsPopup] = useState(false);

  // useRef para controlar carregamento único
  const hasLoadedData = useRef(false);
  
  // Hook para pontuação usando o novo sistema de cards
  const { totalPoints, loading: pointsLoading } = usePlayerPoints(
    currentRoom?.name, 
    myCountry
  );


  // Atualizar o tempo a cada segundo - sem mudanças
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, CLIENT_UPDATE_INTERVAL);
    
    return () => clearInterval(timer);
  }, []);
  
  // Memoizar função de pontos para evitar re-criação
  const getMyCountryPoints = useCallback(() => {
    // Usar sistema de cards
    if (totalPoints !== undefined && !pointsLoading) {
      return totalPoints;
    }

    if (!myCountry || !tradeAgreements.length) return 0;
    
    // Contar acordos comerciais onde meu país é o originador
    const myTradeAgreements = tradeAgreements.filter(agreement => 
      agreement.originCountry === myCountry
    ).length;
    
    // Por enquanto, apenas acordos comerciais (como no RankingPanel)
    // No futuro: alianças militares * 2
    const totalScore = myTradeAgreements;
    
    return totalScore;
  }, [myCountry, tradeAgreements]);

  // Memoizar função de formatação de tempo
  const formatTimeRemaining = useCallback((ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);
  
  // Memoizar roomData para evitar recálculo constante
  const roomData = useMemo(() => {
    return currentRoom ? rooms.find(room => room.name === currentRoom.name) : null;
  }, [currentRoom, rooms]);

  const timeRemaining = roomData?.expiresAt ? Math.max(0, roomData.expiresAt - currentTime) : 0;
  
  // Verificar se o tempo acabou e mostrar popup
  useEffect(() => {
    if (roomData && timeRemaining === 0 && roomData.expiresAt > 0 && !showTimeupPopup) {
      setShowTimeupPopup(true);
    }
  }, [timeRemaining, roomData, showTimeupPopup]);
  
  // ✅ CORREÇÃO 6: useEffect separado para carregamento de dados - EXECUTA APENAS UMA VEZ
  useEffect(() => {
    if (hasLoadedData.current) return;
    
    const loadAllData = async () => {
      try {
        await loadCountriesData();
        
        const coordinates = await loadCountriesCoordinates();
        if (coordinates) {
          dispatch(setCountriesCoordinates(coordinates));
        }
        
        setDataLoaded(true);
        hasLoadedData.current = true;
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    };
    
    loadAllData();
  }, [dispatch]);

  // useEffect separado para atualizar lista de salas
  useEffect(() => {
    if (currentRoom) {
      dispatch({ type: 'socket/getRooms' });
    }
  }, [currentRoom, dispatch]);
  
  // Listener para propostas de comércio - dependências vazias para estabilidade
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    const handleTradeProposalReceived = (proposal) => {
      console.log('Trade proposal received:', proposal);
      // Adicionar som de notificação, se disponível
      if (window.Audio) {
        try {
          const notificationSound = new Audio('/notification.mp3');
          notificationSound.play();
        } catch (error) {
          console.error('Failed to play notification sound:', error);
        }
      }
      
      // REMOVER: A notificação toast agora é feita apenas no socketEventHandlers.js
      // para evitar duplicação
      
      setTradeProposal(proposal);
    };
    
    socket.on('tradeProposalReceived', handleTradeProposalReceived);
    
    return () => {
      socket.off('tradeProposalReceived', handleTradeProposalReceived);
    };
  }, []);
  
  // Função para fechar o popup de proposta comercial
  const handleCloseTradeProposal = () => {
    setTradeProposal(null);
  };
  
  // Função para abrir o popup de dívidas (callback do AdvancedEconomyPanel)
  const handleOpenDebtPopup = (debtSummary, debtRecords) => {
    setDebtPopupData({
      debtSummary,
      debtRecords
    });
    setShowDebtPopup(true);
  };
  
  // Função para fechar o popup de dívidas
  const handleCloseDebtPopup = () => {
    setShowDebtPopup(false);
    setDebtPopupData({
      debtSummary: null,
      debtRecords: null
    });
  };
  
  // Função para abrir o popup de cards (clique no timer)
  const handleOpenCardsPopup = () => {
    setShowCardsPopup(true);
  };
  
  // Função para fechar o popup de cards
  const handleCloseCardsPopup = () => {
    setShowCardsPopup(false);
  };

  // Obter países com jogadores humanos e seus nomes
  const getCountriesWithPlayers = () => {
    if (!players) return {};
    
    const countryPlayerMap = {};
    
    players.forEach(player => {
      let username = null;
      let country = null;
      
      if (typeof player === 'object') {
        username = player.username;
        country = player.country;
      } else if (typeof player === 'string') {
        const match = player.match(/^(.*?)\s*\((.*)\)$/);
        if (match) {
          username = match[1];
          country = match[2];
        }
      }
      
      if (username && country) {
        countryPlayerMap[country] = username;
      }
    });
    
    return countryPlayerMap;
  };
  
  // Obter lista completa de países para o popup
  const getAllCountries = () => {
    if (!countriesData) return [];
    
    const countryPlayerMap = getCountriesWithPlayers();
    
    return Object.keys(countriesData).map(countryName => ({
      name: countryName,
      hasPlayer: !!countryPlayerMap[countryName],
      playerName: countryPlayerMap[countryName] || null
    })).sort((a, b) => a.name.localeCompare(b.name));
  };
  
  // Função para fechar o popup
  const closeTimeupPopup = () => {
    setShowTimeupPopup(false);
  };
  
  const handleExitRoom = () => {
    dispatch({ type: 'socket/leaveRoom' });
    dispatch({ type: 'rooms/leaveRoom' });
  };

  const toggleSideview = () => {
    setSideviewActive(!sideviewActive);
  };

  const toggleSidetools = () => {
    setSidetoolsActive(!sidetoolsActive);
  };

  // Function to open sideview with specific tab
  const openSideviewWithTab = (tabName) => {
    setSideviewActive(true);
    setActiveTab(tabName);
  };

  useEffect(() => {
    const sideview = document.getElementById('sideview');
    const sidetools = document.getElementById('sidetools');
    
    if (sideview) {
      sideview.classList.toggle('active', sideviewActive);
    }
    
    if (sidetools) {
      sidetools.classList.toggle('active', sidetoolsActive);
    }

    const handleClickOutside = (event) => {
      // Verifica se está em modo mobile
      if (window.innerWidth <= 1200) {
        const sideview = document.getElementById('sideview');
        const sidetools = document.getElementById('sidetools');
        const btnOpenSideview = document.getElementById('btn-open-sideview');
        const btnOpenSidetools = document.getElementById('btn-open-sidetools');
        
        // Verifica se clicou fora da sideview e não no botão de abrir
        if (sideviewActive && 
            sideview && 
            !sideview.contains(event.target) && 
            btnOpenSideview && 
            !btnOpenSideview.contains(event.target)) {
          setSideviewActive(false);
        }
        
        // Verifica se clicou fora da sidetools e não no botão de abrir
        if (sidetoolsActive && 
            sidetools && 
            !sidetools.contains(event.target) && 
            btnOpenSidetools && 
            !btnOpenSidetools.contains(event.target)) {
          setSidetoolsActive(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sideviewActive, sidetoolsActive]);

  // useEffect de resize com dependências vazias para estabilidade
  useEffect(() => {
    const handleResize = () => {
      // Não feche os painéis se o chat está focado
      if (document.body.classList.contains('chat-input-focused')) {
        return;
      }
      
      if (document.body.classList.contains('bond-input-focused')) {
        return;
      }
      
      // Aplica a lógica normal apenas para mudanças reais de largura
      if (window.innerWidth <= 1200) {
        setSideviewActive(false);
        setSidetoolsActive(false);
      }
    };

    handleResize();
    
    // Debounce o resize para evitar múltiplas chamadas
    let resizeTimeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 150);
    };
    
    window.addEventListener('resize', debouncedResize);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  if (!dataLoaded) {
    return (
      <div id="game-screen" className="loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Carregando dados do jogo...</p>
        </div>
      </div>
    );
  }

  return (
    <PopupProvider>
      <div id="game-screen">
        {/* Timer no topo da tela */}
        {currentRoom && (
          <div className="room-timer">
            <div className="timer-content" onClick={handleOpenCardsPopup} style={{ cursor: 'pointer' }}>
              <span className={`timer-value ${timeRemaining <= roomData.duration * 0.2 ? 'timer-warning' : ''}`}>
                {formatTimeRemaining(timeRemaining)}
              </span>
              &nbsp;
              <span className="material-icons">style</span>
              <span className="cards-pts">
                {getMyCountryPoints()}<small>pts</small>
              </span>
            </div>
          </div>
        )}
        
        <div id="map-container">
          <MapView />
        </div>
        
        <button id="btn-open-sidetools" className="map-control" onClick={toggleSidetools}>
          <span className="material-icons">ads_click</span>
        </button>
        
        <button id="btn-open-sideview" className="map-control" onClick={toggleSideview}>
          <span className="material-icons">public</span>
        </button>
        
        {/* Add the ActionMenu component with needed props */}
        <ActionMenu 
          onOpenSideview={() => {
            setSideviewActive(true);
            // Directly set the activeTab in Sideview by finding and clicking the country tab
            setTimeout(() => {
              const countryTab = document.querySelector('#sideview .tabs .tab[data-tab="country"]');
              if (countryTab) {
                countryTab.click();
              }
            }, 100);
          }} 
          onSetActiveTab={(tab) => {
            // Find and click the tab directly
            const tabElement = document.querySelector(`#sideview .tabs .tab[data-tab="${tab}"]`);
            if (tabElement) {
              tabElement.click();
            }
          }}
        />
        
        <Sidetools 
          onClose={toggleSidetools} 
          isActive={sidetoolsActive}
          myCountry={myCountry}
          onOpenDebtPopup={handleOpenDebtPopup}
        />
        
        <Sideview 
          onExitRoom={handleExitRoom} 
          onClose={toggleSideview} 
          isActive={sideviewActive}
          activeTab={activeTab} // Pass activeTab to Sideview
          onTabChange={setActiveTab} // Allow Sideview to update our activeTab state
        />
        
        {/* Popup quando o tempo acaba */}
        {showTimeupPopup && (
          <div className="timeup-popup-overlay">
            <div className="timeup-popup">
              <div className="timeup-popup-header">
                <h2>Tempo Esgotado!</h2>
                {/* <button className="close-popup-btn" onClick={closeTimeupPopup}>×</button> */}
              </div>
              <div className="timeup-popup-content">
                <h3>Resultados da Partida</h3>
                <div className="countries-list">
                  {getAllCountries().map((country, index) => (
                    <div 
                      key={index} 
                      className={`country-item ${country.hasPlayer ? 'with-player' : 'without-player'}`}
                    >
                      <span className="country-name">{country.name}</span>
                      {country.hasPlayer && (
                        <span className="player-indicator" title={country.playerName}>
                          {country.playerName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="timeup-popup-footer">
                <button className="exit-room-btn" onClick={handleExitRoom}>
                  Sair da Partida
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Popup de proposta de comércio - agora gerenciado automaticamente */}
        <TradeProposalPopup 
          proposal={tradeProposal}
          isOpen={tradeProposal !== null}
          onClose={handleCloseTradeProposal}
        />
        
        {/* Popup de resumo de dívidas - agora gerenciado automaticamente */}
        <DebtSummaryPopup
          isOpen={showDebtPopup}
          onClose={handleCloseDebtPopup}
          debtSummary={debtPopupData.debtSummary}
          debtRecords={debtPopupData.debtRecords}
        />

        {/* Popup de cards - agora gerenciado automaticamente */}
        <CardsPopup
          isOpen={showCardsPopup}
          onClose={handleCloseCardsPopup}
        />
      </div>
    </PopupProvider>
  );
};

export default GamePage;