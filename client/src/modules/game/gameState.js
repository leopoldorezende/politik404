import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  myCountry: null,
  players: [],
  onlinePlayers: [],
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
      
      // Extract online player names
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
      
      // Atualizar lista de jogadores online
      if (isOnline && !state.onlinePlayers.includes(username)) {
        state.onlinePlayers.push(username);
      } else if (!isOnline) {
        state.onlinePlayers = state.onlinePlayers.filter(name => name !== username);
      }
      
      // Atualizar status do jogador na lista de players
      state.players = state.players.map(player => {
        if (typeof player === 'object' && player.username === username) {
          return { ...player, isOnline };
        }
        return player;
      });
    },
    setCountriesData: (state, action) => {
      state.countriesData = action.payload;
    },
    updateCountryData: (state, action) => {
      const { countryCode, data } = action.payload;
      if (state.countriesData && state.countriesData[countryCode]) {
        state.countriesData[countryCode] = {
          ...state.countriesData[countryCode],
          ...data
        };
      }
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
  updateCountryData,
  setCountriesCoordinates,
  setSelectedCountry,
} = gameState.actions;

export default gameState.reducer;