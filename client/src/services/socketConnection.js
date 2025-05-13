import { io } from 'socket.io-client';

// Configurações
const MAX_RECONNECT_ATTEMPTS = 5;

// Singleton do socket
let socketInstance = null;
let reconnectAttempts = 0;
let isJoiningRoom = false;

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
  // Evitar múltiplas conexões
  if (socketInstance && socketInstance.connected) {
    console.log('Reutilizando conexão de socket existente:', socketInstance.id);
    return socketInstance;
  }
  
  // Se há uma instância desconectada, desconecte explicitamente
  if (socketInstance) {
    console.log('Desconectando instância de socket anterior');
    socketInstance.disconnect();
    socketInstance = null;
  }
  
  // Obter a URL do socket do ambiente ou usar a origem da página
  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  console.log('Conectando ao servidor socket:', socketUrl);
  
  // Opções de conexão
  const sessionId = getSessionId();
  const connectionOptions = {
    withCredentials: true,
    transports: ['websocket'], // Usar polling primeiro para melhor compatibilidade
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
    socketInstance.disconnect();
    socketInstance = null;
  }
};