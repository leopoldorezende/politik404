/**
 * Handlers relacionados ao chat
 */
import { getCurrentRoom } from '../../shared/utils/gameStateUtils.js';

/**
 * Configura os handlers relacionados ao chat
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 */
function setupChatHandlers(io, socket, gameState) {
  console.log('Chat handlers inicializados');
  
  // Manipular mensagem de chat
  socket.on('chatMessage', (data) => {
    const username = socket.username;
    
    // Validar username
    if (!username) {
      socket.emit('error', 'Usuário não autenticado');
      return;
    }
    
    // Encontrar sala ativa
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Sala não encontrada');
      return;
    }
    
    // Verificar e inicializar o histórico de chat se necessário
    if (!room.chatHistory) {
      room.chatHistory = {
        public: [],
        private: new Map()
      };
    }
    
    // Garantir que o mapa de histórico privado seja um Map
    if (!room.chatHistory.private || !(room.chatHistory.private instanceof Map)) {
      console.log(`Corrigindo estrutura de chat privado para sala ${roomName}`);
      room.chatHistory.private = new Map();
    }
    
    // Validar dados da mensagem
    if (!data || typeof data.message !== 'string' || data.message.trim() === '') {
      socket.emit('error', 'Conteúdo da mensagem inválido');
      return;
    }
    
    // Obter país do jogador
    let playerCountry = 'Desconhecido';
    const userRoomKey = `${username}:${roomName}`;
    
    // Primeiro, tenta obter do mapeamento userRoomCountries
    if (gameState.userRoomCountries.has(userRoomKey)) {
      playerCountry = gameState.userRoomCountries.get(userRoomKey);
    } 
    // Se não encontrar, procura na lista de jogadores
    else if (room.players) {
      const player = room.players.find(p => {
        if (typeof p === 'object') {
          return p.username === username;
        }
        if (typeof p === 'string') {
          return p.startsWith(username);
        }
        return false;
      });
      
      if (player) {
        if (typeof player === 'object' && player.country) {
          playerCountry = player.country;
        } else if (typeof player === 'string') {
          const match = player.match(/\((.*)\)/);
          if (match) {
            playerCountry = match[1];
          }
        }
      }
    }
    
    // Criar objeto da mensagem
    const fullUsername = `${playerCountry} - ${username}`;
    const message = { 
      sender: fullUsername, 
      content: data.message.trim(),
      timestamp: Date.now(),
      isPrivate: !!data.isPrivate,
      recipient: data.recipient || null
    };
    
    console.log('Processando mensagem:', {
      sender: username,
      isPrivate: message.isPrivate,
      recipient: message.recipient,
      content: message.content.substring(0, 20) + (message.content.length > 20 ? '...' : '')
    });
    
    // Manipular mensagem com base no tipo (pública/privada)
    if (message.isPrivate && message.recipient) {
      processPrivateMessage(io, socket, gameState, room, roomName, username, message);
    } else {
      // Adicionar mensagem ao histórico público
      room.chatHistory.public.push(message);
      
      // Limitar tamanho do histórico
      if (room.chatHistory.public.length > gameState.MAX_CHAT_HISTORY) {
        room.chatHistory.public.shift();
      }
      
      // Enviar para todos na sala
      io.to(roomName).emit('chatMessage', message);
    }
  });
  
  // Obter histórico de chat ao entrar em uma sala
  socket.on('getChatHistory', () => {
    // Encontrar sala atual
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Sala não encontrada');
      return;
    }
    
    // Verificar e inicializar o histórico de chat se necessário
    if (!room.chatHistory) {
      room.chatHistory = {
        public: [],
        private: new Map()
      };
    }
    
    // Garantir que o mapa de histórico privado seja um Map
    if (!room.chatHistory.private || !(room.chatHistory.private instanceof Map)) {
      console.log(`Corrigindo estrutura de chat privado para sala ${roomName}`);
      room.chatHistory.private = new Map();
    }
    
    // Enviar histórico público para o cliente
    socket.emit('chatHistory', {
      type: 'public',
      messages: room.chatHistory.public || []
    });
  });
  
  // Solicitação de histórico de chat privado
  socket.on('requestPrivateHistory', (targetUsername) => {
    const username = socket.username;
    if (!username || !targetUsername) {
      socket.emit('error', 'Usuário não autenticado ou alvo inválido');
      return;
    }
    
    // Encontra a sala atual do usuário
    const roomName = getCurrentRoom(socket, gameState);
    if (!roomName) {
      socket.emit('error', 'Não está em uma sala');
      return;
    }
    
    const room = gameState.rooms.get(roomName);
    if (!room) {
      socket.emit('error', 'Sala não encontrada');
      return;
    }
    
    // Verificar e inicializar o histórico de chat se necessário
    if (!room.chatHistory) {
      room.chatHistory = {
        public: [],
        private: new Map()
      };
    }
    
    // Garantir que o mapa de histórico privado seja um Map
    if (!room.chatHistory.private || !(room.chatHistory.private instanceof Map)) {
      console.log(`Corrigindo estrutura de chat privado para sala ${roomName}`);
      room.chatHistory.private = new Map();
    }
    
    // Criar uma chave única para o histórico de chat privado usando a função do gameState
    const chatKey = gameState.getPrivateChatKey(username, targetUsername);
    
    // Obter o histórico (ou array vazio se não existir)
    const history = room.chatHistory.private.get(chatKey) || [];
    
    // Enviar o histórico ao cliente
    socket.emit('chatHistory', { 
      type: 'private', 
      target: targetUsername,
      messages: history 
    });
    
    console.log(`Enviado histórico de chat privado para ${username} com ${targetUsername}, ${history.length} mensagens`);
  });
}

/**
 * Processa uma mensagem privada
 * @param {Object} io - Instância do Socket.io
 * @param {Object} socket - Socket do cliente
 * @param {Object} gameState - Estado global do jogo
 * @param {Object} room - Sala atual
 * @param {string} roomName - Nome da sala
 * @param {string} username - Nome do usuário
 * @param {Object} message - Objeto da mensagem
 */
function processPrivateMessage(io, socket, gameState, room, roomName, username, message) {
  const recipientUsername = message.recipient;
  
  // Verificar e inicializar o histórico de chat se necessário
  if (!room.chatHistory) {
    room.chatHistory = {
      public: [],
      private: new Map()
    };
  }
  
  // Garantir que o mapa de histórico privado seja um Map
  if (!room.chatHistory.private || !(room.chatHistory.private instanceof Map)) {
    console.log(`Corrigindo estrutura de chat privado para mensagem privada na sala ${roomName}`);
    room.chatHistory.private = new Map();
  }
  
  // Criar chave única para histórico de chat privado
  const chatKey = gameState.getPrivateChatKey(username, recipientUsername);
  
  // Inicializar histórico para este par de chat se não existir
  if (!room.chatHistory.private.has(chatKey)) {
    room.chatHistory.private.set(chatKey, []);
  }
  
  // Adicionar mensagem ao histórico
  const history = room.chatHistory.private.get(chatKey);
  history.push(message);
  
  // Limitar tamanho do histórico
  if (history.length > gameState.MAX_CHAT_HISTORY) {
    history.shift();
  }
  
  // Encontrar ID do socket do destinatário
  let recipientSocketId = null;
  for (const [socketId, name] of gameState.socketIdToUsername.entries()) {
    if (name === recipientUsername) {
      recipientSocketId = socketId;
      break;
    }
  }
  
  // Enviar para o remetente
  socket.emit('chatMessage', message);
  
  // Enviar para o destinatário
  if (recipientSocketId) {
    console.log(`Enviando mensagem privada para ${recipientUsername} (Socket ID: ${recipientSocketId})`);
    io.to(recipientSocketId).emit('chatMessage', message);
  } else {
    console.log(`Destinatário ${recipientUsername} não encontrado ou offline`);
    socket.emit('error', 'Destinatário não encontrado ou offline');
  }
}

export { setupChatHandlers };