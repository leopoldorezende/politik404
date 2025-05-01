import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  ships: [],
};

export const shipsState = createSlice({
  name: 'ships',
  initialState,
  reducers: {
    setShips: (state, action) => {
      state.ships = action.payload;
    },
    updateShipPosition: (state, action) => {
      const { id, coordinates } = action.payload;
      const shipIndex = state.ships.findIndex(ship => ship.id === id);
      if (shipIndex !== -1) {
        state.ships[shipIndex].coordinates = coordinates;
      }
    },
    addShip: (state, action) => {
      state.ships.push(action.payload);
    },
    removeShip: (state, action) => {
      state.ships = state.ships.filter(ship => ship.id !== action.payload);
    }
  },
});

export const { setShips, updateShipPosition, addShip, removeShip } = shipsState.actions;
export default shipsState.reducer;