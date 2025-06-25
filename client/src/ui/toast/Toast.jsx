import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import './Toast.css';

/**
 * Componente de Toast (Toast) genérico reutilizável em todo o sistema
 * @param {Object} props - Propriedades do componente
 * @param {string} props.className - Classes CSS adicionais para personalização
 * @returns {React.ReactElement} - O componente de Toast
 */
const Toast = forwardRef((props, ref) => {
  const [messages, setMessages] = useState([]);
  const [, forceUpdate] = useState({});

  // Expor métodos para componentes que usam a ref
  useImperativeHandle(ref, () => ({
    show: (message, type = 'info', duration = 3000) => {
      // Garantir um ID único com timestamp + valor aleatório
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newMessage = { id, text: message, type, duration };
      
      setMessages(prev => [...prev, newMessage]);
      
      // Configurar auto-remoção após a duração especificada
      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
      
      return id;
    },
    dismiss: (id) => {
      dismiss(id);
    },
    dismissAll: () => {
      setMessages([]);
    }
  }));

  // Remover mensagem específica por ID
  const dismiss = (id) => {
    setMessages(prev => prev.filter(message => message.id !== id));
  };

  // Lidar com transições de animação
  useEffect(() => {
    // Forçar atualização para garantir que animações sejam ativadas
    const timer = setTimeout(() => forceUpdate({}), 10);
    return () => clearTimeout(timer);
  }, [messages]);

  // Renderizar mensagens vazias se não houver nenhuma
  if (messages.length === 0) return null;

  return (
    <div className={`toast-container ${props.className || ''}`}>
      {messages.map((message, index) => (
        <div
          key={`${message.id}-${index}`}
          className={`toast toast-${message.type} toast-show`}
          onClick={() => dismiss(message.id)}
        >
          <div className="toast-content">
            <div className="toast-icon">
              {message.type === 'success' && <span className="material-icons">check_circle</span>}
              {message.type === 'error' && <span className="material-icons">error</span>}
              {message.type === 'warning' && <span className="material-icons">warning</span>}
              {message.type === 'info' && <span className="material-icons">info</span>}
            </div>
            <div className="toast-text">{message.text}</div>
            <button className="toast-close" onClick={() => dismiss(message.id)}>
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});

export default Toast;