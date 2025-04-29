import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  rooms: [],
  currentRoom: null,
};

export const roomsSlice = createSlice({
  name: 'rooms',
  initialState,
  reducers: {
    setRooms: (state, action) => {
      state.rooms = action.payload;
    },
    setCurrentRoom: (state, action) => {
      console.log('Setting current room:', action.payload);
      state.currentRoom = action.payload;
    },
    leaveRoom: (state) => {
      state.currentRoom = null;
    },
  },
});

export const { setRooms, setCurrentRoom, leaveRoom } = roomsSlice.actions;
export default roomsSlice.reducer;