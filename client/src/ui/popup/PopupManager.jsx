import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// Context para gerenciar o stack de popups
const PopupContext = createContext();

export const usePopupStack = () => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopupStack must be used within PopupProvider');
  }
  return context;
};

// Provider que gerencia o stack automático
export const PopupProvider = ({ children }) => {
  const [popupStack, setPopupStack] = useState([]);
  const nextZIndexRef = useRef(1000); // ✅ CORREÇÃO: Usar useRef em vez de useState

  // Registra uma nova popup no stack
  const registerPopup = useCallback((popupId) => {
    setPopupStack(prev => {
      // Se já existe, não adiciona novamente
      if (prev.some(p => p.id === popupId)) {
        return prev;
      }
      
      const newZIndex = nextZIndexRef.current; // ✅ CORREÇÃO: Usar ref em vez de state
      nextZIndexRef.current += 10; // ✅ CORREÇÃO: Atualizar ref diretamente
      
      return [...prev, { id: popupId, zIndex: newZIndex }];
    });
  }, []); // ✅ CORREÇÃO: Remover nextZIndex das dependências

  // Remove popup do stack
  const unregisterPopup = useCallback((popupId) => {
    setPopupStack(prev => prev.filter(p => p.id !== popupId));
  }, []);

  // Obtém o z-index para uma popup específica
  const getZIndex = useCallback((popupId) => {
    const popup = popupStack.find(p => p.id === popupId);
    return popup ? popup.zIndex : 1000;
  }, [popupStack]);

  // Verifica se é a popup do topo
  const isTopPopup = useCallback((popupId) => {
    if (popupStack.length === 0) return true;
    const topPopup = popupStack[popupStack.length - 1];
    return topPopup.id === popupId;
  }, [popupStack]);

  const value = {
    registerPopup,
    unregisterPopup,
    getZIndex,
    isTopPopup,
    stackSize: popupStack.length
  };

  return (
    <PopupContext.Provider value={value}>
      {children}
    </PopupContext.Provider>
  );
};

// Hook melhorado para popups individuais
export const usePopup = (isOpen, onClose) => {
  const { registerPopup, unregisterPopup, getZIndex, isTopPopup } = usePopupStack();
  const popupIdRef = useRef(`popup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const popupId = popupIdRef.current;

  useEffect(() => {
    if (isOpen) {
      registerPopup(popupId);
    } else {
      unregisterPopup(popupId);
    }

    return () => {
      unregisterPopup(popupId);
    };
  }, [isOpen, popupId, registerPopup, unregisterPopup]);

  const handleClose = useCallback(() => {
    unregisterPopup(popupId);
    onClose();
  }, [onClose, popupId, unregisterPopup]);

  return {
    zIndex: getZIndex(popupId),
    isTop: isTopPopup(popupId),
    handleClose
  };
};