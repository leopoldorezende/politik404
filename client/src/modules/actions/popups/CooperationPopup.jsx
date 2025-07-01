import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { socketApi } from '../../../services/socketClient';
import MessageService from '../../../ui/toast/messageService';
import useActionCooldown from '../hooks/useActionCooldown';

/**
 * Componente para exibir o popup de cooperação estratégica
 */
const CooperationPopup = ({ 
  selectedCountry, 
  myCountry, 
  onClose 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentRoom = useSelector(state => state.rooms?.currentRoom);

  // Hook para gerenciar cooldowns (15 segundos)
  const { isInCooldown, getRemainingTime, startCooldown } = useActionCooldown('strategic-cooperation', 15000);
  
  // Configurar listeners de socket
  useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;
    
    const handleCooperationProposalResponse = (response) => {
      setIsSubmitting(false);
      
      if (response.accepted) {
        MessageService.showSuccess(
          `Acordo de Cooperação Estratégica com ${selectedCountry} estabelecido com sucesso!`
        );
        onClose();
      } else {
        MessageService.showWarning(
          `${selectedCountry} recusou sua proposta de cooperação estratégica.`
        );
      }
    };
    
    socket.on('cooperationProposalResponse', handleCooperationProposalResponse);
    
    return () => {
      socket.off('cooperationProposalResponse', handleCooperationProposalResponse);
    };
  }, [selectedCountry, onClose]);
  
  /**
   * Manipulador para assinar acordo de cooperação
   */
  const handleSignCooperation = () => {
    // Verificar se está em cooldown (segurança)
    if (isInCooldown('strategic-cooperation')) {
      MessageService.showWarning(
        `Aguarde ${getRemainingTime('strategic-cooperation')} segundos antes de enviar uma nova proposta.`
      );
      return;
    }
    
    console.log(`Enviando proposta de cooperação estratégica para ${selectedCountry}`);
    
    // Desabilitar o botão enquanto processa
    setIsSubmitting(true);
    
    // Enviar proposta via socket com o tipo unificado
    socketApi.sendCooperationProposal({
      type: 'strategic-cooperation',
      targetCountry: selectedCountry,
      originCountry: myCountry
    });
    
    // Mostrar mensagem de confirmação
    MessageService.showInfo(
      `Proposta de cooperação estratégica enviada para ${selectedCountry}.`
    );
    
    // Iniciar cooldown DEPOIS de enviar a proposta
    console.log(`Iniciando cooldown para cooperação estratégica`);
    startCooldown('strategic-cooperation');
    
    // Fechar popup após enviar a proposta e iniciar o cooldown
    onClose();
  };

  // Verificar se está em cooldown - verificação em cada renderização
  const inCooldown = isInCooldown('strategic-cooperation');
  
  // Se estiver em cooldown, mostrar mensagem com cronômetro
  if (inCooldown) {
    const remaining = getRemainingTime('strategic-cooperation');
    
    return (
      <div className="cooldown-message">
        <div className="cooldown-timer">
          <span className="material-icons">timer</span>
          <span className="countdown">{remaining} segundos</span>
        </div>
        <p>
          Você precisa aguardar antes de enviar uma nova proposta de cooperação estratégica.
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
            A Cooperação Estratégica permite a <strong>troca de tecnologias militares</strong> e o 
            desenvolvimento conjunto de projetos de defesa.
          </li>
          <li>
            Este acordo aumenta as capacidades bélicas de ambos os países através da transferência 
            de tecnologia da indústria militar.
          </li>
          <li>
            Diferente de uma Aliança Militar, não há obrigação de assistência mútua em caso de conflito.
          </li>
        </ul>
      </div>

      <div className="popup-actions">
        <button 
          onClick={handleSignCooperation}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Enviando...' : 'Assinar Cooperação'}
        </button>
      </div>
    </>
  );
};

export default CooperationPopup;