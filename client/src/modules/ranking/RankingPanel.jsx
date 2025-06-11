import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import './RankingPanel.css';

/**
 * RankingPanel - Componente que exibe o ranking de países
 */
const RankingPanel = () => {
  // Seletores para obter dados de Redux
  const players = useSelector(state => state.game?.players || []);
  const countriesData = useSelector(state => state.game?.countriesData || {});
  const playerCards = useSelector(state => state.cards?.playerCards || []);
  const playerRanking = useSelector(state => state.cards?.playerRanking || []);
  
  // Calcular o ranking usando useMemo para evitar recálculos desnecessários
  const rankings = useMemo(() => {
    if (!Object.keys(countriesData).length) return [];
    
    // Se temos dados do playerRanking (que vem do cardService), usar esses dados
    if (playerRanking && playerRanking.length > 0) {
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
      
      // Inicializar todos os países com pontuação zero
      const allCountries = {};
      Object.keys(countriesData).forEach(country => {
        allCountries[country] = {
          country,
          player: countryPlayerMap[country] || null,
          isHuman: !!countryPlayerMap[country],
          totalScore: 0,
          tradeAgreements: 0,
          militaryAlliances: 0
        };
      });
      
      // Atualizar com dados do ranking do cardService
      playerRanking.forEach(rankingData => {
        if (allCountries[rankingData.owner]) {
          allCountries[rankingData.owner].totalScore = rankingData.totalPoints;
          allCountries[rankingData.owner].tradeAgreements = (rankingData.cardsByType?.import || 0) + (rankingData.cardsByType?.export || 0);
          allCountries[rankingData.owner].militaryAlliances = rankingData.cardsByType?.military_alliance || 0;
        }
      });
      
      return Object.values(allCountries).sort((a, b) => b.totalScore - a.totalScore);
    }
    
    // Fallback: usar apenas playerCards se não temos playerRanking
    if (!Object.keys(countriesData).length) return;
    
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
    
    // Inicializar scores para TODOS os países
    const countryScores = {};
    
    // Inicializar todos os países dos dados do jogo
    Object.keys(countriesData).forEach(country => {
      countryScores[country] = {
        country,
        player: countryPlayerMap[country] || null,
        isHuman: countryPlayerMap[country] ? true : false,
        tradeAgreements: 0,
        militaryAlliances: 0,
        totalScore: 0
      };
    });
    
    // Calcular pontuação baseada nos playerCards (fallback)
    if (playerCards && playerCards.length > 0) {
      playerCards.forEach(card => {
        const owner = card.owner;
        if (countryScores[owner]) {
          // Somar pontos baseado no tipo de card
          let points = 0;
          switch(card.type) {
            case 'import':
              points = 1;
              countryScores[owner].tradeAgreements += 1;
              break;
            case 'export':
              points = 2;
              countryScores[owner].tradeAgreements += 1;
              break;
            case 'political_pact':
            case 'business_partnership':
            case 'media_control':
              points = 3;
              break;
            case 'strategic_cooperation':
              points = 4;
              break;
            case 'military_alliance':
              points = 5;
              countryScores[owner].militaryAlliances += 1;
              break;
            default:
              points = 1;
          }
          countryScores[owner].totalScore += points;
        }
      });
    }
    
    // Converter para array e ordenar por score total
    const rankingArray = Object.values(countryScores)
      .sort((a, b) => b.totalScore - a.totalScore || b.tradeAgreements - a.tradeAgreements);
    
    return rankingArray;
  }, [players, countriesData, playerCards, playerRanking]);
  
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

  // Função para lidar com clique no país do ranking
  const handleCountryClick = (countryName) => {
    console.log(`Clique no país do ranking: ${countryName}`);
    
    // Usar função global exposta pelo MapView, passando 'ranking' como source
    if (window.selectCountryOnMap) {
      console.log(`Selecionando país via função global: ${countryName}`);
      window.selectCountryOnMap(countryName, 'ranking'); // Passar source como 'ranking'
    } else {
      console.warn('Função selectCountryOnMap não disponível - fallback para Redux');
      // Fallback: apenas atualizar Redux sem animação
      // Importar useDispatch e setSelectedCountry se necessário para fallback
    }
  };

  return (
    <div className="ranking-panel">
      <div className="ranking-list">
        {rankings.map((item, index) => (
          <div 
            key={item.country} 
            className={`ranking-item ${item.isHuman ? 'top-ranked' : ''}`}
            onClick={() => handleCountryClick(item.country)}
          >
            <div className="ranking-position">{index + 1}


            </div>
            <div className="ranking-info">
              <div className="country-name">{item.country}</div>
              <small>{item.totalScore} pts</small>
              <div className="player-name">
                {item.isHuman ? 
                  item.player : 
                  <span className="ai-controlled">Controlado pela IA</span>
                }
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default RankingPanel;