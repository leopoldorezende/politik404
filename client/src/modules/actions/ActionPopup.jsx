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
    } else if (popupType === 'hybrid') {
      if (actionType === 'interference') {
        return `Ingerência contra ${selectedCountry}`;
      } else if (actionType === 'disinformation') {
        return `Campanha de Desinformação contra ${selectedCountry}`;
      }
      return `Guerra Híbrida contra ${selectedCountry}`;
    } else if (popupType === 'attack') {
      if (actionType === 'sabotage') {
        return `Sabotagem contra ${selectedCountry}`;
      } else if (actionType === 'military') {
        return `Ataque Bélico contra ${selectedCountry}`;
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
    }
    
    // Componentes futuros (guerra híbrida, ataques, etc.) seriam incluídos aqui
    
    return <div>Componente para {popupType} (ação: {actionType}) ainda não implementado</div>;
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