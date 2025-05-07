import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sideview from '../sideview/Sideview';
import Sidetools from '../sidetools/Sidetools';
import MapView from '../map/MapView';
import { loadCountriesData, loadCountriesCoordinates } from '../country/countryService';
import { setCountriesCoordinates } from './gameState'; 
import './GamePage.css';

const GamePage = () => {
  const dispatch = useDispatch();
  // const currentRoom = useSelector(state => state.rooms.currentRoom);
  const myCountry = useSelector(state => state.game.myCountry);
  
  const [sideviewActive, setSideviewActive] = useState(true);
  const [sidetoolsActive, setSidetoolsActive] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  useEffect(() => {
    const loadAllData = async () => {
      try {
        await loadCountriesData();
        
        const coordinates = await loadCountriesCoordinates();
        if (coordinates) {
          dispatch(setCountriesCoordinates(coordinates));
        }
        
        setDataLoaded(true);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    };
    
    loadAllData();
  }, [dispatch]);
  
  useEffect(() => {
    const handleCountrySelected = (event) => {
      const country = event.detail.country;
      
      if (window.innerWidth <= 1200) {
        setSideviewActive(true);
      }
      
      const countryTab = document.querySelector('#sidebar .tab[data-target="country"]');
      const countryContent = document.getElementById('country');
      
      if (countryTab && countryContent) {
        const sidebarTabs = document.querySelectorAll('#sidebar .tab');
        const sidebarContents = document.querySelectorAll('#sidebar .tab-content');
        
        sidebarTabs.forEach(t => t.classList.remove('active'));
        sidebarContents.forEach(c => c.classList.remove('active'));
        
        countryTab.classList.add('active');
        countryContent.classList.add('active');
      }
    };
    
    document.addEventListener('countrySelected', handleCountrySelected);
    return () => {
      document.removeEventListener('countrySelected', handleCountrySelected);
    };
  }, []);

  const handleExitRoom = () => {
    dispatch({ type: 'socket/leaveRoom' });
    dispatch({ type: 'rooms/leaveRoom' });
  };

  const toggleSideview = () => {
    setSideviewActive(!sideviewActive);
  };

  const toggleSidetools = () => {
    setSidetoolsActive(!sidetoolsActive);
  };

  useEffect(() => {
    const sideview = document.getElementById('sideview');
    const sidetools = document.getElementById('sidetools');
    
    if (sideview) {
      sideview.classList.toggle('active', sideviewActive);
    }
    
    if (sidetools) {
      sidetools.classList.toggle('active', sidetoolsActive);
    }

    const handleClickOutside = (event) => {
      // Verifica se está em modo mobile
      if (window.innerWidth <= 1200) {
        const sideview = document.getElementById('sideview');
        const sidetools = document.getElementById('sidetools');
        const btnOpenSideview = document.getElementById('btn-open-sideview');
        const btnOpenSidetools = document.getElementById('btn-open-sidetools');
        
        // Verifica se clicou fora da sideview e não no botão de abrir
        if (sideviewActive && 
            sideview && 
            !sideview.contains(event.target) && 
            btnOpenSideview && 
            !btnOpenSideview.contains(event.target)) {
          setSideviewActive(false);
        }
        
        // Verifica se clicou fora da sidetools e não no botão de abrir
        if (sidetoolsActive && 
            sidetools && 
            !sidetools.contains(event.target) && 
            btnOpenSidetools && 
            !btnOpenSidetools.contains(event.target)) {
          setSidetoolsActive(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sideviewActive, sidetoolsActive]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1200) {
        setSideviewActive(false);
        setSidetoolsActive(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!dataLoaded) {
    return (
      <div id="game-screen" className="loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Carregando dados do jogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="game-screen">
      <div id="map-container">
        <MapView />
      </div>
      
      <button id="btn-open-sidetools" className="map-control" onClick={toggleSidetools}>
        <span className="material-icons">sports_esports</span>
      </button>
      
      <button id="btn-open-sideview" className="map-control" onClick={toggleSideview}>
        <span className="material-icons">public</span>
      </button>
      
      <Sidetools 
        onClose={toggleSidetools} 
        isActive={sidetoolsActive}
        myCountry={myCountry}
      />
      
      <Sideview 
        onExitRoom={handleExitRoom} 
        onClose={toggleSideview} 
        isActive={sideviewActive}
      />
    </div>
  );
};

export default GamePage;
