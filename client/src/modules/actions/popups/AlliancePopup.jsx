import React, { useState, useEffect } from 'react';
import { socketApi } from '../../../services/socketClient';
import MessageService from '../../../ui/toast/messageService';
import useActionCooldown from '../hooks/useActionCooldown';

/**
 * Componente para exibir o popup de aliança militar
 * Segue o mesmo padrão do TradePopup.jsx
 */
const AlliancePopup = ({ 
  selectedCountry, 
  myCountry, 
  isControlledByPlayer, 
  onClose 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Hook para gerenciar cooldowns (15 segundos - mesmo intervalo do comércio)
  const { isInCooldown, getRemainingTime, startCooldown } = useActionCooldown(15000);
  
  // Configurar listeners de socket
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    const handleAllianceProposalResponse = (response) => {
      setIsSubmitting(false);
      
      if (response.accepted) {
        MessageService.showSuccess(
          `Aliança militar com ${selectedCountry} estabelecida com sucesso!`
        );
        onClose();
      } else {
        MessageService.showWarning(
          `${selectedCountry} recusou sua proposta de aliança militar.`
        );
      }
    };
    
    socket.on('allianceProposalResponse', handleAllianceProposalResponse);
    
    return () => {
      socket.off('allianceProposalResponse', handleAllianceProposalResponse);
    };
  }, [selectedCountry, onClose]);
  
  /**
   * Manipulador para enviar proposta de aliança
   */
  const handleSendProposal = () => {
    // Verificar se está em cooldown (segurança)
    if (isInCooldown('military_alliance')) {
      MessageService.showWarning(
        `Aguarde ${getRemainingTime('military_alliance')} segundos antes de enviar uma nova proposta.`
      );
      return;
    }
    
    console.log(`Enviando proposta de aliança militar para ${selectedCountry}`);
    
    // Desabilitar o botão enquanto processa
    setIsSubmitting(true);
    
    // Enviar proposta via socket - ANTES de iniciar o cooldown
    socketApi.sendAllianceProposal({
      type: 'military_alliance',
      targetCountry: selectedCountry,
      originCountry: myCountry
    });
    
    // Mostrar mensagem de confirmação
    MessageService.showInfo(
      `Proposta de aliança militar enviada para ${selectedCountry}.`
    );
    
    // Iniciar cooldown DEPOIS de enviar a proposta
    console.log(`Iniciando cooldown para aliança militar`);
    startCooldown('military_alliance');
    
    // Fechar popup após enviar a proposta e iniciar o cooldown
    onClose();
  };
  
  // Verificar se está em cooldown - verificação em cada renderização
  const inCooldown = isInCooldown('military_alliance');
  
  // Se estiver em cooldown, mostrar mensagem com cronômetro
  if (inCooldown) {
    const remaining = getRemainingTime('military_alliance');
    
    console.log(`Exibindo mensagem de cooldown para aliança: ${remaining}s restantes`);
    
    // ✅ NOVO: Mensagem diferente dependendo do tempo restante
    const isLongCooldown = remaining > 30; // Mais de 30 segundos = provavelmente cancelamento
    
    return (
      <div className="cooldown-message">
        <div className="cooldown-timer">
          <span className="material-icons">timer</span>
          <span className="countdown">{remaining} segundos</span>
        </div>
        <p>
          {isLongCooldown 
            ? 'Você cancelou uma aliança recentemente. Aguarde antes de propor uma nova aliança militar.'
            : 'Você precisa aguardar antes de enviar uma nova proposta de aliança militar.'
          }
        </p>
      </div>
    );
  }
  
  // Formulário padrão se não estiver em cooldown
  return (
    <>
      <div className="popup-info">
        <ul className="popup-info-list">
          <li>
            Em caso de guerra, os países aliados são <strong>obrigados</strong> a prestar 
            assistência militar.
          </li>
          <li>
            Você só pode ter uma aliança militar ativa. Para fazer outra aliança, precisará desfazer a atual.
          </li>
          <li>
            <br />
            <i>A aliança militar gera 5 pontos para cada país.</i>
          </li>
        </ul>
      </div>

      <div className="popup-actions">
        <button 
          onClick={handleSendProposal}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar Proposta'}
        </button>
      </div>
    </>
  );
};

export default AlliancePopup;