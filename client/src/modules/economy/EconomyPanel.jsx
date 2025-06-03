/**
 * EconomyPanel.jsx - Simplificado usando hook direto
 * Remove toda complexidade do Redux
 */

import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useEconomy, usePublicDebt } from '../../hooks/useEconomy';
import { socketApi } from '../../services/socketClient';
import MessageService from '../../ui/toast/messageService';
import './EconomyPanel.css';

const EconomyPanel = ({ onOpenDebtPopup }) => {
  // Estados básicos do Redux (mantidos apenas para info da sala/país)
  const myCountry = useSelector(state => state.game?.myCountry);
  const currentRoom = useSelector(state => state.rooms?.currentRoom);
  
  // Hook direto para dados econômicos (substitui Redux)
  const { economicIndicators, loading, formatPercent } = useEconomy(
    currentRoom?.name, 
    myCountry
  );
  
  // Formatação específica para valores em bilhões com 2 casas decimais
  const formatCurrency = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00';
    return Number(value).toFixed(2);
  };
  
  // Hook para dívida pública
  const { debtSummary, refresh: refreshDebt } = usePublicDebt(
    currentRoom?.name, 
    myCountry
  );
  
  // Estados locais apenas para UI
  const [localParameters, setLocalParameters] = useState({
    interestRate: 0,
    taxBurden: 0,
    publicServices: 0
  });
  const [bondAmount, setBondAmount] = useState('');
  const [isIssuingBonds, setIsIssuingBonds] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState(new Set());

  // Sincronizar parâmetros locais com dados do servidor
  React.useEffect(() => {
    if (economicIndicators && pendingUpdates.size === 0) {
      const newParams = {
        interestRate: economicIndicators.interestRate,
        taxBurden: economicIndicators.taxBurden,
        publicServices: economicIndicators.publicServices
      };

      // console.log('[SYNC DEBUG] economicIndicators received:', {
      //   interestRate: economicIndicators.interestRate,
      //   taxBurden: economicIndicators.taxBurden,
      //   publicServices: economicIndicators.publicServices
      // });
      
      if (JSON.stringify(newParams) !== JSON.stringify(localParameters)) {
        setLocalParameters(newParams);
      }
    }
  }, [economicIndicators?.interestRate, economicIndicators?.taxBurden, economicIndicators?.publicServices]);

  // ======================================================================
  // HANDLERS SIMPLIFICADOS
  // ======================================================================

const applyAllParameters = useCallback(async () => {
  if (!currentRoom?.name || !myCountry) {
    // console.error('[ECONOMY] Missing room or country:', { room: currentRoom?.name, country: myCountry });
    MessageService.showError('Dados da sala ou país não encontrados');
    return;
  }
  
  const parameters = [
    { name: 'interestRate', value: localParameters.interestRate, min: 0, max: 25 },
    { name: 'taxBurden', value: localParameters.taxBurden, min: 0, max: 60 },
    { name: 'publicServices', value: localParameters.publicServices, min: 0, max: 60 }
  ];
  
  // console.log('[ECONOMY] Applying parameters:', parameters);
  // console.log('[ECONOMY] Room:', currentRoom.name, 'Country:', myCountry);
  
  // Validação
  for (const param of parameters) {
    if (isNaN(param.value) || param.value < param.min || param.value > param.max) {
      // console.error('[ECONOMY] Invalid parameter:', param);
      MessageService.showError(`${param.name} deve estar entre ${param.min}% e ${param.max}%`);
      return;
    }
  }

  setPendingUpdates(new Set(['interestRate', 'taxBurden', 'publicServices']));
  
  try {
    const socket = socketApi.getSocketInstance();
    if (!socket) {
      throw new Error('Socket não disponível');
    }
    
    if (!socket.connected) {
      throw new Error('Socket não conectado');
    }
    
    // console.log('[ECONOMY] Socket status:', { 
    //   connected: socket.connected, 
    //   id: socket.id 
    // });
    
    for (const param of parameters) {
      // console.log('[ECONOMY] Sending parameter update:', param);
      socket.emit('updateEconomicParameter', {
        parameter: param.name,
        value: param.value
      });
    }
    
    // Timeout para resetar pending se não receber resposta
    setTimeout(() => {
      setPendingUpdates(prev => {
        if (prev.size > 0) {
          // console.warn('[ECONOMY] Timeout waiting for parameter updates');
          MessageService.showWarning('Tempo limite para atualização. Tente novamente.');
          return new Set();
        }
        return prev;
      });
    }, 10000); // 10 segundos
    
  } catch (error) {
    // console.error('[ECONOMY] Error in applyAllParameters:', error);
    MessageService.showError(`Erro ao atualizar parâmetros: ${error.message}`);
    setPendingUpdates(new Set());
  }
}, [currentRoom?.name, myCountry, localParameters]);

  const cancelChanges = useCallback(() => {
    if (economicIndicators) {
      setLocalParameters({
        interestRate: economicIndicators.interestRate,
        taxBurden: economicIndicators.taxBurden,
        publicServices: economicIndicators.publicServices
      });
    }
  }, [economicIndicators]);

  const handleIssueBonds = useCallback(async () => {
    const amount = parseFloat(bondAmount);
    
    if (!amount || amount <= 0 || amount > 1000) {
      MessageService.showError('Valor deve estar entre 0 e 1000 bilhões');
      return;
    }
    
    setIsIssuingBonds(true);
    
    try {
      const socket = socketApi.getSocketInstance();
      if (socket) {
        socket.emit('issueDebtBonds', { bondAmount: amount });
        setBondAmount('');
      }
    } catch (error) {
      console.error('Erro ao emitir títulos:', error);
      MessageService.showError('Erro ao emitir títulos: ' + error.message);
      setIsIssuingBonds(false);
    }
  }, [bondAmount]);

  const handleOpenDebtPopup = useCallback(() => {
    if (debtSummary && onOpenDebtPopup) {
      // Usar dados do debtSummary que já contém economicData
      const economicData = debtSummary.economicData || {
        gdp: economicIndicators?.gdp || 0,
        treasury: economicIndicators?.treasury || 0,
        publicDebt: economicIndicators?.publicDebt || 0
      };
      
      onOpenDebtPopup(debtSummary, debtSummary.debtRecords || [], economicData);
    } else {
      MessageService.showWarning('Aguardando dados de dívida...');
      // Tentar buscar dados novamente
      refreshDebt();
    }
  }, [debtSummary, onOpenDebtPopup, economicIndicators, refreshDebt]);

  // ======================================================================
  // HANDLERS DE EVENTOS DO SERVIDOR
  // ======================================================================

  React.useEffect(() => {
    const socket = socketApi.getSocketInstance();
    if (!socket) return;

    const handleParameterUpdated = (data) => {
      // console.log('[ECONOMY] Parameter updated response:', data);
      
      const { countryName, parameter, success } = data;
      
      if (countryName === myCountry) {
        setPendingUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(parameter);
          // console.log('[ECONOMY] Removed from pending:', parameter, 'Remaining:', Array.from(newSet));
          return newSet;
        });
        
        if (success) {
          // const parameterNames = {
          //   interestRate: 'Taxa de Juros',
          //   taxBurden: 'Carga Tributária', 
          //   publicServices: 'Investimento Público'
          // };
          
          // const parameterName = parameterNames[parameter] || parameter;
          // MessageService.showSuccess(`${parameterName} alterada para ${data.value}%`);
        } else {
          MessageService.showError(`Falha ao atualizar ${parameter}`);
        }
      }
    };

    const handleDebtBondsIssued = (data) => {
      // console.log('[ECONOMY] Debt bonds issued response:', data);
      
      const { success, bondAmount: issuedAmount, message } = data;
      
      if (success) {
        MessageService.showSuccess(`Títulos emitidos: ${issuedAmount} bi USD`, 4000);
        setTimeout(refreshDebt, 500);
      } else {
        MessageService.showError(message || 'Falha na emissão de títulos');
      }
      
      setIsIssuingBonds(false);
    };

    socket.on('economicParameterUpdated', handleParameterUpdated);
    socket.on('debtBondsIssued', handleDebtBondsIssued);

    return () => {
      socket.off('economicParameterUpdated', handleParameterUpdated);
      socket.off('debtBondsIssued', handleDebtBondsIssued);
    };
  }, [myCountry, refreshDebt]);

  // ======================================================================
  // VALIDAÇÕES
  // ======================================================================

  if (!myCountry) {
    return (
      <div className="advanced-economy-panel">
        <p>Você precisa estar controlando um país para ver os dados econômicos.</p>
      </div>
    );
  }

  if (loading || !economicIndicators) {
    return (
      <div className="advanced-economy-panel">
        <p>Carregando dados econômicos...</p>
      </div>
    );
  }

  // Verificar se há mudanças nos parâmetros
  const hasChanges = Math.abs(localParameters.interestRate - economicIndicators.interestRate) >= 0.1 ||
                  Math.abs(localParameters.taxBurden - economicIndicators.taxBurden) >= 0.1 ||
                  Math.abs(localParameters.publicServices - economicIndicators.publicServices) >= 0.1;

  const getCreditRatingColor = (rating) => {
    if (['AAA', 'AA', 'A'].includes(rating)) return '#28a745';
    if (rating === 'BBB') return '#ffc107';
    if (['BB', 'B'].includes(rating)) return '#fd7e14';
    return '#dc3545';
  };

  const formatValueWithSign = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0';
    const num = Number(value);
    return (num >= 0 ? '+' : '') + num.toFixed(1);
  };

  
  // ======================================================================
  // RENDER
  // ======================================================================

  return (
    <div className="advanced-economy-panel">
      
      {/* Indicadores Principais */}
      <div className="main-indicators">
        <div className="indicator">
          <label>PIB:</label>
          <div className="indicator-value">
            <span className="value">{formatCurrency(economicIndicators.gdp)} bi</span>
            <span className={`growth ${economicIndicators.gdpGrowth >= 0 ? 'positive' : 'negative'}`}>
              {formatValueWithSign(economicIndicators.gdpGrowth)}% anual
            </span>
          </div>
        </div>
        
        <div className="indicator">
          <label>Tesouro:</label>
          <span className={`value ${economicIndicators.treasury >= 0 ? '' : 'negative'}`}>
            {formatCurrency(economicIndicators.treasury)} bi
          </span>
        </div>
        
        <div className="indicator">
          <label>Dívida Pública:</label>
          <div className="indicator-value">
            <span className="value">{formatCurrency(economicIndicators.publicDebt)} bi</span>
            <span className="debt-ratio">
              {formatPercent((economicIndicators.publicDebt / economicIndicators.gdp) * 100)} PIB
            </span>
          </div>
        </div>
        
        <div className="indicator">
          <label>Inflação:</label>
          <span className={`value ${economicIndicators.inflation > 5 ? 'negative' : 'positive'}`}>
            {formatPercent(economicIndicators.inflation * 100)} {/* CORREÇÃO: multiplicar por 100 */}
          </span>
        </div>
        
        <div className="indicator">
          <label>Desemprego:</label>
          <span className={`value ${economicIndicators.unemployment > 10 ? 'negative' : 'positive'}`}>
            {formatPercent(economicIndicators.unemployment)}
          </span>
        </div>
        
        <div className="indicator">
          <label>Popularidade:</label>
          <span className={`value ${economicIndicators.popularity > 50 ? 'positive' : 'negative'}`}>
            {formatPercent(economicIndicators.popularity)}
          </span>
        </div>
        
        <div className="indicator credit-indicator">
          <label>Rating:</label>
          <span 
            className="credit-rating" 
            style={{ color: getCreditRatingColor(economicIndicators.creditRating) }}
          >
            {economicIndicators.creditRating}
          </span>
        </div>
      </div>
      
      {/* Controles Econômicos */}
      <div className="economic-controls">
        <div className="control-group">
          <label>Taxa de Juros: {formatPercent(localParameters.interestRate)}</label>
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
              disabled={pendingUpdates.size > 0}
            />
          </div>
        </div>
        
        <div className="control-group">
          <label>Carga Tributária: {formatPercent(localParameters.taxBurden)}</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="60"
              step="0.5"
              value={localParameters.taxBurden}
              onChange={(e) => setLocalParameters(prev => ({
                ...prev,
                taxBurden: parseFloat(e.target.value)
              }))}
              disabled={pendingUpdates.size > 0}
            />
          </div>
        </div>
        
        <div className="control-group">
          <label>Investimento Público: {formatPercent(localParameters.publicServices)}</label>
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
              disabled={pendingUpdates.size > 0}
            />
          </div>
        </div>
        
        {/* Botões para aplicar e cancelar parâmetros */}
        {hasChanges && (
          <div className="apply-parameters">
            <button 
              onClick={cancelChanges}
              disabled={pendingUpdates.size > 0}
              className="btn-cancel-parameters"
            >
              Cancelar
            </button>
            <button 
              onClick={applyAllParameters}
              disabled={pendingUpdates.size > 0}
              className="btn-apply-parameters"
            >
              {pendingUpdates.size > 0 ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        )}
      </div>
      
      {/* Emissão de Títulos */}
      <div className="bonds-section">
        <h4>Emitir dívida pública</h4>
        
        <div className="bonds-controls">
          <input
            type="number"
            placeholder="Valor (bi USD)"
            min="0"
            max="1000"
            step="0.1"
            value={bondAmount}
            onChange={(e) => setBondAmount(e.target.value)}
            disabled={isIssuingBonds}
          />
          <button 
            className="btn-issue-bonds"
            onClick={handleIssueBonds}
            disabled={isIssuingBonds || !bondAmount || parseFloat(bondAmount) <= 0}
          >
            {isIssuingBonds ? 'Emitindo...' : 'Emitir'}
          </button>
        </div>
        
        {/* Informação sobre capacidade de endividamento */}
        {economicIndicators.publicDebt > 0 && (
          <div className="debt-info">
            <small>
              Capacidade: {formatPercent(Math.max(0, 120 - (economicIndicators.publicDebt / economicIndicators.gdp) * 100))} restante
            </small>
          </div>
        )}
        
        {/* Botão de resumo de dívidas */}
        {debtSummary && debtSummary.numberOfContracts > 0 && (
          <button 
            className="debt-summary-btn"
            onClick={handleOpenDebtPopup}
          >
            Ver Dívidas ({debtSummary.numberOfContracts} {debtSummary.numberOfContracts === 1 ? 'contrato' : 'contratos'})
          </button>
        )}
      </div>
    </div>
  );
};

export default EconomyPanel;