import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { socketApi } from '../../services/socketClient';
import './RoomPage.css';

const RoomPage = () => {
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [joiningRoomName, setJoiningRoomName] = useState('');
  const [joinAttemptTime, setJoinAttemptTime] = useState(null);
  
  const dispatch = useDispatch();
  const rooms = useSelector(state => state.rooms.rooms);
  const username = useSelector(state => state.auth.username);

  // Função para garantir conexão e atualizar lista de salas
  const ensureConnectionAndUpdateRooms = () => {
    if (!username) {
      console.warn('Usuário não está autenticado na tela de salas');
      return false;
    }

    console.log('Garantindo conexão e atualizando lista de salas...');
    
    // Conectar socket se necessário
    socketApi.connect();
    
    // Garantir autenticação
    socketApi.authenticate(username);
    
    // Solicitar lista de salas
    setTimeout(() => {
      socketApi.getRooms();
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

    // Iniciar conexão e carregar salas
    ensureConnectionAndUpdateRooms();
    
    // Finalizar carregamento após um tempo
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    // Definir intervalo para atualização periódica de salas
    const interval = setInterval(() => {
      // Não atualizar se estiver tentando entrar em uma sala
      if (!joiningRoomName) {
        socketApi.getRooms();
      }
    }, 30000); // A cada 30 segundos

    // Limpar o intervalo ao desmontar
    return () => clearInterval(interval);
  }, [dispatch, username]);

  // Efeito para verificar se já passou tempo suficiente desde a última tentativa de entrar na sala
  useEffect(() => {
    if (joiningRoomName && joinAttemptTime) {
      const now = Date.now();
      const elapsed = now - joinAttemptTime;
      
      // Se passou mais de 10 segundos e ainda estamos tentando entrar na mesma sala,
      // podemos considerar que houve um problema
      if (elapsed > 10000) {
        console.log(`Tempo limite para entrar na sala ${joiningRoomName} atingido.`);
        setIsLoading(false);
        setJoiningRoomName('');
        setJoinAttemptTime(null);
        
        // Mostrar mensagem para o usuário
        alert(`Não foi possível entrar na sala ${joiningRoomName}. Por favor, tente novamente.`);
      }
    }
  }, [joiningRoomName, joinAttemptTime]);

  // Efeito adicional para reconectar se não receber salas após um tempo
  useEffect(() => {
    if (!username || rooms.length > 0 || connectionRetries >= 3 || joiningRoomName) return;

    const timer = setTimeout(() => {
      console.log('Tentando reconectar por não ter recebido salas...');
      setConnectionRetries(prev => prev + 1);
      
      // Tentar novamente
      ensureConnectionAndUpdateRooms();
    }, 5000); // Tentar novamente após 5 segundos

    return () => clearTimeout(timer);
  }, [rooms, username, connectionRetries, joiningRoomName]);

  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      alert('Por favor, digite um nome para a sala!');
      return;
    }
    
    setIsLoading(true);
    console.log(`Iniciando criação da sala: ${roomName}`);
    
    // Criar a sala
    socketApi.createRoom(roomName);
    
    // Limpar o campo de entrada
    setRoomName('');
    
    // Atualizar lista de salas após um delay
    setTimeout(() => {
      socketApi.getRooms();
      setIsLoading(false);
    }, 2000);
  };

  const handleJoinRoom = (roomName) => {
    // Evitar duplo clique ou múltiplas tentativas
    if (isLoading || joiningRoomName) {
      console.log('Ignorando clique enquanto já está processando...');
      return;
    }
    
    console.log(`Tentando entrar na sala: ${roomName}`);
    setIsLoading(true);
    setJoiningRoomName(roomName);
    setJoinAttemptTime(Date.now());
    
    // Entrar na sala
    socketApi.joinRoom(roomName);
    
    // Se não conseguir entrar na sala depois de 10 segundos, isso será tratado pelo useEffect acima
  };

  const handleRefreshRooms = () => {
    // Não atualizar se estiver tentando entrar em uma sala
    if (joiningRoomName) return;
    
    console.log('Atualizando lista de salas');
    setIsLoading(true);
    
    // Atualizar lista de salas
    socketApi.getRooms();
    
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleCreateRoom();
    }
  };

  // Função para verificar se uma sala específica está sendo tentada
  const isJoiningThisRoom = (roomName) => {
    return joiningRoomName === roomName;
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
          disabled={isLoading || joiningRoomName}
        />
        <button 
          id="create-room-button" 
          onClick={handleCreateRoom}
          disabled={isLoading || joiningRoomName || !roomName.trim()}
        >
          {isLoading && !joiningRoomName ? 'Criando...' : 'Criar Sala'}
        </button>
        <button 
          id="refresh-rooms-button" 
          onClick={handleRefreshRooms}
          disabled={isLoading || joiningRoomName}
        >
          {isLoading && !joiningRoomName ? 'Atualizando...' : 'Atualizar Lista'}
        </button>
      </div>
      <div className="room-list-container">
        <h3>
          Salas Disponíveis 
          {isLoading && !joiningRoomName && ' (Carregando...)'}
          {joiningRoomName && ` (Entrando em ${joiningRoomName}...)`}
        </h3>
        <ul id="room-list">
          {rooms.length === 0 ? (
            <li className="no-rooms">
              {isLoading && !joiningRoomName 
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
                  disabled={isLoading || joiningRoomName}
                >
                  {isJoiningThisRoom(room.name) ? 'Entrando...' : 'Entrar'}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
      
      {/* Status de conexão e debugging */}
      {(connectionRetries > 0 || joiningRoomName) && (
        <div className="connection-status">
          {connectionRetries > 0 && (
            <p>Tentativa de reconexão: {connectionRetries}/3</p>
          )}
          {joiningRoomName && (
            <p>Tentando entrar em: {joiningRoomName}</p>
          )}
        </div>
      )}
      
      {/* Adicionar logs para depuração */}
      <div className="debug-info" style={{display: 'none'}}>
        <pre>
          {JSON.stringify({
            username, 
            roomsCount: rooms.length, 
            connectionRetries,
            joiningRoom: joiningRoomName,
            loading: isLoading
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default RoomPage;