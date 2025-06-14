import React, { useState, useEffect } from 'react';
import { socketApi } from '../../../services/socketClient';
import MessageService from '../../../ui/toast/messageService';
import useActionCooldown from '../hooks/useActionCooldown';

/**
 * Componente para exibir as popups de propostas comerciais (exportação/importação)
 */
const TradePopup = ({ 
  tradeType, 
  selectedCountry, 
  myCountry, 
  isControlledByPlayer, 
  onClose,
  redirectToTradePanel
}) => {
  const [product, setProduct] = useState('commodity'); // 'commodity' ou 'manufacture'
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Hook para gerenciar cooldowns (15 segundos)
  const { isInCooldown, getRemainingTime, startCooldown } = useActionCooldown(15000);
  
  // Configurar listeners de socket
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    const handleTradeProposalResponse = (response) => {
      setIsSubmitting(false);
      
      if (response.accepted) {
        MessageService.showSuccess(
          `Proposta de ${tradeType === 'export' ? 'exportação' : 'importação'} aceita por ${selectedCountry}!`
        );
        onClose();
        redirectToTradePanel();
      } else {
        MessageService.showWarning(
          `${selectedCountry} recusou sua proposta de ${tradeType === 'export' ? 'exportação' : 'importação'}.`
        );
      }
    };
    
    socket.on('tradeProposalResponse', handleTradeProposalResponse);
    
    return () => {
      socket.off('tradeProposalResponse', handleTradeProposalResponse);
    };
  }, [tradeType, selectedCountry, onClose, redirectToTradePanel]);
  
  /**
   * Manipulador para enviar proposta comercial
   */
  const handleSendProposal = () => {
    const parsedAmount = parseFloat(amount);
    
    if (!parsedAmount || parsedAmount <= 0) {
      MessageService.showError('Por favor, insira um valor válido maior que zero.');
      return;
    }
    
    // Verificar se está em cooldown (segurança)
    if (isInCooldown(tradeType)) {
      MessageService.showWarning(
        `Aguarde ${getRemainingTime(tradeType)} segundos antes de enviar uma nova proposta.`
      );
      return;
    }
    
    console.log(`Enviando proposta de ${tradeType} para ${selectedCountry}`);
    
    // Desabilitar o botão enquanto processa
    setIsSubmitting(true);
    
    // Enviar proposta via socket - IMPORTANTE: Enviar ANTES de iniciar o cooldown
    socketApi.sendTradeProposal({
      type: tradeType,
      product: product,
      targetCountry: selectedCountry,
      value: parsedAmount,
      originCountry: myCountry
    });
    
    // Mostrar mensagem de confirmação
    MessageService.showInfo(
      `Proposta de ${tradeType === 'export' ? 'exportação' : 'importação'} enviada para ${selectedCountry}.`
    );
    
    // Iniciar cooldown DEPOIS de enviar a proposta
    console.log(`Iniciando cooldown para ${tradeType}`);
    startCooldown(tradeType);
    
    // Fechar popup após enviar a proposta e iniciar o cooldown
    onClose();
  };
  
  // Verificar se está em cooldown - verificação em cada renderização
  const inCooldown = isInCooldown(tradeType);
  
  // Se estiver em cooldown, mostrar mensagem com cronômetro
  if (inCooldown) {
    const actionType = tradeType === 'export' ? 'exportação' : 'importação';
    const remaining = getRemainingTime(tradeType);
    
    console.log(`Exibindo mensagem de cooldown: ${remaining}s restantes`);
    
    return (
      <div className="cooldown-message">
        <div className="cooldown-timer">
          <span className="material-icons">timer</span>
          <span className="countdown">{remaining} segundos</span>
        </div>
        <p>
          Você precisa aguardar antes de enviar uma nova proposta de {actionType}.
        </p>
      </div>
    );
  }
  
  // Formulário padrão se não estiver em cooldown
  return (
    <>
      <div className="popup-form-group">
        <label>Tipo de produto:</label>
        <div className="radio-options">
          <label className="radio-option">
            <input 
              type="radio" 
              name="productType" 
              value="commodity" 
              checked={product === 'commodity'}
              onChange={() => setProduct('commodity')}
            />
            Commoditie
          </label>
          <label className="radio-option">
            <input 
              type="radio" 
              name="productType" 
              value="manufacture" 
              checked={product === 'manufacture'}
              onChange={() => setProduct('manufacture')}
            />
            Manufatura
          </label>
        </div>
      </div>

      <div className="popup-form-group">
        <label>USD para {tradeType === 'export' ? 'exportação' : 'importação'} mensal:</label>
        <input 
          type="number" 
          value={amount} 
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          placeholder="Digite o valor em USD"
        />
      </div>

      <div className="popup-info">
        <p>
          {isControlledByPlayer 
            ? `${selectedCountry} é controlado por outro jogador e precisará aprovar esta proposta.`
            : `${selectedCountry} é controlado pelo sistema e poderá aprovar ou recusar esta proposta.`
          }
        </p>
      </div>

      <div className="popup-actions">
        <button 
          onClick={handleSendProposal}
          disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar Proposta'}
        </button>
      </div>
    </>
  );
};

export default TradePopup;