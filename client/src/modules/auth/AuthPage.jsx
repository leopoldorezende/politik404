import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { login } from './authState';
import { loginWithGoogle } from './firebaseClient';
import { socketApi, SOCKET_EVENTS } from '../../services/socketClient';
import './AuthPage.css';

const AuthPage = () => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Função para autenticar o usuário
  const authenticateUser = (username) => {
    console.log('Autenticando usuário:', username);
    
    // Primeiro, atualize o Redux state
    dispatch(login(username));
    
    // MODIFICAR: Verificar se o socket existe e está conectado antes de autenticar
    const socket = socketApi.getSocketInstance();
    if (socket && socket.connected) {
      // Se já estiver conectado, autenticar imediatamente
      socketApi.authenticate(username);
    } else {
      // Se não estiver conectado, conectar primeiro
      socketApi.connect();
      
      // Aguardar a conexão antes de autenticar
      setTimeout(() => {
        socketApi.authenticate(username);
      }, 1000);
    }
    
    // Também solicite a lista de salas após a autenticação
    setTimeout(() => {
      socketApi.getRooms();
    }, 1500);
  };

  // Ao montar o componente, verificar se existe uma sessão salva
  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username');
    if (storedUsername) {
      console.log('Sessão existente encontrada para:', storedUsername);
      setIsLoading(true);
      
      // MODIFICAR: Verificar se não foi feito recentemente
      const lastAutoAuth = sessionStorage.getItem('lastAutoAuth');
      const now = Date.now();
      
      if (!lastAutoAuth || (now - parseInt(lastAutoAuth)) > 5000) {
        sessionStorage.setItem('lastAutoAuth', now.toString());
        authenticateUser(storedUsername);
      } else {
        setIsLoading(false);
      }
      
      // Definir um timeout para finalizar o carregamento mesmo se algo falhar
      setTimeout(() => {
        setIsLoading(false);
      }, 3000);
    }
  }, [dispatch]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await loginWithGoogle();
      const token = await result.user.getIdToken();

      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/auth/google`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Falha ao autenticar com o servidor');

      const user = await res.json();
      const username = user.email;
      
      // Salvar o username no sessionStorage para persistência
      sessionStorage.setItem('username', username);
      
      // Autenticar o usuário
      authenticateUser(username);
      
      // Definir um timeout para finalizar o carregamento mesmo se algo falhar
      setTimeout(() => {
        setIsLoading(false);
      }, 3000);
      
    } catch (err) {
      console.error('Erro no login com Google:', err);
      setError('Erro no login com Google. Tente novamente.');
      setIsLoading(false);
    }
  };

  return (
    <div id="login-screen">
      <h2>Politik404</h2>
      {error && <div className="error-message">{error}</div>}
      <div>
        <button 
          onClick={handleGoogleLogin} 
          disabled={isLoading}
        >
          {isLoading ? 'Processando...' : 'Entrar com Google'}
        </button>
      </div>
    </div>
  );
};

export default AuthPage;