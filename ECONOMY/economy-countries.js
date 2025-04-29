// countries.js (modificado)
// ==========================================
// COUNTRIES MODULE - Gerenciamento de múltiplos países
// ==========================================

import { createInitialEconomy } from './economy-economy.js';

/**
 * Classe para gerenciar múltiplos países e suas economias
 */
export class CountryManager {
  constructor() {
    this.countries = {};
    this.activeCountryId = null;
  }
  
  /**
   * Carrega um país a partir de dados do JSON
   * @param {string} id - Identificador único do país
   * @param {Object} jsonData - Dados para a economia do país
   * @returns {Object} - Instância da economia criada
   */
  loadCountry(id, jsonData) {
    // Verifica se já existe o país e evita sobrescrever
    if (this.countries[id]) {
      console.warn(`País ${id} já existe e não será sobrescrito.`);
      return this.countries[id];
    }
    
    this.countries[id] = createInitialEconomy(jsonData);
    
    // Se for o primeiro país, torne-o ativo
    if (this.activeCountryId === null) {
      this.activeCountryId = id;
    }
    
    return this.countries[id];
  }
  
  /**
   * Obtém o país ativo atualmente
   * @returns {Object} - Economia do país ativo
   */
  getActiveCountry() {
    return this.countries[this.activeCountryId];
  }
  
  /**
   * Define qual país está ativo
   * @param {string} id - Identificador do país
   * @returns {boolean} - Se a operação foi bem-sucedida
   */
  setActiveCountry(id) {
    if (this.countries[id]) {
      this.activeCountryId = id;
      return true;
    }
    return false;
  }
  
  /**
   * Obtém um país específico pelo ID
   * @param {string} id - Identificador do país
   * @returns {Object|null} - Economia do país ou null se não existir
   */
  getCountry(id) {
    return this.countries[id] || null;
  }
  
  /**
   * Obtém todos os IDs de países disponíveis
   * @returns {Array<string>} - Array com os IDs dos países
   */
  getAllCountryIds() {
    return Object.keys(this.countries);
  }
}

/**
 * Carrega países a partir de um arquivo JSON
 * @param {string} jsonUrl - Caminho para o arquivo JSON
 * @returns {Promise} - Promise que será resolvida quando os países forem carregados
 */
export async function carregarPaisesDoJSON(jsonUrl) {
  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`Erro ao carregar dados: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (Object.keys(data).length === 0) {
      console.error('Arquivo JSON não contém dados de países.');
      return [];
    }
    
    // Carrega cada país no gerenciador
    Object.entries(data).forEach(([id, paisData]) => {
      // Corrige datas que foram serializadas como strings
      if (paisData.registroDividas && paisData.registroDividas.length > 0) {
        paisData.registroDividas.forEach(divida => {
          if (typeof divida.dataEmissao === 'string') {
            divida.dataEmissao = new Date(divida.dataEmissao);
          }
        });
      }
      
      countryManager.loadCountry(id, paisData);
    });
    
    console.log(`Países carregados: ${Object.keys(data).join(', ')}`);
    return Object.keys(data);
  } catch (error) {
    console.error('Erro ao carregar países do JSON:', error);
    return [];
  }
}

// Cria uma instância global do gerenciador de países
export const countryManager = new CountryManager();