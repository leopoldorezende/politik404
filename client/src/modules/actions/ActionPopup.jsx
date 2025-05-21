import React from 'react';
import Popup from '../../ui/popup/Popup';
import TradePopup from './popups/TradePopup';
import AlliancePopup from './popups/AlliancePopup';

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
      return `Aliança Militar com ${selectedCountry}`;
    } else if (popupType === 'hybrid') {
      return `Guerra Híbrida contra ${selectedCountry}`;
    } else if (popupType === 'attack') {
      return `Ataque Militar contra ${selectedCountry}`;
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
      return (
        <AlliancePopup 
          selectedCountry={selectedCountry}
          onClose={onClose}
        />
      );
    }
    
    // Componentes futuros (guerra híbrida, ataques, etc.) seriam incluídos aqui
    
    return <div>Componente para {popupType} ainda não implementado</div>;
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