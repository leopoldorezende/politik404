import React from 'react';
import './DebtSummaryPopup.css';

/**
 * Popup para exibir resumo detalhado das dívidas do país
 */
const DebtSummaryPopup = ({ isOpen, onClose, debtSummary, debtRecords }) => {
  if (!isOpen) return null;

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

  return (
    <div className="debt-popup-overlay">
      <div className="debt-popup">
        <div className="debt-popup-header">
          <h2>Resumo de Dívidas Públicas</h2>
          <button className="close-debt-popup-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="debt-popup-content">
          {debtSummary && (
            <>
              <div className="debt-summary-cards">
                <div className="debt-card">
                  <div className="debt-card-title">Pagamento Mensal</div>
                  <div className="debt-card-value">{formatCurrency(debtSummary.totalMonthlyPayment)} bi USD</div>
                  <div className="debt-card-description">Valor pago mensalmente</div>
                </div>
                
                <div className="debt-card">
                  <div className="debt-card-title">Principal Restante</div>
                  <div className="debt-card-value">{formatCurrency(debtSummary.principalRemaining)} bi USD</div>
                  <div className="debt-card-description">Valor principal ainda devido</div>
                </div>
                
                <div className="debt-card">
                  <div className="debt-card-title">Total Futuro</div>
                  <div className="debt-card-value">{formatCurrency(debtSummary.totalFuturePayments)} bi USD</div>
                  <div className="debt-card-description">Total a ser pago até o final</div>
                </div>
                
                <div className="debt-card">
                  <div className="debt-card-title">Relação Dívida/PIB</div>
                  <div className="debt-card-value">{formatPercent(debtSummary.debtToGdpRatio * 100)}</div>
                  <div className="debt-card-description">Percentual da dívida em relação ao PIB</div>
                </div>
              </div>
              
              {debtRecords && debtRecords.length > 0 && (
                <div className="debt-details-section">
                  <h3>Detalhes dos Títulos Emitidos</h3>
                  <div className="debt-table-container">
                    <table className="debt-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Valor Original</th>
                          <th>Saldo Restante</th>
                          <th>Taxa de Juros</th>
                          <th>Pagamento Mensal</th>
                          <th>Parcelas Restantes</th>
                          <th>Data de Emissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debtRecords.map((debt) => (
                          <tr key={debt.id}>
                            <td>#{debt.id}</td>
                            <td>{formatCurrency(debt.originalValue)} bi</td>
                            <td>{formatCurrency(debt.remainingValue)} bi</td>
                            <td>{formatPercent(debt.interestRate)}</td>
                            <td>{formatCurrency(debt.monthlyPayment)} bi</td>
                            <td>{debt.remainingInstallments} meses</td>
                            <td>{new Date(debt.issueDate).toLocaleDateString('pt-BR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="debt-info-section">
                <h4>Informações Importantes</h4>
                <ul>
                  <li>Os pagamentos são processados automaticamente a cada mês (30 turnos)</li>
                  <li>Títulos têm duração padrão de 10 anos (120 meses)</li>
                  <li>Taxa de juros varia conforme classificação de crédito do país</li>
                  <li>Se não houver caixa suficiente, títulos de emergência podem ser emitidos automaticamente</li>
                  <li>Relação dívida/PIB acima de 120% impede novas emissões</li>
                </ul>
              </div>
            </>
          )}
        </div>
        
        <div className="debt-popup-footer">
          <button className="close-debt-btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};

export default DebtSummaryPopup;