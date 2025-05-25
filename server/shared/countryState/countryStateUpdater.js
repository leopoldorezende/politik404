/**
 * countryStateUpdater.js (Simplificado)
 * Gerencia atualizações periódicas para estados de países
 */

import CountryEconomyCalculator from './countryEconomyCalculator.js';
import { SYNC_CONFIG } from '../config/syncConfig.js';

class CountryStateUpdater {
  constructor(core) {
    this.core = core;
    this.economyCalculator = new CountryEconomyCalculator();
    this.updateInterval = null;
    this.saveInterval = null;
    this.updateCounter = 0;
    this.lastLogTime = 0;
    this.logInterval = 30000; // 30 segundos entre logs resumo
  }

  startPeriodicUpdates(updateIntervalMs = SYNC_CONFIG.MASTER_CYCLE, saveIntervalMs = SYNC_CONFIG.USER_CLEANUP_INTERVAL) {
    this.stopPeriodicUpdates();
    
    console.log(`[ECONOMY] Starting periodic updates every ${updateIntervalMs}ms`);
    
    this.updateInterval = setInterval(() => {
      this.performPeriodicEconomicUpdates();
    }, updateIntervalMs);
    
    this.saveInterval = setInterval(() => {
      this.core.saveStatesToRedis();
    }, saveIntervalMs);
  }

  stopPeriodicUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  performPeriodicEconomicUpdates() {
    const gameState = global.gameState;
    if (!gameState || !gameState.countriesData) {
      return;
    }
    
    let totalUpdates = 0;
    let roomsWithPlayers = 0;
    
    const roomNames = this.core.getAllRooms();
    
    for (const roomName of roomNames) {
      const room = gameState.rooms.get(roomName);
      
      // Verificar se tem jogadores online
      const hasOnlinePlayers = room && room.players && 
        room.players.some(p => typeof p === 'object' && p.isOnline);
      
      if (!hasOnlinePlayers) continue;
      
      roomsWithPlayers++;
      const countryNames = this.core.getAllCountriesInRoom(roomName);
      
      for (const countryName of countryNames) {
        const countryState = this.core.getCountryState(roomName, countryName);
        if (!countryState) continue;
        
        try {
          const countryJSONData = gameState.countriesData[countryName] || { name: countryName };
          const tradeAgreements = room.tradeAgreements || [];
          
          const updatedCountryState = this.economyCalculator.performEconomicUpdate(
            countryState,
            countryJSONData,
            tradeAgreements
          );
          
          this.core.setCountryState(roomName, countryName, updatedCountryState);
          totalUpdates++;
          
        } catch (error) {
          console.error(`[ECONOMY] Error updating ${countryName} in ${roomName}:`, error.message);
        }
      }
      
      if (countryNames.length > 0) {
        this.core.lastUpdated.set(roomName, Date.now());
      }
    }
    
    this.updateCounter++;
    
    // Log resumo periodicamente
    const now = Date.now();
    if (now - this.lastLogTime > this.logInterval) {
      console.log(`[ECONOMY] Update #${this.updateCounter}: ${totalUpdates} countries in ${roomsWithPlayers} rooms`);
      this.lastLogTime = now;
    }
  }

  updateCountryEconomy(roomName, countryName, tradeAgreements = []) {
    const countryState = this.core.getCountryState(roomName, countryName);
    if (!countryState) return null;
    
    const gameState = global.gameState;
    const countryJSONData = gameState?.countriesData?.[countryName] || { name: countryName };
    
    try {
      const updatedCountryState = this.economyCalculator.performEconomicUpdate(
        countryState,
        countryJSONData,
        tradeAgreements
      );
      
      this.core.setCountryState(roomName, countryName, updatedCountryState);
      return updatedCountryState;
      
    } catch (error) {
      console.error(`[ECONOMY] Error in manual update for ${countryName}:`, error.message);
      return null;
    }
  }

  updateCountriesForTradeAgreement(roomName, agreement) {
    const gameState = global.gameState;
    if (!gameState) return;
    
    const room = gameState.rooms.get(roomName);
    if (!room) return;
    
    const tradeAgreements = room.tradeAgreements || [];
    const { originCountry, country: targetCountry } = agreement;
    
    this.updateCountryEconomy(roomName, originCountry, tradeAgreements);
    this.updateCountryEconomy(roomName, targetCountry, tradeAgreements);
  }

  performManualUpdate() {
    console.log('[ECONOMY] Manual update triggered');
    this.performPeriodicEconomicUpdates();
  }

  getUpdateStats() {
    return {
      updateCounter: this.updateCounter,
      economyCalculatorCounter: this.economyCalculator.getUpdateCounter(),
      isUpdating: this.updateInterval !== null,
      isSaving: this.saveInterval !== null,
      totalRooms: this.core.getAllRooms().length,
      lastLogTime: this.lastLogTime
    };
  }

  resetCounters() {
    this.updateCounter = 0;
    this.economyCalculator.resetUpdateCounter();
    this.lastLogTime = 0;
  }

  getEconomyCalculator() {
    return this.economyCalculator;
  }

  cleanup() {
    this.stopPeriodicUpdates();
  }
}

export default CountryStateUpdater;