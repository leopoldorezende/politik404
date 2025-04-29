// src/services/countryService.js

import { store } from '../store';
import { setCountriesData } from '../store/slices/gameSlice';

// Carrega os dados dos países
export const loadCountriesData = async () => {
  try {
    // Adicionando timestamp para evitar cache
    const timestamp = new Date().getTime();
    const response = await fetch(`http://localhost:3001/data/countriesData.json?t=${timestamp}`);
    
    if (!response.ok) {
      console.error(`Erro ao carregar countriesData: ${response.status} ${response.statusText}`);
      // Tenta um caminho alternativo se o primeiro falhar
      const altResponse = await fetch(`http://localhost:3001/countriesData.json?t=${timestamp}`);
      if (!altResponse.ok) {
        throw new Error(`Não foi possível carregar os dados dos países de nenhum caminho`);
      }
      const data = await altResponse.json();
      console.log('countriesData carregado do caminho alternativo:', data);
      store.dispatch(setCountriesData(data));
      return data;
    }
    
    const data = await response.json();
    console.log('countriesData carregado com sucesso:', data);
    
    // Armazena no Redux
    store.dispatch(setCountriesData(data));
    
    return data;
  } catch (error) {
    console.error('Erro ao carregar countriesData:', error);
    // Em caso de erro no desenvolvimento, retorna um objeto vazio
    // para evitar que a aplicação quebre completamente
    return {}; 
  }
};

// Carrega as coordenadas dos países
export const loadCountriesCoordinates = async () => {
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(`http://localhost:3001/data/countriesCoordinates.json?t=${timestamp}`);
    
    if (!response.ok) {
      console.error(`Erro ao carregar coordenadas: ${response.status} ${response.statusText}`);
      // Tenta um caminho alternativo
      const altResponse = await fetch(`http://localhost:3001/countriesCoordinates.json?t=${timestamp}`);
      if (!altResponse.ok) {
        throw new Error(`Não foi possível carregar as coordenadas de nenhum caminho`);
      }
      const data = await altResponse.json();
      console.log('Coordenadas carregadas do caminho alternativo:', data);
      return data;
    }
    
    const data = await response.json();
    console.log('Coordenadas carregadas com sucesso:', data);
    return data;
  } catch (error) {
    console.error('Erro ao carregar as coordenadas:', error);
    return {
      customZoomLevels: {},
      countries: {}
    };
  }
};

// Retorna o centro de um país
export const getCountryCenter = (country, countriesData, countriesCoordinates) => {
  if (!country) return [0, 0];
  
  if (countriesCoordinates?.countries && countriesCoordinates.countries[country]) {
    console.log(`Usando coordenadas personalizadas para ${country}:`, countriesCoordinates.countries[country]);
    return countriesCoordinates.countries[country];
  }
  
  if (countriesData && countriesData[country] && countriesData[country].coordinates) {
    console.log(`Usando coordenadas de countriesData para ${country}:`, countriesData[country].coordinates);
    return countriesData[country].coordinates;
  }
  
  console.log(`País "${country}" não encontrado, usando posição padrão`);
  return [0, 0];
};
