import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { socketApi } from '../../services/socketClient';
import './RoomPage.css';

const RoomPage = () => {
  const [roomName, setRoomName] = useState('');
  const [roomDuration, setRoomDuration] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [joiningRoomName, setJoiningRoomName] = useState('');
  const [joinAttemptTime, setJoinAttemptTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  const dispatch = useDispatch();
  const rooms = useSelector(state => state.rooms.rooms);
  const username = useSelector(state => state.auth.username);

  // Atualizar o tempo a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

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
    // Verificar se o usuário está autenticado
    if (!username) {
      console.warn('Usuário não está autenticado na tela de salas');
      return;
    }

    console.log('Inicializando RoomPage para usuário:', username);
    
    // Não definir isLoading aqui para evitar ocultar as salas
    // setIsLoading(true);

    // Iniciar conexão e carregar salas imediatamente
    ensureConnectionAndUpdateRooms();
    
    // Definir intervalo para atualização periódica de salas
    const interval = setInterval(() => {
      // Não atualizar se estiver tentando entrar em uma sala
      if (!joiningRoomName) {
        socketApi.getRooms();
      }
    }, 10000); // Reduzir para 10 segundos para atualizações mais frequentes

    // Limpar o intervalo ao desmontar
    return () => clearInterval(interval);
  }, [dispatch, username, joiningRoomName]); // Adicionar joiningRoomName como dependência

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
  }, [joiningRoomName, joinAttemptTime, currentTime]); // Adicionar currentTime para verificação contínua

  const handleCreateRoom = () => {
    
    if (!roomName.trim() || !roomDuration) {
      alert('Por favor, preencha o nome da sala e a duração!');
      return;
    }
    
    // Validar e usar valor padrão de 30 se não houver duração
    const duration = roomDuration ? parseInt(roomDuration) : 30;
    
    if (isNaN(duration) || duration < 1 || duration > 90) {
      alert('Por favor, insira uma duração válida entre 1 e 90 minutos!');
      return;
    }
    
    setIsLoading(true);
    console.log(`Iniciando criação da sala: ${roomName}`);
    
    // Criar a sala com duração
    socketApi.createRoom({ name: roomName, duration: duration * 60000 });
    
    // Limpar os campos de entrada
    setRoomName('');
    setRoomDuration('');
    
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
    
    console.log('Atualizando lista de salas manualmente');
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

  // Função para formatar tempo em mm:ss
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
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
        <div>
          <input
            type="text"
            id="room-name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Nome da sala"
            disabled={isLoading || joiningRoomName}
          />
          <input
            type="number"
            value={roomDuration}
            onChange={(e) => setRoomDuration(parseInt(e.target.value))}
            min="1"
            max="90"
            placeholder="Duração (minutos)"
            disabled={isLoading || joiningRoomName}
          />
        </div>
        <button 
          id="create-room-button" 
          onClick={handleCreateRoom}
          disabled={isLoading || joiningRoomName || !roomName.trim()}
        >
          {isLoading && !joiningRoomName ? 'Criando...' : 'Criar Sala'}
        </button>
      </div>
      <div className="room-list-container">
        <h3>
          Salas Disponíveis 
          {isLoading && !joiningRoomName && ' (Carregando...)'}
          {joiningRoomName && ` (Entrando em ${joiningRoomName}...)`}
          <button 
            id="refresh-rooms-button" 
            onClick={handleRefreshRooms}
            disabled={isLoading || joiningRoomName}
            style={{ marginLeft: '10px', fontSize: '14px' }}
          >
            ↻ Atualizar
          </button>
        </h3>
        <ul id="room-list">
          {rooms.length === 0 ? (
            <li className="no-rooms">
              {isLoading && !joiningRoomName 
                ? 'Carregando salas...' 
                : 'Nenhuma sala disponível.\nCrie uma nova!'}
            </li>
          ) : (
            [...rooms]  // Criar uma cópia do array antes de ordenar
              .sort((a, b) => {
                // Ordenar por mais recente primeiro (por createdAt ou timestamp)
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateB - dateA; // Ordem decrescente (mais recente primeiro)
              })
              .map((room) => {
                const timeRemaining = room.expiresAt ? Math.max(0, room.expiresAt - currentTime) : 0;
                const totalTime = room.duration || 0;
                const isExpired = timeRemaining === 0 && room.expiresAt > 0; // Verificar se a sala expirou
                
                return (
                  <li key={room.name} className={`room-item ${isExpired ? 'room-expired' : ''}`}>
                    <div className="room-details">
                      <h4>{room.name} - {formatTime(totalTime)} - Restante: {formatTime(timeRemaining)}</h4>
                      <p>Criador: {room.owner}</p>
                      <p>Jogadores: {room.playerCount}</p>
                    </div>
                    <button 
                      className="join-room-btn" 
                      onClick={() => handleJoinRoom(room.name)}
                      disabled={isLoading || joiningRoomName || isExpired}
                      title={isExpired ? 'Esta sala já expirou' : ''}
                    >
                      {isExpired ? 'Expirou' : (isJoiningThisRoom(room.name) ? 'Entrando...' : 'Entrar')}
                    </button>
                  </li>
                );
              })
          )}
        </ul>
      </div>
      
      {/* Mostrar informações de debug quando houver rooms */}
      {rooms.length > 0 && process.env.NODE_ENV === 'development' && (
        <div className="debug-info" style={{display: 'block', fontSize: '12px', marginTop: '20px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '5px'}}>
          <details>
            <summary>Debug Info (clique para expandir)</summary>
            <pre style={{fontSize: '11px', marginTop: '10px'}}>
              {JSON.stringify({
                username, 
                roomsCount: rooms.length,
                rooms: rooms.map(r => ({ name: r.name, expired: r.expiresAt < currentTime })),
                joiningRoom: joiningRoomName,
                loading: isLoading,
                currentTime: new Date(currentTime).toISOString()
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default RoomPage;