import React from 'react';
import './Popup.css';

/**
 * Componente de Popup genérico reutilizável em todo o sistema
 * @param {Object} props - Propriedades do componente
 * @param {boolean} props.isOpen - Define se o popup está aberto ou fechado
 * @param {function} props.onClose - Função chamada ao fechar o popup
 * @param {string} props.title - Título do popup
 * @param {React.ReactNode} props.children - Conteúdo do popup
 * @param {string} props.size - Tamanho do popup ('small', 'medium', 'large')
 * @param {string} props.className - Classes CSS adicionais para personalização
 * @returns {React.ReactElement} - O componente de Popup
 */
const Popup = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'medium',
  className = ''
}) => {
  if (!isOpen) return null;

  // Impede que cliques dentro do popup fechem o popup
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  // Classes de tamanho
  const sizeClass = size ? `popup-${size}` : '';

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className={`popup-content ${sizeClass} ${className}`} onClick={handleContentClick}>
        <div className="popup-header">
          <h3>{title}</h3>
          <button className="popup-close" onClick={onClose}>×</button>
        </div>
        <div className="popup-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Popup;