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
 * @param {Object} economy - Estado econômico atual
 * @param {Object} tradeAgreements - Acordos comerciais ativos
 * @returns {Object} - Ajustes a serem aplicados
 */
function calculateTradeAgreementsImpact(economy, tradeAgreements = []) {
  if (!tradeAgreements || tradeAgreements.length === 0) {
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

  // Calcular totais por tipo
  tradeAgreements.forEach(agreement => {
    if (agreement.type === 'import') {
      if (agreement.product === 'commodity') {
        commodityImports += agreement.value;
      } else if (agreement.product === 'manufacture') {
        manufactureImports += agreement.value;
      }
    } else if (agreement.type === 'export') {
      if (agreement.product === 'commodity') {
        commodityExports += agreement.value;
      } else if (agreement.product === 'manufacture') {
        manufactureExports += agreement.value;
      }
    }
  });

  // Calcular ajustes nos balanços
  const commoditiesBalanceAdjustment = commodityImports - commodityExports;
  const manufacturesBalanceAdjustment = manufactureImports - manufactureExports;

  // Retornar os ajustes calculados
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
  
  // Aplicar impacto dos acordos comerciais, se fornecidos
  if (updates.tradeAgreements && updates.tradeAgreements.length > 0) {
    const tradeImpact = calculateTradeAgreementsImpact(updatedEconomy, updates.tradeAgreements);
    
    // Ajustar os balanços comerciais
    if (updatedEconomy.commoditiesBalance) {
      updatedEconomy.commoditiesBalance.value += tradeImpact.balanceAdjustments.commodities;
    }
    
    if (updatedEconomy.manufacturesBalance) {
      updatedEconomy.manufacturesBalance.value += tradeImpact.balanceAdjustments.manufactures;
    }
    
    // Guardar as estatísticas comerciais (opcional, se necessário para outras partes do sistema)
    updatedEconomy.tradeStats = {
      commodityImports: tradeImpact.commodityImports,
      commodityExports: tradeImpact.commodityExports,
      manufactureImports: tradeImpact.manufactureImports,
      manufactureExports: tradeImpact.manufactureExports
    };
  }
  
  // Preservar os valores dos indicadores derivados para que sejam recalculados
  // pelo countryStateManager a partir do novo PIB
  const preservedValues = {
    services: updatedEconomy.services,
    commodities: updatedEconomy.commodities,
    manufactures: updatedEconomy.manufactures,
    servicesOutput: updatedEconomy.servicesOutput,
    commoditiesOutput: updatedEconomy.commoditiesOutput,
    manufacturesOutput: updatedEconomy.manufacturesOutput,
    commoditiesNeeds: updatedEconomy.commoditiesNeeds,
    manufacturesNeeds: updatedEconomy.manufacturesNeeds,
    commoditiesBalance: updatedEconomy.commoditiesBalance,
    manufacturesBalance: updatedEconomy.manufacturesBalance
  };
  
  // Garantir que os valores preservados sejam recuperados
  Object.entries(preservedValues).forEach(([key, value]) => {
    if (value !== undefined) {
      updatedEconomy[key] = value;
    }
  });
  
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