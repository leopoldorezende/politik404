# FOLDER-MAP.md

  /Politik404
  ├── FOLDER-MAP.md
  ├── README.md  # Documentação do front-end
  ├── SISTEMA_UNIFICADO_COMPLETO.md
  ├── client
  │   ├── index.html  # HTML principal
  │   ├── package.json  # Dependências e scripts principais (monorepo)
  │   ├── public
  │   │   ├── logo.jpg
  │   │   ├── notification.mp3
  │   │   └── vite2.svg
  │   ├── src
  │   │   ├── App.css
  │   │   ├── App.jsx  # Componente raiz
  │   │   ├── constants
  │   │   ├── hooks
  │   │   │   ├── useCards.js
  │   │   │   └── useEconomy.js
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
  │   │   │   ├── alliance
  │   │   │   │   ├── AllianceProposalPopup.css
  │   │   │   │   └── AllianceProposalPopup.jsx
  │   │   │   ├── auth
  │   │   │   │   ├── AuthPage.css
  │   │   │   │   ├── AuthPage.jsx  # Tela de autenticação/login
  │   │   │   │   ├── authState.js  # Estado de autenticação
  │   │   │   │   └── firebaseClient.js
  │   │   │   ├── cards
  │   │   │   │   ├── CardsPopup.css
  │   │   │   │   ├── CardsPopup.jsx
  │   │   │   │   └── cardState.js
  │   │   │   ├── chat
  │   │   │   │   ├── ChatPanel.css
  │   │   │   │   ├── ChatPanel.jsx  # Componente de chat
  │   │   │   │   └── chatState.js  # Estado do chat
  │   │   │   ├── country
  │   │   │   │   ├── CountryDetails.css
  │   │   │   │   ├── CountryDetails.jsx  # Componente de detalhes
  │   │   │   │   ├── CountryState.css
  │   │   │   │   ├── CountryState.jsx
  │   │   │   │   └── countryService.js  # Identificação dos países
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
  │   │   │   ├── authMutex.js
  │   │   │   ├── socketClient.js
  │   │   │   ├── socketConnection.js
  │   │   │   ├── socketEventHandlers.js
  │   │   │   └── storageService.js
  │   │   ├── store
  │   │   │   └── index.js
  │   │   └── ui
  │   │       ├── popup
  │   │       │   ├── Popup.css
  │   │       │   ├── Popup.jsx  # Layout da popup genérica que será usada em todo game
  │   │       │   └── PopupManager.jsx
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
  ├── deploy.sh
  ├── eslint.config.js  # Configuração do lint para os dois ambientes client e server
  ├── package.json  # Dependências e scripts principais (monorepo)
  └── server
      ├── keys
      │   └── firebase-admin.json
      ├── middlewares
      │   └── socketServerMiddleware.js
      ├── modules
      │   ├── agreements
      │   │   ├── agreementEngine.js
      │   │   ├── agreementHandlers.js
      │   │   ├── agreementValidator.js
      │   │   └── internalAgreementService.js
      │   ├── ai
      │   │   └── aiCountryController.js
      │   ├── auth
      │   │   ├── _authHandlers.js
      │   │   ├── authHandlers.js  # Handlers de autenticação
      │   │   └── google.js
      │   ├── chat
      │   │   └── chatHandlers.js  # Handlers do chat
      │   ├── country
      │   │   ├── countryAssignment.js  # Atribuições de países
      │   │   └── countryUtils.js  # Utilitários para países
      │   ├── economy
      │   │   └── economyHandlers.js
      │   ├── index.js
      │   ├── player
      │   │   ├── playerRoomHandlers.js  # Handlers para jogadores na sala
      │   │   └── playerStateManager.js  # Gerencia estado dos jogadores
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
          ├── config
          │   ├── agreementTypeRegistry.js
          │   └── syncConfig.js
          ├── firebaseAdmin.js
          ├── redisClient.js  # Infraestrutura do Redis
          ├── services
          │   ├── agreementMessagesService.js
          │   ├── cardService.js
          │   ├── economy
          │   │   ├── economyDebt.js
          │   │   └── economyTrade.js
          │   └── economyService.js
          └── utils
              ├── economicCalculations.js
              ├── economicConstants.js
              ├── economicUtils.js
              └── gameStateUtils.js  # Utilitários de estado para o jogo
