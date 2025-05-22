import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addMessage, setChatMode, markAsRead } from './chatState';
import { socketApi } from '../../services/socketClient';
import './ChatPanel.css';

const ChatPanel = ({ hasUnreadMessagesFrom }) => {
  const [message, setMessage] = useState('');
  const messagesRef = useRef(null);
  const dispatch = useDispatch();
  
  const username = useSelector(state => state.auth.username);
  const publicMessages = useSelector(state => state.chat.publicMessages);
  const privateMessages = useSelector(state => state.chat.privateMessages);
  const currentChatMode = useSelector(state => state.chat.currentChatMode);
  const players = useSelector(state => state.game.players);
  const unreadCount = useSelector(state => state.chat.unreadCount);
  
  // Determina quais mensagens mostrar com base no modo atual
  const displayMessages = currentChatMode === 'public' 
    ? publicMessages 
    : (privateMessages[currentChatMode] || []);
  
  // Scroll to bottom of messages when new messages are added
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [displayMessages]);

  useEffect(() => {
    const chatInput = document.getElementById('chat-input');
    
    if (chatInput) {
      const handleFocus = () => {
        // Adiciona uma classe ao body para indicar que o chat está ativo
        document.body.classList.add('chat-input-focused');
      };
      
      const handleBlur = () => {
        // Remove a classe após um delay para evitar fechamento acidental
        setTimeout(() => {
          document.body.classList.remove('chat-input-focused');
        }, 300);
      };
      
      chatInput.addEventListener('focus', handleFocus);
      chatInput.addEventListener('blur', handleBlur);
      
      return () => {
        chatInput.removeEventListener('focus', handleFocus);
        chatInput.removeEventListener('blur', handleBlur);
        document.body.classList.remove('chat-input-focused');
      };
    }
  }, []);

  // Mark messages as read when chat mode changes
  useEffect(() => {
    if (currentChatMode === 'public') {
      dispatch(markAsRead({ chatType: 'public' }));
    } else {
      dispatch(markAsRead({ chatType: 'private', target: currentChatMode }));
    }
  }, [currentChatMode, dispatch]);
  
  const handleSendMessage = () => {
    if (message.trim()) {
      // Enviar mensagem usando o socketApi centralizado
      socketApi.sendMessage(
        message, 
        currentChatMode !== 'public',
        currentChatMode !== 'public' ? currentChatMode : null
      );
      
      // Clear input field
      setMessage('');
    }
  };
  
  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Handle chat mode change (public/private)
  const handleChatModeChange = (mode) => {
    // Mark as read when switching to a new chat
    if (mode === 'public') {
      dispatch(markAsRead({ chatType: 'public' }));
    } else {
      dispatch(markAsRead({ chatType: 'private', target: mode }));
    }
    
    dispatch(setChatMode(mode));
    
    // If switching to private chat and there's no history, request it
    if (mode !== 'public' && (!privateMessages[mode] || privateMessages[mode].length === 0)) {
      socketApi.requestPrivateHistory(mode);
    }
  };

  // Extract player names from the players array
  const getPlayerNames = () => {
    if (!players) return [];
    
    return players
      .filter(player => {
        // Filter out current user
        if (typeof player === 'object') {
          return player.username !== username;
        }
        
        if (typeof player === 'string') {
          const match = player.match(/^(.*?)\s*\(/);
          return match && match[1] !== username;
        }
        
        return false;
      })
      .map(player => {
        // Extract player info
        if (typeof player === 'object') {
          return {
            username: player.username,
            isOnline: player.isOnline !== false // Default to true if not specified
          };
        }
        
        if (typeof player === 'string') {
          const match = player.match(/^(.*?)\s*\(/);
          return {
            username: match ? match[1] : player,
            isOnline: true // Default to true for string format
          };
        }
        
        return null;
      })
      .filter(Boolean); // Remove any null values
  };

  // Check if there are unread messages in public chat
  const hasUnreadPublicMessages = () => {
    return unreadCount.public > 0 && currentChatMode !== 'public';
  };

  return (
    <div className="chat-section">
      {/* <h4 id="you">Você: {username}</h4> */}
      <ul id="player-list">
        <li 
          className={`chat-option ${currentChatMode === 'public' ? 'active' : ''}`}
          onClick={() => handleChatModeChange('public')}
        >
          Público
          {hasUnreadPublicMessages() && (
            <span className="player-message-badge" title="Novas mensagens públicas">•</span>
          )}
        </li>
        {getPlayerNames().map((player, index) => (
          <li 
            key={index} 
            className={`chat-option ${currentChatMode === player.username ? 'active' : ''}`}
            onClick={() => handleChatModeChange(player.username)}
          >
            {player.username} {!player.isOnline && <span className="offline-status">(offline)</span>}
            {/* Adiciona o badge apenas se houver mensagens não lidas deste jogador */}
            {hasUnreadMessagesFrom && hasUnreadMessagesFrom(player.username) && (
              <span className="player-message-badge" title="Nova mensagem privada">•</span>
            )}
          </li>
        ))}
      </ul>
      <div id="chat-container">
        {/* <div id="chat-header">
          {currentChatMode === 'public' ? 'Chat Público' : `Chat Privado com ${currentChatMode}`}
        </div> */}
        <div id="chat-messages" ref={messagesRef}>
          {displayMessages.map((msg, index) => {
            // Extrair o nome do usuário da mensagem (sem a parte do país)
            let msgSender = msg.sender;
            if (typeof msgSender === 'string') {
              const senderMatch = msgSender.match(/.*? - (.*)/);
              if (senderMatch) msgSender = senderMatch[1];
            }
            
            return (
              <div 
                key={index} 
                className={`message ${msgSender === username ? 'self' : 'other'} ${msg.isPrivate ? 'private' : ''}`}
              >
                <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''} {msg.isPrivate ? '(Privado)' : ''} {msg.sender}</span>
                {msg.content}
              </div>
            );
          })}
        </div>
        <div className="chat-sendgroup">
          <input 
            type="text" 
            id="chat-input" 
            placeholder={`Mensagem ${currentChatMode === 'public' ? 'pública' : `para ${currentChatMode}`}...`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button id="chat-send" onClick={handleSendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;