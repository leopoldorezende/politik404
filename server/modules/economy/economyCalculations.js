/**
 * economyCalculations.js
 * Centralized economic calculations for the game
 */

import { calculateTradeAgreementsImpact } from './economyUpdateService.js';

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
    // Verificar e adaptar estrutura do treasury (objeto ou número)
    let currentTreasury = 0;
    if (typeof updatedEconomy.treasury === 'object' && updatedEconomy.treasury.value !== undefined) {
      currentTreasury = updatedEconomy.treasury.value;
    } else if (typeof updatedEconomy.treasury === 'number') {
      currentTreasury = updatedEconomy.treasury;
    }
    
    // Verificar e adaptar estrutura do publicDebt (objeto ou número)
    let currentPublicDebt = 0;
    if (staticData.economy?.publicDebt) {
      if (typeof staticData.economy.publicDebt === 'object' && staticData.economy.publicDebt.value !== undefined) {
        currentPublicDebt = staticData.economy.publicDebt.value;
      } else if (typeof staticData.economy.publicDebt === 'number') {
        currentPublicDebt = staticData.economy.publicDebt;
      }
    }
    
    const bondResult = issueDebtBonds(
      currentTreasury,
      currentPublicDebt,
      updates.bondAmount
    );
    
    // Atualizar treasury conforme estrutura (objeto ou número)
    if (typeof updatedEconomy.treasury === 'object') {
      updatedEconomy.treasury.value = bondResult.treasury;
    } else {
      updatedEconomy.treasury = { value: bondResult.treasury, unit: 'bi USD' };
    }
    
    // Note: Public debt is stored in static data, we'll return it separately
    updates.publicDebtResult = bondResult.publicDebt;
  }
  
  // Calculate GDP growth based on employment
  if (staticData.economy?.unemployment !== undefined) {
    // Verificar e adaptar estrutura do gdp (objeto ou número)
    let currentGdp = 0;
    if (typeof updatedEconomy.gdp === 'object' && updatedEconomy.gdp.value !== undefined) {
      currentGdp = updatedEconomy.gdp.value;
    } else if (typeof updatedEconomy.gdp === 'number') {
      currentGdp = updatedEconomy.gdp;
    }
    
    const newGdp = calculateGdpGrowth(
      currentGdp,
      staticData.economy.unemployment
    );
    
    // Atualizar gdp conforme estrutura (objeto ou número)
    if (typeof updatedEconomy.gdp === 'object') {
      updatedEconomy.gdp.value = newGdp;
    } else {
      updatedEconomy.gdp = { value: newGdp, unit: 'bi USD' };
    }
  }
  
  // Recalcular a produção baseada no PIB atualizado
  if (updatedEconomy.services && updatedEconomy.commodities && updatedEconomy.manufactures) {
    // Obter valor do GDP com suporte para estrutura objeto ou número
    let gdpValue = 0;
    if (typeof updatedEconomy.gdp === 'object' && updatedEconomy.gdp.value !== undefined) {
      gdpValue = updatedEconomy.gdp.value;
    } else if (typeof updatedEconomy.gdp === 'number') {
      gdpValue = updatedEconomy.gdp;
    }
    
    // Obter percentuais dos setores com suporte para estrutura objeto ou número
    let servicesValue = 0;
    if (typeof updatedEconomy.services === 'object' && updatedEconomy.services.value !== undefined) {
      servicesValue = updatedEconomy.services.value;
    } else if (typeof updatedEconomy.services === 'number') {
      servicesValue = updatedEconomy.services;
    }
    
    let commoditiesValue = 0;
    if (typeof updatedEconomy.commodities === 'object' && updatedEconomy.commodities.value !== undefined) {
      commoditiesValue = updatedEconomy.commodities.value;
    } else if (typeof updatedEconomy.commodities === 'number') {
      commoditiesValue = updatedEconomy.commodities;
    }
    
    let manufacturesValue = 0;
    if (typeof updatedEconomy.manufactures === 'object' && updatedEconomy.manufactures.value !== undefined) {
      manufacturesValue = updatedEconomy.manufactures.value;
    } else if (typeof updatedEconomy.manufactures === 'number') {
      manufacturesValue = updatedEconomy.manufactures;
    }
    
    // Calcular outputs
    updatedEconomy.servicesOutput = { 
      value: Math.round((gdpValue * servicesValue / 100) * 100) / 100,
      unit: 'bi USD'
    };
    
    updatedEconomy.commoditiesOutput = { 
      value: Math.round((gdpValue * commoditiesValue / 100) * 100) / 100,
      unit: 'bi USD'
    };
    
    updatedEconomy.manufacturesOutput = { 
      value: Math.round((gdpValue * manufacturesValue / 100) * 100) / 100,
      unit: 'bi USD'
    };
  }
  
  // Aplicar impacto dos acordos comerciais, se fornecidos
  if (updates.tradeAgreements && updates.tradeAgreements.length > 0) {
    // console.log(`Calculating trade impact for ${countryName} with ${updates.tradeAgreements.length} agreements`);
    
    const tradeImpact = calculateTradeAgreementsImpact(updatedEconomy, updates.tradeAgreements, countryName);
    
    // Ajustar os balanços comerciais
    if (updatedEconomy.commoditiesBalance) {
      // Produção básica
      const baseProduction = updatedEconomy.commoditiesOutput?.value || 0;
      // Necessidade interna
      const internalNeeds = updatedEconomy.commoditiesNeeds?.value || 0;
      
      // CORREÇÃO: Exportações (negativo) - o que sai do país
      const exports = tradeImpact.commodityExports || 0;
      // Importações (positivo) - o que entra no país
      const imports = tradeImpact.commodityImports || 0;
      
      // Balanço final = Produção - Exportações + Importações - Necessidade
      const newBalance = baseProduction - exports + imports - internalNeeds;
      
      // console.log(`Commodities balance for ${countryName}:`, { 
      //   baseProduction, 
      //   imports, 
      //   exports, 
      //   internalNeeds, 
      //   newBalance 
      // });
      
      updatedEconomy.commoditiesBalance.value = Math.round(newBalance * 100) / 100;
    }
    
    if (updatedEconomy.manufacturesBalance) {
      // Produção básica
      const baseProduction = updatedEconomy.manufacturesOutput?.value || 0;
      // Necessidade interna
      const internalNeeds = updatedEconomy.manufacturesNeeds?.value || 0;
      
      // CORREÇÃO: Exportações (negativo) - o que sai do país
      const exports = tradeImpact.manufactureExports || 0;
      // Importações (positivo) - o que entra no país
      const imports = tradeImpact.manufactureImports || 0;
      
      // Balanço final = Produção - Exportações + Importações - Necessidade
      const newBalance = baseProduction - exports + imports - internalNeeds;
      
      // console.log(`Manufactures balance for ${countryName}:`, { 
      //   baseProduction, 
      //   imports, 
      //   exports, 
      //   internalNeeds, 
      //   newBalance 
      // });
      
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
  performEconomicCalculations
};