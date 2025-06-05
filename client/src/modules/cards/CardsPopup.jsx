import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Popup from '../../ui/popup/Popup';
import { useCards } from '../../hooks/useCards';
import { socketApi } from '../../services/socketClient';
import './CardsPopup.css';

/**
 * Popup simplificado de cards - Lista simples com filtro por tipo
 */
const CardsPopup = ({ isOpen, onClose, initialFilter = 'todos' }) => {
  // Estados do Redux
  const myCountry = useSelector(state => state.game?.myCountry);
  const currentRoom = useSelector(state => state.rooms?.currentRoom);
  
  // Hook dos cards
  const {
    allPlayerCards,
    playerPoints,
    loading,
    refreshAll,
    formatCardForDisplay,
    getCardTypeLabel
  } = useCards(currentRoom?.name, myCountry);
  
  // Estados locais
  const [selectedGroup, setSelectedGroup] = useState(initialFilter);
  
  // Auto-refresh quando o popup é aberto
  useEffect(() => {
    if (isOpen && currentRoom?.name && myCountry) {
      refreshAll();
    }
  }, [isOpen, currentRoom?.name, myCountry, refreshAll]);
  
  // Aplicar filtro inicial quando o popup abrir
  useEffect(() => {
    if (isOpen && initialFilter) {
      setSelectedGroup(initialFilter);
    }
  }, [isOpen, initialFilter]);

  const handleRemoveCard = (card) => {
      if (card.type === 'military_alliance') {
        // Lógica especial para alianças militares
        if (window.confirm(`Tem certeza que deseja cancelar a aliança militar com ${card.target}? Esta ação encerrará o acordo militar entre os países e você precisará aguardar 1 minuto antes de propor uma nova aliança.`)) {
          const socket = socketApi.getSocketInstance();
          if (socket) {
            // Cancelar aliança militar via card ID
            socket.emit('cancelMilitaryAlliance', card.id);
          }
        }
      } else if (card.type === 'export' || card.type === 'import') {
        // Lógica para acordos comerciais
        if (window.confirm(`Tem certeza que deseja remover este card e cancelar o acordo comercial?`)) {
          const socket = socketApi.getSocketInstance();
          if (socket && card.sourceAgreementId) {
            // Cancelar o acordo comercial que gerou este card
            socket.emit('cancelTradeAgreement', card.sourceAgreementId);
          }
        }
      } else {
        // Outros tipos de cards
        if (window.confirm(`Tem certeza que deseja remover este card?`)) {
          const socket = socketApi.getSocketInstance();
          if (socket) {
            socket.emit('cancelCard', card.id);
          }
        }
      }
    };

  // Definir grupos de cards - REORGANIZADO conforme solicitado
  const cardGroups = {
    'acordos-comerciais': {
      label: 'Acordos Comerciais',
      types: ['import', 'export']
    },
    'acordos-internos': {
      label: 'Acordos Internos',
      types: ['political_pact', 'business_partnership', 'media_control']
    },
    'acordos-defesa': {
      label: 'Acordos de Defesa',
      types: ['strategic_cooperation', 'military_alliance'] // ingerência ainda não implementado
    }
  };
  
  // Função para agrupar cards por tipo
  const getGroupedCards = () => {
    const formattedCards = allPlayerCards.map(formatCardForDisplay);
    const grouped = {};
    
    Object.entries(cardGroups).forEach(([groupKey, groupConfig]) => {
      grouped[groupKey] = formattedCards.filter(card => 
        groupConfig.types.includes(card.type)
      );
    });
    
    return grouped;
  };
  
  // Função para filtrar cards por grupo selecionado
  const getFilteredGroups = () => {
    const groupedCards = getGroupedCards();
    
    if (selectedGroup === 'todos') {
      // Para "todos", filtrar apenas grupos que têm cards
      const filteredGroups = {};
      Object.entries(groupedCards).forEach(([groupKey, cards]) => {
        if (cards.length > 0) {
          filteredGroups[groupKey] = cards;
        }
      });
      return filteredGroups;
    }
    
    return {
      [selectedGroup]: groupedCards[selectedGroup] || []
    };
  };
  
  // Função para obter cor do card`
  const getCardColor = (cardType) => {
    const colors = {
      export: '#27ae60',
      import: '#3498db',
      political_pact: '#9b59b6',
      business_partnership: '#f39c12',
      media_control: '#e74c3c',
      strategic_cooperation: '#16a085',
      military_alliance: '#00bcd4' // ✅ CIANO conforme solicitado
    };
    
    return colors[cardType] || '#95a5a6';
  };
  
  if (!myCountry) {
    return (
      <Popup
        isOpen={isOpen}
        onClose={onClose}
        title="Central de Cards"
        size="large"
      >
        <div className="cards-popup-simple">
          <div className="cards-empty">
            <span className="material-icons">person_off</span>
            <p>Você precisa estar controlando um país para ver seus cards.</p>
          </div>
        </div>
      </Popup>
    );
  }
  
  const filteredGroups = getFilteredGroups();
  const totalCards = allPlayerCards.length;
  const filteredCardsCount = selectedGroup === 'todos' 
    ? totalCards
    : Object.values(filteredGroups).reduce((sum, cards) => sum + cards.length, 0);
  
  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      title={`${myCountry} - ${playerPoints.total} pontos`}
      size="large"
      className="cards-popup"
    >
      <div className="cards-popup-simple">
        {/* Filtro simples */}
        <div className="simple-filter">
          <label>Mostrar:</label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="todos">Todos</option>
            {Object.entries(cardGroups).map(([groupKey, groupConfig]) => {
              const groupCards = getGroupedCards()[groupKey] || [];
              return (
                <option key={groupKey} value={groupKey}>
                  {groupConfig.label} ({groupCards.length})
                </option>
              );
            })}
          </select>
        </div>
        
        {/* Lista de cards agrupados */}
        <div className="cards-content">
          {loading.playerCards ? (
            <div className="cards-loading">
              <span className="material-icons spinning">refresh</span>
              <p>Carregando cards...</p>
            </div>
         ) : totalCards === 0 ? (
            <div className="cards-empty">
              <span className="material-icons">style</span>
              <p>Você ainda não possui cards. Faça acordos para começar a pontuar!</p>
            </div>
          ) : selectedGroup !== 'todos' && Object.values(filteredGroups).every(cards => cards.length === 0) ? (
            <div className="cards-empty">
              <span className="material-icons">style</span>
              <p>Você ainda não possui cards de {cardGroups[selectedGroup]?.label || 'categoria selecionada'}.</p>
            </div>
          ) : (
            Object.entries(filteredGroups).map(([groupKey, groupCards]) => {
              if (groupCards.length === 0) return null;
              
              const groupConfig = cardGroups[groupKey];
              
              return (
                <div key={groupKey} className="card-group">
                  <div className="group-header">
                    <h3>{groupConfig.label}</h3>
                  </div>
                  
                  <div className="cards-grid">
                    {groupCards.map(card => (
                      <div 
                        key={card.id} 
                        className="card-item-simple"
                        style={{ '--card-color': getCardColor(card.type) }}
                      >
                        <div 
                          className="card-header"
                        >
                          {getCardTypeLabel(card.type)}
                        </div>

                        <div className="card-body">
                          <div className="card-points">
                            {card.points}pt{card.points !== 1 ? 's' : ''}
                          </div>
                          
                          
                          <div className="card-info">

                            <div className="card-target">{card.target || 'N/A'}</div>
                            {card.value > 0 && (
                              <div className="card-value">{card.value} bi</div>
                            )}
                            {card.metadata?.product && (
                              <div className="card-product">
                                {card.metadata.product === 'commodity' ? 'Commodities' : 'Manufaturas'}
                              </div>
                            )}
                          </div>
                          
                          <div className="card-actions">
                            {(card.sourceAgreementId || card.type === 'military_alliance') && (
                              <button 
                                className="card-remove-btn"
                                onClick={() => handleRemoveCard(card)}
                                title={
                                  card.type === 'military_alliance' 
                                    ? "Cancelar aliança militar" 
                                    : "Remover card e cancelar acordo"
                                }
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Popup>
  );
};

export default CardsPopup;