/**
 * economyHandlers.js
 * Socket.io handlers for economic operations
 */

import { performEconomicCalculations } from './economyCalculations.js';
import countryStateManager from '../../shared/countryStateManager.js';
import { getCurrentRoom, getUsernameFromSocketId } from '../../shared/gameStateUtils.js';

/**
 * Setup economy-related socket event handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Client socket
 * @param {Object} gameState - Global game state
 */
function setupEconomyHandlers(io, socket, gameState) {
  console.log('Economy handlers initialized');
  
  // Handle debt bond issuance
  socket.on('issueDebtBonds', (data) => {
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'User not authenticated');
      return;
    }
    
    // Get current room
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Not in a room');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    // Get user's country
    const userRoomKey = `${username}:${roomName}`;
    const userCountry = gameState.userRoomCountries.get(userRoomKey);
    
    if (!userCountry) {
      socket.emit('error', 'No country assigned');
      return;
    }
    
    // Validate bond amount
    const { bondAmount } = data;
    if (!bondAmount || bondAmount <= 0 || bondAmount > 1000) {
      socket.emit('error', 'Invalid bond amount. Must be between 0 and 1000 billions');
      return;
    }
    
    // Get current country state
    const currentState = countryStateManager.getCountryState(roomName, userCountry);
    if (!currentState) {
      socket.emit('error', 'Country state not found');
      return;
    }
    
    // Get static country data
    const staticData = gameState.countriesData[userCountry];
    if (!staticData) {
      socket.emit('error', 'Country data not found');
      return;
    }
    
    // Perform economic calculations
    const calculationResult = performEconomicCalculations(
      currentState,
      staticData,
      { issueDebtBonds: true, bondAmount }
    );
    
    // Update country state with new economy values
    countryStateManager.updateCountryState(
      roomName,
      userCountry,
      'economy',
      calculationResult.economy
    );
    
    // Update public debt in static data (note: this is a simplification)
    // In a real game, public debt would also be part of the dynamic state
    if (calculationResult.publicDebtResult !== null && staticData.economy) {
      staticData.economy.publicDebt = {
        value: calculationResult.publicDebtResult,
        unit: 'bi USD'
      };
      
      // Recalculate debt-to-GDP ratio
      const gdpValue = calculationResult.economy.gdp.value;
      staticData.economy.publicDebtToGdp = Math.round((calculationResult.publicDebtResult / gdpValue) * 100);
    }
    
    console.log(`${username} issued ${bondAmount} billion in debt bonds for ${userCountry}`);
    
    // Send success response
    socket.emit('debtBondsIssued', {
      bondAmount,
      newTreasury: calculationResult.economy.treasury.value,
      newPublicDebt: calculationResult.publicDebtResult
    });
  });
}

export { setupEconomyHandlers };