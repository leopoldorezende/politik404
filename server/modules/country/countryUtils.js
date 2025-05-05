/**
 * Utilitários para gerenciamento de países
 */

/**
 * Verifica se um país é válido no conjunto de dados de países
 * @param {Object} gameState - Estado global do jogo
 * @param {string} country - Nome do país a verificar
 * @returns {boolean} - Verdadeiro se válido, falso caso contrário
 */
function isValidCountry(gameState, country) {
  if (!gameState.countriesData || !country) return false;
  return Object.keys(gameState.countriesData).includes(country);
}

/**
 * Obtém lista de países fronteiriços a um determinado país
 * @param {Object} gameState - Estado global do jogo
 * @param {string} country - Nome do país para obter fronteiras
 * @returns {Array<string>} - Lista de países fronteiriços
 */
function getBorderingCountries(gameState, country) {
  if (!isValidCountry(gameState, country)) return [];
  
  const countryData = gameState.countriesData[country];
  if (!countryData || !countryData.borders) return [];
  
  return countryData.borders
    .filter(border => border.enabled)
    .map(border => border.country);
}

/**
 * Verifica se dois países fazem fronteira
 * @param {Object} gameState - Estado global do jogo
 * @param {string} country1 - Primeiro país
 * @param {string} country2 - Segundo país
 * @returns {boolean} - Verdadeiro se fazem fronteira, falso caso contrário
 */
function areCountriesNeighbors(gameState, country1, country2) {
  if (!isValidCountry(gameState, country1) || !isValidCountry(gameState, country2)) {
    return false;
  }
  
  const borders = getBorderingCountries(gameState, country1);
  return borders.includes(country2);
}

/**
 * Obtém países que não estão em uso em uma sala
 * @param {Object} gameState - Estado global do jogo
 * @param {Object} room - Sala a verificar
 * @returns {Array<string>} - Lista de países disponíveis
 */
function getAvailableCountries(gameState, room) {
  if (!gameState.countriesData || !room) return [];
  
  const allCountries = Object.keys(gameState.countriesData);
  
  // Se a sala não tem jogadores, todos os países estão disponíveis
  if (!room.players || room.players.length === 0) {
    return allCountries;
  }
  
  // Obter países já em uso
  const countriesInUse = room.players
    .filter(p => typeof p === 'object' ? p.country : p.includes('('))
    .map(p => typeof p === 'object' ? p.country : p.match(/\((.*)\)/)[1]);
  
  // Retorna países que não estão em uso
  return allCountries.filter(country => !countriesInUse.includes(country));
}

/**
 * Obtém apenas países fronteiriços disponíveis de uma lista de países elegíveis
 * @param {Object} gameState - Estado global do jogo
 * @param {Object} room - Sala a verificar
 * @returns {Array<string>} - Lista de países elegíveis disponíveis
 */
function getAvailableEligibleCountries(gameState, room) {
  if (!room || !room.eligibleCountries) return [];
  
  const availableCountries = getAvailableCountries(gameState, room);
  
  // Filtra apenas os países elegíveis que também estão disponíveis
  return room.eligibleCountries.filter(country => availableCountries.includes(country));
}

export {
  isValidCountry,
  getBorderingCountries,
  areCountriesNeighbors,
  getAvailableCountries,
  getAvailableEligibleCountries
};
