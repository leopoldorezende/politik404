import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux'
import { login } from '../modules/auth/authState'
import { loginWithGoogle } from '../modules/auth/firebaseClient'
import '../shared/styles/AuthPage.css';

const AuthPage = () => {
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authAttempt, setAuthAttempt] = useState(0);

  // Função para conectar e autenticar o socket
  const connectAndAuthenticate = (username) => {
    console.log('Conectando e autenticando socket para:', username);
    
    // Primeiramente, garantir que o Redux está atualizado
    dispatch(login(username));
    
    // 1. Conectar o socket
    dispatch({ type: 'socket/connect' });
    
    // 2. Autenticar o socket com o username (com delay para garantir conexão)
    setTimeout(() => {
      dispatch({ type: 'socket/authenticate', payload: username });
    
      // 3. Solicitar lista de salas após autenticação
      setTimeout(() => {
        dispatch({ type: 'socket/getRooms' });
      }, 500);
    }, 500);
  };

  // Ao montar o componente, verificar se existe uma sessão salva
  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username');
    if (storedUsername) {
      console.log('Sessão existente encontrada para:', storedUsername);
      setIsLoading(true);
      
      // Se existir um usuário no sessionStorage, fazer login automaticamente
      connectAndAuthenticate(storedUsername);
      
      // Definir um timeout para finalizar o carregamento mesmo se algo falhar
      setTimeout(() => {
        setIsLoading(false);
      }, 3000);
    }
  }, [dispatch]);

  // Efeito para tentar novamente se houver erro
  useEffect(() => {
    if (error && authAttempt < 3) {
      const username = sessionStorage.getItem('username');
      if (username) {
        const retryTimer = setTimeout(() => {
          console.log(`Tentativa ${authAttempt + 1} de reconexão para:`, username);
          setAuthAttempt(prev => prev + 1);
          setError(null);
          connectAndAuthenticate(username);
        }, 2000);
        
        return () => clearTimeout(retryTimer);
      }
    }
  }, [error, authAttempt, dispatch]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await loginWithGoogle()
      const token = await result.user.getIdToken()

      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/auth/google`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!res.ok) throw new Error('Falha ao autenticar com o servidor')

      const user = await res.json()
      const username = user.email;
      
      // Salvar o username no sessionStorage para persistência
      sessionStorage.setItem('username', username);
      
      // Conectar e autenticar
      connectAndAuthenticate(username);
      
      // Definir um timeout para finalizar o carregamento mesmo se algo falhar
      setTimeout(() => {
        setIsLoading(false);
      }, 3000);
      
    } catch (err) {
      console.error('Erro no login com Google:', err);
      setError('Erro no login com Google. Tente novamente.');
      setIsLoading(false);
    }
  }

  return (
    <div id="login-screen">
      <h2>Politik404</h2>
      {error && <div className="error-message">{error}</div>}
      {authAttempt > 0 && (
        <div className="retry-message">
          Tentando reconectar ({authAttempt}/3)...
        </div>
      )}
      <div>
        <button 
          onClick={handleGoogleLogin} 
          disabled={isLoading}
        >
          {isLoading ? 'Processando...' : 'Entrar com Google'}
        </button>
      </div>
    </div>
  )
}

export default AuthPage