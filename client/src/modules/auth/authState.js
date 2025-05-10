/**
 * Authentication state management
 * Centralizes all authentication logic and maintains consistent state
 * between Redux and browser storage
 */
import { createSlice } from '@reduxjs/toolkit';

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