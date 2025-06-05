import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import ChatPanel from '../../modules/chat/ChatPanel';
import RankingPanel from '../../modules/ranking/RankingPanel';
import CountryDetails from '../../modules/country/CountryDetails';
import { setChatMode, markAsRead } from '../../modules/chat/chatState';
import './Sideview.css';

const Sideview = ({ onExitRoom, onClose, isActive }) => {
  const [activeTab, setActiveTab] = useState('chat');
  const dispatch = useDispatch();
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  const selectedCountry = useSelector(state => state.game.selectedCountry);
  const currentChatMode = useSelector(state => state.chat.currentChatMode);
  const unreadCount = useSelector(state => state.chat.unreadCount);
  
  // Mudar para a aba do país quando um país for selecionado
  useEffect(() => {
    if (selectedCountry) {
      setActiveTab('country');
    }
  }, [selectedCountry]);

  // Quando clicar na aba de chat, marca as mensagens como lidas para o modo atual
  const handleChatTabClick = () => {
    setActiveTab('chat');
    
    // Marca mensagens como lidas para o modo atual
    if (currentChatMode === 'public') {
      dispatch(markAsRead({ chatType: 'public' }));
    } else {
      dispatch(markAsRead({ chatType: 'private', target: currentChatMode }));
    }
  };

  // Verificar se há novas mensagens não lidas (CORRIGIDO)
  const hasUnreadMessages = () => {
    // Se estamos na aba de chat, não mostrar badge
    if (activeTab === 'chat') {
      return false;
    }
    
    // Verifica se há mensagens públicas não lidas
    if (unreadCount.public > 0) {
      return true;
    }
    
    // Verifica se há mensagens privadas não lidas
    if (unreadCount.private) {
      return Object.values(unreadCount.private).some(count => count > 0);
    }
    
    return false;
  };

  // Verifica se um usuário específico tem mensagens não lidas
  const hasUnreadMessagesFrom = (playerName) => {
    return unreadCount.private && unreadCount.private[playerName] > 0;
  };
  
  return (
    <div id="sideview" className={isActive ? 'active' : ''}>
      {/* Botão de recolher */}
      <button className="close-button" onClick={onClose}>
        <span className="material-icons">chevron_right</span>
      </button>
      
      <h2 className="sidebar-title">
        Politik404
      </h2>
      
      <div className="tabs">
        <div 
          className={`tab ${activeTab === 'country' ? 'active' : ''}`} 
          onClick={() => setActiveTab('country')}
          data-tab="country"
        >
          <span className="material-icons">map</span>
        </div>
        <div 
          className={`tab ${activeTab === 'ranking' ? 'active' : ''}`} 
          onClick={() => setActiveTab('ranking')}
          data-tab="ranking"
        >
          <span className="material-icons">leaderboard</span>
        </div>
        <div 
          className={`tab ${activeTab === 'chat' ? 'active' : ''}`} 
          onClick={handleChatTabClick}
          data-tab="chat"
        >
          <span className="material-icons">chat</span>
          {hasUnreadMessages() && (
            <span className="chat-badge" title="Novas mensagens">•</span>
          )}
        </div>
        <div 
          className={`tab ${activeTab === 'info' ? 'active' : ''}`} 
          onClick={() => setActiveTab('info')}
          data-tab="info"
        >
          <span className="material-icons">info</span>
        </div>
      </div>

      {/* Conteúdo das abas - cada um só aparece quando sua aba está ativa */}
      <div id="country" className={`tab-content ${activeTab === 'country' ? 'active' : ''}`}>
        <CountryDetails />
      </div>


      <div id="ranking" className={`tab-content ${activeTab === 'ranking' ? 'active' : ''}`}>
        <RankingPanel />
      </div>

      {activeTab === 'chat' && (
        <div id="chat" className="tab-content active">
          <ChatPanel hasUnreadMessagesFrom={hasUnreadMessagesFrom} />
        </div>
      )}

      <div id="info" className={`tab-content ${activeTab === 'info' ? 'active' : ''}`}>

        <div id="room-details">
          <p><strong>Nome da partida:</strong> <span id="room-name-display">{currentRoom?.name}</span></p>
          <p><strong>Criador:</strong> <span id="room-owner-display">{currentRoom?.owner}</span></p>
          <p><strong>Jogadores:</strong> <span id="room-players-count">{currentRoom?.playerCount}</span></p>
          <p><strong>Criada em:</strong> <span id="room-created-at">
            {currentRoom?.createdAt && new Date(currentRoom.createdAt).toLocaleString('pt-BR')}
          </span></p>
          <div className="room-info">
            <button id="exit-room-button" onClick={onExitRoom}>Sair da Partida</button>
          </div>
        </div>

        <h4>Objetivo:</h4>
        <p>
          O jogo possui 12 nações ativas que participam do confronto por influência global.
        </p>
        <ul>
          <li>1. Fazer o maior número de acordos econômicos e militares.</li>
          <li>2. Forçar rompimento de acordos de países concorrentes.</li>
          <li>3. Sobreviver enquanto líder da sua nação.</li>
        </ul>
      </div>
    </div>
  );
};

export default Sideview;