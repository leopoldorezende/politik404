# FOLDER-MAP.md

  /Politik404
  ├── FOLDER-MAP.md
  ├── README.md  # Documentação do front-end
  ├── client
  │   ├── dist
  │   │   ├── assets
  │   │   │   ├── index-CzKhD5Fv.css
  │   │   │   └── index-D_hTw9CZ.js
  │   │   ├── ico.png
  │   │   ├── index.html  # HTML principal
  │   │   ├── logo.png
  │   │   └── vite2.svg
  │   ├── index.html  # HTML principal
  │   ├── package-lock.json
  │   ├── package.json  # Dependências e scripts principais (monorepo)
  │   ├── public
  │   │   ├── ico.png
  │   │   ├── logo.png
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
  │   │   │   │   └── countryService.jsx
  │   │   │   ├── economy
  │   │   │   │   ├── EconomyPanel.css
  │   │   │   │   ├── EconomyPanel.jsx  # Componente Painel de Economia
  │   │   │   │   └── economyState.js  # Estado de economia
  │   │   │   ├── game
  │   │   │   │   ├── GamePage.css
  │   │   │   │   ├── GamePage.jsx  # Tela principal do jogo
  │   │   │   │   └── gameState.js  # Estado do jogo
  │   │   │   ├── map
  │   │   │   │   ├── MapView.css
  │   │   │   │   ├── MapView.jsx  # Mapa principal
  │   │   │   │   ├── SeaRoutes.jsx  # Rotas marítimas
  │   │   │   │   └── mapboxUtils.js  # Integração com Mapbox
  │   │   │   ├── military
  │   │   │   │   ├── MilitaryPanel.css
  │   │   │   │   ├── MilitaryPanel.jsx  # Componente Painel Militar
  │   │   │   │   └── militaryState.js  # Estado militar
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
  │   │   │   └── socketClient.js
  │   │   └── store
  │   │       ├── index.js  # Criação e combinação dos reducers
  │   │       └── socketReduxMiddleware.js
  │   └── vite.config.js  # Configuração do Vite
  ├── eslint.config.js  # Configuração do lint para os dois ambientes client e server
  ├── package-lock.json
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
      │   │   └── countryUtils.js  # Utilitários para países
      │   ├── index.js  # Criação e combinação dos reducers
      │   ├── player
      │   │   ├── playerHandlers.js  # Handlers para jogadores
      │   │   ├── playerRoomHandlers.js  # Handlers para jogadores na sala
      │   │   ├── playerStateManager.js  # Gerencia estado dos jogadores
      │   │   └── playerUtils.js  # Funções utilitárias
      │   └── room
      │       ├── roomHandlers.js  # Handlers para sala
      │       ├── roomManagement.js  # Gerenciamento de sala
      │       ├── roomNotifications.js  # Notificações da Sala
      │       └── roomUtils.js  # Utilitários da sala
      ├── package-lock.json
      ├── package.json  # Dependências e scripts principais (monorepo)
      ├── public
      │   └── data
      │       ├── countriesCoordinates.json
      │       └── countriesData.json
      ├── server.js  # Entry point do servidor
      └── shared
          ├── firebaseAdmin.js
          ├── gameStateUtils.js  # Utilitários de estado para o jogo
          └── redisClient.js  # Infraestrutura do Redis
