import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import AuthPage from './pages/AuthPage';
import RoomPage from './pages/RoomPage';
import GamePage from './pages/GamePage';
import './shared/styles/App.css';
import { initializeSocketConnection } from './modules/network/socketClient';


function App() {
  const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  const dispatch = useDispatch();

  useEffect(() => {
    initializeSocketConnection(dispatch);
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