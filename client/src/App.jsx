import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import AuthPage from './pages/AuthPage';
import RoomPage from './pages/RoomPage';
import GamePage from './pages/GamePage';
import './shared/styles/App.css';
import { socketApi, SOCKET_EVENTS } from './modules/network/socketService';

function App() {
  const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
  const currentRoom = useSelector(state => state.rooms.currentRoom);
  const dispatch = useDispatch();

  useEffect(() => {
    // Inicializa a conexão do socket ao montar o componente
    socketApi.connect();
    
    // Também dispara o evento Redux para manter o fluxo consistente
    dispatch({ type: SOCKET_EVENTS.CONNECT });
    
    // Cleanup ao desmontar
    return () => {
      // Não precisamos fazer nada aqui, o socket é uma singleton
      // e permanecerá até o fim da sessão
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