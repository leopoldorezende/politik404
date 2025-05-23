# FOLDER-MAP.md

  /Politik404
  ├── FOLDER-MAP.md
  ├── README.md  # Documentação do front-end
  ├── client
  │   ├── index.html  # HTML principal
  │   ├── package.json  # Dependências e scripts principais (monorepo)
  │   ├── public
  │   │   ├── notification.mp3
  │   │   └── vite2.svg
  │   ├── src
  │   │   ├── App.css
  │   │   ├── App.jsx  # Componente raiz
  │   │   ├── main.jsx  # Entry point (Vite)
  │   │   ├── modules
  │   │   │   ├── actions
  │   │   │   │   ├── ActionMenu.css
  │   │   │   │   ├── ActionMenu.jsx
  │   │   │   │   ├── ActionPopup.jsx
  │   │   │   │   ├── hooks
  │   │   │   │   │   └── useActionCooldown.js
  │   │   │   │   └── popups
  │   │   │   │       ├── AlliancePopup.jsx
  │   │   │   │       ├── CooperationPopup.jsx
  │   │   │   │       └── TradePopup.jsx
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
  │   │   │   │   ├── countryService.js  # Identificação dos países
  │   │   │   │   └── countryStateSlice.js
  │   │   │   ├── defense
  │   │   │   │   ├── DefensePanel.jsx  # Componente Painel Militar
  │   │   │   │   ├── defensePanel.css
  │   │   │   │   └── defenseState.js  # Estado militar
  │   │   │   ├── economy
  │   │   │   │   ├── DebtSummaryPopup.css
  │   │   │   │   ├── DebtSummaryPopup.jsx
  │   │   │   │   ├── EconomyPanel.css
  │   │   │   │   └── EconomyPanel.jsx  # Componente Painel de Economia
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
  │   │   │   ├── ranking
  │   │   │   │   ├── RankingPanel.css
  │   │   │   │   └── RankingPanel.jsx
  │   │   │   ├── room
  │   │   │   │   ├── RoomPage.css
  │   │   │   │   ├── RoomPage.jsx  # Tela de seleção de sala
  │   │   │   │   └── roomState.js  # Estado das salas
  │   │   │   └── trade
  │   │   │       ├── TradePanel.css
  │   │   │       ├── TradePanel.jsx  # Componente Painel de Comercio
  │   │   │       ├── TradeProposalPopup.css
  │   │   │       ├── TradeProposalPopup.jsx
  │   │   │       └── tradeState.js  # Estado do comércio
  │   │   ├── services
  │   │   │   ├── socketClient.js
  │   │   │   ├── socketConnection.js
  │   │   │   └── socketEventHandlers.js
  │   │   ├── store
  │   │   │   ├── index.js  # Criação e combinação dos reducers
  │   │   │   └── socketReduxMiddleware.js
  │   │   └── ui
  │   │       ├── popup
  │   │       │   ├── Popup.css
  │   │       │   └── Popup.jsx  # Layout da popup genérica que será usada em todo game
  │   │       ├── sidetools
  │   │       │   ├── Sidetools.css
  │   │       │   └── Sidetools.jsx  # Layout da sidebar esquerda Sidetools
  │   │       ├── sideview
  │   │       │   ├── Sideview.css
  │   │       │   └── Sideview.jsx  # Layout da sidebar direita Sideview
  │   │       └── toast
  │   │           ├── Toast.css
  │   │           ├── Toast.jsx
  │   │           └── messageService.js
  │   └── vite.config.js  # Configuração do Vite
  ├── eslint.config.js  # Configuração do lint para os dois ambientes client e server
  ├── package.json  # Dependências e scripts principais (monorepo)
  └── server
      ├── keys
      │   └── firebase-admin.json
      ├── middlewares
      │   └── socketServerMiddleware.js
      ├── modules
      │   ├── ai
      │   │   └── aiCountryController.js
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
      │   │   ├── economyHandlers.js
      │   │   ├── economyUpdateService.js
      │   │   ├── index.js  # Criação e combinação dos reducers
      │   │   └── tradeAgreementService.js
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
      │       ├── countriesData-bkp.json
      │       └── countriesData.json
      ├── server.js  # Entry point do servidor
      └── shared
          ├── advancedDebtManagement.js
          ├── countryState
          │   ├── countryEconomyCalculator.js
          │   ├── countryStateConfig.js
          │   ├── countryStateCore.js
          │   ├── countryStateUpdater.js
          │   └── index.js  # Criação e combinação dos reducers
          ├── countryStateManager.js
          ├── firebaseAdmin.js
          ├── gameStateUtils.js  # Utilitários de estado para o jogo
          └── redisClient.js  # Infraestrutura do Redis
