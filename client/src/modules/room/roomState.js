import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  rooms: [],
  currentRoom: null,
};

export const roomState = createSlice({
  name: 'rooms',
  initialState,
  reducers: {
    setRooms: (state, action) => {
      state.rooms = action.payload;
    },
    setCurrentRoom: (state, action) => {
      state.currentRoom = action.payload;
    },
    leaveRoom: (state) => {
      state.currentRoom = null;
    },
  },
});

export const { setRooms, setCurrentRoom, leaveRoom } = roomState.actions;
export default roomState.reducer;