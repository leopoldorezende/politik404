import redis from './shared/redisClient.js';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { 
  initializeSocketHandlers 
} from './modules/index.js';
import { 
  createSocketMiddleware 
} from './middlewares/socketServerMiddleware.js';
import { 
  createDefaultGameState,
  cleanupInactiveUsers, 
  registerSocketUserMapping 
} from './shared/gameStateUtils.js';
import googleAuthRoutes from './modules/auth/google.js';

// Adicionar isso para lidar com __dirname e __filename no ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

redis.set('debug_check', new Date().toISOString());
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Rota de autenticação
app.use('/auth', googleAuthRoutes);

// Servir arquivos públicos estáticos do front-end
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  app.use(express.static(path.join(__dirname, '../public')));
}

// Servir apenas countriesData.json e countriesCoordinates.json
app.get('/data/countriesData.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/data/countriesData.json'));
});
app.get('/data/countriesCoordinates.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/data/countriesCoordinates.json'));
});

// Rota de verificação para facilitar a depuração (exclui routes.json)
app.get('/check-data-files', (req, res) => {
  const serverPublicDataPath = path.join(__dirname, 'public/data');
  const rootPublicDataPath = path.join(__dirname, '../public/data');
  let files = {
    serverPublicData: null,
    rootPublicData: null
  };
  try {
    if (fs.existsSync(serverPublicDataPath)) {
      files.serverPublicData = fs.readdirSync(serverPublicDataPath)
        .filter(f => f !== 'routes.json');
    }
  } catch (err) {
    files.serverPublicData = `Erro: ${err.message}`;
  }
  try {
    if (fs.existsSync(rootPublicDataPath)) {
      files.rootPublicData = fs.readdirSync(rootPublicDataPath)
        .filter(f => f !== 'routes.json');
    }
  } catch (err) {
    files.rootPublicData = `Erro: ${err.message}`;
  }
  res.json({
    paths: {
      serverPublicDataPath,
      rootPublicDataPath
    },
    files
  });
});

const server = http.createServer(app);
// Configuração do Socket.io - Adicionando configurações para melhor lidar com conexões
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true); // aceita qualquer origem
    },
    credentials: true
  },
  // Configurações adicionais para melhorar a compatibilidade com proxies e firewalls
  transports: ['polling', 'websocket'], // Tenta primeiro polling e depois websocket
  allowUpgrades: true, // Permite upgrade de polling para websocket, se disponível
  pingTimeout: 30000, // Aumentar timeout para detecção de desconexão
  pingInterval: 10000, // Intervalo para verificar conexão
  cookie: false, // Desativa cookies para evitar problemas com CORS
  maxHttpBufferSize: 1e8, // 100MB - para lidar com mensagens maiores se necessário
  path: '/socket.io/', // Caminho padrão para o socket.io
});

// Rota para obter estatísticas do servidor para monitoramento
app.get('/api/stats', (req, res) => {
  // Usamos o gameState já definido pelo middleware do socket
  const gameState = global.gameState;
  
  if (!gameState) {
    return res.status(500).json({ error: 'Estado do jogo não inicializado' });
  }
  
  const stats = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    connections: {
      socketCount: io.engine.clientsCount,
      socketsById: Array.from(io.sockets.sockets.keys()),
      roomCount: gameState.rooms.size,
      onlineUsersCount: gameState.onlinePlayers.size,
      onlineUsers: Array.from(gameState.onlinePlayers)
    },
    memory: process.memoryUsage()
  };
  res.json(stats);
});

// Rota para obter o token Mapbox
app.get('/api/mapbox', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== process.env.MY_SECRET) {
    return res.status(401).send('Não autorizado');
  }
  res.json({ token: process.env.MAP_APIKEY });
});

// Carrega os dados dos países
let countriesData;
try {
  const serverDataPath = path.join(__dirname, 'public/data/countriesData.json');
  if (fs.existsSync(serverDataPath)) {
    const rawData = fs.readFileSync(serverDataPath, 'utf8');
    countriesData = JSON.parse(rawData);
  } else {
    const rootDataPath = path.join(__dirname, '../public/data/countriesData.json');
    if (fs.existsSync(rootDataPath)) {
      const rawData = fs.readFileSync(rootDataPath, 'utf8');
      countriesData = JSON.parse(rawData);
    } else {
      console.error('ERRO CRÍTICO: countriesData.json não encontrado!');
      countriesData = {};
    }
  }
} catch (error) {
  console.error('Erro ao carregar countriesData.json:', error);
  countriesData = {};
}

// Criamos o estado global do jogo usando a função centralizada
const gameState = createDefaultGameState();
// Adicionamos os dados dos países carregados
gameState.countriesData = countriesData;
// Disponibilizamos o gameState globalmente para acesso em outros módulos
global.gameState = gameState;

// Função para limpar periodicamente sockets e usuários inativos
const setupCleanupSchedule = () => {
  // Executa limpeza a cada 15 minutos
  const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutos
  
  // Inicia o intervalo para limpeza
  const cleanupInterval = setInterval(() => {
    const now = new Date();
    console.log(`[${now.toISOString()}] Iniciando limpeza programada...`);
    
    const removedCount = cleanupInactiveUsers(io, gameState);
    
    console.log(`[${now.toISOString()}] Limpeza concluída: ${removedCount} itens removidos`);
  }, CLEANUP_INTERVAL);
  
  // Também executa limpeza a cada 2 horas para remover sessões muito antigas
  const DEEP_CLEANUP_INTERVAL = 2 * 60 * 60 * 1000; // 2 horas
  
  // Inicia o intervalo para limpeza profunda (sessões antigas)
  const deepCleanupInterval = setInterval(() => {
    const now = new Date();
    console.log(`[${now.toISOString()}] Iniciando limpeza profunda...`);
    
    // Limpar usuários com mais de 8 horas de inatividade
    const removedCount = cleanupInactiveUsers(io, gameState, 8 * 60 * 60 * 1000);
    
    console.log(`[${now.toISOString()}] Limpeza profunda concluída: ${removedCount} itens removidos`);
  }, DEEP_CLEANUP_INTERVAL);
  
  // Retorna os intervalos para possível cancelamento futuro
  return { cleanupInterval, deepCleanupInterval };
};

async function restoreRoomsFromRedis() {
  try {
    const stored = await redis.get('rooms');
    if (stored) {
      const parsed = JSON.parse(stored);
      for (const [name, room] of Object.entries(parsed)) {
        gameState.rooms.set(name, room);
      }
      console.log(`[REDIS] Salas restauradas: ${gameState.rooms.size}`);
    }
  } catch (err) {
    console.error('[REDIS] Erro ao restaurar salas:', err.message);
  }
}

const PORT = process.env.PORT || 3000;

app.get('/check-connection', (req, res) => {
  res.status(200).send('OK');
});

// Iniciar servidor só depois que Redis restaurar
restoreRoomsFromRedis().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Countries data loaded: ${Object.keys(countriesData).length} countries`);

    // Configurar limpeza programada
    const cleanupSchedules = setupCleanupSchedule();
    
    // Salvar as referências no objeto global para possível acesso futuro
    global.cleanupSchedules = cleanupSchedules;
  });
});

io.use(createSocketMiddleware(io));

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Registrar o evento para monitorar quando o cliente confirma a conexão
  socket.on('pong', (data) => {
    // Atualizar timestamp de atividade para o usuário associado a este socket
    const username = gameState.socketIdToUsername.get(socket.id);
    if (username && gameState.lastActivityTimestamp) {
      gameState.lastActivityTimestamp.set(username, Date.now());
    }
  });
  
  // Registrar o evento de autenticação para mapeamento bidirecional
  socket.on('authenticate', (username) => {
    if (username) {
      // Registrar mapeamento bidirecional
      registerSocketUserMapping(gameState, socket.id, username);
      
      // Atualizar o timestamp de última atividade
      if (gameState.lastActivityTimestamp) {
        gameState.lastActivityTimestamp.set(username, Date.now());
      }
    }
  });
    
  // Log quando o transporte mudar (de polling para websocket, por exemplo)
  socket.conn.on('upgrade', () => {
    console.log('Socket transport upgraded to:', socket.conn.transport.name);
  });
  
  // Inicializar os handlers do socket
  initializeSocketHandlers(io, socket, gameState);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const username = gameState.socketIdToUsername.get(socket.id);
    if (username) {
      const roomName = gameState.userToRoom.get(username);
      if (roomName) {
        const room = gameState.rooms.get(roomName);
        if (room && room.players) {
          room.players = room.players.filter(p => 
            typeof p === 'object' ? p.username !== username : !p.startsWith(username)
          );
          io.to(roomName).emit('playersList', room.players);
          if (room.players.length === 0) {
            gameState.rooms.delete(roomName);
            const roomsList = Array.from(gameState.rooms.entries()).map(([name, rm]) => ({
              name,
              owner: rm.owner,
              playerCount: rm.players.length,
              createdAt: rm.createdAt
            }));
            io.emit('roomsList', roomsList);
          }
        }
        gameState.userToRoom.delete(username);
      }
      gameState.socketIdToUsername.delete(socket.id);
      gameState.onlinePlayers.delete(username);
      io.emit('playerOnlineStatus', { username, isOnline: false });
    }
  });
});