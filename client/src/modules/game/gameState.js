import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  myCountry: null,
  players: [],
  onlinePlayers: [], // Lista de jogadores online
  countriesData: null,
  countriesCoordinates: null,
  selectedCountry: null,
  economyUpdates: {}, // Para armazenar o histórico de atualizações econômicas
  latestEconomyUpdate: null, // Última atualização recebida
  economicEvents: [], // Eventos econômicos especiais
  economyConfig: null, // Configurações do sistema econômico
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
    // Novos reducers para o sistema econômico
    updateEconomyData: (state, action) => {
      // action.payload contém { room, timestamp, countries, isBackgroundUpdate }
      const update = action.payload;
      
      // Se for uma atualização em segundo plano, não redefinimos o país selecionado
      const isBackgroundUpdate = update.isBackgroundUpdate === true;
      
      // Armazena a atualização mais recente
      state.latestEconomyUpdate = update;
      
      // Armazena a atualização no histórico identificado pela sala
      if (!state.economyUpdates[update.room]) {
        state.economyUpdates[update.room] = [];
      }
      
      // Limita o histórico a 10 atualizações por sala
      if (state.economyUpdates[update.room].length >= 10) {
        state.economyUpdates[update.room].shift();
      }
      
      state.economyUpdates[update.room].push(update);
      
      // Atualiza os dados econômicos de cada país
      if (state.countriesData && update.countries && typeof update.countries === 'object') {
        Object.entries(update.countries).forEach(([country, economyData]) => {
          if (state.countriesData[country] && state.countriesData[country].economy) {
            // Atualiza cada propriedade individual
            Object.entries(economyData).forEach(([key, value]) => {
              if (key === 'gdp' || key === 'treasury' || key === 'publicDebt') {
                // Para objetos aninhados como PIB, tesouro e dívida pública
                if (state.countriesData[country].economy[key]) {
                  state.countriesData[country].economy[key].value = value.value;
                }
              } else {
                // Para valores simples como inflação, desemprego, etc.
                state.countriesData[country].economy[key] = value;
              }
            });
          }
        });
      }
    },
    addEconomicEvent: (state, action) => {
      // action.payload contém { room, country, event, currentEconomy }
      const eventData = action.payload;
      
      // Adiciona o evento à lista, limitando a 20 eventos
      if (state.economicEvents.length >= 20) {
        state.economicEvents.shift();
      }
      
      state.economicEvents.push(eventData);
      
      // Atualiza os dados econômicos do país afetado
      if (state.countriesData && state.countriesData[eventData.country]) {
        const economyData = eventData.currentEconomy;
        
        Object.entries(economyData).forEach(([key, value]) => {
          if (key === 'gdp' || key === 'treasury' || key === 'publicDebt') {
            // Para objetos aninhados
            if (state.countriesData[eventData.country].economy[key]) {
              state.countriesData[eventData.country].economy[key].value = value.value;
            }
          } else {
            // Para valores simples
            state.countriesData[eventData.country].economy[key] = value;
          }
        });
      }
    },
    setEconomyConfig: (state, action) => {
      // Armazena as configurações do sistema econômico
      state.economyConfig = action.payload;
    },
    applyPolicyChange: (state, action) => {
      // action.payload contém { room, country, type, oldValue, newValue, effects }
      const policyChange = action.payload;
      
      // Atualiza os dados econômicos do país com base na mudança de política
      if (state.countriesData && state.countriesData[policyChange.country]) {
        const economy = state.countriesData[policyChange.country].economy;
        
        // Atualiza o valor da política alterada
        economy[policyChange.type] = policyChange.newValue;
        
        // Aplica os efeitos da política nos outros indicadores econômicos
        if (policyChange.effects) {
          Object.entries(policyChange.effects).forEach(([key, value]) => {
            if (key === 'treasury' || key === 'publicDebt') {
              // Para objetos aninhados
              if (economy[key] && typeof economy[key] === 'object') {
                economy[key].value = value.value;
              }
            } else {
              // Para valores simples
              economy[key] = value;
            }
          });
        }
        
        // Se houver um custo, deduz do tesouro
        if (policyChange.cost && economy.treasury && typeof economy.treasury === 'object') {
          economy.treasury.value = Math.max(0, economy.treasury.value - policyChange.cost);
        }
      }
    },
    resetEconomyState: (state) => {
      // Reseta todo o estado econômico
      state.economyUpdates = {};
      state.latestEconomyUpdate = null;
      state.economicEvents = [];
      state.economyConfig = null;
    }
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
  updateEconomyData,
  addEconomicEvent,
  setEconomyConfig,
  applyPolicyChange,
  resetEconomyState
} = gameState.actions;

export default gameState.reducer;