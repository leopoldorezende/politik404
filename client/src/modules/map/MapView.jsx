import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapView.css';
import Chokepoints from './Chokepoints';

import {
  loadCountriesData,
  loadCountriesCoordinates,
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
      projection: 'globe',
      attributionControl: false, 
      logoPosition: 'top-left', 
      logo: false 
    });

    map.current.on('load', () => {
      console.log('Mapa totalmente carregado - inicializando camadas');
      setLoaded(true);
      loadData();
      addCountryClickHandler();
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
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  useEffect(() => {
    if (loaded && countriesData && map.current) {
      setupMapLayers();
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

    // Ocultar labels dos países que não existem no JSON
    if (countriesData) {
      mapInstance.setFilter('country-label', [
        'in', ['get', 'name_en'], ['literal', Object.keys(countriesData)]
      ]);
    }
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
          
          // Se o usuário clicar em um país disponível, pode solicitar este país específico
          const availableCountries = Object.keys(countriesData || {}).filter(country => {
            const otherPlayersCountries = getOtherPlayersCountries();
            return country !== myCountry && !otherPlayersCountries.includes(country);
          });
          
          if (availableCountries.includes(clickedCountry) && clickedCountry !== myCountry) {
            // Aqui poderia mostrar uma confirmação antes de solicitar o país
            console.log(`País ${clickedCountry} disponível, o jogador pode solicitar a troca`);
            
            // Podemos adicionar aqui um popup de confirmação se necessário
          }
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

  return (
    <div className="map-container">
      <div ref={mapContainer} className="map" />
      <Chokepoints map={map.current} />
    </div>
  );
};

export default MapView;