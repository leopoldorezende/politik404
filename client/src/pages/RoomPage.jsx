import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import '../shared/styles/RoomPage.css';

const RoomPage = () => {
  const [roomName, setRoomName] = useState('');
  const dispatch = useDispatch();
  const rooms = useSelector(state => state.rooms.rooms);

  useEffect(() => {
    // Request room list from server
    dispatch({ type: 'socket/getRooms' });
  }, [dispatch]);

  const handleCreateRoom = () => {
    if (roomName.trim()) {
      dispatch({ type: 'socket/createRoom', payload: roomName });
      setRoomName('');
    } else {
      alert('Por favor, digite um nome para a sala!');
    }
  };

  // RoomPage.jsx - atualizando a função handleJoinRoom
  const handleJoinRoom = (roomName) => {
    console.log(`Attempting to join room: ${roomName}`);
    dispatch({ type: 'socket/joinRoom', payload: roomName });
  };

  const handleRefreshRooms = () => {
    dispatch({ type: 'socket/getRooms' });
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreateRoom();
    }
  };



  return (
    <div id="room-selection-screen">
      <h2>teste109</h2>
      <div className="room-actions">
        <input
          type="text"
          id="room-name"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Nome da sala"
        />
        <button id="create-room-button" onClick={handleCreateRoom}>
          Criar Sala
        </button>
      </div>
      <div className="room-list-container">
        <h3>Disponíveis</h3>
        <ul id="room-list">
          {rooms.length === 0 ? (
            <li className="no-rooms">
              Nenhuma sala disponível.<br /> Crie uma nova!
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
                <button className="join-room-btn" onClick={() => handleJoinRoom(room.name)}>
                  Entrar
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default RoomPage;