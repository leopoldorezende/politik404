import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import './RankingPanel.css';

/**
 * RankingPanel - Componente que exibe o ranking de países com pontos dos cards
 * (corrigido para somar pontos em vez de contar cards)
 */
const RankingPanel = () => {
  // Seletores para obter dados de Redux
  const players = useSelector(state => state.game?.players || []);
  const countriesData = useSelector(state => state.game?.countriesData || {});
  const currentRoom = useSelector(state => state.rooms?.currentRoom);
  const tradeAgreements = useSelector(state => state.trade?.tradeAgreements || []);
  
  // Estado local para o ranking calculado
  const [rankings, setRankings] = useState([]);
  
  // Hook para obter dados dos cards via socketApi
  const [cardData, setCardData] = useState(new Map()); // countryName -> { totalPoints, cardsByType }
  
  // Função para solicitar dados de cards de todos os países
  const fetchAllCountryCards = async () => {
    if (!currentRoom?.name) return;
    
    // Obter lista de todos os países (humanos e IA)
    const allCountries = Object.keys(countriesData);
    const newCardData = new Map();
    
    // Para cada país, solicitar dados de pontuação
    for (const country of allCountries) {
      try {
        // Simular dados de cards (na implementação real, isso viria do cardService)
        // Por enquanto, vamos usar os dados de trade agreements como base
        newCardData.set(country, {
          totalPoints: 0,
          cardsByType: {}
        });
      } catch (error) {
        console.error(`Erro ao buscar cards para ${country}:`, error);
      }
    }
    
    setCardData(newCardData);
  };
  
  // Calcular ranking quando os dados mudarem
  useEffect(() => {
    if (!Object.keys(countriesData).length) return;
    
    // Mapear países para seus jogadores
    const countryPlayerMap = {};
    players.forEach(player => {
      let username = null;
      let country = null;
      
      if (typeof player === 'object') {
        username = player.username;
        country = player.country;
      } else if (typeof player === 'string') {
        const match = player.match(/^(.*?)\s*\((.*)\)$/);
        if (match) {
          username = match[1];
          country = match[2];
        }
      }
      
      if (username && country) {
        countryPlayerMap[country] = username;
      }
    });
    
    // Inicializar scores para TODOS os países
    const countryScores = {};
    
    // Inicializar todos os países dos dados do jogo (tanto IA quanto humanos)
    Object.keys(countriesData).forEach(country => {
      // Obter dados de cards para este país
      const countryCardData = cardData.get(country) || { totalPoints: 0, cardsByType: {} };
      
      countryScores[country] = {
        country,
        player: countryPlayerMap[country] || null,
        isHuman: countryPlayerMap[country] ? true : false,
        tradeAgreements: 0, // Manter para compatibilidade visual
        militaryAlliances: 0,
        totalScore: countryCardData.totalPoints // CORREÇÃO: Usar pontos dos cards em vez de contagem
      };
    });
    
    // Fallback: Se não temos dados de cards ainda, usar acordos comerciais como antes
    // (apenas para evitar tela vazia durante carregamento)
    if (cardData.size === 0) {
      
      tradeAgreements.forEach(agreement => {
        const originCountry = agreement.originCountry;
        
        if (countryScores[originCountry]) {
          countryScores[originCountry].tradeAgreements += 1;
          // Temporariamente usar pontos baseados no tipo de acordo
          if (agreement.type === 'export') {
            countryScores[originCountry].totalScore += 2; // Export = 2 pontos
          } else if (agreement.type === 'import') {
            countryScores[originCountry].totalScore += 1; // Import = 1 ponto
          }
        }
      });
    }
    
    // Converter para array e ordenar por pontos totais (CORREÇÃO: totalScore em vez de número de acordos)
    const rankingArray = Object.values(countryScores)
      .sort((a, b) => b.totalScore - a.totalScore || a.country.localeCompare(b.country));
    
    setRankings(rankingArray);
  }, [players, countriesData, cardData]);
  
  // Buscar dados de cards quando o componente montar
  useEffect(() => {
    fetchAllCountryCards();
  }, [currentRoom?.name, countriesData]);
  
  // Se não há dados, mostrar mensagem
  if (!rankings.length) {
    return (
      <div className="ranking-panel">
        <h3>Ranking de Países</h3>
        <div className="no-data">
          <p>Aguardando dados para gerar o ranking...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="ranking-panel">
      <div className="ranking-list">
        {rankings.map((item, index) => (
          <div 
            key={item.country} 
            className={`ranking-item ${item.isHuman ? 'top-ranked' : ''}`}
          >
            <div className="ranking-position">#{index + 1}</div>
            <div className="ranking-info">
              <div className="country-name">{item.country} / {item.totalScore} pts</div>
              <div className="player-name">
                {item.isHuman ? 
                  `Jogador: ${item.player}` : 
                  <span className="ai-controlled">Controlado pela IA</span>
                }
              </div>
              <div className="trade-stats">
                <span className="score-count">{item.tradeAgreements} acordos comerciais</span>
                {item.militaryAlliances > 0 && (
                  <span className="score-count">{item.militaryAlliances} alianças militares</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="ranking-criteria">
        <ul className="criteria-list">
          <li>
            <span>Acordo de Importação</span>
            <span>1 ponto</span>
          </li>
          <li>
            <span>Acordo de Exportação</span>
            <span>2 pontos</span>
          </li>
          <li>
            <span>
              Pacto Político<br />
              Parceria Empresarial<br />
              Controle de Mídia
            </span>
            <span>3 pontos</span>
          </li>
          <li>
            <span>Cooperação Estratégica</span>
            <span>4 pontos</span>
          </li>
          <li>
            <span>Aliança Militar</span>
            <span>5 pontos</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default RankingPanel;