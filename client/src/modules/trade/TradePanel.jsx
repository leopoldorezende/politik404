import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import '../../shared/styles/TradePanel.css';

// Garante que as importações de ações estão seguras, com fallbacks se necessário
let tradeActions = {};
try {
  // Tentativa de importar as ações do tradeState
  tradeActions = require('./tradeState');
} catch (error) {
  console.warn('Módulo tradeState não encontrado, usando ações mock');
  // Ações mock que não fazem nada
  tradeActions = {
    addTradeAgreement: () => ({ type: 'trade/addTradeAgreement' }),
    removeTradeAgreement: () => ({ type: 'trade/removeTradeAgreement' }),
    addTradeRoute: () => ({ type: 'trade/addTradeRoute' }),
    removeTradeRoute: () => ({ type: 'trade/removeTradeRoute' })
  };
}

const {
  addTradeAgreement,
  removeTradeAgreement,
  addTradeRoute,
  removeTradeRoute
} = tradeActions;

const TradePanel = () => {
  const dispatch = useDispatch();
  
  // Estados Redux com fallbacks seguros
  const myCountry = useSelector(state => state.game?.myCountry || 'Seu País');
  const countriesData = useSelector(state => state.game?.countriesData || {});
  const players = useSelector(state => state.game?.players || []);
  
  // Estados de comércio com fallbacks seguros
  const tradeAgreements = useSelector(state => state.trade?.tradeAgreements || []);
  const tradeRoutes = useSelector(state => state.trade?.tradeRoutes || {});
  
  // Estado local
  const [activeTab, setActiveTab] = useState('import');
  const [targetCountry, setTargetCountry] = useState('');
  
  // Lista de países para testes quando não há dados reais disponíveis
  const testCountries = [
    'United States', 'Russia', 'China', 'Germany', 'Japan', 'Brazil', 'India', 'France'
  ];
  
  // Obter países controlados por outros jogadores
  const getOtherPlayerCountries = () => {
    // Se não houver jogadores disponíveis, use a lista de teste
    if (!players || players.length === 0) {
      return testCountries;
    }
    
    return players
      .filter(player => {
        if (typeof player === 'object') {
          return player.username !== sessionStorage.getItem('username');
        }
        return false;
      })
      .map(player => typeof player === 'object' ? player.country : null)
      .filter(Boolean);
  };
  
  // Obter acordos comerciais do país do jogador por tipo
  const getMyAgreements = (type) => {
    if (!tradeAgreements) return [];
    
    return tradeAgreements.filter(agreement => 
      agreement.parties?.includes(myCountry) && agreement.type === type
    );
  };
  
  // Criar novo acordo comercial
  const handleCreateAgreement = () => {
    if (!targetCountry || targetCountry === myCountry) return;
    
    try {
      dispatch(addTradeAgreement({
        parties: [myCountry, targetCountry],
        resourceTypes: ['general'],
        type: activeTab,
        terms: {
          duration: 10, // 10 turnos
          volume: 100
        }
      }));
      
      // Adicionar a rota comercial correspondente
      dispatch(addTradeRoute({
        sourceCountry: activeTab === 'import' ? targetCountry : myCountry,
        destinationCountry: activeTab === 'import' ? myCountry : targetCountry,
        volume: 100,
        resourceType: 'general',
        routeType: activeTab
      }));
      
      // Limpar formulário
      setTargetCountry('');
    } catch (error) {
      console.error('Erro ao criar acordo comercial:', error);
    }
  };
  
  // Cancelar um acordo e sua rota correspondente
  const handleCancelAgreement = (agreement) => {
    try {
      // Remover o acordo
      dispatch(removeTradeAgreement({ id: agreement.id }));
      
      // Encontrar e remover a rota correspondente
      if (tradeRoutes[myCountry]) {
        const route = tradeRoutes[myCountry].find(r => 
          r.destination === (agreement.parties.find(p => p !== myCountry)) &&
          r.resourceType === agreement.resourceTypes[0] &&
          r.type === agreement.type
        );
        
        if (route) {
          dispatch(removeTradeRoute({ 
            sourceCountry: myCountry, 
            routeId: route.id 
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao cancelar acordo comercial:', error);
    }
  };
  
  // Formatar timestamp
  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      return 'Data desconhecida';
    }
  };
  
  // Componente de cartão para acordos
  const AgreementCard = ({ agreement }) => {
    if (!agreement || !agreement.parties) {
      return null;
    }
    
    const partnerCountry = agreement.parties.find(p => p !== myCountry);
    const isImport = agreement.type === 'import';
    
    return (
      <div className={`trade-card ${isImport ? 'import' : 'export'}`}>
        <h4>{isImport ? 'Importar de' : 'Exportar para'}: {partnerCountry}</h4>
        <p>Criado em: {formatTimestamp(agreement.createdAt)}</p>
        <button 
          className="cancel-btn" 
          onClick={() => handleCancelAgreement(agreement)}
        >
          Cancelar Acordo
        </button>
      </div>
    );
  };
  
  // Versão minimalista quando não há país selecionado
  if (!myCountry || myCountry === 'Seu País') {
    return (
      <div className="trade-panel">
        <h3>Comércio Internacional</h3>
        <p>Selecione um país para gerenciar o comércio.</p>
      </div>
    );
  }
  
  return (
    <div className="trade-panel">

          <h4>Exportação </h4>
          <div className="form-section">
            <div className="form-row">
            <label>
              <select 
                name="targetCountry"
                value={targetCountry}
                onChange={(e) => setTargetCountry(e.target.value)}
              >
                <option value="">Selecione um país</option>
                {getOtherPlayerCountries().map((country, index) => (
                  <option key={index} value={country}>{country}</option>
                ))}
              </select>
            </label>
          </div>
          
          <div className="form-actions">
            <button 
              onClick={handleCreateAgreement} 
              disabled={!targetCountry}
            >
              Criar acordo exportação
            </button>
          </div>
        </div>

        <h4>Importação </h4>
        <div className="form-section">
          <div className="form-row">
          <label>
            <select 
              name="targetCountry"
              value={targetCountry}
              onChange={(e) => setTargetCountry(e.target.value)}
            >
              <option value="">Selecione um país</option>
              {getOtherPlayerCountries().map((country, index) => (
                <option key={index} value={country}>{country}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button 
            onClick={handleCreateAgreement} 
            disabled={!targetCountry}
          >
            Criar acordo importação
          </button>
        </div>
        </div>
        
        <div className="agreements-list">
          <h4>Acordos de {activeTab === 'import' ? 'Importação' : 'Exportação'} Ativos</h4>
          {getMyAgreements(activeTab).length > 0 ? (
            <div className="cards-grid">
              {getMyAgreements(activeTab).map((agreement, index) => (
                <AgreementCard key={index} agreement={agreement} />
              ))}
            </div>
          ) : (
            <div className="no-data">
              <p>Nenhum acordo de {activeTab === 'import' ? 'importação' : 'exportação'} ativo</p>
            </div>
          )}
        </div>
      </div>
  );
};

export default TradePanel;