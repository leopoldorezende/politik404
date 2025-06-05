import React from 'react';
import Popup from '../../ui/popup/Popup';
import TradePopup from './popups/TradePopup';
import AlliancePopup from './popups/AlliancePopup';
import CooperationPopup from './popups/CooperationPopup';

/**
 * Componente wrapper para determinar qual popup mostrar com base no tipo
 */
const ActionPopup = ({ 
  isOpen, 
  onClose, 
  popupType, 
  actionType, 
  selectedCountry, 
  myCountry, 
  isCountryControlledByPlayer,
  redirectToTradePanel 
}) => {
  
  /**
   * Obtém o título do popup com base no tipo e ação
   */
  const getTitle = () => {
    if (popupType === 'trade') {
      return actionType === 'export' 
        ? `Exportar para ${selectedCountry}` 
        : `Importar de ${selectedCountry}`;
    } else if (popupType === 'alliance') {
      return actionType === 'military' 
        ? `Aliança Militar com ${selectedCountry}`
        : `Cooperação Estratégica com ${selectedCountry}`;
    } else if (popupType === 'attack') {
      if (actionType === 'interference') {
        return `Ingerência contra ${selectedCountry}`;
      } else if (actionType === 'military') {
        return `Ataque Militar contra ${selectedCountry}`;
      }
      return `Operação Militar contra ${selectedCountry}`;
    }
    return 'Ação';
  };
  
  /**
   * Renderiza o conteúdo correto com base no tipo de popup
   */
  const renderContent = () => {
    if (popupType === 'trade') {
      return (
        <TradePopup
          tradeType={actionType}
          selectedCountry={selectedCountry}
          myCountry={myCountry}
          isControlledByPlayer={isCountryControlledByPlayer}
          onClose={onClose}
          redirectToTradePanel={redirectToTradePanel}
        />
      );
    } else if (popupType === 'alliance') {
      if (actionType === 'military') {
        return (
          <AlliancePopup 
            selectedCountry={selectedCountry}
            onClose={onClose}
          />
        );
      } else if (actionType === 'cooperation') {
        return (
          <CooperationPopup 
            selectedCountry={selectedCountry}
            onClose={onClose}
          />
        );
      }
    } else if (popupType === 'attack') {
      // NOVO: Componentes para operações militares
      if (actionType === 'interference') {
        return (
          <div className="popup-info">
            <h4>Operação de Ingerência</h4>
            <p>
              Realizar operação de ingerência política contra <strong>{selectedCountry}</strong>.
            </p>
            <ul className="popup-info-list">
              <li>Pode desestabilizar o governo adversário</li>
              <li>Reduz a aprovação popular do país alvo</li>
              <li>Pode causar retaliações diplomáticas</li>
              <li>Operação encoberta com chance de descoberta</li>
            </ul>
            <div className="popup-actions">
              <button onClick={() => {
                alert('Operação de ingerência ainda não implementada');
                onClose();
              }}>
                Executar Ingerência
              </button>
            </div>
          </div>
        );
      } else if (actionType === 'military') {
        return (
          <div className="popup-info">
            <h4>Ataque Militar</h4>
            <p>
              Declarar guerra e atacar militarmente <strong>{selectedCountry}</strong>.
            </p>
            <ul className="popup-info-list">
              <li>
                <strong>Consequências graves:</strong> Pode resultar em destruição mútua
              </li>
              <li>Afeta drasticamente a economia de ambos os países</li>
              <li>Pode quebrar acordos comerciais existentes</li>
              <li>Outros países podem se envolver no conflito</li>
            </ul>
            <div className="popup-actions">
              <button 
                onClick={() => {
                  if (window.confirm(`Tem certeza que deseja declarar guerra contra ${selectedCountry}? Esta ação não pode ser desfeita e terá consequências graves!`)) {
                    alert('Sistema de guerra ainda não implementado');
                  }
                  onClose();
                }}
                style={{ backgroundColor: '#e74c3c' }}
              >
                Declarar Guerra
              </button>
            </div>
          </div>
        );
      }
    }
    
    // Fallback para componentes não implementados
    return (
      <div className="popup-info">
        <h4>Funcionalidade em Desenvolvimento</h4>
        <p>
          A funcionalidade <strong>{popupType}</strong> (ação: <strong>{actionType}</strong>) 
          está sendo desenvolvida e será disponibilizada em breve.
        </p>
        <div className="popup-actions">
          <button onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
    >
      {renderContent()}
    </Popup>
  );
};

export default ActionPopup;