import React from 'react';
import './ActionMenuPopup.css';

/**
 * Componente de Popup reutilizável para o ActionMenu
 * @param {Object} props - Propriedades do componente
 * @param {boolean} props.isOpen - Define se o popup está aberto ou fechado
 * @param {function} props.onClose - Função chamada ao fechar o popup
 * @param {string} props.title - Título do popup
 * @param {React.ReactNode} props.children - Conteúdo do popup
 * @returns {React.ReactElement} - O componente de Popup
 */
const ActionMenuPopup = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  // Impede que cliques dentro do popup fechem o popup
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="action-menu-popup-overlay" onClick={onClose}>
      <div className="action-menu-popup-content" onClick={handleContentClick}>
        <div className="action-menu-popup-header">
          <h3>{title}</h3>
          <button className="action-menu-popup-close" onClick={onClose}>×</button>
        </div>
        <div className="action-menu-popup-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ActionMenuPopup;