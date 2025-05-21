import React from 'react';
import MessageService from '../../../ui/toast/messageService';

/**
 * Componente para exibir o popup de cooperação estratégica
 */
const CooperationPopup = ({ selectedCountry, onClose }) => {
  
  /**
   * Manipulador para assinar acordo de cooperação
   */
  const handleSignCooperation = () => {
    MessageService.showSuccess(
      `Acordo de Cooperação Estratégica com ${selectedCountry} assinado! A cooperação permitirá o desenvolvimento conjunto de tecnologias militares.`
    );
    onClose();
  };
  
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
        <button onClick={handleSignCooperation}>
          Assinar Cooperação
        </button>
      </div>
    </>
  );
};

export default CooperationPopup;