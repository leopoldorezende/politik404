/**
 * Middleware para manipulação e processamento de eventos do Socket.io
 */

const { initializeGameState, cleanupDisconnectedUser } = require('../shared/gameStateUtils');

/**
 * Middleware para registro, monitoramento e processamento de eventos do Socket.io
 * @param {Object} io - Instância do Socket.io
 * @returns {Function} Middleware para uso com o Socket.io
 */
function createSocketMiddleware(io) {
  // Inicializa o estado global do jogo
  const gameState = {
    rooms: new Map(),
    socketIdToUsername: new Map(),
    userToRoom: new Map(),
    userRoomCountries: new Map(),
    playerStates: new Map(),
    ships: new Map(),
    onlinePlayers: new Set(),
    displayNames: new Map(),
    MAX_CHAT_HISTORY: 100,
    
    // Função auxiliar para criar uma sala
    createRoom: function(name, owner) {
      return {
        name,
        owner,
        players: [],
        eligibleCountries: [],
        chatHistory: {
          public: [],
          private: new Map() // Mapa para mensagens privadas
        },
        createdAt: new Date().toISOString()
      };
    },
    
    // Função auxiliar para gerar chave para chat privado
    getPrivateChatKey: function(user1, user2) {
      return [user1, user2].sort().join(':');
    }
  };
  
  // Inicializa as estruturas de dados
  initializeGameState(gameState);
  
  // Função de middleware
  return function(socket, next) {
    console.log(`Socket conectado: ${socket.id}`);
    
    // Monitoramento e registro de eventos
    const originalEmit = socket.emit;
    socket.emit = function(event, ...args) {
      if (event !== 'ping' && event !== 'pong') {
        console.log(`[EMIT para ${socket.id}] ${event}`);
      }
      return originalEmit.apply(socket, [event, ...args]);
    };
    
    // Interceptação de erros
    socket.on('error', (error) => {
      console.error(`Erro no socket ${socket.id}:`, error);
      socket.emit('error', 'Erro interno no servidor');
    });
    
    // Captura eventos de desconexão para limpeza
    socket.on('disconnect', () => {
      console.log(`Socket desconectado: ${socket.id}`);
      
      // Limpa dados relacionados ao usuário desconectado
      cleanupDisconnectedUser(gameState, socket.id);
      
      // Atualiza a lista de salas para todos
      const roomsList = Array.from(gameState.rooms.entries()).map(([name, room]) => ({
        name,
        owner: room.owner,
        playerCount: room.players ? room.players.length : 0,
        createdAt: room.createdAt
      }));
      
      io.emit('roomsList', roomsList);
    });
    
    // Verificação de tempo limite para inatividade
    let inactivityTimeout;
    
    // Função para resetar o temporizador de inatividade
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        const username = socket.username;
        if (username) {
          console.log(`Desconectando ${username} por inatividade`);
          socket.emit('inactivityDisconnect', { message: 'Desconectado por inatividade' });
          socket.disconnect(true);
        }
      }, 2 * 60 * 60 * 1000); // 2 horas de inatividade
    };
    
    // Redefine o temporizador em cada evento recebido
    socket.use((packet, next) => {
      resetInactivityTimer();
      next();
    });
    
    // Inicializa o temporizador
    resetInactivityTimer();
    
    // Registra estatísticas de latência
    socket.on('ping', (callback) => {
      const startTime = Date.now();
      if (typeof callback === 'function') {
        callback();
        const latency = Date.now() - startTime;
        socket.emit('pong', { latency });
      }
    });
    
    // Continua para o próximo middleware
    next();
  };
}

module.exports = { 
  createSocketMiddleware
};