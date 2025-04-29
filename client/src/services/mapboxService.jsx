// src/services/mapboxService.js

export const getMapboxToken = async () => {
  try {
    // Chama o backend via proxy do Vite (relative path)
    const response = await fetch('/api/mapbox', {
      headers: { 'Authorization': 'lavrovpass' }
    });
    
    if (!response.ok) {
      throw new Error(`Não autorizado (status: ${response.status})`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Erro ao obter token do Mapbox:', error);
    throw error;
  }
};
