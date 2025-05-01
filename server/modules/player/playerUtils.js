/**
 * Utilitários para gerenciamento de jogadores
 */

/**
 * Encontra um jogador pelo username na lista de jogadores de uma sala
 * @param {Array} players - Lista de jogadores da sala
 * @param {string} username - Nome do usuário a procurar
 * @returns {Object|null} - Jogador encontrado ou null
 */
function findPlayerByUsername(players, username) {
  if (!players || !Array.isArray(players)) return null;
  
  const player = players.find(p => {
    if (typeof p === 'object') {
      return p.username === username;
    }
    if (typeof p === 'string') {
      return p.startsWith(username + ' ');
    }
    return false;
  });
  
  return player || null;
}

/**
 * Converte um jogador para formato de objeto padrão
 * @param {Object|string} player - Jogador a ser convertido
 * @returns {Object} - Objeto padronizado de jogador
 */
function standardizePlayer(player) {
  if (!player) return null;
  
  if (typeof player === 'object') {
    return {
      username: player.username,
      country: player.country,
      isOnline: player.isOnline || false,
      id: player.id || null
    };
  }
  
  if (typeof player === 'string') {
    const match = player.match(/^(.*?)\s*\((.*)\)$/);
    if (match) {
      return {
        username: match[1],
        country: match[2],
        isOnline: false,
        id: null
      };
    }
    
    return {
      username: player,
      country: null,
      isOnline: false,
      id: null
    };
  }
  
  return null;
}

/**
 * Retorna a lista de jogadores online em uma sala
 * @param {Array} players - Lista de jogadores da sala
 * @returns {Array} - Lista de jogadores online
 */
function getOnlinePlayers(players) {
  if (!players || !Array.isArray(players)) return [];
  
  return players
    .filter(p => typeof p === 'object' && p.isOnline)
    .map(standardizePlayer);
}

/**
 * Verifica se um jogador está online
 * @param {Object} gameState - Estado global do jogo
 * @param {string} username - Nome do usuário a verificar
 * @returns {boolean} - Verdadeiro se online, falso caso contrário
 */
function isPlayerOnline(gameState, username) {
  return gameState.onlinePlayers.has(username);
}

module.exports = {
  findPlayerByUsername,
  standardizePlayer,
  getOnlinePlayers,
  isPlayerOnline
};
