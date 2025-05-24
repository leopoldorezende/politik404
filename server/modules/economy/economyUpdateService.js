/**
 * economyUpdateService.js (Simplificado)
 * APENAS cálculo de impacto comercial - economia delegada para countryStateManager
 */

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

  // Calcular ajustes nos balanços - exportações DIMINUEM, importações aumentam
  const commoditiesBalanceAdjustment = -commodityExports + commodityImports;
  const manufacturesBalanceAdjustment = -manufactureExports + manufactureImports;

  // Log apenas quando há impacto real de comércio e com intervalo mínimo entre logs
  if (commodityExports > 0 || commodityImports > 0 || manufactureExports > 0 || manufactureImports > 0) {
    const now = Date.now();
    if (!global.lastTradeAdjustmentLog || now - global.lastTradeAdjustmentLog > 60000) {
      console.log(`Trade adjustments for ${countryName}:`, {
        commodityExports,
        commodityImports,
        manufactureExports, 
        manufactureImports,
        commoditiesBalanceAdjustment,
        manufacturesBalanceAdjustment
      });
      global.lastTradeAdjustmentLog = now;
    }
  }

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

export {
  calculateTradeAgreementsImpact
};