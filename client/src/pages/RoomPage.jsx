import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import '../shared/styles/RoomPage.css';

const RoomPage = () => {
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const dispatch = useDispatch();
  const rooms = useSelector(state => state.rooms.rooms);
  const username = useSelector(state => state.auth.username);

  // Função para garantir conexão e autenticação
  const ensureConnection = () => {
    if (!username) {
      console.warn('Usuário não está autenticado na tela de salas');
      return false;
    }

    // Garantir que o socket está conectado
    dispatch({ type: 'socket/connect' });

    // Garantir que o socket está autenticado com delay para dar tempo de conectar
    setTimeout(() => {
      dispatch({ type: 'socket/authenticate', payload: username });
    }, 500);

    return true;
  };

  useEffect(() => {
    // Verificar se o usuário está autenticado e configurar conexão inicial
    if (!username) {
      console.warn('Usuário não está autenticado na tela de salas');
      return;
    }

    console.log('Inicializando RoomPage para usuário:', username);
    setIsLoading(true);

    // Iniciar conexão com o socket
    ensureConnection();

    // Requisitar a lista de salas com delay para dar tempo de conectar e autenticar
    const timer = setTimeout(() => {
      dispatch({ type: 'socket/getRooms' });
      setIsLoading(false);
    }, 1000);

    // Configurar intervalo para atualizar a lista de salas a cada 30 segundos
    const interval = setInterval(() => {
      if (ensureConnection()) {
        dispatch({ type: 'socket/getRooms' });
      }
    }, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [dispatch, username]);

  // Efeito adicional para reconectar se não receber salas após um tempo
  useEffect(() => {
    if (!username || rooms.length > 0 || connectionRetries >= 3) return;

    const timer = setTimeout(() => {
      console.log('Tentando reconectar por não ter recebido salas...');
      setConnectionRetries(prev => prev + 1);
      ensureConnection();
      
      setTimeout(() => {
        dispatch({ type: 'socket/getRooms' });
      }, 1000);
    }, 5000); // Tentar novamente após 5 segundos

    return () => clearTimeout(timer);
  }, [rooms, username, connectionRetries, dispatch]);

  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      alert('Por favor, digite um nome para a sala!');
      return;
    }
    
    setIsLoading(true);
    console.log(`Iniciando criação da sala: ${roomName}`);
    
    // Garantir conexão e autenticação
    if (!ensureConnection()) {
      setIsLoading(false);
      return;
    }
    
    // Criar sala com delay para garantir autenticação
    setTimeout(() => {
      dispatch({ type: 'socket/createRoom', payload: roomName });
      
      // Limpar o campo de entrada
      setRoomName('');
      
      // Atualiza lista de salas após criar
      setTimeout(() => {
        dispatch({ type: 'socket/getRooms' });
        setIsLoading(false);
      }, 1000);
    }, 500);
  };

  const handleJoinRoom = (roomName) => {
    console.log(`Tentando entrar na sala: ${roomName}`);
    setIsLoading(true);
    
    // Garantir conexão e autenticação
    if (!ensureConnection()) {
      setIsLoading(false);
      return;
    }
    
    // Entrar na sala com delay para garantir autenticação
    setTimeout(() => {
      dispatch({ type: 'socket/joinRoom', payload: roomName });
      
      // Resetar estado de carregamento
      setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    }, 500);
  };

  const handleRefreshRooms = () => {
    console.log('Atualizando lista de salas');
    setIsLoading(true);
    
    // Garantir conexão e autenticação
    if (!ensureConnection()) {
      setIsLoading(false);
      return;
    }
    
    // Solicitar lista de salas com delay para garantir autenticação
    setTimeout(() => {
      dispatch({ type: 'socket/getRooms' });
      
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }, 500);
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreateRoom();
    }
  };

  if (!username) {
    return (
      <div id="room-selection-screen">
        <h2>Politik404</h2>
        <p>Você precisa estar autenticado para acessar as salas.</p>
      </div>
    );
  }

  return (
    <div id="room-selection-screen">
      <h2>Politik404</h2>
      <div className="user-info">
        <p>Logado como: {username}</p>
      </div>
      <div className="room-actions">
        <input
          type="text"
          id="room-name"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Nome da sala"
          disabled={isLoading}
        />
        <button 
          id="create-room-button" 
          onClick={handleCreateRoom}
          disabled={isLoading || !roomName.trim()}
        >
          {isLoading ? 'Criando...' : 'Criar Sala'}
        </button>
        <button 
          id="refresh-rooms-button" 
          onClick={handleRefreshRooms}
          disabled={isLoading}
        >
          {isLoading ? 'Atualizando...' : 'Atualizar Lista'}
        </button>
      </div>
      <div className="room-list-container">
        <h3>Salas Disponíveis {isLoading && '(Carregando...)'}</h3>
        <ul id="room-list">
          {rooms.length === 0 ? (
            <li className="no-rooms">
              {isLoading 
                ? 'Carregando salas...' 
                : connectionRetries > 0
                  ? 'Tentando reconectar... Por favor, aguarde.'
                  : 'Nenhuma sala disponível.\nCrie uma nova!'}
            </li>
          ) : (
            rooms.map((room) => (
              <li key={room.name} className="room-item">
                <div className="room-details">
                  <h4>{room.name}</h4>
                  <p>Criador: {room.owner}</p>
                  <p>Jogadores: {room.playerCount}</p>
                  <p>Criada em: {new Date(room.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <button 
                  className="join-room-btn" 
                  onClick={() => handleJoinRoom(room.name)}
                  disabled={isLoading}
                >
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
      {/* Adicionar logs para depuração */}
      <div className="debug-info" style={{display: 'none'}}>
        <pre>
          {JSON.stringify({username, roomsCount: rooms.length, connectionRetries}, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default RoomPage;