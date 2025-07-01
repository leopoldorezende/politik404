import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapView.css';
// import Chokepoints from './Chokepoints';

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

  const selectCountryOnMap = (countryName) => {
    if (!countryName || !countriesData?.[countryName]) {
      console.warn('País não encontrado:', countryName);
      return;
    }
    
    console.log(`Selecionando país via função global: ${countryName}`);
    
    // Centraliza no país
    centerMapOnCountry(countryName);
    
    // Atualiza o país selecionado no Redux
    dispatch(setSelectedCountry(countryName));
    currentSelectedCountry.current = countryName;
    
    // Dispara evento de seleção de país
    document.dispatchEvent(new CustomEvent('countrySelected', {
      detail: { 
        country: countryName,
        source: 'globalFunction'
      }
    }));
  };

  // ===== Expor função globalmente quando o mapa carrega =====
  useEffect(() => {
    if (loaded && map.current) {
      // Expor função global para seleção de país
      window.selectCountryOnMap = selectCountryOnMap;
      
      // Expor instância do mapa para depuração (opcional)
      window.mapInstance = map.current;
      
      console.log('✅ Função global selectCountryOnMap disponível');
    }
    
    // Cleanup: remover referências globais ao desmontar
    return () => {
      if (window.selectCountryOnMap) {
        delete window.selectCountryOnMap;
      }
      if (window.mapInstance) {
        delete window.mapInstance;
      }
    };
  }, [loaded, countriesData, dispatch]);

  // Observe o justClosedSidebar para saber se precisamos ignorar cliques no mapa
  useEffect(() => {
    // Nada a fazer aqui além de monitorar a propriedade
  }, [justClosedSidebar]);

  const getOtherPlayersCountries = () => {
    if (!players || !Array.isArray(players)) {
      return [];
    }
    
    return players.filter(player => {
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
        return player.country || '';
      }
      const match = player.match(/\((.*)\)/);
      return match ? match[1] : '';
    }).filter(country => country && country.trim() !== '') || [];
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
      maxZoom: 3.5,
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

  useEffect(() => {
    if (loaded && countriesData && map.current) {
      // Aguardar um pouco para garantir que myCountry seja definido
      const timer = setTimeout(() => {
        console.log('Verificando dados para setupMapLayers:', {
          loaded,
          hasCountriesData: !!countriesData,
          hasMap: !!map.current,
          myCountry,
          selectedCountry,
          playersCount: players?.length || 0
        });
        
        // Se não temos myCountry mas temos players, solicitar o país
        if (!myCountry && players && players.length > 0) {
          console.log('myCountry não definido, solicitando do servidor...');
          const socket = window.socketApi?.getSocketInstance();
          if (socket) {
            socket.emit('getMyCountry');
          }
        }
        
        if (countriesData && Object.keys(countriesData).length > 0) {
          setupMapLayers();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [loaded, countriesData, myCountry, players, selectedCountry]);

  const loadData = async () => {
    try {
      console.log('Iniciando carregamento de dados...');
      const [countries, coordinates] = await Promise.all([
        loadCountriesData(),
        loadCountriesCoordinates(),
      ]);

      console.log('Dados carregados:', {
        countries: countries ? Object.keys(countries).length : 0,
        coordinates: coordinates ? 'loaded' : 'not loaded'
      });

      if (coordinates) dispatch(setCountriesCoordinates(coordinates));
      if (countries && map.current) {
        console.log('Configurando camadas do mapa...');
        setupMapLayers();
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  const setupMapLayers = () => {
    const mapInstance = map.current;
    if (!mapInstance) {
      console.warn('Mapa não inicializado ainda');
      return;
    }
    
    if (!mapInstance.getSource('countries')) {
      mapInstance.addSource('countries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
      });
    }
    
    // Verificar se temos dados necessários
    const safeCountriesData = countriesData || {};
    if (!safeCountriesData || Object.keys(safeCountriesData).length === 0) {
      console.warn('Dados dos países não carregados ainda');
      return;
    }
    
    console.log('Debug - Dados disponíveis:', {
      myCountry,
      selectedCountry,
      players: players?.length || 0,
      countriesDataKeys: Object.keys(safeCountriesData).length
    });
    
    // Considerar jogadores offline como ainda "controlando" o país
    const otherPlayersCountries = getOtherPlayersCountries();
    console.log('Países de outros jogadores:', otherPlayersCountries);

    // Países no JSON mas sem jogadores controlando
    const availableCountries = Object.keys(safeCountriesData).filter(country => 
      country !== myCountry && !otherPlayersCountries.includes(country)
    );
    console.log('Países disponíveis sem jogadores:', availableCountries);

    // Verificações de segurança para evitar valores undefined
    const safeMyCountry = (myCountry && typeof myCountry === 'string' && myCountry.trim() !== '') ? myCountry : null;
    const safeSelectedCountry = (selectedCountry && typeof selectedCountry === 'string' && selectedCountry.trim() !== '') ? selectedCountry : null;
    const safeOtherPlayersCountries = otherPlayersCountries || [];
    const safeAvailableCountries = availableCountries || [];
    const safeCountriesDataKeys = Object.keys(safeCountriesData);

    console.log('Debug - Valores seguros:', {
      safeMyCountry,
      safeSelectedCountry,
      safeOtherPlayersCountries,
      safeAvailableCountries: safeAvailableCountries.length,
      safeCountriesDataKeys: safeCountriesDataKeys.length
    });

    // Expressão de cores
    const fillColorExpression = [
      'case',
      // Meu país e selecionado → amarelo mais claro (quase dourado)
      ['all',
        ['==', ['get', 'name_en'], safeMyCountry],
        ['==', ['get', 'name_en'], safeSelectedCountry]
      ], 'rgba(238, 195, 0, 0.9)',

      // Meu país (não selecionado) → amarelo padrão
      ['==', ['get', 'name_en'], safeMyCountry], 'rgba(255, 232, 116, 0.9)',

      // País selecionado em roxo (somente se não for meu país)
      ['all', 
        ['==', ['get', 'name_en'], safeSelectedCountry],
        ['!=', ['get', 'name_en'], safeMyCountry]
      ], 'rgba(105, 65, 217, 0.9)', // 0, 220, 160  CIANO
      // Países de outros jogadores em laranja
      ['in', ['get', 'name_en'], ['literal', safeOtherPlayersCountries]], 'rgba(240, 120, 0, 0.2)',
      // Países disponíveis em branco transparente
      ['in', ['get', 'name_en'], ['literal', safeAvailableCountries]], 'rgba(255, 255, 255, 0.5)',
      // Países que não estão no jogo em cinza escuro transparente
      ['!', ['in', ['get', 'name_en'], ['literal', safeCountriesDataKeys]]], 'rgba(90, 120, 120, .3)',
      // Fallback para outros países
      'rgba(30, 50, 70, 0)'
    ];

    const borderColorExpression = [
      'case',
      // Borda do meu país sempre em preto
      ['==', ['get', 'name_en'], safeMyCountry], 'rgba(0, 0, 0, 1)',
      // Borda do país selecionado em preto
      ['all', 
        ['==', ['get', 'name_en'], safeSelectedCountry],
        ['!=', ['get', 'name_en'], safeMyCountry]
      ], 'rgba(0, 0, 0, 0.8)',
      // Borda dos países de outros jogadores em preto
      ['in', ['get', 'name_en'], ['literal', safeOtherPlayersCountries]], 'rgba(240, 120, 0, 1)',
      // Borda dos países disponíveis em cinza
      ['in', ['get', 'name_en'], ['literal', safeAvailableCountries]], 'rgba(90, 120, 120, 1)',
      // Outra condição para países disponíveis (parece redundante no código original)
      ['in', ['get', 'name_en'], ['literal', safeAvailableCountries]], 'rgba(120, 120, 120, 0.8)',
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
    if (safeCountriesData) {
      mapInstance.setFilter('country-label', [
        'in', ['get', 'name_en'], ['literal', safeCountriesDataKeys]
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

    const zoomLevel = countriesCoordinates.customZoomLevels?.[country] || 3;
    map.current.flyTo({ center, zoom: zoomLevel, speed: 0.8, curve: 1, essential: true });
  };

  return (
    <div className="map-container">
      <div ref={mapContainer} className="map" />
      {/* <Chokepoints map={map.current} /> */}
    </div>
  );
};

export default MapView;