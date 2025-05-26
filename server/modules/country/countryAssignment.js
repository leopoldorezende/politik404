/**
 * Gerenciamento da atribuição de países para jogadores
 */

import { 
  sendUpdatedPlayersList 
} from '../room/roomNotifications.js';
import { 
  getCurrentRoom, 
  getUsernameFromSocketId 
} from '../../shared/utils/gameStateUtils.js';
import {
  isValidCountry,
  getBorderingCountries,
  getAvailableCountries
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
  
    // Inicializar economia da sala se necessário
    const economyService = global.economyService;
    if (economyService && gameState.countriesData) {
      economyService.initializeRoom(roomName, gameState.countriesData);
    }
    
    // Adiciona o jogador à sala
    socket.join(roomName);
    
    // Marca o jogador como online
    gameState.onlinePlayers.add(username);
    
    // Associa o usuário à sala
    gameState.userToRoom.set(username, roomName);
    
    // Notifica todos sobre o status online
    io.emit('playerOnlineStatus', { username, isOnline: true });
    
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
    const newCountry = selectCountryForPlayer(username, roomName, gameState);
    
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
  });
}

/**
 * Seleciona um país para um novo jogador (versão simplificada)
 * @param {string} username - Nome do usuário
 * @param {string} roomName - Nome da sala
 * @param {Object} gameState - Estado global do jogo
 * @returns {string|null} - País selecionado ou null se não for possível
 */
function selectCountryForPlayer(username, roomName, gameState) {
  const room = gameState.rooms.get(roomName);
  
  // Obter todos os países disponíveis
  const allCountries = gameState.countriesData ? Object.keys(gameState.countriesData) : [];
  
  if (allCountries.length === 0) {
    console.error("Erro: Não há países disponíveis no gameState.countriesData!");
    return null;
  }
  
  // Obter países já em uso na sala
  const countriesInUse = getCountriesInUse(room);
  
  // Filtrar países disponíveis (não em uso)
  const availableCountries = allCountries.filter(country => !countriesInUse.includes(country));
  
  if (availableCountries.length === 0) {
    console.log('Não há países disponíveis para atribuição');
    return null;
  }
  
  // Se é o primeiro jogador ou não há estratégia de fronteira, escolhe aleatoriamente
  if (countriesInUse.length === 0) {
    const selectedCountry = getRandomCountry(availableCountries);
    console.log(`Primeiro jogador ${username}: país sorteado ${selectedCountry}`);
    return selectedCountry;
  }
  
  // Para jogadores subsequentes, tenta priorizar países fronteiriços
  const borderingCountries = getBorderingAvailableCountries(countriesInUse, availableCountries, gameState);
  
  if (borderingCountries.length > 0) {
    const selectedCountry = getRandomCountry(borderingCountries);
    console.log(`${username}: país fronteiriço sorteado ${selectedCountry}`);
    return selectedCountry;
  }
  
  // Se não há países fronteiriços disponíveis, escolhe qualquer um disponível
  const selectedCountry = getRandomCountry(availableCountries);
  console.log(`${username}: país aleatório sorteado ${selectedCountry}`);
  return selectedCountry;
}

/**
 * Obtém países já em uso na sala
 * @param {Object} room - Objeto da sala
 * @returns {Array<string>} - Lista de países em uso
 */
function getCountriesInUse(room) {
  if (!room.players || room.players.length === 0) {
    return [];
  }
  
  return room.players
    .filter(p => typeof p === 'object' && p.country)
    .map(p => p.country);
}

/**
 * Obtém países fronteiriços disponíveis
 * @param {Array<string>} countriesInUse - Países já em uso
 * @param {Array<string>} availableCountries - Países disponíveis
 * @param {Object} gameState - Estado global do jogo
 * @returns {Array<string>} - Países fronteiriços disponíveis
 */
function getBorderingAvailableCountries(countriesInUse, availableCountries, gameState) {
  const borderingCountries = new Set();
  
  // Para cada país em uso, adiciona suas fronteiras aos países fronteiriços
  for (const country of countriesInUse) {
    const borders = getBorderingCountries(gameState, country);
    for (const border of borders) {
      if (availableCountries.includes(border)) {
        borderingCountries.add(border);
      }
    }
  }
  
  return Array.from(borderingCountries);
}

/**
 * Seleciona um país aleatório de uma lista
 * @param {Array<string>} countries - Lista de países
 * @returns {string} - País selecionado
 */
function getRandomCountry(countries) {
  return countries[Math.floor(Math.random() * countries.length)];
}

export { 
  setupCountryAssignment,
  selectCountryForPlayer
};