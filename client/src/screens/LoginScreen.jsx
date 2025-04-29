import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { login } from '../store/slices/authSlice';
import '../assets/styles/LoginScreen.css';

const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const dispatch = useDispatch();

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      dispatch(login(username));
      dispatch({ type: 'socket/connect' });
      dispatch({ type: 'socket/authenticate', payload: username });
    } else {
      alert('Por favor, digite um nome!');
    }
  };

  return (
    <div id="login-screen">
      <h2>Teste1198</h2>
      <h4>Digite seu nome</h4>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Seu nome"
        />
        <button type="submit" id="enterButton">
          Entrar
        </button>
      </form>
    </div>
  );
};

export default LoginScreen;