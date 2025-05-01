/**
 * Handlers centralizados para gerenciamento de jogadores
 */

const { getCurrentRoom } = require('../../shared/gameStateUtils');
const { setupPlayerRoomHandlers } = require('./playerRoomHandlers');
const { setupPlayerStateManager } = require('./playerStateManager');
const { findPlayerByUsername, standardizePlayer, getOnlinePlayers } = require('./playerUtils');

/**
 * Configura todos os handlers relacionados a jogadores
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupPlayerHandlers(io, socket, gameState) {
  console.log('Player handlers inicializados');
  
  // Inicializa os handlers específicos de jogadores
  setupPlayerRoomHandlers(io, socket, gameState);
  setupPlayerStateManager(io, socket, gameState);
  
  // Inicializa o conjunto de jogadores online se não existir
  if (!gameState.onlinePlayers) {
    gameState.onlinePlayers = new Set();
  }
  
  // Quando um usuário se autentica, marca-o como online
  socket.on('authenticate', (username) => {
    if (username) {
      console.log(`Jogador ${username} autenticado`);
      
      // Não marca como online aqui, apenas quando entra em uma sala
      // A marcação online acontece no evento 'joinRoom'
    }
  });
  
  // Obter lista de jogadores online em toda a aplicação
  socket.on('getOnlinePlayers', () => {
    const onlinePlayersList = Array.from(gameState.onlinePlayers);
    socket.emit('onlinePlayersList', onlinePlayersList);
    console.log('Enviando lista de jogadores online:', onlinePlayersList);
  });
  
  // Obter lista de jogadores na sala atual
  socket.on('getPlayersInRoom', () => {
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room || !room.players) {
      socket.emit('error', 'Sala não encontrada ou sem jogadores');
      return;
    }
    
    // Padroniza os objetos de jogadores 
    const standardizedPlayers = room.players.map(player => standardizePlayer(player));
    
    socket.emit('playersInRoom', standardizedPlayers);
    console.log(`Enviando lista de ${standardizedPlayers.length} jogadores na sala ${roomName}`);
  });
  
  // Solicitar detalhes de um jogador específico
  socket.on('getPlayerDetails', (targetUsername) => {
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room || !room.players) {
      socket.emit('error', 'Sala não encontrada ou sem jogadores');
      return;
    }
    
    // Encontra o jogador alvo
    const targetPlayer = findPlayerByUsername(room.players, targetUsername);
    if (!targetPlayer) {
      socket.emit('error', 'Jogador não encontrado');
      return;
    }
    
    // Obtém país do jogador
    const userRoomKey = `${targetUsername}:${roomName}`;
    const playerCountry = gameState.userRoomCountries.get(userRoomKey);
    
    // Obtém estado do jogador
    const playerState = gameState.playerStates.get(userRoomKey);
    
    // Navios do jogador
    const playerShips = Array.from(gameState.ships.values())
      .filter(ship => ship.owner === targetUsername && ship.roomName === roomName)
      .map(ship => ({
        id: ship.id,
        name: ship.name,
        type: ship.type,
        country: ship.country
      }));
    
    // Monta o objeto de detalhes
    const playerDetails = {
      username: targetUsername,
      country: playerCountry,
      isOnline: gameState.onlinePlayers.has(targetUsername),
      score: playerState?.customData?.score || 0,
      lastPosition: playerState?.customData?.lastPosition || [0, 0],
      ships: playerShips,
      // Não envia dados sensíveis
    };
    
    socket.emit('playerDetails', playerDetails);
    console.log(`Enviando detalhes do jogador ${targetUsername}`);
  });
  
  // Atualizar nome de exibição
  socket.on('updateDisplayName', (newDisplayName) => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    if (!newDisplayName || typeof newDisplayName !== 'string' || newDisplayName.trim() === '') {
      socket.emit('error', 'Nome de exibição inválido');
      return;
    }
    
    // Limita o tamanho do nome
    if (newDisplayName.length > 30) {
      socket.emit('error', 'Nome de exibição muito longo (máximo 30 caracteres)');
      return;
    }
    
    // Armazena o novo nome de exibição
    if (!gameState.displayNames) {
      gameState.displayNames = new Map();
    }
    
    gameState.displayNames.set(username, newDisplayName);
    
    // Confirma a atualização
    socket.emit('displayNameUpdated', newDisplayName);
    
    // Atualiza o nome nas salas em que o jogador está
    for (const [roomName, room] of gameState.rooms.entries()) {
      if (room.players) {
        const playerIndex = room.players.findIndex(player => {
          if (typeof player === 'object') {
            return player.username === username;
          }
          return false;
        });
        
        if (playerIndex !== -1) {
          if (typeof room.players[playerIndex] === 'object') {
            room.players[playerIndex].displayName = newDisplayName;
          }
          
          // Notifica todos na sala sobre a mudança
          io.to(roomName).emit('playerDisplayNameChanged', {
            username,
            displayName: newDisplayName
          });
        }
      }
    }
    
    console.log(`Jogador ${username} atualizou nome de exibição para ${newDisplayName}`);
  });
  
  // Enviar uma mensagem privada para outro jogador (atalho)
  socket.on('directMessage', (data) => {
    const { targetUsername, message } = data;
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    if (!targetUsername || !message) {
      socket.emit('error', 'Destinatário ou mensagem inválidos');
      return;
    }
    
    // Reencaminha para o handler de chat como uma mensagem privada
    socket.emit('chatMessage', {
      message,
      isPrivate: true,
      recipient: targetUsername
    });
    
    console.log(`Mensagem direta de ${username} para ${targetUsername}`);
  });
  
  // Evento de desconexão para marcar o jogador como offline
  socket.on('disconnect', () => {
    const username = socket.username;
    if (username) {
      // Remover da lista de jogadores online
      gameState.onlinePlayers.delete(username);
      
      // Notificar todos os clientes conectados que este jogador está offline
      io.emit('playerOnlineStatus', { username, isOnline: false });
      
      console.log(`Jogador ${username} está offline. Jogadores online:`, [...gameState.onlinePlayers]);
      
      // Atualizar o status nos cômodos
      for (const [roomName, room] of gameState.rooms.entries()) {
        if (room.players) {
          const playerIndex = room.players.findIndex(player => {
            if (typeof player === 'object') {
              return player.username === username;
            }
            return false;
          });
          
          if (playerIndex !== -1) {
            if (typeof room.players[playerIndex] === 'object') {
              room.players[playerIndex].isOnline = false;
            }
            
            // Notificar atualizações de status para todos os clientes na sala
            io.to(roomName).emit('playerOnlineStatus', { username, isOnline: false });
            
            // Atualizar lista de jogadores na sala
            io.to(roomName).emit('playersList', room.players);
          }
        }
      }
    }
  });
}

module.exports = { setupPlayerHandlers };