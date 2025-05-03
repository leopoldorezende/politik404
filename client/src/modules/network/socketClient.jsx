import { io } from 'socket.io-client';

console.log('[ENV] VITE_API_URL =', import.meta.env.VITE_API_URL);
console.log('[ENV] VITE_SOCKET_URL =', import.meta.env.VITE_SOCKET_URL);

let socket;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Gera um ID de sessão único para este cliente/navegador se não existir
const generateSessionId = () => {
  if (!window.localStorage.getItem('socketSessionId')) {
    const randomId = Math.random().toString(36).substring(2, 15);
    window.localStorage.setItem('socketSessionId', randomId);
  }
  return window.localStorage.getItem('socketSessionId');
};

// ID de sessão único para este cliente
const sessionId = generateSessionId();
console.log('ID de sessão do cliente:', sessionId);

// Lista de URLs de fallback para tentar em ordem
const getFallbackUrls = () => {
  const defaultUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  
  // Extrair hostname e tentar variações de portas/protocolos
  let hostname = '';
  try {
    const url = new URL(defaultUrl);
    hostname = url.hostname;
  } catch (e) {
    console.error('URL inválida:', defaultUrl);
    hostname = window.location.hostname;
  }

  // Lista com múltiplas portas/variações para tentar
  return [
    defaultUrl,
    `https://${hostname}:3000`,
    `http://${hostname}:3000`,
    `https://${hostname}`,
    `http://${hostname}`,
    window.location.origin
  ];
};

// Verifica se uma URL está acessível
const checkUrlAvailability = async (url) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // Tenta fazer uma solicitação simples para verificar se o servidor está respondendo
    const response = await fetch(`${url}/check-connection`, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    return false;
  }
};

// Função para encontrar URL disponível
const findAvailableUrl = async () => {
  const urls = getFallbackUrls();
  console.log('Testando URLs de fallback:', urls);
  
  for (const url of urls) {
    console.log(`Testando disponibilidade de: ${url}`);
    if (await checkUrlAvailability(url)) {
      console.log(`URL disponível: ${url}`);
      return url;
    }
  }
  
  console.warn('Nenhuma URL disponível. Usando URL padrão como último recurso.');
  return urls[0]; // Retorna a URL padrão como último recurso
};

export const initializeSocketConnection = async (dispatch) => {
  let baseUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  console.log(`🔌 Verificando conexão com: ${baseUrl}`);

  // Verificar se o socket já existe para evitar múltiplas conexões
  if (socket && socket.connected) {
    console.log('Socket já está conectado, reutilizando...', socket.id);
    return socket;
  }
  
  // Se o socket existe mas não está conectado, desconectar para criar um novo
  if (socket) {
    console.log('Desconectando socket antigo antes de criar novo');
    socket.disconnect();
  }

  // Tenta encontrar uma URL disponível (com 3 segundos de timeout)
  try {
    const availableUrl = await Promise.race([
      findAvailableUrl(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    
    if (availableUrl) {
      baseUrl = availableUrl;
      console.log(`Usando URL disponível: ${baseUrl}`);
    } else {
      console.warn('Nenhuma URL disponível. Usando URL padrão.');
    }
  } catch (error) {
    console.error('Erro ao verificar URLs disponíveis:', error);
    // Em caso de timeout ou erro, tente usar a URL padrão
    console.log(`Usando URL padrão: ${baseUrl}`);
  }

  // Configurando o socket com opções adequadas para reconexão
  // Incluindo o ID de sessão nos parâmetros de consulta
  console.log(`Tentando conectar ao socket em: ${baseUrl}`);
  
  try {
    socket = io(baseUrl, {
      withCredentials: true,
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      query: {
        clientSessionId: sessionId
      }
    });
  } catch (error) {
    console.error('Erro ao inicializar socket:', error);
    return null;
  }

  // Para facilitar o acesso global em situações de debug
  window.socket = socket;

  // Eventos principais do socket
  socket.on('connect', () => {
    console.log('✅ Socket conectado com sucesso', socket.id);
    reconnectAttempts = 0; // Resetar contador de tentativas
    
    // Autenticar automaticamente ao conectar
    const username = sessionStorage.getItem('username');
    if (username) {
      console.log('Autenticando socket automaticamente com:', username);
      // Incluir o ID de sessão na autenticação
      socket.emit('authenticate', username, { clientSessionId: sessionId });
      
      // Solicitar lista de salas após autenticação com um delay
      setTimeout(() => {
        socket.emit('getRooms');
      }, 500);
    }
  });

  // Configurar eventos de reconexão
  socket.io.on("reconnect_attempt", (attempt) => {
    console.log(`Tentativa de reconexão #${attempt}`);
    reconnectAttempts = attempt;
    
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(`Atingido máximo de ${MAX_RECONNECT_ATTEMPTS} tentativas de reconexão`);
    }
  });
  
  socket.io.on("reconnect", (attempt) => {
    console.log(`Reconectado após ${attempt} tentativas`);
    reconnectAttempts = 0;
    
    // Re-autenticar após reconexão
    const username = sessionStorage.getItem('username');
    if (username) {
      console.log('Re-autenticando após reconexão:', username);
      // Incluir o ID de sessão na re-autenticação
      socket.emit('authenticate', username, { clientSessionId: sessionId });
    }
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Erro de conexão com o socket:', err.message);
    
    // Incrementar contador de tentativas
    reconnectAttempts++;
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`❌ Falha após ${MAX_RECONNECT_ATTEMPTS} tentativas de conexão.`);
      
      // Tentar conectar com outra URL
      initializeSocketConnection(dispatch);
    }
  });

  socket.on('disconnect', (reason) => {
    console.warn('⚠️ Socket desconectado:', reason);
    
    // Tentar reconectar em caso de desconexão não intencional
    if (reason === 'io server disconnect' || reason === 'transport close') {
      console.log('Reconectando após desconexão inesperada...');
      setTimeout(() => {
        socket.connect();
      }, 1000);
    }
  });

  // Evento de desconexão forçada (normalmente quando outra sessão é iniciada)
  socket.on('forcedDisconnect', (data) => {
    console.warn('⚠️ Desconexão forçada:', data);
    
    // Só mostrar alerta se não for do mesmo navegador
    if (!data.sameBrowser && data.reason) {
      alert(`Você foi desconectado: ${data.reason}`);
    }
    
    // Se for para reconectar automaticamente
    if (data.reconnect) {
      setTimeout(() => {
        console.log('Tentando reconectar após desconexão forçada...');
        socket.connect();
        
        // Re-autenticar após reconexão
        const username = sessionStorage.getItem('username');
        if (username) {
          setTimeout(() => {
            console.log('Re-autenticando após desconexão forçada:', username);
            socket.emit('authenticate', username, { clientSessionId: sessionId });
          }, 500);
        }
      }, 2000);
    }
  });

  // Eventos de recebimento de dados
  socket.on('roomsList', (rooms) => {
    console.log('Recebida lista de salas:', rooms);
    dispatch({ type: 'rooms/setRooms', payload: rooms });
  });

  socket.on('roomJoined', (room) => {
    console.log('Sala acessada:', room);
    dispatch({ type: 'rooms/setCurrentRoom', payload: room });
  });

  socket.on('chatMessage', (message) => {
    dispatch({ type: 'chat/addMessage', payload: message });
  });

  // Autenticação bem-sucedida
  socket.on('authenticated', (data) => {
    console.log('Autenticação bem-sucedida:', data);
    
    // Solicitar lista de salas após autenticação
    socket.emit('getRooms');
  });

  // Lidar com erros do servidor sem mostrar um alert para o usuário
  // a menos que seja um erro crítico
  socket.on('error', (error) => {
    console.error('Erro recebido do servidor:', error);
    
    // Verificar se é um erro de autenticação
    if (error.includes('usuário já está em uso')) {
      console.warn('Conflito de nome de usuário. A sessão antiga será substituída.');
      // Não mostrar alerta para este erro específico para evitar spam
    } else if (error.includes('crítico') || error.includes('fatal')) {
      // Apenas mostrar alerta para erros críticos ou fatais
      alert(`Erro: ${error}`);
    }
  });

  return socket;
};

export const authenticate = (username) => {
  if (!username) {
    console.error('⚠️ Tentativa de autenticação sem username');
    return;
  }

  console.log('Autenticando com username:', username);
  
  // Salvar no sessionStorage
  sessionStorage.setItem('username', username);
  
  // Inicializar socket se não estiver conectado
  if (!socket || !socket.connected) {
    console.log('Socket não inicializado ou não conectado. Inicializando...');
    initializeSocketConnection((action) => {
      console.log('Dispatching action:', action);
    });
  }
  
  // Usar setTimeout para garantir que o socket esteja conectado antes de tentar autenticar
  setTimeout(() => {
    if (socket?.connected) {
      console.log('Emitindo evento authenticate com username:', username);
      // Incluir o ID de sessão na autenticação
      socket.emit('authenticate', username, { clientSessionId: sessionId });
    } else {
      console.warn('⚠️ Socket ainda não conectado. Tentando novamente em 1s...');
      
      // Tentar novamente após um segundo
      setTimeout(() => {
        if (socket?.connected) {
          socket.emit('authenticate', username, { clientSessionId: sessionId });
        } else {
          console.error('❌ Não foi possível conectar o socket para autenticação após múltiplas tentativas.');
          alert('Erro de conexão com o servidor. Por favor, tente novamente mais tarde.');
        }
      }, 1000);
    }
  }, 100);
};

export const joinRoom = (roomName) => {
  if (!roomName) {
    console.error('⚠️ Tentativa de entrar em sala sem nome');
    return;
  }

  console.log('Tentando entrar na sala:', roomName);
  
  // Inicializar socket se não estiver conectado
  if (!socket || !socket.connected) {
    console.log('Socket não inicializado ou não conectado. Inicializando...');
    initializeSocketConnection((action) => {
      console.log('Dispatching action:', action);
    });
    
    // Tentar entrar na sala após um delay para garantir conexão
    setTimeout(() => joinRoom(roomName), 1000);
    return;
  }
  
  socket.emit('joinRoom', roomName, { clientSessionId: sessionId });
};

export const sendChatMessage = (message) => {
  if (!message) {
    console.error('⚠️ Tentativa de enviar mensagem vazia');
    return;
  }
  
  // Inicializar socket se não estiver conectado
  if (!socket || !socket.connected) {
    console.log('Socket não inicializado ou não conectado. Inicializando...');
    initializeSocketConnection((action) => {
      console.log('Dispatching action:', action);
    });
    
    // Tentar enviar a mensagem após um delay para garantir conexão
    setTimeout(() => sendChatMessage(message), 1000);
    return;
  }
  
  console.log('Emitindo evento chatMessage:', message);
  // Adicionar o ID de sessão à mensagem
  message.clientSessionId = sessionId;
  socket.emit('chatMessage', message);
};

export default {
  initializeSocketConnection,
  authenticate,
  joinRoom,
  sendChatMessage
};