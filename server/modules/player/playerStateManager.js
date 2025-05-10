/**
 * Gerenciamento do estado dos jogadores
 */

import { getCurrentRoom } from '../../shared/gameStateUtils.js';

/**
 * Configura os handlers relacionados ao gerenciamento de estado dos jogadores
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupPlayerStateManager(io, socket, gameState) {
  console.log('Player state manager inicializado');
  
  // Salva o estado personalizado do jogador
  socket.on('saveState', (customData) => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Encontra a sala atual
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    // Chave para acessar o estado do jogador
    const stateKey = `${username}:${roomName}`;
    
    // Obtém o estado atual ou cria um novo
    let playerState = gameState.playerStates.get(stateKey);
    if (!playerState) {
      const country = gameState.userRoomCountries.get(stateKey);
      playerState = {
        country,
        customData: {}
      };
    }
    
    // Atualiza os dados personalizados
    playerState.customData = {
      ...playerState.customData,
      ...customData
    };
    
    // Salva o estado atualizado
    gameState.playerStates.set(stateKey, playerState);
    
    // Confirma salvamento
    socket.emit('stateSaved', { success: true });
  });
  
  // Solicita o estado atual do jogador
  socket.on('getState', () => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Encontra a sala atual
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    // Chave para acessar o estado do jogador
    const stateKey = `${username}:${roomName}`;
    
    // Obtém o estado atual
    const playerState = gameState.playerStates.get(stateKey);
    
    if (playerState) {
      // Envia o estado para o cliente
      socket.emit('stateRestored', playerState);
    } else {
      socket.emit('error', 'Estado não encontrado');
    }
  });
}

export { setupPlayerStateManager };