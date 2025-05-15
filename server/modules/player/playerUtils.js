/**
 * Utilitários para gerenciamento de jogadores
 * SIMPLIFICADO - Apenas funções realmente utilizadas
 */

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

export {
  standardizePlayer
};