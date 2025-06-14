import React from 'react';
import Popup from '../../ui/popup/Popup';
import { socketApi } from '../../services/socketClient';
import './AllianceProposalPopup.css';

/**
 * Popup para exibir uma proposta de aliança militar recebida e permitir ao usuário aceitar ou recusar
 * Segue o mesmo padrão do TradeProposalPopup.jsx
 * @param {Object} props - Props do componente
 * @param {Object} props.proposal - Dados da proposta recebida
 * @param {boolean} props.isOpen - Se o popup está aberto
 * @param {Function} props.onClose - Função para fechar o popup
 * @returns {React.ReactElement} - O componente de popup
 */
const AllianceProposalPopup = ({ proposal, isOpen, onClose }) => {
  if (!proposal || !isOpen) return null;

  const { proposalId, type, originCountry } = proposal;
  
  // Título e informações da proposta
  const title = `Proposta de ${originCountry}`;
  
  // Funções para aceitar ou recusar proposta
  const handleAccept = () => {
    socketApi.respondToAllianceProposal(proposalId, true);
    onClose();
  };

  const handleReject = () => {
    socketApi.respondToAllianceProposal(proposalId, false);
    onClose();
  };
  
  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      <div className="alliance-proposal-content">

        
        <div className="proposal-details">
          <div className="detail-item">
            <span className="detail-label">Tipo:</span>
            <span className="detail-value">Aliança Militar</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Solicitante:</span>
            <span className="detail-value">{originCountry}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Benefícios:</span>
            <span className="detail-value">5 pontos para cada país</span>
          </div>
        </div>
        
        <div className="proposal-info">
          <ul className="alliance-benefits">
            <li>
              <strong>Assistência militar obrigatória:</strong> Em caso de guerra, ambos os países são 
              obrigados a prestar assistência militar mútua.
            </li>
            <li>
              <strong>Exclusividade:</strong> Você só pode ter uma aliança militar ativa por vez. 
              Para fazer outra aliança, precisará desfazer a atual.
            </li>
          </ul>
          
          <div className="strategic-context">
            <strong>Contexto Estratégico:</strong> Uma aliança militar com {originCountry} pode 
            fortalecer sua posição defensiva e ofensiva no cenário geopolítico atual, 
            além de garantir pontos valiosos para sua classificação.
          </div>
        </div>
        
        <div className="proposal-actions">
          <button 
            className="action-btn accept"
            onClick={handleAccept}
          >
            Aceitar Aliança
          </button>
          <button 
            className="action-btn reject"
            onClick={handleReject}
          >
            Recusar
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default AllianceProposalPopup;