import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { socketApi } from '../../services/socketClient';
import './RoomPage.css';

const RoomPage = () => {
  const [roomName, setRoomName] = useState('');
  const [roomDuration, setRoomDuration] = useState('20'); // Valor padrão definido como 20 minutos
  const [isLoading, setIsLoading] = useState(false);
  const [joiningRoomName, setJoiningRoomName] = useState('');
  const [joinAttemptTime, setJoinAttemptTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [roomNameError, setRoomNameError] = useState('');
  
  const dispatch = useDispatch();
  const rooms = useSelector(state => state.rooms.rooms);
  const username = useSelector(state => state.auth.username);

  // Opções de duração em minutos
  const durationOptions = [5, 10, 20, 40, 60];

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

  // Handler para validar e atualizar o nome da sala
  const handleRoomNameChange = (e) => {
    const value = e.target.value;
    
    // Permitir apenas letras e números
    if (value && !/^[a-zA-Z0-9]+$/.test(value)) {
      setRoomNameError('Use apenas letras e números');
    } else if (value && value.length < 3) {
      setRoomNameError('Mínimo de 3 caracteres');
    } else {
      setRoomNameError('');
    }
    
    // Remover caracteres especiais automaticamente
    const sanitizedValue = value.replace(/[^a-zA-Z0-9]/g, '');
    setRoomName(sanitizedValue);
  };

  const handleCreateRoom = () => {
    // Verificar se há um erro ou se o nome não atende aos requisitos mínimos
    if (roomNameError || roomName.length < 3) {
      alert('Por favor, corrija o nome da sala. Use apenas letras e números, com no mínimo 3 caracteres.');
      return;
    }
    
    if (!roomName.trim() || !roomDuration) {
      alert('Por favor, preencha o nome da sala e a duração!');
      return;
    }
    
    // Converter roomDuration para número
    const duration = parseInt(roomDuration);
    
    if (isNaN(duration)) {
      alert('Por favor, selecione uma duração válida!');
      return;
    }
    
    setIsLoading(true);
    console.log(`Iniciando criação da sala: ${roomName}`);
    
    // Criar a sala com duração
    socketApi.createRoom({ name: roomName, duration: duration * 60000 });
    
    // Limpar os campos de entrada
    setRoomName('');
    setRoomNameError('');
    // Não reseta duração para manter o último valor selecionado
    
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

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading && !roomNameError && roomName.length >= 3) {
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
        <p>Você precisa estar autenticado para acessar as partidas.</p>
      </div>
    );
  }

  return (
    <div id="room-selection-screen">
      {(isLoading || joiningRoomName) && (
        <div className="full-screen-spinner">
          <div className="spinner"></div>
        </div>
      )}
      
      <h2>Politik404</h2>
      <div className="user-info">
        <p>Logado como: {username}</p>
      </div>
      <div className="room-actions">
        <div>
          <div className="input-with-error">
            <input
              type="text"
              id="room-name"
              value={roomName}
              onChange={handleRoomNameChange}
              onKeyPress={handleKeyPress}
              placeholder="Nome da partida"
              disabled={isLoading || joiningRoomName}
            />
            {roomNameError && <div className="input-error">{roomNameError}</div>}
          </div>
          <div className="select-with-icon">
            <span className="material-icons">schedule</span>
            <select
              value={roomDuration}
              onChange={(e) => setRoomDuration(e.target.value)}
              disabled={isLoading || joiningRoomName}
            >
              {durationOptions.map((option) => (
                <option key={option} value={option}>
                  {option} minutos
                </option>
              ))}
            </select>
          </div>
        </div>
        <button 
          id="create-room-button" 
          onClick={handleCreateRoom}
          disabled={isLoading || joiningRoomName || !roomName.trim() || roomNameError || roomName.length < 3}
        >
          Criar Partida
        </button>
      </div>
      <div className="room-list-container">
        <h3>Partidas Disponíveis</h3>
        <ul id="room-list">
          {rooms.length === 0 ? (
            <li className="no-rooms">
              {isLoading && !joiningRoomName 
                ? 'Carregando partidas...' 
                : 'Nenhuma partida disponível.\nCrie uma nova!'}
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
                      {/* <p>Criada em: {new Date(room.createdAt).toLocaleString('pt-BR')}</p> */}
                    </div>
                    <button 
                      className="join-room-btn" 
                      onClick={() => handleJoinRoom(room.name)}
                      disabled={isLoading || joiningRoomName}
                    >
                      {isExpired ? 'Visualizar' : 'Entrar'}
                    </button>
                  </li>
                );
              })
          )}
        </ul>
      </div>
      
      {/* Adicionar logs para depuração */}
      <div className="debug-info" style={{display: 'none'}}>
        <pre>
          {JSON.stringify({
            username, 
            roomsCount: rooms.length, 
            joiningRoom: joiningRoomName,
            loading: isLoading
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default RoomPage;