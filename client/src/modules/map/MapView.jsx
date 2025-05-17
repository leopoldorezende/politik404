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

const MapView = ({ justClosedSidebar }) => {
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

  // Observe o justClosedSidebar para saber se precisamos ignorar cliques no mapa
  useEffect(() => {
    // Nada a fazer aqui além de monitorar a propriedade
  }, [justClosedSidebar]);

  const getOtherPlayersCountries = () => {
    return players?.filter(player => {
      if (typeof player === 'object') {
        // MUDAR: Não filtrar por isOnline, apenas por username
        return player.username !== sessionStorage.getItem('username');
      }
      if (typeof player === 'string') {
        return !player.startsWith(sessionStorage.getItem('username'));
      }
      return false;
    }).map(player => {
      if (typeof player === 'object') {
        return player.country;
      }
      const match = player.match(/\((.*)\)/);
      return match ? match[1] : '';
    }).filter(Boolean) || [];
  };

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

  // Efeito para atualizar o mapa quando a lista de jogadores mudar ou quando o país selecionado mudar
  useEffect(() => {
    if (loaded && map.current) {
      // Atualiza a referência do país selecionado
      currentSelectedCountry.current = selectedCountry;
      // Atualiza a visualização do mapa para refletir o país selecionado
      setupMapLayers();
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
  }, [loaded, countriesData, myCountry, players, selectedCountry]);

  const setupMapLayers = () => {
    const mapInstance = map.current;
    if (!mapInstance.getSource('countries')) {
      mapInstance.addSource('countries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
      });
    }
    
    // Considerar jogadores offline como ainda "controlando" o país
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
      // Meu país sempre em amarelo, independente se está selecionado ou não
      ['==', ['get', 'name_en'], myCountry], 'rgba(255, 213, 0, 0.9)',
      // País selecionado em laranja (somente se não for meu país)
      ['all', 
        ['==', ['get', 'name_en'], selectedCountry],
        ['!=', ['get', 'name_en'], myCountry]
      ], 'rgba(255, 155, 50, 0.6)',
      // Países de outros jogadores em roxo
      ['in', ['get', 'name_en'], ['literal', otherPlayersCountries]], 'rgba(105, 65, 217, 0.9)',
      // Países disponíveis em branco transparente
      ['in', ['get', 'name_en'], ['literal', availableCountries]], 'rgba(255, 255, 255, 0.5)',
      // Países que não estão no jogo em cinza escuro transparente
      ['!', ['in', ['get', 'name_en'], ['literal', Object.keys(countriesData || {})]]], 'rgba(90, 120, 120, .3)',
      // Fallback para outros países
      'rgba(30, 50, 70, 0)'
    ];

    const borderColorExpression = [
      'case',
      // Borda do meu país sempre em preto
      ['==', ['get', 'name_en'], myCountry], 'rgba(0, 0, 0, 0.8)',
      // Borda do país selecionado em laranja mais escuro (somente se não for meu país)
      ['all', 
        ['==', ['get', 'name_en'], selectedCountry],
        ['!=', ['get', 'name_en'], myCountry]
      ], 'rgba(255, 155, 50, 1)',
      // Borda dos países de outros jogadores em preto
      ['in', ['get', 'name_en'], ['literal', otherPlayersCountries]], 'rgba(0, 0, 0, 0.8)',
      // Borda dos países disponíveis em cinza
      ['in', ['get', 'name_en'], ['literal', availableCountries]], 'rgba(90, 120, 120, 1)',
      // Outra condição para países disponíveis (parece redundante no código original)
      ['in', ['get', 'name_en'], ['literal', availableCountries]], 'rgba(120, 120, 120, 0.8)',
      // Fallback para outras bordas
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
      // Se acabamos de fechar uma sidebar, ignore este clique
      if (justClosedSidebar) {
        console.log('Ignorando clique no mapa porque uma sidebar acabou de ser fechada');
        return;
      }

      // Verifica se está em modo mobile e uma sidebar está aberta
      const isMobile = window.innerWidth <= 1200;
      const sideviewActive = document.getElementById('sideview')?.classList.contains('active');
      const sidetoolsActive = document.getElementById('sidetools')?.classList.contains('active');
      
      // Se estamos no modo mobile e uma sidebar está aberta, não processe o clique no mapa
      if (isMobile && (sideviewActive || sidetoolsActive)) {
        console.log('Ignorando clique no mapa porque uma sidebar está aberta no modo mobile');
        return;
      }

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