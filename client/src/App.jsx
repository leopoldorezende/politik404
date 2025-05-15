import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import AuthPage from './modules/auth/AuthPage';
import RoomPage from './modules/room/RoomPage';
import GamePage from './modules/game/GamePage';
import './App.css';
import { socketApi, SOCKET_EVENTS } from './services/socketClient';

function App() {
  const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  const dispatch = useDispatch();
  const socketInitialized = useRef(false);

  useEffect(() => {
    // Só inicializa o socket uma vez, mesmo em Strict Mode
    if (!socketInitialized.current) {
      console.log('Inicializando socket connection...');
      socketInitialized.current = true;
      
      // Inicializa a conexão do socket
      socketApi.connect();
      
      // Dispara o evento Redux para manter o fluxo consistente
      dispatch({ type: SOCKET_EVENTS.CONNECT });
    }
    
    // O cleanup não deve desconectar o socket em desenvolvimento
    // porque isso causará problemas com Strict Mode
    return () => {
      // No cleanup em desenvolvimento
    };
  }, [dispatch]);

  // Função para determinar qual tela mostrar
  const renderScreen = () => {
    if (!isAuthenticated) {
      return <AuthPage />;
    } else if (!currentRoom) {
      return <RoomPage />;
    } else {
      return <GamePage />;
    }
  };

  return (
    <div className="app">
      {renderScreen()}
    </div>
  );
}

export default App;