const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Importa o inicializador de socket da pasta socket/index.js
const { initializeSocketHandlers } = require('./socket');

// Importa o sistema econômico
const { initializeEconomySystem } = require('./economy/economyManager');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Servir arquivos públicos estáticos do front-end
app.use(express.static(path.join(__dirname, '../public')));

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
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
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

// Estado global do jogo
const gameState = {
  rooms: new Map(),
  socketIdToUsername: new Map(),
  userToRoom: new Map(),
  userRoomCountries: new Map(),
  playerStates: new Map(),
  ships: new Map(),
  onlinePlayers: new Set(),
  countriesData: countriesData,
  MAX_CHAT_HISTORY: 100,
  createRoom: function(name, owner) {
    return {
      name,
      owner,
      players: [],
      eligibleCountries: [],
      chatHistory: { public: [], private: new Map() },
      createdAt: new Date().toISOString()
    };
  },
  getPrivateChatKey: function(user1, user2) {
    return [user1, user2].sort().join(':');
  }
};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Countries data loaded: ${Object.keys(countriesData).length} countries`);
  
  // Inicializar o sistema econômico após o servidor estar em execução
  initializeEconomySystem(io, gameState);
});