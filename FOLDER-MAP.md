# FOLDER-MAP.md

  /Politik404
  ├── FOLDER-MAP.md
  ├── README.md  # Documentação do front-end
  ├── client
  │   ├── index.html  # HTML principal
  │   ├── package.json  # Dependências e scripts principais (monorepo)
  │   ├── public
  │   │   └── vite2.svg
  │   ├── src
  │   │   ├── App.css
  │   │   ├── App.jsx  # Componente raiz
  │   │   ├── main.jsx  # Entry point (Vite)
  │   │   ├── modules
  │   │   │   ├── auth
  │   │   │   │   ├── AuthPage.css
  │   │   │   │   ├── AuthPage.jsx  # Tela de autenticação/login
  │   │   │   │   ├── authState.js  # Estado de autenticação
  │   │   │   │   └── firebaseClient.js
  │   │   │   ├── chat
  │   │   │   │   ├── ChatPanel.css
  │   │   │   │   ├── ChatPanel.jsx  # Componente de chat
  │   │   │   │   └── chatState.js  # Estado do chat
  │   │   │   ├── country
  │   │   │   │   ├── CountryDetails.css
  │   │   │   │   ├── CountryDetails.jsx  # Componente de detalhes
  │   │   │   │   ├── CountryState.css
  │   │   │   │   ├── CountryState.jsx
  │   │   │   │   ├── countryService.jsx
  │   │   │   │   └── countryStateSlice.js
  │   │   │   ├── defense
  │   │   │   │   ├── DefensePanel.jsx  # Componente Painel Militar
  │   │   │   │   ├── defensePanel.css
  │   │   │   │   └── defenseState.js  # Estado militar
  │   │   │   ├── economy
  │   │   │   │   ├── EconomyPanel.css
  │   │   │   │   ├── EconomyPanel.jsx  # Componente Painel de Economia
  │   │   │   │   └── economyState.js  # Estado de economia
  │   │   │   ├── game
  │   │   │   │   ├── GamePage.css
  │   │   │   │   ├── GamePage.jsx  # Tela principal do jogo
  │   │   │   │   └── gameState.js  # Estado do jogo
  │   │   │   ├── map
  │   │   │   │   ├── Chokepoints.jsx
  │   │   │   │   ├── MapView.css
  │   │   │   │   └── MapView.jsx  # Mapa principal
  │   │   │   ├── politics
  │   │   │   │   ├── PoliticsPanel.css
  │   │   │   │   ├── PoliticsPanel.jsx  # Componente Painel de Política
  │   │   │   │   └── politicsState.js  # Estado político
  │   │   │   ├── room
  │   │   │   │   ├── RoomPage.css
  │   │   │   │   ├── RoomPage.jsx  # Tela de seleção de sala
  │   │   │   │   └── roomState.js  # Estado das salas
  │   │   │   ├── sidetools
  │   │   │   │   ├── Sidetools.css
  │   │   │   │   └── Sidetools.jsx  # Layout da sidebar esquerda Sidetools
  │   │   │   ├── sideview
  │   │   │   │   ├── Sideview.css
  │   │   │   │   └── Sideview.jsx  # Layout da sidebar direita Sideview
  │   │   │   └── trade
  │   │   │       ├── TradePanel.css
  │   │   │       ├── TradePanel.jsx  # Componente Painel de Comercio
  │   │   │       └── tradeState.js  # Estado do comércio
  │   │   ├── services
  │   │   │   ├── socketClient.js
  │   │   │   ├── socketConnection.js
  │   │   │   └── socketEventHandlers.js
  │   │   └── store
  │   │       ├── index.js  # Criação e combinação dos reducers
  │   │       └── socketReduxMiddleware.js
  │   └── vite.config.js  # Configuração do Vite
  ├── eslint.config.js  # Configuração do lint para os dois ambientes client e server
  ├── package.json  # Dependências e scripts principais (monorepo)
  └── server
      ├── keys
      │   └── firebase-admin.json
      ├── middlewares
      │   └── socketServerMiddleware.js
      ├── modules
      │   ├── auth
      │   │   ├── authHandlers.js  # Handlers de autenticação
      │   │   └── google.js
      │   ├── chat
      │   │   └── chatHandlers.js  # Handlers do chat
      │   ├── country
      │   │   ├── countryAssignment.js  # Atribuições de países
      │   │   ├── countryStateHandlers.js
      │   │   └── countryUtils.js  # Utilitários para países
      │   ├── economy
      │   │   ├── economyCalculations.js
      │   │   └── economyHandlers.js
      │   ├── index.js  # Criação e combinação dos reducers
      │   ├── player
      │   │   ├── playerHandlers.js  # Handlers para jogadores
      │   │   ├── playerRoomHandlers.js  # Handlers para jogadores na sala
      │   │   ├── playerStateManager.js  # Gerencia estado dos jogadores
      │   │   └── playerUtils.js  # Funções utilitárias
      │   └── room
      │       ├── roomExpirationManager.js
      │       ├── roomManagement.js  # Gerenciamento de sala
      │       └── roomNotifications.js  # Notificações da Sala
      ├── package.json  # Dependências e scripts principais (monorepo)
      ├── public
      │   └── data
      │       ├── countriesCoordinates.json
      │       └── countriesData.json
      ├── server.js  # Entry point do servidor
      └── shared
          ├── countryStateManager.js
          ├── firebaseAdmin.js
          ├── gameStateUtils.js  # Utilitários de estado para o jogo
          └── redisClient.js  # Infraestrutura do Redis
