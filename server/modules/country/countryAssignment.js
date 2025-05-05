/**
 * Gerenciamento da atribuição de países para jogadores
 */

import { 
  sendUpdatedPlayersList 
} from '../room/roomNotifications.js';
import { 
  getCurrentRoom, 
  getUsernameFromSocketId 
} from '../../shared/gameStateUtils.js';
import {
  isValidCountry,
  getBorderingCountries,
  getAvailableCountries,
  getAvailableEligibleCountries
} from './countryUtils.js';

/**
 * Configura os handlers relacionados à atribuição de países
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupCountryAssignment(io, socket, gameState) {
  console.log('Country assignment handlers inicializados');
  
  // Entrar em uma sala e obter um país atribuído
  socket.on('joinRoom', (roomName) => {
    const username = socket.username;
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
  
    // Verifica se a sala existe
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Sala não existe');
      return;
    }
  
    // Adiciona o jogador à sala
    socket.join(roomName);
    
    // Marca o jogador como online
    gameState.onlinePlayers.add(username);
    
    // Associa o usuário à sala
    gameState.userToRoom.set(username, roomName);
    
    // Notifica todos sobre o status online
    io.emit('playerOnlineStatus', { username, isOnline: true });
    
    // Inicializa as estruturas de histórico de chat se não existirem
    if (!room.chatHistory) {
      room.chatHistory = {
        public: [],
        private: new Map()
      };
    }
    
    if (!room.chatHistory.private) {
      room.chatHistory.private = new Map();
    }
    
    // Chave para identificar o par usuário-sala
    const userRoomKey = `${username}:${roomName}`;
    
    let playerCountry;
    let playerState;
    
    // Verifica se o jogador já tem um país atribuído para esta sala específica
    if (gameState.userRoomCountries.has(userRoomKey)) {
      // O usuário já esteve nesta sala antes, usa o mesmo país
      playerCountry = gameState.userRoomCountries.get(userRoomKey);
      console.log(`${username} já tinha o país ${playerCountry} na sala ${roomName}`);
      
      // Verifica se há dados personalizados salvos para este usuário nesta sala
      const stateKey = `${username}:${roomName}`;
      if (gameState.playerStates.has(stateKey)) {
        playerState = gameState.playerStates.get(stateKey);
      } else {
        playerState = {
          country: playerCountry,
          customData: {
            lastMessage: null,
            score: 0,
            lastPosition: [0, 0]
          }
        };
      }
    } else {
      // É a primeira vez do usuário nesta sala, atribui um novo país
      playerCountry = selectCountryForPlayer(username, roomName, gameState);
      
      if (!playerCountry) {
        socket.emit('error', 'Não foi possível atribuir um país. Tente novamente.');
        socket.leave(roomName);
        return;
      }
      
      // Armazena o país para este usuário nesta sala específica
      gameState.userRoomCountries.set(userRoomKey, playerCountry);
      
      // Cria o estado inicial do jogador
      playerState = {
        country: playerCountry,
        customData: {
          lastMessage: null,
          score: 0,
          lastPosition: [0, 0]
        }
      };
    }
    
    // Salva o estado atual do jogador nesta sala específica
    gameState.playerStates.set(userRoomKey, playerState);

    // Adiciona o jogador à lista de jogadores da sala
    const playerObject = {
      username: username,
      id: socket.id,
      country: playerCountry,
      isOnline: true
    };
    
    // Inicializa room.players como array se não existir
    if (!room.players) {
      room.players = [];
    }
    
    // Adiciona o jogador à lista de jogadores se ainda não estiver lá
    const existingPlayerIndex = room.players.findIndex(player => {
      if (typeof player === 'object') {
        return player.username === username;
      }
      return false;
    });
    
    if (existingPlayerIndex === -1) {
      // Jogador novo: adiciona à lista
      room.players.push(playerObject);
    } else {
      // Jogador já existe na sala: atualiza o status
      room.players[existingPlayerIndex] = {
        ...room.players[existingPlayerIndex],
        id: socket.id,
        country: playerCountry,
        isOnline: true
      };
    }
    
    console.log(`${username} entrou na sala ${roomName} como ${playerCountry}`);
    
    // Envia informações da sala para o jogador
    socket.emit('roomJoined', {
      name: roomName,
      owner: room.owner,
      playerCount: room.players.length,
      createdAt: room.createdAt
    });
    
    // Envia o país atribuído ao jogador
    socket.emit('countryAssigned', playerCountry);
    
    // Atualiza a lista de jogadores para todos na sala
    sendUpdatedPlayersList(io, roomName, gameState);
    
    // Envia o estado completo ao cliente
    socket.emit('stateRestored', playerState);
    
    // Envia o histórico de mensagens públicas para o cliente
    socket.emit('chatHistory', { 
      type: 'public', 
      messages: room.chatHistory.public 
    });
  });
  
  // Solicitar troca de país
  socket.on('requestCountryChange', () => {
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
    
    const room = gameState.rooms.get(roomName);
    
    // Seleciona um novo país
    const newCountry = selectNewCountryForPlayer(username, roomName, gameState);
    
    if (!newCountry) {
      socket.emit('error', 'Não há países disponíveis para troca');
      return;
    }
    
    // Atualiza o país no mapa userRoomCountries
    const userRoomKey = `${username}:${roomName}`;
    const oldCountry = gameState.userRoomCountries.get(userRoomKey);
    gameState.userRoomCountries.set(userRoomKey, newCountry);
    
    // Atualiza o estado do jogador
    if (gameState.playerStates.has(userRoomKey)) {
      const playerState = gameState.playerStates.get(userRoomKey);
      playerState.country = newCountry;
    }
    
    // Atualiza o jogador na lista de jogadores da sala
    const playerIndex = room.players.findIndex(player => {
      if (typeof player === 'object') {
        return player.username === username;
      }
      return false;
    });
    
    if (playerIndex !== -1 && typeof room.players[playerIndex] === 'object') {
      room.players[playerIndex].country = newCountry;
    }
    
    console.log(`${username} trocou de país: ${oldCountry} -> ${newCountry}`);
    
    // Envia o novo país atribuído ao jogador
    socket.emit('countryAssigned', newCountry);
    
    // Atualiza a lista de jogadores para todos na sala
    sendUpdatedPlayersList(io, roomName, gameState);
  });
  
  // Solicitar um país específico
  socket.on('requestSpecificCountry', (countryName) => {
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
    
    const room = gameState.rooms.get(roomName);
    
    // Verifica se o país solicitado existe nos dados
    if (!isValidCountry(gameState, countryName)) {
      socket.emit('error', `País '${countryName}' não existe nos dados`);
      return;
    }
    
    // Verifica se o país já está em uso por outro jogador
    const isCountryTaken = room.players.some(player => {
      if (typeof player === 'object') {
        return player.country === countryName && player.username !== username;
      }
      return false;
    });
    
    if (isCountryTaken) {
      socket.emit('error', `País '${countryName}' já está em uso por outro jogador`);
      return;
    }
    
    // Atualiza o país no mapa userRoomCountries
    const userRoomKey = `${username}:${roomName}`;
    const oldCountry = gameState.userRoomCountries.get(userRoomKey);
    gameState.userRoomCountries.set(userRoomKey, countryName);
    
    // Atualiza o estado do jogador
    if (gameState.playerStates.has(userRoomKey)) {
      const playerState = gameState.playerStates.get(userRoomKey);
      playerState.country = countryName;
    }
    
    // Atualiza o jogador na lista de jogadores da sala
    const playerIndex = room.players.findIndex(player => {
      if (typeof player === 'object') {
        return player.username === username;
      }
      return false;
    });
    
    if (playerIndex !== -1 && typeof room.players[playerIndex] === 'object') {
      room.players[playerIndex].country = countryName;
    }
    
    console.log(`${username} solicitou e recebeu o país específico: ${countryName}`);
    
    // Envia o novo país atribuído ao jogador
    socket.emit('countryAssigned', countryName);
    
    // Atualiza a lista de jogadores para todos na sala
    sendUpdatedPlayersList(io, roomName, gameState);
    
    // Atualiza países elegíveis
    updateEligibleCountries(countryName, room, gameState);
  });
}

/**
 * Seleciona um país para um novo jogador
 * @param {string} username - Nome do usuário
 * @param {string} roomName - Nome da sala
 * @param {Object} gameState - Estado global do jogo
 * @returns {string|null} - País selecionado ou null se não for possível
 */
function selectCountryForPlayer(username, roomName, gameState) {
  const room = gameState.rooms.get(roomName);
  
  // Certifica-se de que countriesData não seja nulo ou indefinido antes de usar Object.keys
  const allAvailableCountries = gameState.countriesData ? Object.keys(gameState.countriesData) : [];
  
  // Verificação extra para garantir que temos países disponíveis
  if (allAvailableCountries.length === 0) {
    console.error("Erro: Não há países disponíveis no gameState.countriesData!");
    return null;
  }
  
  // Log para depuração - ver quais países estão disponíveis
  console.log('Países disponíveis em countriesData:', allAvailableCountries.length);
  
  // Verifica se é o primeiro jogador na sala
  if (!room.players || room.players.length === 0 || 
      !room.players.some(p => typeof p === 'object' && p.country)) {
    // Primeiro jogador na sala - pode escolher qualquer país do countriesData
    const availableCountries = [...allAvailableCountries];
    
    if (availableCountries.length === 0) {
      return null;
    }
    
    // Sorteia um país aleatório entre os disponíveis
    const playerCountry = availableCountries[Math.floor(Math.random() * availableCountries.length)];
    console.log(`País sorteado para ${username}: ${playerCountry}`);
    
    // Inicializa o conjunto de países elegíveis se não existir
    if (!room.eligibleCountries) {
      room.eligibleCountries = [];
    }
    
    // Define países elegíveis para próximos jogadores com base nas fronteiras
    updateEligibleCountries(playerCountry, room, gameState, allAvailableCountries);
    
    return playerCountry;
  } else {
    // Jogadores subsequentes - prioriza países fronteiriços elegíveis
    
    // Obtém países já em uso
    const countriesInUse = room.players
      .filter(p => typeof p === 'object' && p.country)
      .map(p => p.country);
    
    // Inicializa eligibleCountries se não existir
    if (!room.eligibleCountries) {
      room.eligibleCountries = allAvailableCountries.filter(c => !countriesInUse.includes(c));
    }
    
    // Garante que todos os países elegíveis estejam no countriesData
    room.eligibleCountries = room.eligibleCountries.filter(c => allAvailableCountries.includes(c));
    
    // Filtrar países elegíveis que não estão em uso
    const availableEligibleCountries = room.eligibleCountries.filter(
      c => !countriesInUse.includes(c)
    );
    
    if (availableEligibleCountries.length > 0) {
      // Prioriza países elegíveis (fronteiriços)
      const playerCountry = availableEligibleCountries[Math.floor(Math.random() * availableEligibleCountries.length)];
      console.log(`País elegível sorteado para ${username}: ${playerCountry}`);
      
      // Adiciona novos países de fronteira aos elegíveis
      updateEligibleCountries(playerCountry, room, gameState, allAvailableCountries);
      
      return playerCountry;
    } else {
      // Se não houver elegíveis, escolhe entre os países restantes do countriesData
      const remainingCountries = allAvailableCountries.filter(
        c => !countriesInUse.includes(c)
      );
      
      if (remainingCountries.length === 0) {
        return null;
      }
      
      const playerCountry = remainingCountries[Math.floor(Math.random() * remainingCountries.length)];
      console.log(`País não-elegível sorteado para ${username}: ${playerCountry}`);
      
      // Adiciona novos países de fronteira aos elegíveis
      updateEligibleCountries(playerCountry, room, gameState, allAvailableCountries);
      
      return playerCountry;
    }
  }
}

/**
 * Seleciona um novo país para um jogador existente
 * @param {string} username - Nome do usuário
 * @param {string} roomName - Nome da sala
 * @param {Object} gameState - Estado global do jogo
 * @returns {string|null} - Novo país selecionado ou null se não for possível
 */
function selectNewCountryForPlayer(username, roomName, gameState) {
  const room = gameState.rooms.get(roomName);
  
  // Obtém o país atual do jogador
  const userRoomKey = `${username}:${roomName}`;
  const currentCountry = gameState.userRoomCountries.get(userRoomKey);
  
  // Obtém todos os países disponíveis
  const allAvailableCountries = gameState.countriesData ? Object.keys(gameState.countriesData) : [];
  
  // Países em uso por outros jogadores
  const countriesInUse = room.players
    .filter(p => typeof p === 'object' && p.username !== username && p.country)
    .map(p => p.country);
  
  // Todos os países disponíveis (não em uso por outros jogadores)
  const availableCountries = allAvailableCountries.filter(
    c => !countriesInUse.includes(c) && c !== currentCountry
  );
  
  if (availableCountries.length === 0) {
    return null;
  }
  
  // Prioriza países que fazem fronteira com países já selecionados
  const borderingCountries = [];
  
  // Obtém países que fazem fronteira com países já selecionados
  room.players.forEach(player => {
    if (typeof player === 'object' && player.country) {
      const borders = getBorderingCountries(gameState, player.country);
      borders.forEach(border => {
        if (!countriesInUse.includes(border) && border !== currentCountry) {
          borderingCountries.push(border);
        }
      });
    }
  });
  
  // Remove duplicatas
  const uniqueBorderingCountries = [...new Set(borderingCountries)];
  
  // Filtra para apenas os que ainda estão disponíveis
  const availableBorderingCountries = uniqueBorderingCountries.filter(
    c => availableCountries.includes(c)
  );
  
  // Se houver países de fronteira disponíveis, prioriza-os
  if (availableBorderingCountries.length > 0) {
    const newCountry = availableBorderingCountries[Math.floor(Math.random() * availableBorderingCountries.length)];
    
    // Atualiza países elegíveis
    updateEligibleCountries(newCountry, room, gameState, allAvailableCountries);
    
    return newCountry;
  }
  
  // Caso contrário, seleciona um país aleatório entre os disponíveis
  const newCountry = availableCountries[Math.floor(Math.random() * availableCountries.length)];
  
  // Atualiza países elegíveis
  updateEligibleCountries(newCountry, room, gameState, allAvailableCountries);
  
  return newCountry;
}

/**
 * Atualiza a lista de países elegíveis com base no novo país
 * @param {string} country - País a considerar
 * @param {Object} room - Sala
 * @param {Object} gameState - Estado global do jogo
 * @param {Array<string>} [allAvailableCountries] - Todos os países disponíveis (opcional)
 */
function updateEligibleCountries(country, room, gameState, allAvailableCountries) {
  // Se allAvailableCountries não for fornecido, obtenha da countriesData
  if (!allAvailableCountries) {
    allAvailableCountries = gameState.countriesData ? Object.keys(gameState.countriesData) : [];
  }
  
  if (gameState.countriesData[country] && gameState.countriesData[country].borders) {
    const newBorders = gameState.countriesData[country].borders
      .filter(border => border.enabled)
      .map(border => border.country)
      .filter(c => allAvailableCountries.includes(c));
    
    // Adiciona novos países de fronteira aos elegíveis (evitando duplicatas)
    if (!room.eligibleCountries) {
      room.eligibleCountries = [];
    }
    
    room.eligibleCountries = [...new Set([...room.eligibleCountries, ...newBorders])];
  }
}

export { 
  setupCountryAssignment,
  selectCountryForPlayer,
  selectNewCountryForPlayer,
  updateEligibleCountries
};