import React, { useEffect, useState } from 'react';
import * as turf from '@turf/turf';

// Definição dos chokepoints marítimos estratégicos
const maritimeChokepoints = [
  { id: 'hormuz', title: 'Estreito de Hormuz', coordinates: [56.0, 26.0] },
  { id: 'malacca', title: 'Estreito de Malaca', coordinates: [101.0, 2.5] },
  { id: 'suez', title: 'Canal de Suez', coordinates: [32.5833, 30.8333] },
  { id: 'panama', title: 'Canal do Panamá', coordinates: [-79.5, 9.0] },
  { id: 'gibraltar', title: 'Estreito de Gibraltar', coordinates: [-5.0, 36.0] }
];

const MaritimeChokepoints = ({ map }) => {
  const [initialized, setInitialized] = useState(false);

  // Função para gerar o GeoJSON dos círculos
  const createCirclesGeoJSON = () => {
    console.log('Criando GeoJSON para chokepoints');
    const features = maritimeChokepoints.map(point => {
      // Cria um círculo com 210km de raio (reduzido em 40% dos 350km anteriores)
      const circle = turf.circle(point.coordinates, 210, { 
        steps: 64, 
        units: 'kilometers'
      });
      
      // Adiciona propriedades ao círculo
      circle.properties = {
        id: point.id,
        title: point.title
      };
      
      return circle;
    });

    return {
      type: 'FeatureCollection',
      features: features
    };
  };

  // Função principal para adicionar os círculos
  const addChokepointsToMap = () => {
    // Verifica se o mapa está disponível e carregado
    if (!map || !map.loaded()) {
      console.log('Mapa não está carregado para adicionar chokepoints');
      return false;
    }

    console.log('Adicionando chokepoints ao mapa');

    try {
      // Primeiro, remova quaisquer camadas existentes para evitar duplicações
      if (map.getLayer('chokepoints-fill')) map.removeLayer('chokepoints-fill');
      if (map.getLayer('chokepoints-outline')) map.removeLayer('chokepoints-outline');
      if (map.getLayer('chokepoints-labels')) map.removeLayer('chokepoints-labels');
      if (map.getSource('chokepoints-source')) map.removeSource('chokepoints-source');

      // Crie o GeoJSON
      const circlesData = createCirclesGeoJSON();

      // Adicione a fonte com os dados
      map.addSource('chokepoints-source', {
        type: 'geojson',
        data: circlesData
      });

      // Adicione a camada de preenchimento do círculo
      map.addLayer({
        id: 'chokepoints-fill',
        type: 'fill',
        source: 'chokepoints-source',
        paint: {
          'fill-color': 'rgba(255, 105, 180, 0.3)',
          'fill-opacity': 0.6
        }
      });

      // Adicione a camada de contorno do círculo com bordas mais finas (1px em vez de 2px)
      map.addLayer({
        id: 'chokepoints-outline',
        type: 'line',
        source: 'chokepoints-source',
        paint: {
          'line-color': 'rgb(255, 105, 180)',
          'line-width': 1
        }
      });

      // Adicione a camada de texto
      map.addLayer({
        id: 'chokepoints-labels',
        type: 'symbol',
        source: 'chokepoints-source',
        layout: {
          'text-field': ['get', 'title'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-offset': [0, 0],
          'text-anchor': 'center'
        },
        paint: {
          'text-color': '#333333',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1
        }
      });

      console.log('Chokepoints adicionados com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro ao adicionar chokepoints:', error);
      return false;
    }
  };

  useEffect(() => {
    console.log('MaritimeChokepoints montado. Map exists:', !!map);
    
    // Função para lidar com o carregamento inicial e recarregamentos
    const handleMapReady = () => {
      console.log('Evento de mapa detectado, tentando adicionar chokepoints');
      
      if (addChokepointsToMap()) {
        console.log('Chokepoints inicializados com sucesso');
        setInitialized(true);
      }
    };

    // Se o mapa já estiver carregado, adicione os chokepoints imediatamente
    if (map && map.loaded()) {
      console.log('Mapa já está carregado, adicionando chokepoints imediatamente');
      handleMapReady();
    } 
    // Caso contrário, aguarde o evento 'load'
    else if (map) {
      console.log('Aguardando o carregamento do mapa...');
      map.on('load', handleMapReady);
    }

    // Também escute eventos de mudança de estilo, que podem remover as camadas
    if (map) {
      map.on('styledata', () => {
        console.log('Estilo do mapa alterado, verificando chokepoints');
        if (initialized && !map.getLayer('chokepoints-fill')) {
          console.log('Chokepoints perdidos após mudança de estilo, readicionando...');
          addChokepointsToMap();
        }
      });
    }

    // Função de limpeza
    return () => {
      console.log('Desmontando componente MaritimeChokepoints');
      if (map) {
        // Remova os listeners
        map.off('load', handleMapReady);
        map.off('styledata');
        
        // Remova as camadas e fontes se o mapa ainda estiver disponível
        if (map.loaded()) {
          if (map.getLayer('chokepoints-labels')) map.removeLayer('chokepoints-labels');
          if (map.getLayer('chokepoints-outline')) map.removeLayer('chokepoints-outline');
          if (map.getLayer('chokepoints-fill')) map.removeLayer('chokepoints-fill');
          if (map.getSource('chokepoints-source')) map.removeSource('chokepoints-source');
        }
      }
    };
  }, [map]); // Dependência no objeto map

  return null; // Este componente não renderiza nada visualmente
};

export default MaritimeChokepoints;