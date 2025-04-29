import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  publicMessages: [],
  privateMessages: {}, // Armazenará mensagens privadas por usuário
  currentChatMode: 'public', // 'public' ou nome de um usuário para chat privado
  currentPrivateRecipient: null, // Usuário selecionado para chat privado
  unreadCount: {
    public: 0,
    private: {}  // Mapeia usuários para contagens de mensagens não lidas
  },
  lastReadTimestamps: {
    public: Date.now(),
    private: {}  // Mapeia usuários para o timestamp da última mensagem lida
  }
};

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action) => {
      const message = action.payload;
      const currentTimestamp = Date.now();
      
      if (message.isPrivate) {
        // Extract username from the message sender (without country prefix)
        let senderUsername = '';
        if (typeof message.sender === 'string') {
          const senderMatch = message.sender.match(/.*? - (.*)/);
          senderUsername = senderMatch ? senderMatch[1] : message.sender;
        }
        
        // Extract username from recipient if present
        let recipientUsername = message.recipient;
        
        // Determine the chat partner for organizing messages
        // This could be either the sender or recipient, depending on who you are
        const currentUsername = sessionStorage.getItem('username');
        let chatPartner;
        
        if (senderUsername === currentUsername) {
          // If I'm the sender, organize by recipient
          chatPartner = recipientUsername;
          // My own messages are always "read"
          if (!state.lastReadTimestamps.private[chatPartner]) {
            state.lastReadTimestamps.private[chatPartner] = currentTimestamp;
          }
        } else {
          // If I'm the recipient, organize by sender
          chatPartner = senderUsername;
          
          // Initialize unread count for this partner if it doesn't exist
          if (!state.unreadCount.private[chatPartner]) {
            state.unreadCount.private[chatPartner] = 0;
          }
          
          // Increment unread count if we're not currently viewing this chat
          if (state.currentChatMode !== chatPartner) {
            state.unreadCount.private[chatPartner]++;
          } else {
            // We're viewing this chat, so update the last read timestamp
            state.lastReadTimestamps.private[chatPartner] = currentTimestamp;
          }
        }
        
        // Initialize array for this chat partner if it doesn't exist
        if (!state.privateMessages[chatPartner]) {
          state.privateMessages[chatPartner] = [];
        }
        
        // Add message to the appropriate conversation
        state.privateMessages[chatPartner].push(message);
      } else {
        // Public message
        state.publicMessages.push(message);
        
        // If we're not in public chat mode, increment unread count
        if (state.currentChatMode !== 'public') {
          state.unreadCount.public++;
        } else {
          // We're viewing public chat, so update last read timestamp
          state.lastReadTimestamps.public = currentTimestamp;
        }
      }
    },
    setChatMode: (state, action) => {
      const previousMode = state.currentChatMode;
      const newMode = action.payload;
      
      // Update the mode
      state.currentChatMode = newMode;
      
      // Set current private recipient if applicable
      if (newMode !== 'public') {
        state.currentPrivateRecipient = newMode;
        
        // Reset unread count for this user
        if (state.unreadCount.private[newMode]) {
          state.unreadCount.private[newMode] = 0;
        }
        
        // Update last read timestamp
        state.lastReadTimestamps.private[newMode] = Date.now();
      } else {
        state.currentPrivateRecipient = null;
        
        // Reset public unread count
        state.unreadCount.public = 0;
        
        // Update last read timestamp
        state.lastReadTimestamps.public = Date.now();
      }
    },
    setPrivateRecipient: (state, action) => {
      state.currentPrivateRecipient = action.payload;
      if (action.payload) {
        state.currentChatMode = action.payload; // Alterna para o modo privado
        
        // Reset unread count for this user
        if (state.unreadCount.private[action.payload]) {
          state.unreadCount.private[action.payload] = 0;
        }
        
        // Update last read timestamp
        state.lastReadTimestamps.private[action.payload] = Date.now();
      }
    },
    setChatHistory: (state, action) => {
      const { type, target, messages } = action.payload;
      const currentTimestamp = Date.now();
      
      if (type === 'public') {
        state.publicMessages = messages;
        
        // Reset unread count if we're in public chat mode
        if (state.currentChatMode === 'public') {
          state.unreadCount.public = 0;
          state.lastReadTimestamps.public = currentTimestamp;
        } else {
          // Otherwise, count messages newer than last read timestamp
          const lastRead = state.lastReadTimestamps.public || 0;
          state.unreadCount.public = messages.filter(msg => 
            msg.timestamp > lastRead
          ).length;
        }
      } else if (type === 'private' && target) {
        state.privateMessages[target] = messages;
        
        // Initialize last read timestamp if it doesn't exist
        if (!state.lastReadTimestamps.private[target]) {
          state.lastReadTimestamps.private[target] = 0;
        }
        
        // Reset unread count if we're in this private chat mode
        if (state.currentChatMode === target) {
          state.unreadCount.private[target] = 0;
          state.lastReadTimestamps.private[target] = currentTimestamp;
        } else {
          // Otherwise, count messages newer than last read timestamp
          const lastRead = state.lastReadTimestamps.private[target] || 0;
          state.unreadCount.private[target] = messages.filter(msg => {
            // Extract username from the message sender (without country prefix)
            let senderUsername = '';
            if (typeof msg.sender === 'string') {
              const senderMatch = msg.sender.match(/.*? - (.*)/);
              senderUsername = senderMatch ? senderMatch[1] : msg.sender;
            }
            
            // Only count messages from the other person that are newer than last read
            return senderUsername === target && msg.timestamp > lastRead;
          }).length;
        }
      }
    },
    markAsRead: (state, action) => {
      const { chatType, target } = action.payload;
      const currentTimestamp = Date.now();
      
      if (chatType === 'public') {
        state.unreadCount.public = 0;
        state.lastReadTimestamps.public = currentTimestamp;
      } else if (chatType === 'private' && target) {
        if (state.unreadCount.private[target]) {
          state.unreadCount.private[target] = 0;
        }
        state.lastReadTimestamps.private[target] = currentTimestamp;
      }
    },
    clearChat: (state) => {
      state.publicMessages = [];
      state.privateMessages = {};
      state.currentChatMode = 'public';
      state.currentPrivateRecipient = null;
      state.unreadCount = {
        public: 0,
        private: {}
      };
      state.lastReadTimestamps = {
        public: Date.now(),
        private: {}
      };
    },
  },
});

export const { 
  addMessage, 
  setChatMode, 
  setPrivateRecipient, 
  setChatHistory, 
  markAsRead,
  clearChat 
} = chatSlice.actions;

export default chatSlice.reducer;