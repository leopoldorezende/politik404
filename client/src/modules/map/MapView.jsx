import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '../../shared/styles/MapView.css';
import SeaRoutes from './SeaRoutes';
import * as turf from '@turf/turf';

import {
  loadCountriesData,
  loadCountriesCoordinates,
  // europeanUnionCountries,
  // africanUnionCountries,
  getCountryCenter
} from '../country/countryService';

import {
  setCountriesCoordinates,
  setSelectedCountry
} from '../game/gameState';

const MapView = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const dispatch = useDispatch();
  const [loaded, setLoaded] = useState(false);
  // Referência para o país selecionado atualmente
  const currentSelectedCountry = useRef(null);

  const myCountry = useSelector(state => state.game.myCountry);
  const countriesData = useSelector(state => state.game.countriesData);
  const countriesCoordinates = useSelector(state => state.game.countriesCoordinates);
  const players = useSelector(state => state.game.players);
  const selectedCountry = useSelector(state => state.game.selectedCountry);

  const getOtherPlayersCountries = () => players?.filter(player => {
    if (typeof player === 'object') return player.username !== sessionStorage.getItem('username');
    if (typeof player === 'string') return !player.startsWith(sessionStorage.getItem('username'));
    return false;
  }).map(player => typeof player === 'object' ? player.country : (player.match(/\((.*)\)/)?.[1] || '')).filter(Boolean) || [];

  useEffect(() => {
    if (map.current) return;

    const mapboxToken = 'pk.eyJ1IjoibGVvcG9sZG9yZXplbmRlIiwiYSI6ImNqOG9zaXVyazA3anozNG8weTVrcnl4NDgifQ._89Jf3MABokdSiU0fqX84w';
    mapboxgl.accessToken = mapboxToken;

    console.log('Inicializando mapa...');
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/leopoldorezende/cklv3mqga2ki517m1zqftm5vp',
      center: [0, 0],
      zoom: 1.5,
      maxZoom: 5.5,
      minZoom: 1.2,
      projection: 'globe'
    });

    map.current.on('style.load', () => {
      console.log('Estilo do mapa carregado');
      // Readicionar os chokepoints quando o estilo do mapa for alterado
      if (loaded) {
        setTimeout(() => {
          addSeaRoutes();
        }, 500);
      }
    });

    map.current.on('load', () => {
      console.log('Mapa totalmente carregado - inicializando camadas');
      setLoaded(true);
      loadData();
      addCountryClickHandler();
      
      // Garante que os rótulos sejam configurados corretamente após o carregamento do mapa
      if (countriesData) {
        hideLabelsForUnknownCountries();
        highlightOtherPlayersLabels();
      }
    });

    return () => {
      // Limpa a animação ao desmontar
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Novo useEffect para centralizar o mapa no país do jogador quando ele entra na sala
  useEffect(() => {
    if (loaded && map.current && myCountry && countriesData && countriesData[myCountry]) {
      // Centraliza o mapa no país do jogador
      centerMapOnCountry(myCountry);
      
      // Seleciona o país do jogador para exibir informações na barra lateral
      dispatch(setSelectedCountry(myCountry));
      
      // Dispara evento de seleção de país (necessário para alguns componentes que escutam este evento)
      document.dispatchEvent(new CustomEvent('countrySelected', {
        detail: { country: myCountry }
      }));
    }
  }, [loaded, myCountry, countriesData, dispatch]);

  // Efeito para atualizar o mapa quando a lista de jogadores mudar
  useEffect(() => {
    if (loaded && map.current && selectedCountry) {
      currentSelectedCountry.current = selectedCountry;
    }
  }, [loaded, players, selectedCountry]);

  const loadData = async () => {
    try {
      const [countries, coordinates] = await Promise.all([
        loadCountriesData(),
        loadCountriesCoordinates(),
      ]);

      if (coordinates) dispatch(setCountriesCoordinates(coordinates));
      if (countries && map.current) setupMapLayers();
      
      // Adiciona os chokepoints diretamente
      addSeaRoutes();
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  const hideLabelsForUnknownCountries = () => {
    if (!map.current) return;
    
    // Lista de países conhecidos
    const knownCountries = Object.keys(countriesData || {});
    
    // Primeiro, encontra todas as camadas de texto (labels) no mapa
    const layers = map.current.getStyle().layers;
    if (!layers) return;
    
    // Itera por todas as camadas para encontrar camadas de texto/símbolos
    layers.forEach(layer => {
      if (layer && layer.type === 'symbol' && layer.id.includes('label')) {
        // Para camadas específicas de rótulos de países, aplica o filtro
        if (layer.id === 'country-label' || layer.id.includes('place-country')) {
          map.current.setFilter(layer.id, [
            'in',
            ['get', 'name_en'],
            ['literal', knownCountries]
          ]);
        }
      }
    });
  };
  
  const highlightOtherPlayersLabels = () => {
    if (!map.current) return;
  
    const otherCountries = getOtherPlayersCountries();
    if (!otherCountries.length) return;
    
    // Encontra todas as camadas de texto (labels) no mapa
    const layers = map.current.getStyle().layers;
    if (!layers) return;
    
    // Para formatar arrays para a expressão match do Mapbox
    const formatMatchExpression = (countries, trueValue, falseValue) => {
      const result = ['match', ['get', 'name_en']];
      countries.forEach(country => {
        result.push(country);
        result.push(trueValue);
      });
      result.push(falseValue);
      return result;
    };
    
    // Itera por todas as camadas para encontrar camadas de texto/símbolos
    layers.forEach(layer => {
      if (layer && layer.type === 'symbol' && layer.id.includes('label')) {
        // Para camadas específicas de rótulos de países, aplica o destaque
        if (layer.id === 'country-label' || layer.id.includes('place-country')) {
          // Define texto branco para países de outros jogadores
          map.current.setPaintProperty(
            layer.id, 
            'text-color', 
            formatMatchExpression(otherCountries, '#ffffff', '#444')
          );
          
          // Define contorno preto para países de outros jogadores
          map.current.setPaintProperty(
            layer.id, 
            'text-halo-color', 
            formatMatchExpression(otherCountries, 'rgba(0, 0, 0, 0.5)', '#ffffff')
          );
          
          // Aumenta o brilho do contorno para melhor legibilidade
          map.current.setPaintProperty(
            layer.id, 
            'text-halo-width', 
            formatMatchExpression(otherCountries, 1.5, 0.75)
          );
        }
      }
    });
  };

  useEffect(() => {
    if (loaded && countriesData && map.current) {
      setupMapLayers();
      
      // Chamadas explícitas para garantir que os rótulos sejam sempre atualizados
      hideLabelsForUnknownCountries();
      highlightOtherPlayersLabels();
    }
  }, [loaded, countriesData, myCountry, players]);

  const setupMapLayers = () => {
    const mapInstance = map.current;
    if (!mapInstance.getSource('countries')) {
      mapInstance.addSource('countries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
      });
    }

    const otherPlayersCountries = getOtherPlayersCountries();
    console.log('Países de outros jogadores:', otherPlayersCountries);

    // Países no JSON mas sem jogadores controlando
    const availableCountries = Object.keys(countriesData || {}).filter(country => 
      country !== myCountry && !otherPlayersCountries.includes(country)
    );
    console.log('Países disponíveis sem jogadores:', availableCountries);

    // Expressão de cores
    const fillColorExpression = [
      'case',
      ['==', ['get', 'name_en'], myCountry], 'rgba(255, 213, 0, 0.9)',
      ['in', ['get', 'name_en'], ['literal', otherPlayersCountries]], 'rgba(105, 65, 217, 0.9)',
      ['in', ['get', 'name_en'], ['literal', availableCountries]], 'rgba(255, 255, 255, 0.5)',
      ['!', ['in', ['get', 'name_en'], ['literal', Object.keys(countriesData || {})]]], 'rgba(90, 120, 120, .3)',
      'rgba(30, 50, 70, 0)'
    ];

    const borderColorExpression = [
      'case',
      ['==', ['get', 'name_en'], myCountry], 'rgba(0, 0, 0, 0.8)',
      ['in', ['get', 'name_en'], ['literal', otherPlayersCountries]], 'rgba(0, 0, 0, 0.8)',
      ['in', ['get', 'name_en'], ['literal', availableCountries]], 'rgba(90, 120, 120, 1)',
      ['in', ['get', 'name_en'], ['literal', availableCountries]], 'rgba(120, 120, 120, 0.8)',
      '#ffffff'
    ];
    
    // Se já existe a layer country-fills, atualize-a em vez de tentar criar novamente
    if (mapInstance.getLayer('country-fills')) {

      // Atualiza a expressão de cores
      mapInstance.setPaintProperty('country-fills', 'fill-color', fillColorExpression);
    } else {
      // Cria a layer pela primeira vez
      mapInstance.addLayer({
        id: 'country-fills',
        type: 'fill',
        source: 'countries',
        'source-layer': 'country_boundaries',
        filter: [
          'all',
          ['==', ['get', 'disputed'], 'false'],
          [
            'any',
            ['==', 'all', ['get', 'worldview']],
            ['in', 'US', ['get', 'worldview']]
          ]
        ],
        paint: {
          'fill-color': fillColorExpression,
          'fill-opacity': 0.9
        }
      });
    }

    if (!mapInstance.getLayer('country-borders')) {
      mapInstance.addLayer({
        id: 'country-borders',
        type: 'line',
        source: 'countries',
        'source-layer': 'country_boundaries',
        filter: [
          'all',
          ['==', ['get', 'disputed'], 'false'],
          [
            'any',
            ['==', 'all', ['get', 'worldview']],
            ['in', 'US', ['get', 'worldview']]
          ]
        ],
        layout: {},
        paint: {
          'line-color': borderColorExpression,
          'line-width': 1
        }
      }, 'country-fills');
    } else {
      // Atualiza a expressão de cores da borda
      mapInstance.setPaintProperty('country-borders', 'line-color', borderColorExpression);
    }

    // Oculta rótulos de países que não estão em countriesData
    hideLabelsForUnknownCountries();
    
    // Destaca os rótulos dos países de outros jogadores
    highlightOtherPlayersLabels();
    
    // Adiciona os círculos dos estreitos estratégicos
    setTimeout(() => {
      addSeaRoutes();
    }, 500); // Atraso de 500ms para garantir que todas as outras camadas sejam carregadas primeiro
  };

  const addCountryClickHandler = () => {
    if (!map.current) return;
    map.current.on('click', (e) => {
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['country-fills']
      });

      if (features.length > 0) {
        const clickedCountry = features[0].properties.name_en;
        if (countriesData?.[clickedCountry]) {
          // Centraliza no país clicado
          centerMapOnCountry(clickedCountry);
          
          // Atualiza o país selecionado no Redux
          dispatch(setSelectedCountry(clickedCountry));
          currentSelectedCountry.current = clickedCountry;
          
          // Dispara evento de seleção de país
          document.dispatchEvent(new CustomEvent('countrySelected', {
            detail: { country: clickedCountry }
          }));
        } 
      }
    });
  };

  const centerMapOnCountry = (country) => {
    const center = getCountryCenter(country, countriesData, countriesCoordinates);
    if (center[0] === 0 && center[1] === 0) return;

    const zoomLevel = countriesCoordinates.customZoomLevels?.[country] || 4;
    map.current.flyTo({ center, zoom: zoomLevel, speed: 0.8, curve: 1, essential: true });
  };

  // Função para adicionar os círculos dos estreitos estratégicos diretamente
  const addSeaRoutes = () => {
    if (!map.current || !map.current.loaded()) {
      console.log('Mapa não está pronto para adicionar chokepoints');
      return;
    }
    
    console.log('Adicionando chokepoints diretamente no MapView');
    
    // Lista de estreitos estratégicos
    const chokepoints = [
      { id: 'hormuz', title: 'Estreito de Hormuz', coordinates: [56.0, 26.0] },
      { id: 'malacca', title: 'Estreito de Malaca', coordinates: [101.0, 2.5] },
      { id: 'suez', title: 'Canal de Suez', coordinates: [32.5833, 30.8333] },
      { id: 'panama', title: 'Canal do Panamá', coordinates: [-79.5, 9.0] },
      { id: 'gibraltar', title: 'Estreito de Gibraltar', coordinates: [-5.0, 36.0] }
    ];
    
    try {
      // Remover camadas anteriores se existirem
      if (map.current.getLayer('chokepoints-fill-direct')) map.current.removeLayer('chokepoints-fill-direct');
      if (map.current.getLayer('chokepoints-outline-direct')) map.current.removeLayer('chokepoints-outline-direct');
      if (map.current.getLayer('chokepoints-labels-direct')) map.current.removeLayer('chokepoints-labels-direct');
      if (map.current.getSource('chokepoints-source-direct')) map.current.removeSource('chokepoints-source-direct');
      
      // Criar os círculos usando turf.js - reduzindo o raio para 210km (40% menor que 350km)
      const features = chokepoints.map(point => {
        const circle = turf.circle(point.coordinates, 210, { steps: 64, units: 'kilometers' });
        circle.properties = {
          id: point.id,
          title: point.title
        };
        return circle;
      });
      
      // Adicionar a fonte com os dados
      map.current.addSource('chokepoints-source-direct', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: features
        }
      });
      
      // Adicionar camada de preenchimento
      map.current.addLayer({
        id: 'chokepoints-fill-direct',
        type: 'fill',
        source: 'chokepoints-source-direct',
        paint: {
          'fill-color': 'rgba(255, 105, 180, 0.3)',
          'fill-opacity': 0.6
        }
      });
      
      // Adicionar camada de contorno com borda mais fina (1px em vez de 2px)
      map.current.addLayer({
        id: 'chokepoints-outline-direct',
        type: 'line',
        source: 'chokepoints-source-direct',
        paint: {
          'line-color': 'rgba(255, 105, 180, 0.8)',
          'line-width': 1
        }
      });
      
      // Adicionar camada de texto
      map.current.addLayer({
        id: 'chokepoints-labels-direct',
        type: 'symbol',
        source: 'chokepoints-source-direct',
        layout: {
          'text-field': ['get', 'title'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-offset': [0, 0],
          'text-anchor': 'center'
        },
        paint: {
          'text-color': '#333333',
          'text-halo-color': 'rgba(255, 255, 255, 0.7)',
          'text-halo-width': 1
        }
      });
      
      console.log('Chokepoints adicionados diretamente com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar chokepoints diretamente:', error);
    }
  };

  return (
    <div className="map-container">
      <div ref={mapContainer} className="map" />
      <SeaRoutes map={map.current} />
    </div>
  );
};

export default MapView;