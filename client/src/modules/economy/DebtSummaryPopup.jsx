import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import Popup from '../../ui/popup/Popup';
import { usePublicDebt } from '../../hooks/useEconomy'; // USAR HOOK DIRETAMENTE
import './DebtSummaryPopup.css';

/**
 * Popup para exibir resumo detalhado das dívidas públicas COM DADOS DINÂMICOS
 */
const DebtSummaryPopup = ({ 
  isOpen, 
  onClose
  // ===== REMOVER: props estáticas que não se atualizam =====
  // debtSummary, debtRecords, economicData 
}) => {
  // ===== NOVO: Usar dados do Redux e hook dinâmico =====
  const myCountry = useSelector(state => state.game?.myCountry);
  const currentRoom = useSelector(state => state.rooms?.currentRoom);
  
  // ===== USAR HOOK QUE SE ATUALIZA EM TEMPO REAL =====
  const { debtSummary, loading, refresh } = usePublicDebt(
    currentRoom?.name, 
    myCountry
  );

  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [updateCount, setUpdateCount] = useState(0);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  // ===== ATUALIZAÇÃO AUTOMÁTICA quando popup está aberto =====
  useEffect(() => {
    if (!isOpen || !currentRoom?.name || !myCountry) return;

    setIsAutoRefreshing(true);

    // Atualização inicial
    refresh();

    // Timer para atualização periódica mais frequente
    const updateInterval = setInterval(() => {
      console.log('[DEBT POPUP] Auto-refresh solicitado');
      refresh();
      setLastUpdateTime(Date.now());
      setUpdateCount(prev => prev + 1);
    }, 1500); // A cada 1.5 segundos para ser mais responsivo

    return () => {
      clearInterval(updateInterval);
      setIsAutoRefreshing(false);
    };
  }, [isOpen, currentRoom?.name, myCountry, refresh]);

  // ===== ATUALIZAR quando debtSummary muda =====
  useEffect(() => {
    if (debtSummary && debtSummary.debtRecords) {
      setLastUpdateTime(Date.now());
      setUpdateCount(prev => prev + 1);
      
      // ===== LOG DETALHADO PARA DEBUG =====
      console.log('[DEBT POPUP] Dados atualizados:', {
        contracts: debtSummary.debtRecords.length,
        totalDebt: debtSummary.totalPublicDebt?.toFixed(2) || '0',
        totalPayment: debtSummary.totalMonthlyPayment?.toFixed(2) || '0',
        contractDetails: debtSummary.debtRecords.map(contract => ({
          id: contract.id,
          remaining: contract.remainingValue?.toFixed(2),
          installments: contract.remainingInstallments
        }))
      });
    }
  }, [debtSummary]);

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

  // ===== USAR DADOS DO HOOK EM VEZ DE PROPS =====
  const activeDebtRecords = debtSummary?.debtRecords || debtSummary?.contracts || [];
  const economicData = debtSummary?.economicData || {};
  
  // Garantir que seja sempre um array
  const safeDebtRecords = Array.isArray(activeDebtRecords) ? activeDebtRecords : [];
  
  // Dados calculados
  const totalPublicDebt = economicData?.publicDebt || debtSummary?.totalPublicDebt || 0;
  const currentGDP = economicData?.gdp || 100;
  const debtToGdpRatio = (totalPublicDebt / currentGDP) * 100;
  const numberOfDebts = safeDebtRecords.length;
  
  // Recalcular valores em tempo real
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

  // Loading state
  if (loading && !debtSummary) {
    return (
      <Popup
        isOpen={isOpen}
        onClose={onClose}
        title="Resumo de Dívidas Públicas"
        size="large"
        className="debt-summary-popup"
      >
        <div className="debt-popup-content">
          <div className="loading-indicator">
            <span className="material-icons spinning">refresh</span>
            <p>Carregando dados de dívida...</p>
          </div>
        </div>
      </Popup>
    );
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
                {safeDebtRecords.map((debt, index) => {
                  // ===== NOVO: Destacar se parcelas restantes estão baixas =====
                  const isNearCompletion = debt.remainingInstallments <= 12; // Últimos 12 meses
                  const isEmergency = debt.emergencyBond;
                  
                  return (
                    <tr 
                      key={debt.id || index} 
                      className={`
                        ${isEmergency ? 'emergency-bond' : 'regular-bond'} 
                        ${isNearCompletion ? 'near-completion' : ''} 
                        debt-row
                      `}
                      title={isNearCompletion ? 'Contrato próximo da quitação' : ''}
                    >
                      <td className="debt-original">{formatCurrency(debt.originalValue)} bi</td>
                      <td className="debt-remaining">{formatCurrency(debt.remainingValue)} bi</td>
                      <td className="debt-rate">{formatPercent(debt.interestRate)}</td>
                      <td className="debt-payment">{formatCurrency(debt.monthlyPayment)} bi</td>
                      <td className={`debt-installments ${isNearCompletion ? 'highlight' : ''}`}>
                        {debt.remainingInstallments}
                        {isNearCompletion && <span className="completion-indicator"> ⏰</span>}
                      </td>
                    </tr>
                  );
                })}
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
        
      </div>
    </Popup>
  );
};

export default DebtSummaryPopup;