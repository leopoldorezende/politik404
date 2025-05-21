import React from 'react';
import MessageService from '../../../ui/toast/messageService';

/**
 * Componente para exibir o popup de aliança militar
 */
const AlliancePopup = ({ selectedCountry, onClose }) => {
  
  /**
   * Manipulador para assinar aliança
   */
  const handleSignAlliance = () => {
    MessageService.showSuccess(
      `Aliança militar com ${selectedCountry} assinada! Em caso de guerra, os países são obrigados a prestar assistência mútua.`
    );
    onClose();
  };
  
  return (
    <>
      <div className="popup-info">
        <ul className="popup-info-list">
          <li>
            Em caso de guerra, os países aliados são <strong>obrigados</strong> a prestar 
            assistência militar. A aliança fortalece a posição diplomática internacional de 
            ambos os países.
          </li>
          <li>
            Este acordo permite o livre trânsito de tropas e equipamentos militares entre 
            os países signatários.
          </li>
          <li>
            Uma aliança militar sinaliza o mais alto nível de cooperação em defesa entre nações.
          </li>
        </ul>
      </div>

      <div className="popup-actions">
        <button onClick={handleSignAlliance}>
          Assinar Aliança
        </button>
      </div>
    </>
  );
};

export default AlliancePopup;