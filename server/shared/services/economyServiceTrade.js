// server/shared/services/economy/EconomyTrade.js
// Métodos auxiliares para gerenciamento de comércio internacional

/**
 * Classe auxiliar para gerenciamento de acordos comerciais
 * Contém todos os métodos relacionados a comércio internacional
 */
export class EconomyTrade {
  constructor(economyService) {
    this.economyService = economyService;
  }

  /**
   * Cria um acordo comercial entre países
   */
  createTradeAgreement(roomName, agreementData) {
    const gameState = global.gameState;
    const room = gameState?.rooms?.get(roomName);
    if (!room) return null;
    
    const { type, product, country, value, originCountry, originPlayer } = agreementData;
    
    const originAgreement = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      type, product, country, value, originCountry, originPlayer
    };
    
    const targetAgreement = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      type: type === 'import' ? 'export' : 'import',
      product,
      country: originCountry,
      value,
      originCountry: country,
      originPlayer: null
    };
    
    if (!room.tradeAgreements) room.tradeAgreements = [];
    
    room.tradeAgreements = room.tradeAgreements.filter(existing => 
      !(existing.type === type && existing.product === product && 
        existing.country === country && existing.originCountry === originCountry) &&
      !(existing.type === targetAgreement.type && existing.product === product && 
        existing.country === originCountry && existing.originCountry === country)
    );
    
    room.tradeAgreements.push(originAgreement, targetAgreement);
    
    // Integração com cardService
    if (global.cardService && global.cardService.initialized) {
      try {
        // Criar cards para o acordo comercial
        const cards = global.cardService.createTradeAgreementCards(roomName, {
          type: type,
          product: product,
          country: country,
          value: value,
          originCountry: originCountry,
          originPlayer: originPlayer,
          agreementId: originAgreement.id // Vincular ao acordo original
        });
        
        console.log(`[ECONOMY-CARDS] Created ${cards.length} cards for trade agreement ${originAgreement.id}`);
        
        // Notificar criação de cards se necessário
        if (global.io) {
          global.io.to(roomName).emit('cardsUpdated', {
            roomName: roomName,
            action: 'created',
            cards: cards.map(card => ({
              id: card.id,
              type: card.type,
              owner: card.owner,
              points: card.points
            }))
          });
        }
      } catch (error) {
        console.error('[ECONOMY-CARDS] Error creating cards for trade agreement:', error);
      }
    }
    
    // Recalcular economias com cálculos delegados
    this.economyService.performAdvancedEconomicCalculations(roomName, originCountry);
    this.economyService.performAdvancedEconomicCalculations(roomName, country);
    
    return originAgreement;
  }

  /**
   * Cancela um acordo comercial existente
   */
  cancelTradeAgreement(roomName, agreementId) {
    const gameState = global.gameState;
    const room = gameState?.rooms?.get(roomName);
    if (!room || !room.tradeAgreements) return false;
    
    const agreementIndex = room.tradeAgreements.findIndex(a => a.id === agreementId);
    if (agreementIndex === -1) return false;
    
    const agreement = room.tradeAgreements[agreementIndex];
    room.tradeAgreements.splice(agreementIndex, 1);
    
    const mirroredType = agreement.type === 'import' ? 'export' : 'import';
    const mirroredAgreementIndex = room.tradeAgreements.findIndex(a => 
      a.type === mirroredType && 
      a.product === agreement.product && 
      a.originCountry === agreement.country && 
      a.country === agreement.originCountry
    );
    
    if (mirroredAgreementIndex !== -1) {
      room.tradeAgreements.splice(mirroredAgreementIndex, 1);
    }
    
    // Integração com cardService para remover cards relacionados
    if (global.cardService && global.cardService.initialized) {
      try {
        global.cardService.removeTradeAgreementCards(roomName, agreementId);
      } catch (error) {
        console.error('[ECONOMY-CARDS] Error removing cards for cancelled agreement:', error);
      }
    }
    
    // Recalcular economias
    this.economyService.performAdvancedEconomicCalculations(roomName, agreement.originCountry);
    this.economyService.performAdvancedEconomicCalculations(roomName, agreement.country);
    
    return true;
  }

  /**
   * Calcula o impacto dos acordos comerciais na economia
   */
  calculateTradeImpact(tradeAgreements, countryName) {
    let commodityImports = 0, commodityExports = 0;
    let manufactureImports = 0, manufactureExports = 0;

    const ownAgreements = tradeAgreements.filter(agreement => 
      agreement.originCountry === countryName
    );
    
    ownAgreements.forEach(agreement => {
      if (agreement.type === 'export') {
        if (agreement.product === 'commodity') {
          commodityExports += agreement.value;
        } else if (agreement.product === 'manufacture') {
          manufactureExports += agreement.value;
        }
      } else if (agreement.type === 'import') {
        if (agreement.product === 'commodity') {
          commodityImports += agreement.value;
        } else if (agreement.product === 'manufacture') {
          manufactureImports += agreement.value;
        }
      }
    });

    return { commodityImports, commodityExports, manufactureImports, manufactureExports };
  }

  /**
   * Calcula balanços setoriais incluindo acordos comerciais
   */
  calculateSectoralBalances(roomName, countryName, economy) {
    const gameState = global.gameState;
    const room = gameState?.rooms?.get(roomName);
    const tradeAgreements = room?.tradeAgreements || [];
    
    const tradeImpact = this.calculateTradeImpact(tradeAgreements, countryName);
    
    // Calcular balanços finais
    economy.commoditiesBalance = economy.commoditiesOutput + tradeImpact.commodityImports 
                                - tradeImpact.commodityExports - economy.commoditiesNeeds;
    economy.manufacturesBalance = economy.manufacturesOutput + tradeImpact.manufactureImports 
                                - tradeImpact.manufactureExports - economy.manufacturesNeeds;
    
    // Armazenar estatísticas de comércio
    economy.tradeStats = {
      commodityImports: tradeImpact.commodityImports,
      commodityExports: tradeImpact.commodityExports,
      manufactureImports: tradeImpact.manufactureImports,
      manufactureExports: tradeImpact.manufactureExports
    };
  }
}