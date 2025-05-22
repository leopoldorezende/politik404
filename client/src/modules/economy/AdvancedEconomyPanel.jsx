import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  selectCountryEconomy,
  selectCountryEconomicIndicators,
  selectCountryDebtSummary,
  selectCountrySectoralBalance,
  initializeCountryEconomy,
  updateEconomicParameters
} from './advancedEconomySlice';
import advancedEconomyService from './advancedEconomyService';
import { showSuccess, showError } from '../../ui/toast/messageService';
import Popup from '../../ui/popup/Popup';
import './AdvancedEconomyPanel.css';

const AdvancedEconomyPanel = () => {
  const dispatch = useDispatch();
  
  // Dados do Redux com verificações de segurança - APENAS DO PRÓPRIO PAÍS
  const myCountry = useSelector(state => state.game?.myCountry);
  const currentRoom = useSelector(state => state.rooms?.currentRoom);
  const countriesData = useSelector(state => state.game?.countriesData);
  
  // Estados econômicos APENAS do próprio país
  const countryEconomy = useSelector(state => 
    myCountry ? selectCountryEconomy(state, currentRoom?.name, myCountry) : null
  );
  const economicIndicators = useSelector(state => 
    myCountry ? selectCountryEconomicIndicators(state, currentRoom?.name, myCountry) : null
  );
  const debtSummary = useSelector(state => 
    myCountry ? selectCountryDebtSummary(state, currentRoom?.name, myCountry) : null
  );
  const sectoralBalance = useSelector(state => 
    myCountry ? selectCountrySectoralBalance(state, currentRoom?.name, myCountry) : null
  );
  
  // Estados locais
  const [localParameters, setLocalParameters] = useState({
    interestRate: 8.0,
    taxBurden: 40.0,
    publicServices: 30.0
  });
  const [bondAmount, setBondAmount] = useState('');
  const [isIssuingBonds, setIsIssuingBonds] = useState(false);
  const [showDebtPopup, setShowDebtPopup] = useState(false);
  
  // Inicializa economia quando componente monta - APENAS PARA O PRÓPRIO PAÍS
  useEffect(() => {
    if (currentRoom?.name && myCountry && countriesData?.[myCountry] && !countryEconomy) {
      console.log('Initializing advanced economy for:', myCountry);
      dispatch(initializeCountryEconomy({
        roomName: currentRoom.name,
        countryName: myCountry,
        countryData: countriesData[myCountry]
      }));
    }
  }, [currentRoom?.name, myCountry, countriesData, countryEconomy, dispatch]);
  
  // Sincroniza parâmetros locais com economia quando ela carrega
  useEffect(() => {
    if (countryEconomy) {
      setLocalParameters({
        interestRate: countryEconomy.interestRate || 8.0,
        taxBurden: countryEconomy.taxBurden || 40.0,
        publicServices: countryEconomy.publicServices || 30.0
      });
    }
  }, [countryEconomy]);
  
  // Aplica mudanças nos parâmetros econômicos - APENAS PARA O PRÓPRIO PAÍS
  const applyParameterChange = useCallback((parameter, value) => {
    if (!currentRoom?.name || !myCountry) return;
    
    const newValue = parseFloat(value);
    const updates = { [parameter]: newValue };
    
    dispatch(updateEconomicParameters({
      roomName: currentRoom.name,
      countryName: myCountry,
      parameters: updates
    }));
    
    setLocalParameters(prev => ({
      ...prev,
      [parameter]: newValue
    }));
  }, [currentRoom?.name, myCountry, dispatch]);
  
  // Emite títulos de dívida - APENAS PARA O PRÓPRIO PAÍS
  const handleIssueBonds = useCallback(async () => {
    const amount = parseFloat(bondAmount);
    
    if (!amount || amount <= 0 || amount > 1000) {
      showError('Valor deve estar entre 0 e 1000 bilhões');
      return;
    }
    
    if (!currentRoom?.name || !myCountry) {
      showError('Erro: dados da sala ou país não encontrados');
      return;
    }
    
    setIsIssuingBonds(true);
    
    try {
      const result = await advancedEconomyService.issueBondsForCountry(
        currentRoom.name,
        myCountry,
        amount
      );
      
      if (result.success) {
        showSuccess(`Títulos emitidos: ${amount} bi USD. ${result.message}`);
        setBondAmount('');
      } else {
        showError(result.message);
      }
    } catch (error) {
      showError('Erro ao emitir títulos: ' + error.message);
    } finally {
      setIsIssuingBonds(false);
    }
  }, [bondAmount, currentRoom?.name, myCountry]);
  
  // Formata valores com sinal
  const formatValueWithSign = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0';
    const num = Number(value);
    return (num >= 0 ? '+' : '') + num.toFixed(1);
  };
  
  // Formata porcentagem
  const formatPercent = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0%';
    return Number(value).toFixed(1) + '%';
  };
  
  // Formata valores monetários
  const formatCurrency = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0';
    return Number(value).toFixed(1);
  };
  
  // Obtém cor baseada na classificação de crédito
  const getCreditRatingColor = (rating) => {
    if (['AAA', 'AA', 'A'].includes(rating)) return '#28a745';
    if (rating === 'BBB') return '#ffc107';
    if (['BB', 'B'].includes(rating)) return '#fd7e14';
    return '#dc3545';
  };
  
  // RESTRIÇÃO: Só mostra dados se for o próprio país
  if (!myCountry) {
    return (
      <div className="advanced-economy-panel">
        <h3>Economia Avançada</h3>
        <p>Você precisa estar controlando um país para ver os dados econômicos avançados.</p>
      </div>
    );
  }
  
  if (!countryEconomy) {
    return (
      <div className="advanced-economy-panel">
        <h3>Economia Avançada</h3>
        <p>Carregando dados econômicos...</p>
      </div>
    );
  }
  
  return (
    <div className="advanced-economy-panel">
      <div className="panel-header">
        <h3>Economia Avançada - {myCountry}</h3>
        <div className="turn-info">
          <span>Turno: {countryEconomy.turn || 0}</span>
          {/* REMOVIDO: Controles manuais de turno - agora segue ciclo automático de 2s */}
        </div>
      </div>
      
      {/* Indicadores Principais */}
      <div className="main-indicators">
        <div className="indicator-group">
          <div className="indicator">
            <label>PIB:</label>
            <span className="value">
              {formatCurrency(economicIndicators?.gdp || countryEconomy.gdp)} bi USD
              {economicIndicators?.quarterlyGrowth !== undefined && (
                <span className={`growth ${economicIndicators.quarterlyGrowth >= 0 ? 'positive' : 'negative'}`}>
                  ({formatValueWithSign(economicIndicators.quarterlyGrowth)}% trim.)
                </span>
              )}
            </span>
          </div>
          
          <div className="indicator">
            <label>Tesouro:</label>
            <span className="value">{formatCurrency(economicIndicators?.treasury || countryEconomy.treasury)} bi USD</span>
          </div>
          
          <div className="indicator">
            <label>Dívida Pública:</label>
            <span className="value">
              {formatCurrency(economicIndicators?.publicDebt || countryEconomy.publicDebt)} bi USD
              <span className="debt-ratio">
                ({formatPercent(economicIndicators?.debtToGdpRatio || (countryEconomy.publicDebt / countryEconomy.gdp * 100))} do PIB)
              </span>
            </span>
          </div>
        </div>
        
        <div className="indicator-group">
          <div className="indicator">
            <label>Inflação:</label>
            <span className={`value ${(economicIndicators?.inflation || countryEconomy.inflation * 100) > 5 ? 'negative' : 'positive'}`}>
              {formatPercent(economicIndicators?.inflation || countryEconomy.inflation * 100)}
            </span>
          </div>
          
          <div className="indicator">
            <label>Desemprego:</label>
            <span className={`value ${(economicIndicators?.unemployment || countryEconomy.unemployment) > 10 ? 'negative' : 'positive'}`}>
              {formatPercent(economicIndicators?.unemployment || countryEconomy.unemployment)}
            </span>
          </div>
          
          <div className="indicator">
            <label>Popularidade:</label>
            <span className={`value ${(economicIndicators?.popularity || countryEconomy.popularity) > 50 ? 'positive' : 'negative'}`}>
              {formatPercent(economicIndicators?.popularity || countryEconomy.popularity)}
            </span>
          </div>
        </div>
        
        <div className="indicator-group">
          <div className="indicator">
            <label>Classificação de Crédito:</label>
            <span 
              className="credit-rating" 
              style={{ color: getCreditRatingColor(economicIndicators?.creditRating || countryEconomy.creditRating || 'A') }}
            >
              {economicIndicators?.creditRating || countryEconomy.creditRating || 'A'}
            </span>
          </div>
          
          <div className="indicator">
            <label>Pode Emitir Dívida:</label>
            <span className={`value ${(economicIndicators?.canIssueDebt !== undefined ? economicIndicators.canIssueDebt : countryEconomy.canIssueDebt) ? 'positive' : 'negative'}`}>
              {(economicIndicators?.canIssueDebt !== undefined ? economicIndicators.canIssueDebt : countryEconomy.canIssueDebt) ? 'Sim' : 'Não'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Controles Econômicos */}
      <div className="economic-controls">
        <h4>Parâmetros Econômicos</h4>
        
        <div className="control-group">
          <label>
            Taxa de Juros: <span className="current-value">{formatPercent(localParameters.interestRate)}</span>
          </label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="25"
              step="0.25"
              value={localParameters.interestRate}
              onChange={(e) => setLocalParameters(prev => ({
                ...prev,
                interestRate: parseFloat(e.target.value)
              }))}
            />
            <button 
              onClick={() => applyParameterChange('interestRate', localParameters.interestRate)}
              disabled={localParameters.interestRate === countryEconomy.interestRate}
            >
              Aplicar
            </button>
          </div>
          <small>Afeta inflação e crescimento econômico</small>
        </div>
        
        <div className="control-group">
          <label>
            Carga Tributária: <span className="current-value">{formatPercent(localParameters.taxBurden)}</span>
          </label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="70"
              step="0.5"
              value={localParameters.taxBurden}
              onChange={(e) => setLocalParameters(prev => ({
                ...prev,
                taxBurden: parseFloat(e.target.value)
              }))}
            />
            <button 
              onClick={() => applyParameterChange('taxBurden', localParameters.taxBurden)}
              disabled={localParameters.taxBurden === countryEconomy.taxBurden}
            >
              Aplicar
            </button>
          </div>
          <small>Afeta arrecadação, crescimento e popularidade</small>
        </div>
        
        <div className="control-group">
          <label>
            Investimento Público: <span className="current-value">{formatPercent(localParameters.publicServices)}</span>
          </label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="60"
              step="0.5"
              value={localParameters.publicServices}
              onChange={(e) => setLocalParameters(prev => ({
                ...prev,
                publicServices: parseFloat(e.target.value)
              }))}
            />
            <button 
              onClick={() => applyParameterChange('publicServices', localParameters.publicServices)}
              disabled={localParameters.publicServices === countryEconomy.publicServices}
            >
              Aplicar
            </button>
          </div>
          <small>Afeta crescimento, gastos públicos e popularidade</small>
        </div>
      </div>
      
      {/* Emissão de Títulos */}
      <div className="bonds-section">
        <h4>Emissão de Títulos da Dívida Pública</h4>
        
        <div className="bonds-controls">
          <input
            type="number"
            placeholder="Valor em bilhões"
            min="0"
            max="1000"
            step="0.1"
            value={bondAmount}
            onChange={(e) => setBondAmount(e.target.value)}
            disabled={isIssuingBonds || !(economicIndicators?.canIssueDebt !== undefined ? economicIndicators.canIssueDebt : countryEconomy.canIssueDebt)}
          />
          <button 
            className="btn-issue-bonds"
            onClick={handleIssueBonds}
            disabled={isIssuingBonds || !bondAmount || !(economicIndicators?.canIssueDebt !== undefined ? economicIndicators.canIssueDebt : countryEconomy.canIssueDebt)}
          >
            {isIssuingBonds ? 'Emitindo...' : 'Emitir Títulos'}
          </button>
        </div>
        
        {!(economicIndicators?.canIssueDebt !== undefined ? economicIndicators.canIssueDebt : countryEconomy.canIssueDebt) && (
          <div className="warning">
            <small>Não é possível emitir mais títulos devido à alta relação dívida/PIB ou baixa classificação de crédito.</small>
          </div>
        )}
        
        <div className="bonds-info">
          <small>
            • Títulos têm duração de 10 anos<br/>
            • Taxa de juros varia conforme classificação de crédito<br/>
            • Pagamentos mensais são automáticos<br/>
            • Os turnos avançam automaticamente a cada 2 segundos
          </small>
        </div>
      </div>
      
      {/* Botão para abrir popup de dívidas */}
      {debtSummary && debtSummary.numberOfDebts > 0 && (
        <div className="debt-summary-button">
          <button 
            className="action-btn"
            onClick={() => setShowDebtPopup(true)}
          >
            Ver Resumo de Dívidas ({debtSummary.numberOfDebts} títulos)
          </button>
        </div>
      )}
      
      {/* Popup de Resumo de Dívidas */}
      <Popup
        isOpen={showDebtPopup}
        onClose={() => setShowDebtPopup(false)}
        title="Resumo de Dívidas"
        size="large"
      >
        {debtSummary && (
          <div className="debt-popup-content">
            <div className="debt-quick-info">
              <div className="debt-metric">
                <label>Pagamento Mensal:</label>
                <span>{formatCurrency(debtSummary.totalMonthlyPayment)} bi USD</span>
              </div>
              <div className="debt-metric">
                <label>Principal Restante:</label>
                <span>{formatCurrency(debtSummary.principalRemaining)} bi USD</span>
              </div>
              <div className="debt-metric">
                <label>Total Futuro:</label>
                <span>{formatCurrency(debtSummary.totalFuturePayments)} bi USD</span>
              </div>
            </div>
            
            {countryEconomy.debtRecords && countryEconomy.debtRecords.length > 0 && (
              <div className="debt-details">
                <h4>Detalhes dos Títulos</h4>
                <table className="debt-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Valor Original</th>
                      <th>Restante</th>
                      <th>Taxa</th>
                      <th>Pagamento Mensal</th>
                      <th>Parcelas Restantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryEconomy.debtRecords.map((debt) => (
                      <tr key={debt.id}>
                        <td>{debt.id}</td>
                        <td>{formatCurrency(debt.originalValue)}</td>
                        <td>{formatCurrency(debt.remainingValue)}</td>
                        <td>{formatPercent(debt.interestRate)}</td>
                        <td>{formatCurrency(debt.monthlyPayment)}</td>
                        <td>{debt.remainingInstallments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Popup>
      
      {/* Balanço Setorial */}
      {sectoralBalance && (
        <div className="sectoral-balance">
          <h4>Balanço Setorial</h4>
          
          <div className="sector-item">
            <div className="sector-header">
              <span>Commodities</span>
              <span className={`balance-value ${sectoralBalance.commoditiesBalance >= 0 ? 'positive' : 'negative'}`}>
                {formatValueWithSign(sectoralBalance.commoditiesBalance)} bi USD
              </span>
            </div>
            <div className="sector-details">
              <span>Produção: {formatCurrency(sectoralBalance.commoditiesOutput)} bi</span>
              <span>Necessidade: {formatCurrency(sectoralBalance.commoditiesNeeds)} bi</span>
            </div>
          </div>
          
          <div className="sector-item">
            <div className="sector-header">
              <span>Manufaturas</span>
              <span className={`balance-value ${sectoralBalance.manufacturesBalance >= 0 ? 'positive' : 'negative'}`}>
                {formatValueWithSign(sectoralBalance.manufacturesBalance)} bi USD
              </span>
            </div>
            <div className="sector-details">
              <span>Produção: {formatCurrency(sectoralBalance.manufacturesOutput)} bi</span>
              <span>Necessidade: {formatCurrency(sectoralBalance.manufacturesNeeds)} bi</span>
            </div>
          </div>
          
          <div className="sector-item">
            <div className="sector-header">
              <span>Serviços</span>
              <span className="balance-value">
                {formatCurrency(sectoralBalance.servicesOutput)} bi USD
              </span>
            </div>
            <div className="sector-details">
              <span>Não comercializável internacionalmente</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedEconomyPanel;