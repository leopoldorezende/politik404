import React from 'react';
import { useSelector } from 'react-redux';
import LoginScreen from './screens/LoginScreen';
import RoomSelectionScreen from './screens/RoomSelectionScreen';
import GameScreen from './screens/GameScreen';
import './assets/styles/App.css';

function App() {
  const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
  const currentRoom = useSelector(state => state.rooms.currentRoom);

  // Função para determinar qual tela mostrar
  const renderScreen = () => {
    if (!isAuthenticated) {
      return <LoginScreen />;
    } else if (!currentRoom) {
      return <RoomSelectionScreen />;
    } else {
      return <GameScreen />;
    }
  };

  return (
    <div className="app">
      {renderScreen()}
    </div>
  );
}

export default App;