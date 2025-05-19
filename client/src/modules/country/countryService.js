/**
 * Country Service - Centralized data loading and country management
 * Provides a single source of truth for country data
 */
import { store } from '../../store';
import { setCountriesData, setCountriesCoordinates } from '../game/gameState';

// Cache mechanism to avoid redundant API calls
const dataCache = {
  countriesData: null,
  countriesCoordinates: null,
  lastFetched: {
    countriesData: null,
    countriesCoordinates: null
  }
};

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

/**
 * Get the base API URL from environment variables or use the current origin
 * @returns {string} The base URL for API requests
 */
const getBaseUrl = () => {
  return import.meta.env.VITE_API_URL || window.location.origin;
};

/**
 * Check if cache is still valid
 * @param {string} dataType - Type of data to check ('countriesData' or 'countriesCoordinates')
 * @returns {boolean} True if cache is valid, false otherwise
 */
const isCacheValid = (dataType) => {
  const lastFetched = dataCache.lastFetched[dataType];
  return (
    lastFetched && 
    (Date.now() - lastFetched) < CACHE_EXPIRATION &&
    dataCache[dataType] !== null
  );
};

/**
 * Fetch data from the server
 * @param {string} filename - Name of the file to fetch
 * @param {boolean} forceRefresh - Whether to bypass the cache
 * @returns {Promise<Object>} The fetched data
 */
const fetchData = async (filename, forceRefresh = false) => {
  const dataType = filename.replace('.json', '');
  
  // Return cached data if valid and refresh not forced
  if (!forceRefresh && isCacheValid(dataType)) {
    console.log(`Using cached ${dataType}`);
    return dataCache[dataType];
  }
  
  // Add timestamp to prevent browser caching
  const timestamp = Date.now();
  const baseUrl = getBaseUrl();
  
  try {
    // Try to fetch the data
    const response = await fetch(`${baseUrl}/data/${filename}?t=${timestamp}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`${dataType} loaded:`, Object.keys(data).length, 'items');
    
    // Update cache
    dataCache[dataType] = data;
    dataCache.lastFetched[dataType] = Date.now();
    
    return data;
  } catch (error) {
    console.error(`Error fetching ${filename}:`, error);
    
    // Return empty data or cached data as fallback
    return dataCache[dataType] || (dataType === 'countriesCoordinates' ? 
      { customZoomLevels: {}, countries: {} } : {});
  }
};

/**
 * Load country data and store in Redux
 * @param {boolean} forceRefresh - Whether to bypass the cache
 * @returns {Promise<Object>} The country data
 */
export const loadCountriesData = async (forceRefresh = false) => {
  try {
    const data = await fetchData('countriesData.json', forceRefresh);
    
    // Store in Redux
    store.dispatch(setCountriesData(data));
    return data;
  } catch (error) {
    console.error('Failed to load countries data:', error);
    return {};
  }
};

/**
 * Load country coordinates and store in Redux
 * @param {boolean} forceRefresh - Whether to bypass the cache
 * @returns {Promise<Object>} The country coordinates
 */
export const loadCountriesCoordinates = async (forceRefresh = false) => {
  try {
    const data = await fetchData('countriesCoordinates.json', forceRefresh);
    
    // Store in Redux
    store.dispatch(setCountriesCoordinates(data));
    return data;
  } catch (error) {
    console.error('Failed to load countries coordinates:', error);
    return { customZoomLevels: {}, countries: {} };
  }
};

/**
 * Get the center coordinates of a country
 * @param {string} country - Country name
 * @param {Object} countriesData - Country data object
 * @param {Object} countriesCoordinates - Country coordinates object
 * @returns {Array} Center coordinates [longitude, latitude]
 */
export const getCountryCenter = (country, countriesData, countriesCoordinates) => {
  if (!country) return [0, 0];
  
  // Try to get from coordinates data first (more reliable for map centering)
  if (countriesCoordinates?.countries && countriesCoordinates.countries[country]) {
    return countriesCoordinates.countries[country];
  }
  
  // Fall back to coordinates in country data if available
  if (countriesData && countriesData[country] && countriesData[country].coordinates) {
    return countriesData[country].coordinates;
  }
  
  console.warn(`Country "${country}" not found, using default position`);
  return [0, 0];
};

/**
 * Get custom zoom level for a country
 * @param {string} country - Country name
 * @param {Object} countriesCoordinates - Country coordinates object
 * @returns {number} Zoom level (default: 4)
 */
export const getCountryZoomLevel = (country, countriesCoordinates) => {
  if (!country || !countriesCoordinates?.customZoomLevels) return 4;
  
  return countriesCoordinates.customZoomLevels[country] || 4;
};

/**
 * Find countries that border the specified country
 * @param {string} country - Country name
 * @param {Object} countriesData - Country data object
 * @returns {Array} List of bordering countries
 */
export const getBorderingCountries = (country, countriesData) => {
  if (!country || !countriesData || !countriesData[country]) return [];
  
  const borders = countriesData[country].borders || [];
  return borders
    .filter(border => border.enabled)
    .map(border => border.country);
};

export default {
  loadCountriesData,
  loadCountriesCoordinates,
  getCountryCenter,
  getCountryZoomLevel,
  getBorderingCountries
};