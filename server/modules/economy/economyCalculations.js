/**
 * economyCalculations.js
 * Centralized economic calculations for the game
 */

/**
 * Calculate GDP growth based on employment rate
 * @param {number} currentGdp - Current GDP value
 * @param {number} unemployment - Unemployment percentage (0-100)
 * @returns {number} - New GDP value
 */
function calculateGdpGrowth(currentGdp, unemployment) {
  // Employment rate = 100 - unemployment
  const employmentRate = 100 - unemployment;
  
  // Growth percentage = employment rate / 1000000
  const growthRate = employmentRate / 1000000;
  
  // New GDP = current GDP + (current GDP * growth rate)
  const gdpIncrease = currentGdp * growthRate;
  const newGdp = currentGdp + gdpIncrease;
  
  return Math.round(newGdp * 100) / 100; // Round to 2 decimal places
}

/**
 * Issue public debt bonds
 * @param {number} currentTreasury - Current treasury value
 * @param {number} currentPublicDebt - Current public debt value
 * @param {number} bondAmount - Amount of bonds to issue (in billions)
 * @returns {Object} - Updated treasury and public debt values
 */
function issueDebtBonds(currentTreasury, currentPublicDebt, bondAmount) {
  // Add bond amount to treasury
  const newTreasury = currentTreasury + bondAmount;
  
  // Add bond amount + 10% interest to public debt
  const debtWithInterest = bondAmount * 1.10;
  const newPublicDebt = currentPublicDebt + debtWithInterest;
  
  return {
    treasury: Math.round(newTreasury * 100) / 100,
    publicDebt: Math.round(newPublicDebt * 100) / 100
  };
}

/**
 * Calcula o impacto dos acordos comerciais na economia
 * Evita dupla contagem considerando apenas acordos onde o país atual é originador
 * @param {Object} economy - Estado econômico atual
 * @param {Array} tradeAgreements - Acordos comerciais ativos
 * @param {string} countryName - Nome do país atual
 * @returns {Object} - Ajustes a serem aplicados
 */
function calculateTradeAgreementsImpact(economy, tradeAgreements = [], countryName) {
  if (!tradeAgreements || tradeAgreements.length === 0 || !countryName) {
    return {
      commodityImports: 0,
      commodityExports: 0,
      manufactureImports: 0,
      manufactureExports: 0,
      balanceAdjustments: {}
    };
  }

  // Totais iniciais
  let commodityImports = 0;
  let commodityExports = 0;
  let manufactureImports = 0;
  let manufactureExports = 0;

  // Filtramos apenas os acordos onde este país é o originador
  // Isso é fundamental para evitar a contagem dupla
  const ownAgreements = tradeAgreements.filter(agreement => 
    agreement.originCountry === countryName
  );
  
  // Processamos apenas os acordos originados por este país
  ownAgreements.forEach(agreement => {
    if (agreement.type === 'export') {
      // Exportação do país atual
      if (agreement.product === 'commodity') {
        commodityExports += agreement.value;
      } else if (agreement.product === 'manufacture') {
        manufactureExports += agreement.value;
      }
    } else if (agreement.type === 'import') {
      // Importação para o país atual
      if (agreement.product === 'commodity') {
        commodityImports += agreement.value;
      } else if (agreement.product === 'manufacture') {
        manufactureImports += agreement.value;
      }
    }
  });

  // Calcular ajustes nos balanços - exportações positivas, importações negativas
  // Para o cálculo do balanço, exportações somam e importações subtraem
  const commoditiesBalanceAdjustment = commodityExports - commodityImports;
  const manufacturesBalanceAdjustment = manufactureExports - manufactureImports;

  console.log(`Trade adjustments for ${countryName}:`, {
    commodityExports,
    commodityImports,
    manufactureExports, 
    manufactureImports,
    commoditiesBalanceAdjustment,
    manufacturesBalanceAdjustment
  });

  return {
    commodityImports,
    commodityExports,
    manufactureImports,
    manufactureExports,
    balanceAdjustments: {
      commodities: commoditiesBalanceAdjustment,
      manufactures: manufacturesBalanceAdjustment
    }
  };
}

/**
 * Perform all economic calculations for a country
 * @param {Object} countryState - Current country state
 * @param {Object} staticData - Static country data (for unemployment, etc.)
 * @param {Object} updates - Any manual updates to apply
 * @returns {Object} - Updated economy object
 */
function performEconomicCalculations(countryState, staticData, updates = {}) {
  let updatedEconomy = { ...countryState.economy };
  const countryName = staticData?.name || updatedEconomy?.countryName || staticData.countryName;
  
  // Apply any manual updates first
  if (updates.issueDebtBonds && updates.bondAmount > 0) {
    const bondResult = issueDebtBonds(
      updatedEconomy.treasury.value,
      staticData.economy?.publicDebt?.value || 0,
      updates.bondAmount
    );
    
    updatedEconomy.treasury.value = bondResult.treasury;
    // Note: Public debt is stored in static data, we'll return it separately
    updates.publicDebtResult = bondResult.publicDebt;
  }
  
  // Calculate GDP growth based on employment
  if (staticData.economy?.unemployment !== undefined) {
    const newGdp = calculateGdpGrowth(
      updatedEconomy.gdp.value,
      staticData.economy.unemployment
    );
    
    updatedEconomy.gdp.value = newGdp;
  }
  
  // Recalcular a produção baseada no PIB atualizado
  if (updatedEconomy.services && updatedEconomy.commodities && updatedEconomy.manufactures) {
    updatedEconomy.servicesOutput.value = Math.round((updatedEconomy.gdp.value * updatedEconomy.services.value / 100) * 100) / 100;
    updatedEconomy.commoditiesOutput.value = Math.round((updatedEconomy.gdp.value * updatedEconomy.commodities.value / 100) * 100) / 100;
    updatedEconomy.manufacturesOutput.value = Math.round((updatedEconomy.gdp.value * updatedEconomy.manufactures.value / 100) * 100) / 100;
  }
  
  // Aplicar impacto dos acordos comerciais, se fornecidos
  if (updates.tradeAgreements && updates.tradeAgreements.length > 0) {
    console.log(`Calculating trade impact for ${countryName} with ${updates.tradeAgreements.length} agreements`);
    
    const tradeImpact = calculateTradeAgreementsImpact(updatedEconomy, updates.tradeAgreements, countryName);
    
    // Ajustar os balanços comerciais
    if (updatedEconomy.commoditiesBalance) {
      // Produção básica
      const baseProduction = updatedEconomy.commoditiesOutput?.value || 0;
      // Necessidade interna
      const internalNeeds = updatedEconomy.commoditiesNeeds?.value || 0;
      
      // Exportações (positivo)
      const exports = tradeImpact.commodityExports || 0;
      // Importações (negativo)
      const imports = tradeImpact.commodityImports || 0;
      
      // Balanço final = Produção + Exportações - Importações - Necessidade
      const newBalance = baseProduction + exports - imports - internalNeeds;
      
      console.log(`Commodities balance for ${countryName}:`, { 
        baseProduction, 
        imports, 
        exports, 
        internalNeeds, 
        newBalance 
      });
      
      updatedEconomy.commoditiesBalance.value = Math.round(newBalance * 100) / 100;
    }
    
    if (updatedEconomy.manufacturesBalance) {
      // Produção básica
      const baseProduction = updatedEconomy.manufacturesOutput?.value || 0;
      // Necessidade interna
      const internalNeeds = updatedEconomy.manufacturesNeeds?.value || 0;
      
      // Exportações (positivo)
      const exports = tradeImpact.manufactureExports || 0;
      // Importações (negativo)
      const imports = tradeImpact.manufactureImports || 0;
      
      // Balanço final = Produção + Exportações - Importações - Necessidade
      const newBalance = baseProduction + exports - imports - internalNeeds;
      
      console.log(`Manufactures balance for ${countryName}:`, { 
        baseProduction, 
        imports, 
        exports, 
        internalNeeds, 
        newBalance 
      });
      
      updatedEconomy.manufacturesBalance.value = Math.round(newBalance * 100) / 100;
    }
    
    // Guardar as estatísticas comerciais no estado da economia para uso futuro
    updatedEconomy.tradeStats = {
      commodityImports: tradeImpact.commodityImports,
      commodityExports: tradeImpact.commodityExports,
      manufactureImports: tradeImpact.manufactureImports,
      manufactureExports: tradeImpact.manufactureExports
    };
  } else {
    // Se não há acordos, calcular os balanços apenas com produção e necessidade
    if (updatedEconomy.commoditiesBalance) {
      updatedEconomy.commoditiesBalance.value = Math.round((updatedEconomy.commoditiesOutput.value - updatedEconomy.commoditiesNeeds.value) * 100) / 100;
    }
    
    if (updatedEconomy.manufacturesBalance) {
      updatedEconomy.manufacturesBalance.value = Math.round((updatedEconomy.manufacturesOutput.value - updatedEconomy.manufacturesNeeds.value) * 100) / 100;
    }
    
    // Zerar as estatísticas comerciais
    updatedEconomy.tradeStats = {
      commodityImports: 0,
      commodityExports: 0,
      manufactureImports: 0,
      manufactureExports: 0
    };
  }
  
  return {
    economy: updatedEconomy,
    publicDebtResult: updates.publicDebtResult || null
  };
}

export {
  calculateGdpGrowth,
  issueDebtBonds,
  calculateTradeAgreementsImpact,
  performEconomicCalculations
};