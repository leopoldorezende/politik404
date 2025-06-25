/**
 * Gerenciamento de salas - ATUALIZADO para usar EconomyService
 */
import { sendUpdatedRoomsList } from './roomNotifications.js';
import { setupRoomExpiration } from './roomExpirationManager.js';

/**
 * Configura os handlers relacionados ao gerenciamento de salas
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupRoomManagement(io, socket, gameState) {
  console.log('Room management handlers inicializados');
  
  // Criar uma nova sala
  socket.on('createRoom', (data) => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    let roomName, duration;
    
    // Suporte para formato antigo (string) e novo (objeto)
    if (typeof data === 'string') {
      roomName = data;
      duration = 30 * 60000; // 30 minutos padrão
    } else if (typeof data === 'object') {
      roomName = data.name;
      duration = data.duration || 30 * 60000;
    } else {
      socket.emit('error', 'Dados da sala inválidos');
      return;
    }
    
    if (!roomName || roomName.trim() === '') {
      socket.emit('error', 'Nome da sala não pode estar vazio');
      return;
    }
    
    // Verificar se a sala já existe
    if (gameState.rooms.has(roomName)) {
      socket.emit('error', 'Uma sala com este nome já existe');
      return;
    }
    
    // Criar a nova sala
    const room = gameState.createRoom(roomName, username);
    room.duration = duration;
    room.expiresAt = Date.now() + duration;
    
    gameState.rooms.set(roomName, room);
    
    // Inicializar economia da sala
    const economyService = global.economyService;
    if (economyService && gameState.countriesData) {
      economyService.initializeRoom(roomName, gameState.countriesData);
      console.log(`[ECONOMY] Sala ${roomName} inicializada no EconomyService`);
    }
    console.log(`Sala criada: ${roomName} por ${username} (${duration / 60000} min)`);
    
    // Configurar expiração da sala
    setupRoomExpiration(io, gameState, roomName, duration);
    
    // Enviar confirmação
    socket.emit('roomCreated', { 
      success: true, 
      message: `Sala '${roomName}' criada com sucesso`,
      roomName,
      duration
    });
    
    // Atualizar lista de salas para todos
    sendUpdatedRoomsList(io, gameState);
  });
  
  // Obter lista de salas
  socket.on('getRooms', () => {
    const roomsList = Array.from(gameState.rooms.entries()).map(([name, room]) => ({
      name,
      owner: room.owner,
      playerCount: room.players ? room.players.length : 0,
      createdAt: room.createdAt,
      duration: room.duration || 30 * 60000,
      expiresAt: room.expiresAt || (Date.now() + 30 * 60000)
    }));
    
    socket.emit('roomsList', roomsList);
  });
  
  // Deletar uma sala (apenas o dono pode)
  socket.on('deleteRoom', (roomName) => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Sala não encontrada');
      return;
    }
    
    if (room.owner !== username) {
      socket.emit('error', 'Apenas o dono da sala pode deletá-la');
      return;
    }
    
    // Notificar todos os jogadores na sala
    io.to(roomName).emit('roomDeleted', {
      message: `A sala '${roomName}' foi deletada pelo criador.`
    });
    
    // Limpar dados econômicos da sala
    const economyService = global.economyService;
    if (economyService) {
      economyService.removeRoom(roomName);
      console.log(`[ECONOMY] Dados da sala ${roomName} removidos do EconomyService`);
    }
    
    // Remover a sala
    gameState.rooms.delete(roomName);
    console.log(`Sala deletada: ${roomName} por ${username}`);
    
    // Atualizar lista de salas
    sendUpdatedRoomsList(io, gameState);
  });
}

export { setupRoomManagement };