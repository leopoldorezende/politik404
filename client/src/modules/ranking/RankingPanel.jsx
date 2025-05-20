import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import './RankingPanel.css';

/**
 * RankingPanel - Componente que exibe o ranking de países com mais acordos comerciais
 * e (futuramente) alianças militares
 */
const RankingPanel = () => {
  // Seletores para obter dados de Redux
  const players = useSelector(state => state.game?.players || []);
  const tradeAgreements = useSelector(state => state.trade?.tradeAgreements || []);
  const countriesData = useSelector(state => state.game?.countriesData || {});
  
  // Estado local para o ranking calculado
  const [rankings, setRankings] = useState([]);
  
  // Calcular o ranking quando os acordos comerciais ou jogadores mudam
  useEffect(() => {
    if (!players.length || !Object.keys(countriesData).length) return;
    
    // Mapeie os países para seus jogadores
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
    
    // Contar acordos comerciais por país
    const countryScores = {};
    
    // Inicializar scores para todos os países com jogadores
    Object.keys(countryPlayerMap).forEach(country => {
      countryScores[country] = {
        country,
        player: countryPlayerMap[country],
        tradeAgreements: 0,
        militaryAlliances: 0, // Preparado para o futuro
        totalScore: 0
      };
    });
    
    // Contar acordos comerciais
    tradeAgreements.forEach(agreement => {
      // Consideramos apenas acordos onde o país é o originador para evitar dupla contagem
      const originCountry = agreement.originCountry;
      
      if (countryScores[originCountry]) {
        countryScores[originCountry].tradeAgreements += 1;
      }
    });
    
    // Calcular score total (no futuro, podemos adicionar peso para alianças militares)
    Object.values(countryScores).forEach(score => {
      score.totalScore = score.tradeAgreements + (score.militaryAlliances * 2); // Alianças valem o dobro
    });
    
    // Converter para array e ordenar por score total
    const rankingArray = Object.values(countryScores)
      .sort((a, b) => b.totalScore - a.totalScore || b.tradeAgreements - a.tradeAgreements);
    
    setRankings(rankingArray);
  }, [players, tradeAgreements, countriesData]);
  
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
      <h3>Ranking de Países</h3>
      
      <div className="ranking-header">
        <div className="ranking-criteria">
          Para cada:
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
              <span>Aliança Militar</span>
              <span>3 pontos</span>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="ranking-list">
        {rankings.map((item, index) => (
          <div key={item.country} className={`ranking-item ${index < 3 ? 'top-ranked' : ''}`}>
            <div className="ranking-position">#{index + 1}</div>
            <div className="ranking-info">
              <div className="country-name">{item.country} / {item.totalScore} pts</div>
              <div className="player-name">Jogador: {item.player}</div>
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
    </div>
  );
};

export default RankingPanel;