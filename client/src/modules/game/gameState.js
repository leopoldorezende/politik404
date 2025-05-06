import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  myCountry: null,
  players: [],
  onlinePlayers: [], // Lista de jogadores online
  countriesData: null,
  countriesCoordinates: null,
  selectedCountry: null,
};

export const gameState = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setMyCountry: (state, action) => {
      state.myCountry = action.payload;
    },
    setPlayers: (state, action) => {
      state.players = action.payload;
      const onlinePlayerNames = action.payload
        .filter(player => {
          if (typeof player === 'object') {
            return player.isOnline !== false;
          }
          return true;
        })
        .map(player => {
          if (typeof player === 'object') {
            return player.username;
          }
          if (typeof player === 'string') {
            const match = player.match(/^(.*?)\s*\(/);
            return match ? match[1] : player;
          }
          return '';
        })
        .filter(Boolean);
      state.onlinePlayers = onlinePlayerNames;
    },
    setOnlinePlayers: (state, action) => {
      state.onlinePlayers = action.payload;
      state.players = state.players.map(player => {
        if (typeof player !== 'object') {
          const match = player.match(/^(.*?)\s*\((.*)\)$/);
          if (match) {
            return {
              username: match[1],
              country: match[2],
              isOnline: player.isOnline !== false && state.onlinePlayers.includes(match[1])
            };
          }
          return player;
        }
        if (player.username) {
          return {
            ...player,
            isOnline: player.isOnline !== false && state.onlinePlayers.includes(player.username)
          };
        }
        return player;
      });
    },
    setPlayerOnlineStatus: (state, action) => {
      const { username, isOnline } = action.payload;
      if (isOnline) {
        if (!state.onlinePlayers.includes(username)) {
          state.onlinePlayers.push(username);
        }
      } else {
        state.onlinePlayers = state.onlinePlayers.filter(name => name !== username);
      }
      state.players = state.players.map(player => {
        if (typeof player !== 'object') {
          const match = player.match(/^(.*?)\s*\((.*)\)$/);
          if (match && match[1] === username) {
            return { username: match[1], country: match[2], isOnline };
          }
          return player;
        }
        if (player.username === username) {
          return { ...player, isOnline: player.isOnline !== false && isOnline };
        }
        return player;
      });
    },
    setCountriesData: (state, action) => {
      state.countriesData = action.payload;
    },
    setCountriesCoordinates: (state, action) => {
      state.countriesCoordinates = action.payload;
    },
    setSelectedCountry: (state, action) => {
      state.selectedCountry = action.payload;
    },
  },
});

export const {
  setMyCountry,
  setPlayers,
  setOnlinePlayers,
  setPlayerOnlineStatus,
  setCountriesData,
  setCountriesCoordinates,
  setSelectedCountry,
} = gameState.actions;

export default gameState.reducer;