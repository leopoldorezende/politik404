const redis = require('../../shared/redisClient');

/**
 * Verifica se os indicadores econômicos estão em uma faixa saudável
 * @param {Object} economyData - Dados econômicos de um país
 * @returns {Object} - Relatório de saúde econômica
 */
function assessEconomicHealth(economyData) {
    if (!economyData) {
      return { status: 'unknown', issues: ['Dados econômicos não disponíveis'] };
    }
    
    const issues = [];
    let healthScore = 100; // Pontuação inicial
    
    // Verifica o crescimento do PIB
    if (economyData.gdpGrowth < 0) {
      issues.push('Recessão: crescimento do PIB negativo');
      healthScore -= 30;
    } else if (economyData.gdpGrowth < 1) {
      issues.push('Crescimento do PIB estagnado');
      healthScore -= 15;
    } else if (economyData.gdpGrowth > 8) {
      issues.push('Crescimento do PIB potencialmente insustentável');
      healthScore -= 5;
    }
    
    // Verifica a inflação
    if (economyData.inflation > 10) {
      issues.push('Inflação alta');
      healthScore -= 20;
    } else if (economyData.inflation > 5) {
      issues.push('Inflação moderadamente alta');
      healthScore -= 10;
    } else if (economyData.inflation < 0) {
      issues.push('Deflação: inflação negativa');
      healthScore -= 20;
    }
    
    // Verifica o desemprego
    if (economyData.unemployment > 10) {
      issues.push('Desemprego alto');
      healthScore -= 15;
    } else if (economyData.unemployment > 7) {
      issues.push('Desemprego moderadamente alto');
      healthScore -= 8;
    }
    
    // Verifica a dívida pública
    if (economyData.publicDebtToGdp > 100) {
      issues.push('Dívida pública muito alta');
      healthScore -= 20;
    } else if (economyData.publicDebtToGdp > 60) {
      issues.push('Dívida pública moderadamente alta');
      healthScore -= 10;
    }
    
    // Determina o status geral com base na pontuação
    let status;
    if (healthScore >= 80) {
      status = 'healthy';
    } else if (healthScore >= 60) {
      status = 'stable';
    } else if (healthScore >= 40) {
      status = 'concerning';
    } else {
      status = 'crisis';
    }
    
    return {
      status,
      healthScore,
      issues,
      recommendations: generateRecommendations(economyData, issues)
    };
  }
  
  /**
   * Gera recomendações de políticas com base nos problemas econômicos
   * @param {Object} economyData - Dados econômicos de um país
   * @param {Array} issues - Lista de problemas identificados
   * @returns {Array} - Lista de recomendações de políticas
   */
  function generateRecommendations(economyData, issues) {
    const recommendations = [];
    
    // Recomendações para crescimento do PIB
    if (issues.some(issue => issue.includes('Recessão'))) {
      if (economyData.interestRate > 3) {
        recommendations.push('Reduzir taxa de juros para estimular crescimento');
      }
      if (economyData.taxBurden > 25) {
        recommendations.push('Considerar cortes temporários de impostos para estimular a economia');
      }
      recommendations.push('Aumentar investimentos públicos em infraestrutura');
    } else if (issues.some(issue => issue.includes('estagnado'))) {
      recommendations.push('Investir em pesquisa e desenvolvimento para impulsionar produtividade');
      recommendations.push('Implementar reformas estruturais para melhorar eficiência econômica');
    } else if (issues.some(issue => issue.includes('insustentável'))) {
      recommendations.push('Aumentar gradualmente a taxa de juros para moderar o crescimento');
      recommendations.push('Fortalecer regulações financeiras para evitar bolhas de ativos');
    }
    
    // Recomendações para inflação
    if (issues.some(issue => issue.includes('Inflação alta'))) {
      recommendations.push('Aumentar significativamente a taxa de juros para controlar inflação');
      recommendations.push('Reduzir gastos públicos para diminuir pressão inflacionária');
    } else if (issues.some(issue => issue.includes('moderadamente alta'))) {
      recommendations.push('Aumentar moderadamente a taxa de juros');
      recommendations.push('Monitorar crescimento da oferta monetária');
    } else if (issues.some(issue => issue.includes('Deflação'))) {
      recommendations.push('Reduzir drasticamente a taxa de juros');
      recommendations.push('Implementar programa de estímulo fiscal');
      recommendations.push('Considerar políticas monetárias não convencionais');
    }
    
    // Recomendações para desemprego
    if (issues.some(issue => issue.includes('Desemprego alto'))) {
      recommendations.push('Implementar programas de treinamento e capacitação');
      recommendations.push('Oferecer incentivos fiscais para criação de empregos');
      recommendations.push('Investir em obras públicas para gerar empregos');
    } else if (issues.some(issue => issue.includes('Desemprego moderadamente alto'))) {
      recommendations.push('Melhorar serviços de colocação profissional');
      recommendations.push('Oferecer estímulos para setores com maior potencial de geração de empregos');
    }
    
    // Recomendações para dívida pública
    if (issues.some(issue => issue.includes('Dívida pública muito alta'))) {
      recommendations.push('Implementar plano rigoroso de redução de gastos');
      recommendations.push('Aumentar impostos progressivamente');
      recommendations.push('Renegociar termos da dívida se possível');
    } else if (issues.some(issue => issue.includes('Dívida pública moderadamente alta'))) {
      recommendations.push('Estabelecer metas fiscais de médio prazo');
      recommendations.push('Melhorar eficiência dos gastos públicos');
      recommendations.push('Implementar regras fiscais para limitar déficits futuros');
    }
    
    return recommendations;
  }
  
  /**
   * Projeta indicadores econômicos futuros com base nas tendências atuais
   * @param {Object} economyData - Dados econômicos atuais
   * @param {number} periods - Número de períodos para projetar
   * @returns {Array} - Projeções econômicas para os períodos futuros
   */
  function projectEconomicTrends(economyData, periods = 5) {
    if (!economyData) {
      return null;
    }
    
    const projections = [];
    let currentProjection = { ...economyData };
    
    // Função auxiliar para adicionar variação aleatória
    const addVariation = (value, baseVariation = 0.2) => {
      const variation = (Math.random() * baseVariation * 2) - baseVariation;
      return value + variation;
    };
    
    for (let i = 0; i < periods; i++) {
      // Clone o objeto anterior para não modificá-lo
      const newProjection = { ...currentProjection };
      
      // Projeta crescimento do PIB
      newProjection.gdpGrowth = Math.round((addVariation(currentProjection.gdpGrowth, 0.5)) * 100) / 100;
      
      // Projeta PIB com base no crescimento
      if (newProjection.gdp && typeof newProjection.gdp === 'object') {
        const growthFactor = 1 + (newProjection.gdpGrowth / 100);
        newProjection.gdp = {
          ...newProjection.gdp,
          value: Math.round((currentProjection.gdp.value * growthFactor) * 100) / 100
        };
      }
      
      // Projeta inflação
      newProjection.inflation = Math.max(0, Math.round((addVariation(currentProjection.inflation, 0.3)) * 100) / 100);
      
      // Projeta desemprego
      const employmentChange = -0.1 * newProjection.gdpGrowth + addVariation(0, 0.2);
      newProjection.unemployment = Math.max(2, Math.round((currentProjection.unemployment + employmentChange) * 100) / 100);
      
      // Projeta tesouro com base na arrecadação de impostos e crescimento
      if (newProjection.treasury && typeof newProjection.treasury === 'object' && newProjection.gdp && typeof newProjection.gdp === 'object') {
        const taxRevenue = newProjection.gdp.value * (newProjection.taxBurden / 100) * 0.1;
        newProjection.treasury = {
          ...newProjection.treasury,
          value: Math.round((currentProjection.treasury.value + taxRevenue) * 100) / 100
        };
      }
      
      // Projeta dívida pública
      if (newProjection.publicDebt && typeof newProjection.publicDebt === 'object') {
        // Assume um déficit/superávit baseado no crescimento e arrecadação
        const deficitFactor = 0.02 - (newProjection.gdpGrowth / 200);
        const debtChange = newProjection.gdp.value * deficitFactor;
        
        newProjection.publicDebt = {
          ...newProjection.publicDebt,
          value: Math.round((currentProjection.publicDebt.value + debtChange) * 100) / 100
        };
        
        // Atualiza relação dívida/PIB
        if (newProjection.gdp && typeof newProjection.gdp === 'object') {
          newProjection.publicDebtToGdp = Math.round((newProjection.publicDebt.value / newProjection.gdp.value * 100) * 100) / 100;
        }
      }
      
      // Projeta popularidade
      if (newProjection.popularity !== undefined) {
        // Fatores que afetam a popularidade
        const growthEffect = newProjection.gdpGrowth > 2 ? 2 : newProjection.gdpGrowth < 0 ? -3 : 0;
        const inflationEffect = newProjection.inflation > 5 ? -2 : newProjection.inflation < 2 ? 1 : 0;
        const unemploymentEffect = newProjection.unemployment > 8 ? -2 : newProjection.unemployment < 4 ? 2 : 0;
        
        const popularityChange = growthEffect + inflationEffect + unemploymentEffect + addVariation(0, 1);
        newProjection.popularity = Math.max(0, Math.min(100, Math.round(currentProjection.popularity + popularityChange)));
      }
      
      // Adiciona período à projeção
      newProjection.period = i + 1;
      
      // Adiciona à lista de projeções
      projections.push(newProjection);
      
      // Atualiza a projeção atual para a próxima iteração
      currentProjection = newProjection;
    }
    
    return projections;
  }
  
  /**
   * Calcula o impacto econômico de um investimento
   * @param {Object} economyData - Dados econômicos do país
   * @param {number} investmentAmount - Montante do investimento
   * @param {string} sector - Setor econômico do investimento (ex: 'infrastructure', 'technology')
   * @returns {Object} - Impacto calculado do investimento
   */
  function calculateInvestmentImpact(economyData, investmentAmount, sector) {
    if (!economyData || !investmentAmount || investmentAmount <= 0) {
      return null;
    }
    
    // Multiplicadores de efeito do investimento por setor
    const multipliers = {
      infrastructure: {
        gdpGrowth: 1.8,
        unemployment: 2.0,
        longTerm: 1.5
      },
      technology: {
        gdpGrowth: 2.2,
        unemployment: 0.8,
        longTerm: 2.0
      },
      healthcare: {
        gdpGrowth: 1.6,
        unemployment: 1.7,
        longTerm: 1.3
      },
      education: {
        gdpGrowth: 1.4,
        unemployment: 1.2,
        longTerm: 2.5
      },
      manufacturing: {
        gdpGrowth: 1.7,
        unemployment: 1.8,
        longTerm: 1.2
      },
      default: {
        gdpGrowth: 1.5,
        unemployment: 1.5,
        longTerm: 1.0
      }
    };
    
    // Obtém o multiplicador apropriado para o setor
    const multiplier = multipliers[sector] || multipliers.default;
    
    // Calcula o investimento relativo ao PIB
    const gdpValue = economyData.gdp && typeof economyData.gdp === 'object' ? economyData.gdp.value : 0;
    const relativeInvestment = gdpValue > 0 ? investmentAmount / gdpValue : 0;
    
    // Calcula os impactos
    const gdpGrowthImpact = relativeInvestment * 100 * multiplier.gdpGrowth;
    const unemploymentImpact = -(relativeInvestment * 100 * multiplier.unemployment);
    
    // Calcula impacto a curto e longo prazo
    const shortTermImpact = {
      gdpGrowth: Math.round((economyData.gdpGrowth + gdpGrowthImpact * 0.7) * 100) / 100,
      unemployment: Math.max(2, Math.round((economyData.unemployment + unemploymentImpact * 0.5) * 100) / 100),
      explanation: `Investimento de ${investmentAmount} ${economyData.gdp?.unit || 'unidades'} em ${sector} gera estímulo econômico a curto prazo.`
    };
    
    const longTermImpact = {
      gdpGrowth: Math.round((economyData.gdpGrowth + gdpGrowthImpact * 0.3 * multiplier.longTerm) * 100) / 100,
      unemployment: Math.max(2, Math.round((economyData.unemployment + unemploymentImpact * 0.3 * multiplier.longTerm) * 100) / 100),
      productivity: Math.round((relativeInvestment * 100 * multiplier.longTerm) * 100) / 100,
      explanation: `Efeitos a longo prazo incluem aumento de produtividade e crescimento sustentável no setor de ${sector}.`
    };
    
    return {
      immediateImpact: {
        treasuryChange: -investmentAmount,
        gdpChange: investmentAmount * 0.8
      },
      shortTermImpact,
      longTermImpact,
      sector,
      investmentAmount,
      roi: multiplier.gdpGrowth * multiplier.longTerm // Retorno estimado sobre investimento
    };
  }
  
  /**
   * Compara indicadores econômicos entre dois ou mais países
   * @param {Object} countriesData - Dados econômicos de vários países
   * @param {Array} indicators - Lista de indicadores a serem comparados
   * @returns {Object} - Resultados da comparação
   */
  function compareEconomies(countriesData, indicators) {
    if (!countriesData || Object.keys(countriesData).length < 1) {
      return null;
    }
    
    // Validar indicadores
    const validIndicators = indicators?.filter(i => 
      ['gdp', 'gdpGrowth', 'inflation', 'unemployment', 'publicDebtToGdp', 'taxBurden', 'interestRate']
      .includes(i)
    ) || ['gdp', 'gdpGrowth', 'inflation', 'unemployment'];
    
    const comparison = {
      indicators: validIndicators,
      countries: {},
      rankings: {}
    };
    
    // Inicializa rankings
    validIndicators.forEach(indicator => {
      comparison.rankings[indicator] = [];
    });
    
    // Coleta dados para cada país
    for (const [countryName, data] of Object.entries(countriesData)) {
      if (!data.economy) continue;
      
      const economyData = data.economy;
      
      comparison.countries[countryName] = {};
      
      // Coleta valores de cada indicador
      validIndicators.forEach(indicator => {
        let value;
        
        if (indicator === 'gdp' && economyData.gdp && typeof economyData.gdp === 'object') {
          value = economyData.gdp.value;
          comparison.countries[countryName][indicator] = {
            value: value,
            unit: economyData.gdp.unit || ''
          };
        } else {
          value = economyData[indicator];
          comparison.countries[countryName][indicator] = value;
        }
        
        // Adiciona ao ranking
        comparison.rankings[indicator].push({
          country: countryName,
          value: value
        });
      });
    }
    
    // Ordena rankings
    for (const indicator of validIndicators) {
      // Indicadores onde valores mais baixos são melhores
      const lowerIsBetter = ['inflation', 'unemployment', 'publicDebtToGdp'];
      
      comparison.rankings[indicator].sort((a, b) => {
        if (lowerIsBetter.includes(indicator)) {
          return a.value - b.value; // Ordem crescente
        } else {
          return b.value - a.value; // Ordem decrescente
        }
      });
    }
    
    // Adiciona posição relativa no ranking a cada país
    for (const [countryName, countryData] of Object.entries(comparison.countries)) {
      for (const indicator of validIndicators) {
        const rank = comparison.rankings[indicator].findIndex(item => item.country === countryName) + 1;
        const totalCountries = Object.keys(comparison.countries).length;
        
        // Adiciona informações de ranking
        if (typeof countryData[indicator] === 'object') {
          countryData[indicator].rank = rank;
          countryData[indicator].outOf = totalCountries;
        } else {
          countryData[indicator] = {
            value: countryData[indicator],
            rank: rank,
            outOf: totalCountries
          };
        }
      }
    }
    
    return comparison;
  }
  
  /**
   * Calcula a métrica de poder econômico global de um país
   * @param {Object} economyData - Dados econômicos do país
   * @returns {Object} - Pontuação de poder econômico e detalhes
   */
  function calculateEconomicPower(economyData) {
    if (!economyData) {
      return { score: 0, details: { error: 'Dados econômicos não disponíveis' } };
    }
    
    const details = {};
    let totalScore = 0;
    
    // Pontuação baseada no PIB (até 40 pontos)
    if (economyData.gdp && typeof economyData.gdp === 'object') {
      // Escala logarítmica para o PIB (em bilhões)
      const gdpInBillions = economyData.gdp.unit === 'billion USD' 
        ? economyData.gdp.value 
        : economyData.gdp.value / 1000;
      
      details.gdpScore = Math.min(40, Math.round(Math.log10(gdpInBillions) * 10));
      totalScore += details.gdpScore;
    } else {
      details.gdpScore = 0;
    }
    
    // Pontuação baseada no crescimento (até 20 pontos)
    if (economyData.gdpGrowth !== undefined) {
      // Crescimento acima de 6% = pontuação máxima
      details.growthScore = Math.min(20, Math.round(economyData.gdpGrowth * 3.33));
      // Crescimento negativo = pontuação zero
      details.growthScore = Math.max(0, details.growthScore);
      totalScore += details.growthScore;
    } else {
      details.growthScore = 0;
    }
    
    // Pontuação baseada na estabilidade econômica (até 20 pontos)
    let stabilityScore = 20;
    
    // Redução por inflação alta
    if (economyData.inflation !== undefined) {
      const inflationPenalty = Math.min(10, Math.max(0, economyData.inflation - 3) * 2);
      stabilityScore -= inflationPenalty;
    }
    
    // Redução por desemprego alto
    if (economyData.unemployment !== undefined) {
      const unemploymentPenalty = Math.min(10, Math.max(0, economyData.unemployment - 5) * 2);
      stabilityScore -= unemploymentPenalty;
    }
    
    details.stabilityScore = Math.max(0, stabilityScore);
    totalScore += details.stabilityScore;
    
    // Pontuação baseada em recursos (até 20 pontos)
    if (economyData.naturalResources !== undefined) {
      details.resourcesScore = Math.min(20, economyData.naturalResources * 2);
      totalScore += details.resourcesScore;
    } else {
      details.resourcesScore = 0;
    }
    
    // Classifica o nível de poder econômico
    let powerLevel;
    if (totalScore >= 80) {
      powerLevel = 'Superpotência Econômica';
    } else if (totalScore >= 60) {
      powerLevel = 'Potência Econômica Major';
    } else if (totalScore >= 40) {
      powerLevel = 'Potência Econômica Regional';
    } else if (totalScore >= 20) {
      powerLevel = 'Economia Média';
    } else {
      powerLevel = 'Economia Emergente';
    }
    
    return {
      score: totalScore,
      powerLevel,
      details
    };
  }

  // Carrega dados econômicos persistidos no Redis
  async function loadEconomyFromRedis() {
    try {
      const data = await redis.get('economy_state');
      if (!data) return {};
      return JSON.parse(data);
    } catch (err) {
      console.error('[ECONOMY] Erro ao carregar economia do Redis:', err.message);
      return {};
    }
  }

    // Salva dados econômicos no Redis
  async function saveEconomyToRedis(economyState) {
    try {
      await redis.set('economy_state', JSON.stringify(economyState));
    } catch (err) {
      console.error('[ECONOMY] Erro ao salvar economia no Redis:', err.message);
    }
  }

module.exports = {
  assessEconomicHealth,
  projectEconomicTrends,
  calculateInvestmentImpact,
  compareEconomies,
  calculateEconomicPower,
  loadEconomyFromRedis,
  saveEconomyToRedis
};