import { io } from 'socket.io-client';

// Configurações
const MAX_RECONNECT_ATTEMPTS = 5;

// Singleton do socket
let socketInstance = null;
let reconnectAttempts = 0;
let isJoiningRoom = false;
let isConnecting = false; // Flag para evitar múltiplas conexões simultâneas

// ID de sessão único para este cliente
const getSessionId = () => {
  if (!localStorage.getItem('clientSessionId')) {
    const sessionId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('clientSessionId', sessionId);
  }
  return localStorage.getItem('clientSessionId');
};

// Inicializa a conexão do socket
export const initializeSocket = () => {
  // Evitar múltiplas conexões simultâneas
  if (isConnecting) {
    console.log('Socket já está conectando, aguardando...');
    return socketInstance;
  }
  
  // Se já existe e está conectado, reutilizar
  if (socketInstance && socketInstance.connected) {
    console.log('Reutilizando conexão de socket existente:', socketInstance.id);
    return socketInstance;
  }
  
  isConnecting = true;
  
  // Se há uma instância desconectada, desconecte explicitamente (mas apenas se não estiver conectada)
  if (socketInstance && !socketInstance.connected) {
    console.log('Limpando instância de socket anterior');
    socketInstance.removeAllListeners(); // Remove listeners antes de desconectar
    socketInstance.disconnect();
    socketInstance = null;
  }
  
  // Obter a URL do socket do ambiente ou usar a origem da página
  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  console.log('Criando nova conexão socket:', socketUrl);
  
  // Opções de conexão
  const sessionId = getSessionId();
  const connectionOptions = {
    withCredentials: true,
    transports: ['polling', 'websocket'], // Primeira tentativa com polling para melhor compatibilidade
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    query: {
      clientSessionId: sessionId
    }
  };
  
  // Criar a conexão
  const socket = io(socketUrl, connectionOptions);
  socketInstance = socket;
  
  // Reset flag quando conectar ou falhar
  socket.on('connect', () => {
    isConnecting = false;
    reconnectAttempts = 0;
  });
  
  socket.on('connect_error', () => {
    isConnecting = false;
  });
  
  socket.on('disconnect', () => {
    isConnecting = false;
  });
  
  return socket;
};

// Getters e setters para variáveis de controle
export const getSocketInstance = () => socketInstance;
export const setSocketInstance = (instance) => { socketInstance = instance; };

export const getReconnectAttempts = () => reconnectAttempts;
export const setReconnectAttempts = (attempts) => { reconnectAttempts = attempts; };
export const incrementReconnectAttempts = () => { reconnectAttempts++; };

export const getIsJoiningRoom = () => isJoiningRoom;
export const setIsJoiningRoom = (value) => { isJoiningRoom = value; };

export const getMaxReconnectAttempts = () => MAX_RECONNECT_ATTEMPTS;

// Função para forçar desconexão
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.removeAllListeners(); // Remove listeners antes
    socketInstance.disconnect();
    socketInstance = null;
  }
  isConnecting = false;
};