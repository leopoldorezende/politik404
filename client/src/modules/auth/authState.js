/**
 * Authentication state management
 * Centralizes all authentication logic and maintains consistent state
 * between Redux and browser storage
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
// Remove the direct socketApi import to avoid circular dependency
// import socketApi from '../network/socketService';

// Constants
const AUTH_STORAGE_KEY = 'politik404_auth';

// Helper function to safely parse JSON
const safeParseJSON = (json, defaultValue = null) => {
  try {
    return json ? JSON.parse(json) : defaultValue;
  } catch (e) {
    console.error('Failed to parse auth data from storage:', e);
    return defaultValue;
  }
};

// Helper to get stored auth data
const getStoredAuth = () => {
  const storedData = localStorage.getItem(AUTH_STORAGE_KEY);
  return safeParseJSON(storedData, { username: null, isAuthenticated: false });
};

// Helper to set stored auth data
const setStoredAuth = (authData) => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
  } catch (e) {
    console.error('Failed to store auth data:', e);
  }
};

// Helper to clear stored auth data
const clearStoredAuth = () => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear auth data:', e);
  }
};

// Initial state with hydration from storage
const storedAuth = getStoredAuth();
const initialState = {
  isAuthenticated: storedAuth.isAuthenticated,
  username: storedAuth.username,
  loading: false,
  error: null,
  lastLogin: storedAuth.lastLogin || null
};

// Async thunks for authentication operations
export const loginWithCredentials = createAsyncThunk(
  'auth/loginWithCredentials',
  async (username, { rejectWithValue }) => {
    try {
      if (!username || typeof username !== 'string' || username.trim() === '') {
        return rejectWithValue('Username is required');
      }
      
      // Note: The actual socket authentication will be handled by the middleware
      return { username };
    } catch (error) {
      return rejectWithValue(error.message || 'Authentication failed');
    }
  }
);

export const loginWithGoogleAsync = createAsyncThunk(
  'auth/loginWithGoogle',
  async (_, { rejectWithValue }) => {
    try {
      // Import dynamically to avoid circular dependency
      const { loginWithGoogle } = await import('./firebaseClient');
      
      // Login with Firebase Google auth
      const result = await loginWithGoogle();
      const token = await result.user.getIdToken();
      
      // Authenticate with backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/auth/google`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server authentication failed: ${response.status}`);
      }
      
      const userData = await response.json();
      const username = userData.email;
      
      // Note: The actual socket authentication will be handled by the middleware
      return { username };
    } catch (error) {
      return rejectWithValue(error.message || 'Google authentication failed');
    }
  }
);

export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    // Clear local authentication data
    clearStoredAuth();
    
    return null;
  }
);

// Auth slice
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action) => {
      state.isAuthenticated = true;
      state.username = action.payload;
      state.lastLogin = Date.now();
      
      // Update local storage to maintain consistency
      setStoredAuth({
        isAuthenticated: true,
        username: action.payload,
        lastLogin: state.lastLogin
      });
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.username = null;
      state.lastLogin = null;
      
      // Clear local storage
      clearStoredAuth();
    },
    clearAuthError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Handle credential login
    builder
      .addCase(loginWithCredentials.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithCredentials.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.username = action.payload.username;
        state.loading = false;
        state.lastLogin = Date.now();
        
        // Update local storage
        setStoredAuth({
          isAuthenticated: true,
          username: action.payload.username,
          lastLogin: state.lastLogin
        });
      })
      .addCase(loginWithCredentials.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Authentication failed';
      })
      
      // Handle Google login
      .addCase(loginWithGoogleAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithGoogleAsync.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.username = action.payload.username;
        state.loading = false;
        state.lastLogin = Date.now();
        
        // Update local storage
        setStoredAuth({
          isAuthenticated: true,
          username: action.payload.username,
          lastLogin: state.lastLogin
        });
      })
      .addCase(loginWithGoogleAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Google authentication failed';
      })
      
      // Handle logout
      .addCase(logoutAsync.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.username = null;
        state.lastLogin = null;
      });
  }
});

// Selectors
export const selectAuth = (state) => state.auth;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUsername = (state) => state.auth.username;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;

// Export actions and reducer
export const { login, logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;