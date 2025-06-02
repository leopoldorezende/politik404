import React from 'react';
import Popup from '../../ui/popup/Popup';
import './DebtSummaryPopup.css';

/**
 * Popup para exibir resumo detalhado das dívidas públicas
 * @param {Object} props - Props do componente
 * @param {boolean} props.isOpen - Se o popup está aberto
 * @param {Function} props.onClose - Função para fechar o popup
 * @param {Object} props.debtSummary - Resumo das dívidas
 * @param {Array} props.debtRecords - Registros detalhados das dívidas
 * @param {Object} props.economicData - Dados econômicos completos
 * @returns {React.ReactElement} - O componente de popup
 */
const DebtSummaryPopup = ({ 
  isOpen, 
  onClose, 
  debtSummary, 
  debtRecords = [], 
  economicData 
}) => {
  // Função para formatar valores monetários
  const formatCurrency = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0';
    return Number(value).toFixed(1);
  };

  // Função para formatar porcentagem
  const formatPercent = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0%';
    return Number(value).toFixed(1) + '%';
  };

  // Garantir que debtRecords seja sempre um array
  const safeDebtRecords = Array.isArray(debtRecords) ? debtRecords : [];
  
  // Dados calculados ou vindos das props
  const totalPublicDebt = economicData?.publicDebt || debtSummary?.principalRemaining || 0;
  const currentGDP = economicData?.gdp || 100;
  const debtToGdpRatio = (totalPublicDebt / currentGDP) * 100;
  const numberOfDebts = safeDebtRecords.length;
  
  // Calcular valores se temos registros de dívida
  let totalMonthlyPayment = 0;
  let totalFuturePayments = 0;
  let averageInterestRate = 0;
  
  if (safeDebtRecords.length > 0) {
    totalMonthlyPayment = safeDebtRecords.reduce((sum, debt) => sum + (debt.monthlyPayment || 0), 0);
    totalFuturePayments = safeDebtRecords.reduce((sum, debt) => 
      sum + ((debt.monthlyPayment || 0) * (debt.remainingInstallments || 0)), 0
    );
    
    const totalDebtValue = safeDebtRecords.reduce((sum, debt) => sum + (debt.remainingValue || 0), 0);
    const weightedInterest = safeDebtRecords.reduce((sum, debt) => 
      sum + ((debt.interestRate || 0) * (debt.remainingValue || 0)), 0
    );
    averageInterestRate = totalDebtValue > 0 ? (weightedInterest / totalDebtValue) : 0;
  }

  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      title="Resumo de Dívidas Públicas"
      size="large"
      className="debt-summary-popup"
    >
      <div className="debt-popup-content">
        {/* Cards de Resumo */}
        <div className="debt-summary-cards">
          <div className="debt-card">
            <div className="debt-card-title">Dívida Total</div>
            <div className="debt-card-value">{formatCurrency(totalPublicDebt)} bi USD</div>
            <div className="debt-card-description">
              {formatPercent(debtToGdpRatio)} do PIB
            </div>
          </div>
          
          <div className="debt-card">
            <div className="debt-card-title">Pagamento Mensal</div>
            <div className="debt-card-value">{formatCurrency(totalMonthlyPayment)} bi USD</div>
            <div className="debt-card-description">
              Taxa média de {formatPercent(averageInterestRate)}
            </div>
          </div>
          
          <div className="debt-card">
            <div className="debt-card-title">Total a Pagar</div>
            <div className="debt-card-value">{formatCurrency(totalFuturePayments)} bi USD</div>
            <div className="debt-card-description">
              {numberOfDebts} contratos
            </div>
          </div>
          
        </div>

        {/* Detalhes dos Títulos */}
        {safeDebtRecords.length > 0 ? (
          <div className="debt-details-section">
            <div className="debt-table-container">
              <table className="debt-table">
                <thead>
                  <tr>
                    <th>Valor <br />Original</th>
                    <th>Saldo <br />Devedor</th>
                    <th>Taxa <br />de Juros</th>
                    <th>Pagamento<br /> Mensal</th>
                    <th>Parcelas <br />Restantes</th>
                  </tr>
                </thead>
                <tbody>
                  {safeDebtRecords.map((debt) => (
                    <tr key={debt.id}>
                      <td>{formatCurrency(debt.originalValue)} bi</td>
                      <td>{formatCurrency(debt.remainingValue)} bi</td>
                      <td>{formatPercent(debt.interestRate)}</td>
                      <td>{formatCurrency(debt.monthlyPayment)} bi</td>
                      <td>{debt.remainingInstallments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="no-debts-message">
            <span className="material-icons">account_balance</span>
            <p>Nenhum título de dívida pública em circulação.</p>
            <p>A dívida atual pode ser de períodos anteriores ou padrão inicial.</p>
          </div>
        )}

        {/* Informações Adicionais */}
        {/* <div className="debt-info-section">
          <h4>Informações sobre Títulos da Dívida Pública</h4>
          <ul>
            <li>A taxa de juros varia conforme a classificação de crédito do país</li>
            <li>Se o Tesouro for insuficiente, títulos de emergência podem ser emitidos</li>
            <li>A relação dívida/PIB não pode ultrapassar 120% para novas emissões</li>
          </ul>
        </div> */}
        
      </div>
    </Popup>
  );
};

export default DebtSummaryPopup;