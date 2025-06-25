/**
 * Handlers relacionados à autenticação de usuários
 */
import { getUsernameFromSocketId } from '../../shared/utils/gameStateUtils.js';

/**
 * Configura os eventos relacionados à autenticação
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupAuthHandlers(io, socket, gameState) {
  console.log('Auth handlers inicializados');
  
  // Evento de autenticação
  socket.on('authenticate', (username) => {
    if (socket.username) {
      console.log(`Socket ${socket.id} já está autenticado como ${socket.username}, ignorando nova autenticação`);
      return;
    }
    
    // Valida o nome de usuário
    if (!username || typeof username !== 'string' || username.trim() === '') {
      socket.emit('error', 'Nome de usuário inválido');
      return;
    }
    
    // Limita o tamanho do nome de usuário
    if (username.length > 30) {
      socket.emit('error', 'Nome de usuário muito longo (máximo 30 caracteres)');
      return;
    }
    
    // Verifica se o nome de usuário já está em uso por um socket conectado
    let isUsernameInUse = false;
    let existingSocketId = null;
    
    for (const [socketId, existingUsername] of gameState.socketIdToUsername.entries()) {
      if (existingUsername === username && socketId !== socket.id) {
        // Verifica se o socket ainda está conectado
        const existingSocket = io.sockets.sockets.get(socketId);
        if (existingSocket && existingSocket.connected) {
          isUsernameInUse = true;
          existingSocketId = socketId;
          
          // Desconectar o socket anterior automaticamente
          console.log(`Desconectando socket anterior ${existingSocketId} para ${username}`);
          existingSocket.emit('forcedDisconnect', { 
            reason: 'Nova sessão iniciada',
            reconnect: false
          });
          existingSocket.disconnect(true);
          
          // Marcar para limpeza
          if (gameState.pendingSocketsRemoval) {
            gameState.pendingSocketsRemoval.add(existingSocketId);
          }
          break;
        } else {
          // Socket antigo não está mais conectado, remover do mapa
          gameState.socketIdToUsername.delete(socketId);
          if (gameState.usernameToSocketId) {
            gameState.usernameToSocketId.delete(existingUsername);
          }
        }
      }
    }
    
    // Registra o usuário
    socket.username = username;
    gameState.socketIdToUsername.set(socket.id, username);
    
    // Inicializa o mapa reverso se não existir
    if (!gameState.usernameToSocketId) {
      gameState.usernameToSocketId = new Map();
    }
    gameState.usernameToSocketId.set(username, socket.id);
    
    // Adiciona à lista de jogadores online
    if (!gameState.onlinePlayers) {
      gameState.onlinePlayers = new Set();
    }
    gameState.onlinePlayers.add(username);
    
    console.log(`Usuário ${username} autenticado com socket ${socket.id}`);
    
    // Confirma autenticação para o cliente
    socket.emit('authenticated', { username });
    
    // Notifica todos sobre o novo jogador online
    io.emit('playerOnlineStatus', { username, isOnline: true });
    
    // Atualiza status em todas as salas onde o player está
    for (const [roomName, room] of gameState.rooms.entries()) {
      if (room.players) {
        const playerIndex = room.players.findIndex(player => {
          if (typeof player === 'object') {
            return player.username === username;
          }
          return false;
        });
        
        if (playerIndex !== -1) {
          // Marca como online
          if (typeof room.players[playerIndex] === 'object') {
            room.players[playerIndex].isOnline = true;
          }
          
          console.log(`${username} marcado como online na sala ${roomName}`);
          
          // Notifica todos na sala sobre o status online
          io.to(roomName).emit('playerOnlineStatus', { 
            username, 
            isOnline: true 
          });
          
          // Enviar lista atualizada
          io.to(roomName).emit('playersList', room.players);
        }
      }
    }
  });
  
  // Evento de mudança de nome de usuário
  socket.on('changeUsername', (newUsername) => {
    const currentUsername = getUsernameFromSocketId(gameState, socket.id);
    
    if (!currentUsername) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim() === '') {
      socket.emit('error', 'Nome de usuário inválido');
      return;
    }
    
    if (newUsername.length > 30) {
      socket.emit('error', 'Nome de usuário muito longo (máximo 30 caracteres)');
      return;
    }
    
    // Verifica se o novo nome já está em uso
    for (const [socketId, existingUsername] of gameState.socketIdToUsername.entries()) {
      if (existingUsername === newUsername && socketId !== socket.id) {
        const existingSocket = io.sockets.sockets.get(socketId);
        if (existingSocket && existingSocket.connected) {
          socket.emit('error', 'Nome de usuário já está em uso');
          return;
        } else {
          // Remove mapeamento antigo se socket não está conectado
          gameState.socketIdToUsername.delete(socketId);
          if (gameState.usernameToSocketId) {
            gameState.usernameToSocketId.delete(existingUsername);
          }
        }
      }
    }
    
    // Atualiza os mapeamentos
    socket.username = newUsername;
    gameState.socketIdToUsername.set(socket.id, newUsername);
    if (gameState.usernameToSocketId) {
      gameState.usernameToSocketId.delete(currentUsername);
      gameState.usernameToSocketId.set(newUsername, socket.id);
    }
    
    // Atualiza lista de jogadores online
    if (gameState.onlinePlayers) {
      gameState.onlinePlayers.delete(currentUsername);
      gameState.onlinePlayers.add(newUsername);
    }
    
    // Atualiza nome em todas as salas
    for (const [roomName, room] of gameState.rooms.entries()) {
      if (room.players) {
        const playerIndex = room.players.findIndex(player => {
          if (typeof player === 'object') {
            return player.username === currentUsername;
          }
          return false;
        });
        
        if (playerIndex !== -1) {
          if (typeof room.players[playerIndex] === 'object') {
            room.players[playerIndex].username = newUsername;
          }
          
          // Notifica todos na sala sobre a mudança
          io.to(roomName).emit('usernameChanged', {
            oldUsername: currentUsername,
            newUsername: newUsername
          });
          
          // Enviar lista atualizada
          io.to(roomName).emit('playersList', room.players);
        }
      }
    }
    
    console.log(`Usuário ${currentUsername} mudou o nome para ${newUsername}`);
    
    // Confirma a mudança para o cliente
    socket.emit('usernameChanged', {
      oldUsername: currentUsername,
      newUsername: newUsername
    });
  });
  
  // Evento de desconexão
  socket.on('disconnect', () => {
    const username = getUsernameFromSocketId(gameState, socket.id);
    
    if (username) {
      console.log(`Usuário ${username} desconectado`);
      
      // Remove usuário da lista de online
      if (gameState.onlinePlayers) {
        gameState.onlinePlayers.delete(username);
      }
      
      // Atualiza status online em todas as salas
      for (const [roomName, room] of gameState.rooms.entries()) {
        if (room.players) {
          const playerIndex = room.players.findIndex(player => {
            if (typeof player === 'object') {
              return player.username === username;
            }
            return false;
          });
          
          if (playerIndex !== -1) {
            // Apenas marca como offline, NÃO remove o player
            if (typeof room.players[playerIndex] === 'object') {
              room.players[playerIndex].isOnline = false;
            }
            console.log(`${username} marcado como offline na sala ${roomName}, país ${room.players[playerIndex].country} mantido`);
            
            // Notifica todos na sala sobre o status offline
            io.to(roomName).emit('playerOnlineStatus', { 
              username, 
              isOnline: false 
            });
            
            // Enviar lista atualizada mantendo o player
            io.to(roomName).emit('playersList', room.players);
          }
        }
      }
      
      // Notifica todos sobre o status offline
      io.emit('playerOnlineStatus', { username, isOnline: false });
      
      // Não deleta o mapeamento usuário-sala
      // Apenas remove o socket mapping se for o socket atual
      const currentSocketId = gameState.usernameToSocketId?.get(username);
      if (currentSocketId === socket.id) {
        gameState.socketIdToUsername.delete(socket.id);
        gameState.usernameToSocketId?.delete(username);
      } else {
        gameState.socketIdToUsername.delete(socket.id);
      }
    }
  });
}

export { setupAuthHandlers };