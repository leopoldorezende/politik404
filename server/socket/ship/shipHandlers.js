/**
 * Handlers relacionados a navios
 */

const { getCurrentRoom } = require('../../utils/gameStateUtils');

/**
 * Configura os handlers relacionados aos navios
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupShipHandlers(io, socket, gameState) {
  console.log('Ship handlers inicializados');
  
  // Criar um novo navio
  socket.on('createShip', (shipData) => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Encontra a sala atual
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    // Cria o ID único para o navio
    const shipId = `${username}:${roomName}:${Date.now()}`;
    
    // Obtém o país do jogador
    const userRoomKey = `${username}:${roomName}`;
    const playerCountry = gameState.userRoomCountries.get(userRoomKey);
    
    if (!playerCountry) {
      socket.emit('error', 'País do jogador não encontrado');
      return;
    }
    
    // Conta quantos navios o jogador já tem
    const playerShips = Array.from(gameState.ships.values())
      .filter(ship => ship.owner === username && ship.roomName === roomName);
    
    // Limita a 3 navios por jogador
    if (playerShips.length >= 3) {
      socket.emit('error', 'Limite de 3 navios por jogador atingido');
      return;
    }
    
    // Cria o navio
    const newShip = {
      id: shipId,
      owner: username,
      country: playerCountry,
      roomName: roomName,
      name: shipData.name || `Navio ${playerShips.length + 1}`,
      type: shipData.type || 'patrol',
      coordinates: shipData.coordinates || [0, 0],
      range: shipData.range || 300, // raio de ação em km
      health: 100,
      createdAt: Date.now()
    };
    
    // Armazena o navio
    gameState.ships.set(shipId, newShip);
    
    // Notifica o cliente sobre seu novo navio
    socket.emit('shipCreated', newShip);
    
    // Notifica todos na sala sobre o novo navio
    io.to(roomName).emit('shipAdded', {
      id: shipId,
      owner: username,
      country: playerCountry,
      name: newShip.name,
      type: newShip.type,
      coordinates: newShip.coordinates,
      range: newShip.range
    });
    
    console.log(`Navio ${newShip.name} criado por ${username} na sala ${roomName}`);
  });
  
  // Mover um navio
  socket.on('moveShip', (data) => {
    const { shipId, coordinates } = data;
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Verifica se o navio existe
    const ship = gameState.ships.get(shipId);
    if (!ship) {
      socket.emit('error', 'Navio não encontrado');
      return;
    }
    
    // Verifica se o jogador é o dono do navio
    if (ship.owner !== username) {
      socket.emit('error', 'Você não é o dono deste navio');
      return;
    }
    
    // Atualiza as coordenadas do navio
    ship.coordinates = coordinates;
    
    // Notifica todos na sala sobre o movimento do navio
    io.to(ship.roomName).emit('shipMoved', {
      id: shipId,
      coordinates
    });
    
    console.log(`Navio ${ship.name} movido para [${coordinates[0]}, ${coordinates[1]}]`);
  });
  
  // Obter lista de navios na sala
  socket.on('getShipsInRoom', () => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Encontra a sala atual
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    // Filtra navios na sala atual
    const shipsInRoom = Array.from(gameState.ships.values())
      .filter(ship => ship.roomName === roomName)
      .map(ship => {
        // Para navios do jogador, envia todas as informações
        if (ship.owner === username) {
          return ship;
        }
        
        // Para navios de outros jogadores, envia apenas informações básicas
        return {
          id: ship.id,
          owner: ship.owner,
          country: ship.country,
          name: ship.name,
          type: ship.type,
          coordinates: ship.coordinates,
          range: ship.range
        };
      });
    
    socket.emit('shipsInRoom', shipsInRoom);
  });
  
  // Remover um navio
  socket.on('removeShip', (shipId) => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Verifica se o navio existe
    const ship = gameState.ships.get(shipId);
    if (!ship) {
      socket.emit('error', 'Navio não encontrado');
      return;
    }
    
    // Verifica se o jogador é o dono do navio
    if (ship.owner !== username) {
      socket.emit('error', 'Você não é o dono deste navio');
      return;
    }
    
    // Remove o navio
    const roomName = ship.roomName;
    gameState.ships.delete(shipId);
    
    // Notifica o cliente que seu navio foi removido
    socket.emit('shipRemoved', shipId);
    
    // Notifica todos na sala sobre a remoção do navio
    io.to(roomName).emit('shipRemoved', shipId);
    
    console.log(`Navio ${ship.name} removido por ${username}`);
  });
  
  // Atacar um navio inimigo
  socket.on('attackShip', (data) => {
    const { attackerShipId, targetShipId } = data;
    const username = socket.username;
    
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Verifica se o navio atacante existe
    const attackerShip = gameState.ships.get(attackerShipId);
    if (!attackerShip) {
      socket.emit('error', 'Navio atacante não encontrado');
      return;
    }
    
    // Verifica se o jogador é o dono do navio atacante
    if (attackerShip.owner !== username) {
      socket.emit('error', 'Você não é o dono do navio atacante');
      return;
    }
    
    // Verifica se o navio alvo existe
    const targetShip = gameState.ships.get(targetShipId);
    if (!targetShip) {
      socket.emit('error', 'Navio alvo não encontrado');
      return;
    }
    
    // Verifica se os navios estão na mesma sala
    if (attackerShip.roomName !== targetShip.roomName) {
      socket.emit('error', 'Os navios devem estar na mesma sala');
      return;
    }
    
    // Verifica se os navios são de jogadores diferentes
    if (attackerShip.owner === targetShip.owner) {
      socket.emit('error', 'Não é possível atacar seus próprios navios');
      return;
    }
    
    // Calcula a distância entre os navios (simplificado - não considera a curvatura da Terra)
    const distance = calculateDistance(attackerShip.coordinates, targetShip.coordinates);
    
    // Verifica se o alvo está dentro do alcance
    if (distance > attackerShip.range) {
      socket.emit('error', 'Navio alvo fora de alcance');
      return;
    }
    
    // Calcula o dano (exemplo simples - pode ser expandido)
    const damage = Math.floor(Math.random() * 25) + 10; // 10-34 de dano
    
    // Aplica o dano
    targetShip.health = Math.max(0, targetShip.health - damage);
    
    // Notifica todos na sala sobre o ataque
    const roomName = attackerShip.roomName;
    io.to(roomName).emit('shipAttacked', {
      attackerId: attackerShipId,
      targetId: targetShipId,
      damage: damage,
      remainingHealth: targetShip.health
    });
    
    // Se o navio foi destruído
    if (targetShip.health <= 0) {
      // Remove o navio
      gameState.ships.delete(targetShipId);
      
      // Notifica todos na sala sobre a destruição
      io.to(roomName).emit('shipDestroyed', {
        shipId: targetShipId,
        destroyedBy: attackerShipId
      });
      
      console.log(`Navio ${targetShip.name} destruído por ${username}`);
    } else {
      console.log(`Navio ${targetShip.name} atacado por ${username}, dano: ${damage}, vida restante: ${targetShip.health}`);
    }
  });
}

/**
 * Calcula a distância entre dois pontos em coordenadas [longitude, latitude]
 * @param {Array<number>} coord1 - Coordenadas do primeiro ponto [longitude, latitude]
 * @param {Array<number>} coord2 - Coordenadas do segundo ponto [longitude, latitude]
 * @returns {number} - Distância em quilômetros
 */
function calculateDistance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  
  // Converter graus para radianos
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLon1 = (lon1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const radLon2 = (lon2 * Math.PI) / 180;
  
  // Fórmula de Haversine
  const dLon = radLon2 - radLon1;
  const dLat = radLat2 - radLat1;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Raio da Terra em km
  const R = 6371;
  
  // Distância em km
  return R * c;
}

module.exports = { setupShipHandlers };