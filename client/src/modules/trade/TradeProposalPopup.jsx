import React from 'react';
import Popup from '../../ui/popup/Popup';
import { socketApi } from '../../services/socketClient';
import './TradeProposalPopup.css';

/**
 * Popup para exibir uma proposta comercial recebida e permitir ao usuário aceitar ou recusar
 * @param {Object} props - Props do componente
 * @param {Object} props.proposal - Dados da proposta recebida
 * @param {boolean} props.isOpen - Se o popup está aberto
 * @param {Function} props.onClose - Função para fechar o popup
 * @returns {React.ReactElement} - O componente de popup
 */
const TradeProposalPopup = ({ proposal, isOpen, onClose }) => {
  if (!proposal || !isOpen) return null;

  const { id, type, product, originCountry, value, reason } = proposal;
  
  // Determinar título e mensagem baseados no tipo da proposta
  const title = `Proposta de ${type === 'export' ? 'Exportação' : 'Importação'} de ${originCountry}`;
  const productType = product === 'commodity' ? 'commodities' : 'manufaturas';
  
  // Análise econômica simples para contextualizar a proposta
  const economicContext = type === 'export' 
    ? `${originCountry} deseja enviar ${productType} para o seu país`
    : `${originCountry} deseja receber ${productType} do seu país`;
  
  // Funções para aceitar ou recusar proposta
  const handleAccept = () => {
    socketApi.respondToTradeProposal(id, true);
    onClose();
  };
  
  const handleReject = () => {
    socketApi.respondToTradeProposal(id, false);
    onClose();
  };

  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      <div className="trade-proposal-content">
        <div className="proposal-message">
          <p>
            <strong>{originCountry}</strong> deseja {type === 'export' ? 'exportar para você' : 'importar de você'} {' '}
            {productType} no valor de <strong>{value} bi USD</strong>.
          </p>
        </div>
        
        <div className="proposal-details">
          <div className="detail-item">
            <span className="detail-label">Tipo:</span>
            <span className="detail-value">{type === 'export' ? 'Exportação' : 'Importação'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Produto:</span>
            <span className="detail-value">{product === 'commodity' ? 'Commodities' : 'Manufaturas'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Valor:</span>
            <span className="detail-value">{value} bi USD</span>
          </div>
        </div>
        
        <div className="proposal-info">
          <p>
            Aceitar esta proposta estabelecerá um acordo comercial entre os dois países.
            {type === 'export' 
              ? ' Você receberá produtos deste país, o que poderá ajudar a suprir demandas internas.'
              : ' Você enviará produtos para este país, o que poderá reforçar suas receitas.'}
          </p>
          
          {/* Contexto econômico adicional */}
          <p className="economic-context">
            <strong>Contexto:</strong> {economicContext}
            {type === 'export' 
              ? ', o que pode ajudar você se estiver com déficit neste setor.'
              : ', o que pode ser vantajoso se você tiver excedente neste setor.'}
          </p>
        </div>
        
        <div className="proposal-actions">
          <button 
            className="action-btn"
            onClick={handleAccept}
          >
            Aceitar
          </button>
          <button 
            className="action-btn danger"
            onClick={handleReject}
          >
            Recusar
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default TradeProposalPopup;