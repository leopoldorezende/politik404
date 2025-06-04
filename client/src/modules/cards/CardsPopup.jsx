import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Popup from '../../ui/popup/Popup';
import { useCards } from '../../hooks/useCards';
import { setCardFilter, resetCardFilters, CARD_TYPES } from './cardState';
import './CardsPopup.css';

/**
 * Popup central de cards - Mostra todos os cards do jogador
 */
const CardsPopup = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  
  // Estados do Redux
  const myCountry = useSelector(state => state.game?.myCountry);
  const currentRoom = useSelector(state => state.rooms?.currentRoom);
  const filters = useSelector(state => state.cards.filters);
  
  // Hook dos cards
  const {
    playerCards,
    cardStats,
    playerPoints,
    playerRanking,
    loading,
    lastUpdated,
    refreshAll,
    formatCardForDisplay,
    getRankingPosition,
    CARD_TYPES: cardTypes,
    getCardTypeLabel,
    getCardTypePoints
  } = useCards(currentRoom?.name, myCountry);
  
  // Estados locais
  const [activeTab, setActiveTab] = useState('cards');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Auto-refresh quando o popup é aberto
  useEffect(() => {
    if (isOpen && currentRoom?.name && myCountry) {
      refreshAll();
    }
  }, [isOpen, currentRoom?.name, myCountry, refreshAll]);
  
  // ========================================================================
  // HANDLERS
  // ========================================================================
  
  const handleFilterChange = (filterType, value) => {
    dispatch(setCardFilter({ filterType, value }));
  };
  
  const handleResetFilters = () => {
    dispatch(resetCardFilters());
    setSearchTerm('');
  };
  
  const handleRefresh = () => {
    refreshAll();
  };
  
  // ========================================================================
  // FUNÇÕES DE FORMATAÇÃO
  // ========================================================================
  
  const getFilteredCards = () => {
    let filtered = playerCards;
    
    // Filtrar por termo de busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(card => 
        getCardTypeLabel(card.type).toLowerCase().includes(term) ||
        card.target?.toLowerCase().includes(term) ||
        card.metadata?.product?.toLowerCase().includes(term)
      );
    }
    
    return filtered.map(formatCardForDisplay);
  };
  
  const getCardIcon = (cardType) => {
    const icons = {
      export: 'trending_up',
      import: 'trending_down',
      political_pact: 'gavel',
      business_partnership: 'corporate_fare',
      media_control: 'connected_tv',
      strategic_cooperation: 'handshake',
      military_alliance: 'security'
    };
    
    return icons[cardType] || 'star';
  };
  
  const getCardColor = (cardType) => {
    const colors = {
      export: '#27ae60',
      import: '#3498db',
      political_pact: '#9b59b6',
      business_partnership: '#f39c12',
      media_control: '#e74c3c',
      strategic_cooperation: '#16a085',
      military_alliance: '#e67e22'
    };
    
    return colors[cardType] || '#95a5a6';
  };
  
  const getStatusColor = (status) => {
    const colors = {
      active: '#27ae60',
      cancelled: '#e74c3c',
      completed: '#3498db',
      transferred: '#f39c12'
    };
    
    return colors[status] || '#95a5a6';
  };
  
  // ========================================================================
  // COMPONENTES DE RENDERIZAÇÃO
  // ========================================================================
  
  const renderFilters = () => (
    <div className="cards-filters">
      <div className="filter-row">
        <div className="filter-group">
          <label>Tipo:</label>
          <select
            value={filters.cardType}
            onChange={(e) => handleFilterChange('cardType', e.target.value)}
          >
            <option value="all">Todos</option>
            {Object.values(cardTypes).map(type => (
              <option key={type.name} value={type.name}>
                {type.label} ({type.points}pts)
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="active">Ativos</option>
            <option value="all">Todos</option>
            <option value="cancelled">Cancelados</option>
            <option value="transferred">Transferidos</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Ordenar:</label>
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
          >
            <option value="timestamp">Mais recentes</option>
            <option value="points">Maior pontuação</option>
            <option value="value">Maior valor</option>
            <option value="type">Tipo</option>
          </select>
        </div>
      </div>
      
      <div className="filter-row">
        <div className="search-group">
          <input
            type="text"
            placeholder="Buscar cards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-actions">
          <button onClick={handleResetFilters} className="btn-reset">
            Limpar Filtros
          </button>
          <button onClick={handleRefresh} className="btn-refresh" disabled={loading.playerCards}>
            <span className="material-icons">refresh</span>
            {loading.playerCards ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>
    </div>
  );
  
  const renderCardsList = () => {
    const filteredCards = getFilteredCards();
    
    if (loading.playerCards) {
      return (
        <div className="cards-loading">
          <span className="material-icons spinning">refresh</span>
          <p>Carregando cards...</p>
        </div>
      );
    }
    
    if (filteredCards.length === 0) {
      return (
        <div className="cards-empty">
          <span className="material-icons">style</span>
          <h3>Nenhum card encontrado</h3>
          <p>
            {playerCards.length === 0 
              ? 'Você ainda não possui cards. Faça acordos para começar a pontuar!'
              : 'Nenhum card corresponde aos filtros selecionados.'
            }
          </p>
        </div>
      );
    }
    
    return (
      <div className="cards-list">
        {filteredCards.map(card => (
          <div 
            key={card.id} 
            className={`card-item ${card.status}`}
            style={{ '--card-color': getCardColor(card.type) }}
          >
            <div className="card-header">
              <div className="card-type">
                <span 
                  className="material-icons card-icon"
                  style={{ color: getCardColor(card.type) }}
                >
                  {getCardIcon(card.type)}
                </span>
                <span className="card-type-label">{card.typeLabel}</span>
              </div>
              
              <div className="card-points">
                <span className="points-value">{card.points}</span>
                <span className="points-label">pt{card.points !== 1 ? 's' : ''}</span>
              </div>
            </div>
            
            <div className="card-content">
              {card.target && (
                <div className="card-detail">
                  <span className="detail-label">País:</span>
                  <span className="detail-value">{card.target}</span>
                </div>
              )}
              
              {card.value > 0 && (
                <div className="card-detail">
                  <span className="detail-label">Valor:</span>
                  <span className="detail-value">{card.valueLabel}</span>
                </div>
              )}
              
              {card.metadata?.product && (
                <div className="card-detail">
                  <span className="detail-label">Produto:</span>
                  <span className="detail-value">
                    {card.metadata.product === 'commodity' ? 'Commodities' : 'Manufaturas'}
                  </span>
                </div>
              )}
              
              <div className="card-detail">
                <span className="detail-label">Status:</span>
                <span 
                  className="detail-value status-badge"
                  style={{ color: getStatusColor(card.status) }}
                >
                  {card.statusLabel}
                </span>
              </div>
              
              <div className="card-detail">
                <span className="detail-label">Criado:</span>
                <span className="detail-value">{card.timestampLabel}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  const renderStats = () => (
    <div className="cards-stats">
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">Total de Cards</span>
          <span className="stat-value">{cardStats.total}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">Cards Ativos</span>
          <span className="stat-value">{cardStats.active}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">Pontuação Total</span>
          <span className="stat-value">{cardStats.totalPoints}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">Valor Total</span>
          <span className="stat-value">{cardStats.totalValue.toFixed(1)} bi</span>
        </div>
      </div>
      
      {Object.keys(cardStats.byType).length > 0 && (
        <div className="stats-by-type">
          <h4>Cards por Tipo</h4>
          <div className="type-stats">
            {Object.entries(cardStats.byType).map(([type, stats]) => (
              <div key={type} className="type-stat-item">
                <div className="type-header">
                  <span 
                    className="material-icons"
                    style={{ color: getCardColor(type) }}
                  >
                    {getCardIcon(type)}
                  </span>
                  <span className="type-name">{getCardTypeLabel(type)}</span>
                </div>
                <div className="type-numbers">
                  <span className="type-count">{stats.count} cards</span>
                  <span className="type-points">{stats.points} pts</span>
                  {stats.value > 0 && (
                    <span className="type-value">{stats.value.toFixed(1)} bi</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
  
  const renderRanking = () => {
    if (loading.playerRanking) {
      return (
        <div className="ranking-loading">
          <span className="material-icons spinning">refresh</span>
          <p>Carregando ranking...</p>
        </div>
      );
    }
    
    if (playerRanking.length === 0) {
      return (
        <div className="ranking-empty">
          <span className="material-icons">leaderboard</span>
          <p>Nenhum dado de ranking disponível.</p>
        </div>
      );
    }
    
    const myPosition = getRankingPosition();
    
    return (
      <div className="ranking-content">
        {myPosition && (
          <div className="my-position">
            <h4>Sua Posição</h4>
            <div className="position-card">
              <span className="position-number">#{myPosition}</span>
              <span className="position-points">{playerPoints.total} pontos</span>
            </div>
          </div>
        )}
        
        <div className="ranking-list">
          <h4>Ranking Geral</h4>
          {playerRanking.map(player => (
            <div 
              key={player.owner} 
              className={`ranking-item ${player.owner === myCountry ? 'my-rank' : ''}`}
            >
              <div className="rank-position">#{player.position}</div>
              
              <div className="rank-info">
                <div className="rank-country">{player.owner}</div>
                <div className="rank-details">
                  {player.isHuman && player.playerName && (
                    <span className="rank-player">Jogador: {player.playerName}</span>
                  )}
                  {!player.isHuman && (
                    <span className="rank-ai">Controlado pela IA</span>
                  )}
                  <span className={`rank-status ${player.isOnline ? 'online' : 'offline'}`}>
                    {player.statusLabel}
                  </span>
                </div>
              </div>
              
              <div className="rank-points">
                <span className="points-total">{player.totalPoints}</span>
                <span className="points-label">pts</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const renderLastUpdated = () => {
    if (!lastUpdated.playerCards) return null;
    
    const updateTime = new Date(lastUpdated.playerCards).toLocaleTimeString('pt-BR');
    
    return (
      <div className="last-updated">
        Última atualização: {updateTime}
      </div>
    );
  };
  
  // ========================================================================
  // RENDER PRINCIPAL
  // ========================================================================
  
  if (!myCountry) {
    return (
      <Popup
        isOpen={isOpen}
        onClose={onClose}
        title="Central de Cards"
        size="large"
      >
        <div className="cards-popup-content">
          <div className="cards-empty">
            <span className="material-icons">person_off</span>
            <p>Você precisa estar controlando um país para ver seus cards.</p>
          </div>
        </div>
      </Popup>
    );
  }
  
  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      title="Central de Cards"
      size="large"
      className="cards-popup"
    >
      <div className="cards-popup-content">
        {/* Header com pontuação */}
        <div className="cards-header">
          <div className="player-info">
            <h3>{myCountry}</h3>
            <div className="player-points">
              <span className="points-total">{playerPoints.total}</span>
              <span className="points-label">pontos</span>
            </div>
          </div>
          
          {renderLastUpdated()}
        </div>
        
        {/* Tabs */}
        <div className="cards-tabs">
          <button 
            className={`tab ${activeTab === 'cards' ? 'active' : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            <span className="material-icons">style</span>
            Meus Cards ({cardStats.total})
          </button>
          
          <button 
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <span className="material-icons">analytics</span>
            Estatísticas
          </button>
          
          <button 
            className={`tab ${activeTab === 'ranking' ? 'active' : ''}`}
            onClick={() => setActiveTab('ranking')}
          >
            <span className="material-icons">leaderboard</span>
            Ranking
          </button>
        </div>
        
        {/* Conteúdo das tabs */}
        <div className="cards-content">
          {activeTab === 'cards' && (
            <>
              {renderFilters()}
              {renderCardsList()}
            </>
          )}
          
          {activeTab === 'stats' && renderStats()}
          
          {activeTab === 'ranking' && renderRanking()}
        </div>
      </div>
    </Popup>
  );
};

export default CardsPopup;