/**
 * Middleware para manipulação e processamento de eventos do Socket.io
 */

import { 
  createDefaultGameState, 
  initializeGameState, 
  cleanupDisconnectedUser 
} from '../shared/gameStateUtils.js';

/**
 * Middleware para registro, monitoramento e processamento de eventos do Socket.io
 * @param {Object} io - Instância do Socket.io
 * @returns {Function} Middleware para uso com o Socket.io
 */
function createSocketMiddleware(io) {
  // Obtém o estado global do jogo da função centralizada
  const gameState = createDefaultGameState();
  
  // Inicializa as estruturas de dados
  initializeGameState(gameState);
  
  // Função de middleware
  return function(socket, next) {
    const transport = socket.conn?.transport?.name;
    console.log(`Socket conectado: ${socket.id} via ${transport || 'unknown transport'}`);
    
      
    // Registra mudança de transporte (polling -> websocket)
    socket.conn.on('upgrade', () => {
      console.log(`Socket ${socket.id} atualizou transporte para ${socket.conn.transport.name}`);
    });
    
    
    // Obter e registrar o ID de sessão do cliente
    const clientSessionId = socket.handshake.query.clientSessionId;
    if (clientSessionId) {
      console.log(`Socket ${socket.id} associado à sessão do cliente: ${clientSessionId}`);
      gameState.socketToSessionId.set(socket.id, clientSessionId);
      
      // Verificar se já existe um usuário associado a esta sessão
      const existingUsername = gameState.sessionIdToUsername.get(clientSessionId);
      if (existingUsername) {
        console.log(`Sessão ${clientSessionId} já está associada ao usuário ${existingUsername}`);
      }
    }
    
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
      
      // Obter o ID de sessão do cliente
      const clientSessionId = gameState.socketToSessionId.get(socket.id);
      
      // Remover o mapeamento de socketId para sessionId
      gameState.socketToSessionId.delete(socket.id);
      
      // Adicionar à lista de pendentes para remoção
      gameState.pendingSocketsRemoval.add(socket.id);
      
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
      
      // Atualizar o timestamp de atividade para o usuário
      const username = socket.username;
      if (username && gameState.lastActivityTimestamp) {
        gameState.lastActivityTimestamp.set(username, Date.now());
      }
      
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
    
    // Customizar o evento de autenticação para aceitar o ID de sessão
    const originalOn = socket.on;
    socket.on = function(event, handler) {
      if (event === 'authenticate') {
        // Substituir o handler de autenticação para incluir verificação de sessão
        return originalOn.call(socket, event, function(username, options = {}) {
          // Obter o ID de sessão do payload ou da query
          const clientSessionId = (options && options.clientSessionId) || 
                                  gameState.socketToSessionId.get(socket.id);
          
          if (clientSessionId) {
            // Associar o ID de sessão ao username para futuras verificações
            gameState.sessionIdToUsername.set(clientSessionId, username);
            
            // Verificar se já existe um socket para este usuário e é do mesmo ID de sessão
            let existingSocketId = null;
            let isSameSession = false;
            
            for (const [socketId, existingUsername] of gameState.socketIdToUsername.entries()) {
              if (existingUsername === username && socketId !== socket.id) {
                existingSocketId = socketId;
                
                // Verificar se é a mesma sessão
                const existingSessionId = gameState.socketToSessionId.get(socketId);
                if (existingSessionId && existingSessionId === clientSessionId) {
                  isSameSession = true;
                  console.log(`Detectada reconexão do mesmo dispositivo para ${username}`);
                }
                break;
              }
            }
            
            // Se existir um socket para este usuário e for do mesmo dispositivo,
            // desconectar o socket antigo sem mostrar erro para o cliente
            if (existingSocketId && isSameSession) {
              const existingSocket = io.sockets.sockets.get(existingSocketId);
              if (existingSocket) {
                console.log(`Desconectando socket antigo ${existingSocketId} do mesmo dispositivo`);
                
                // Notificar o socket antigo que será desconectado (sem mostrar alerta)
                existingSocket.emit('forcedDisconnect', { 
                  reason: 'Nova sessão iniciada em outro local',
                  reconnect: false,
                  sameBrowser: true // Indicar que é do mesmo navegador
                });
                
                // Marca para remoção na próxima limpeza
                gameState.pendingSocketsRemoval.add(existingSocketId);
              }
            }
          }
          
          // Chamar o handler original com os argumentos originais
          handler.apply(socket, [username]);
        });
      }
      
      // Para outros eventos, manter comportamento padrão
      return originalOn.apply(socket, arguments);
    };
    
    // Continua para o próximo middleware
    next();
  };
}

export { 
  createSocketMiddleware 
};