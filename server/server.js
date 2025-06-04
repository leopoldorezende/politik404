import redis from './shared/redisClient.js';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import economyService from './shared/services/economyService.js';
import cardService from './shared/services/cardService.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { initializeSocketHandlers } from './modules/index.js';
import { createSocketMiddleware, setupPeriodicCleanup } from './middlewares/socketServerMiddleware.js';
import { 
  createDefaultGameState,
  cleanupInactiveUsers, 
  registerSocketUserMapping 
} from './shared/utils/gameStateUtils.js';
import { 
  initializeExistingRoomsExpiration,
  cleanup as cleanupExpirationTimers
} from './modules/room/roomExpirationManager.js';
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

// Configuração simplificada do Socket.io
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8,
  connectTimeout: 45000,
  upgradeTimeout: 30000
});

global.io = io;

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

global.gameState = gameState;
global.economyService = economyService;
global.cardService = cardService;

async function restoreRoomsFromRedis() {
  try {
    const stored = await redis.get('rooms');
    if (stored) {
      const parsed = JSON.parse(stored);
      for (const [name, room] of Object.entries(parsed)) {
        gameState.rooms.set(name, room);
        
        // Inicializar economia para salas restauradas
        if (Object.keys(countriesData).length > 0) {
          economyService.initializeRoom(name, countriesData);
        }
      }
      console.log(`[REDIS] Salas restauradas: ${gameState.rooms.size}`);
      
      // Inicializar os timers de expiração para salas existentes
      initializeExistingRoomsExpiration(io, gameState);
    }
  } catch (err) {
    console.error('[REDIS] Erro ao restaurar salas:', err.message);
  }
}

const PORT = process.env.PORT || 3000;

app.get('/check-connection', (req, res) => {
  res.status(200).send('OK');
});

// Handler único para encerramento do servidor
const shutdownHandler = () => {
  console.log('Servidor está sendo encerrado. Limpando recursos avançados...');
  
  // Limpar o economyService com dados avançados
  if (global.economyService) {
    const finalStats = global.economyService.getPerformanceStats();
    console.log('📊 Final Economy Stats:', finalStats);
    global.economyService.cleanup();
    console.log('✅ Advanced EconomyService cleanup completed');
  }
  
  // Limpar o cardService
  if (global.cardService) {
    const finalCardStats = global.cardService.getStats();
    console.log('🎯 Final Card Stats:', finalCardStats);
    global.cardService.cleanup();
    console.log('✅ CardService cleanup completed');
  }
  
  // Limpar os timers de expiração
  cleanupExpirationTimers();
  
  process.exit(0);
};

// Configurar handlers de encerramento
process.on('SIGINT', shutdownHandler);
process.on('SIGTERM', shutdownHandler);

// Iniciar servidor só depois que Redis restaurar
restoreRoomsFromRedis().then(() => {
  // CRÍTICO: Inicializar EconomyService com cálculos avançados
  Promise.all([
    economyService.initialize(),
    cardService.initialize()
  ]).then(() => {
    console.log('✅ Advanced EconomyService and CardService initialized successfully');
    
    // Validar se os cálculos avançados estão funcionando
    const performanceStats = economyService.getPerformanceStats();
    const cardStats = cardService.getStats();
    console.log('📊 Economy Performance Stats:', performanceStats);
    console.log('🎯 Card Service Stats:', cardStats);
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Countries data loaded: ${Object.keys(countriesData).length} countries`);
      console.log(`EconomyService initialized: ${economyService.initialized ? 'Yes' : 'No'}`);
      console.log(`CardService initialized: ${cardService.initialized ? 'Yes' : 'No'}`);
      console.log(`Advanced calculations enabled: ${economyService.getPerformanceStats().isRunning ? 'Yes' : 'No'}`);
    });
  }).catch(error => {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  });
}).catch(error => {
  console.error('Failed to restore rooms from Redis:', error);
  process.exit(1);
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
            
            // Limpar dados econômicos da sala
            economyService.removeRoom(roomName);
            
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