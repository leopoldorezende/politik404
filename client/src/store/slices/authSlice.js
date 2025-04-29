import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isAuthenticated: false,
  username: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action) => {
      state.isAuthenticated = true;
      state.username = action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.username = null;
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;