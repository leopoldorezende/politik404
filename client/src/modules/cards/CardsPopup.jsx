import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Popup from '../../ui/popup/Popup';
import { useCards } from '../../hooks/useCards';
import { socketApi } from '../../services/socketClient';
import './CardsPopup.css';

/**
 * Popup simplificado de cards - Lista simples com filtro por tipo
 * CORREÇÃO: Adicionado escuta de eventos socket para atualização em tempo real
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

  // ========================================================================
  // ✅ CORREÇÃO: ESCUTA DE EVENTOS SOCKET UNIFICADOS EM TEMPO REAL
  // ========================================================================
  useEffect(() => {
    // Só escutar eventos quando o popup estiver aberto
    if (!isOpen || !currentRoom?.name || !myCountry) return;

    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    console.log('[CARDS POPUP] Configurando listeners de tempo real');

    // Handler para atualizações de cards
    const handleCardsUpdated = (data) => {
      console.log('[CARDS POPUP] Cards updated event received:', data);
      
      if (data.roomName === currentRoom.name) {
        console.log('[CARDS POPUP] Refreshing cards due to real-time update');
        setTimeout(() => {
          refreshAll();
        }, 100);
      }
    };
    
    // Handler unificado para cancelamento de acordos
    const handleAgreementCancelled = (data) => {
      console.log('[CARDS POPUP] Unified agreement cancelled event received:', data);
      
      if (data.roomName === currentRoom.name) {
        setTimeout(() => {
          refreshAll();
        }, 100);
      }
    };

    // Handler genérico para qualquer mudança de acordo/card
    const handleAgreementChange = () => {
      console.log('[CARDS POPUP] Generic agreement change detected');
      
      setTimeout(() => {
        refreshAll();
      }, 100);
    };

    // Registrar apenas os listeners unificados relevantes
    socket.on('cardsUpdated', handleCardsUpdated);
    socket.on('agreementCancelled', handleAgreementCancelled); // ✅ Listener unificado de cancelamento
    socket.on('agreementProposalProcessed', handleAgreementChange);

    // Cleanup: remover listeners quando popup fechar ou componente desmontar
    return () => {
      console.log('[CARDS POPUP] Removendo listeners de tempo real');
      
      socket.off('cardsUpdated', handleCardsUpdated);
      socket.off('agreementCancelled', handleAgreementCancelled);
      socket.off('agreementProposalProcessed', handleAgreementChange);
    };
  }, [isOpen, currentRoom?.name, myCountry, refreshAll]);

  // ========================================================================
  // ✅ CORREÇÃO: UNIFICAR A LÓGICA DE CANCELAMENTO DE CARDS
  // ========================================================================
  const handleRemoveCard = (card) => {
    if (!socketApi || !card.sourceAgreementId) {
      console.error('Dados insuficientes para cancelar o card.');
      MessageService.showError('Não foi possível cancelar o card. Falta o ID do acordo.');
      return;
    }

    // Usar o ID do acordo como identificador
    const agreementId = card.sourceAgreementId;
    const agreementType = card.type;

    if (window.confirm(`Tem certeza que deseja cancelar o acordo de ${agreementType}?`)) {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        // Emitir o evento de cancelamento unificado
        console.log(`Emitindo evento de cancelamento unificado para o acordo ${agreementId} do tipo ${agreementType}`);
        socket.emit('cancelAgreement', { agreementId, agreementType });

        // Refresh imediato após o cancelamento
        setTimeout(() => {
          refreshAll();
        }, 200);
      }
    }
  };

  // Definir grupos de cards - REORGANIZADO E UNIFICADO
  const cardGroups = {
    'acordos-comerciais': {
      label: 'Acordos Comerciais',
      types: ['trade-import', 'trade-export']
    },
    'acordos-internos': {
      label: 'Acordos Internos',
      types: ['political-pact', 'business-partnership', 'media-control']
    },
    'acordos-defesa': {
      label: 'Acordos de Defesa',
      types: ['strategic-cooperation', 'military-alliance']
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
  
  // Função para obter cor do card - UNIFICADA
  const getCardColor = (cardType) => {
    const colors = {
      'trade-export': '#27ae60',
      'trade-import': '#3498db',
      'political-pact': '#9b59b6',
      'business-partnership': '#f39c12',
      'media-control': '#e74c3c',
      'strategic-cooperation': '#16a085',
      'military-alliance': '#00bcd4'
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
                            {(card.sourceAgreementId || card.type === 'military-alliance') && (
                              <button 
                                className="card-remove-btn"
                                onClick={() => handleRemoveCard(card)}
                                title={
                                  card.type === 'military-alliance' 
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