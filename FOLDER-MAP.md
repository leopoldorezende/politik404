# FOLDER-MAP.md

  /project-root
  ├── README.md                                  # Documentação do front-end
  ├── eslint.config.js                           # Configuração do lint para os dois ambientes client e server
  ├── package.json                               # Dependências e scripts principais (monorepo)
  ├── .gitignore                                 # Não subir pro git
  │
  ├── /node_modules                              # Node Modules
  │
  ├── /client                                    
  │   ├── index.html                             # HTML principal
  │   ├── vite.config.js                         # Configuração do Vite
  │   ├── package.json                           # Dependências do front-end
  │   ├── .env.local                             # Variáveis de ambiente local (React)
  │   ├── .env.production                        # Variáveis de ambiente produção (React)
  │   │
  │   ├── /public                                
  │   │   └── favicon.ico
  │   │
  │   └── /src                                   
  │       ├── App.jsx                            # Componente raiz
  │       ├── main.jsx                           # Entry point (Vite)
  │       │
  │       ├── /modules                          
  │       │   ├── /auth
  │       │   │   └── authState.js               # Estado de autenticação
  │       │   │
  │       │   ├── /chat
  │       │   │   ├── ChatPanel.jsx              # Componente de chat
  │       │   │   └── chatState.js               # Estado do chat
  │       │   │
  │       │   ├── /country
  │       │   │   ├── countryService.js          # Identificação dos países
  │       │   │   └── CountryDetails.jsx         # Componente de detalhes
  │       │   │
  │       │   ├── /game
  │       │   │   └── gameState.js               # Estado do jogo
  │       │   │
  │       │   ├── /map
  │       │   │   ├── MapView.jsx                # Mapa principal
  │       │   │   ├── SeaRoutes.jsx              # Rotas marítimas
  │       │   │   └── mapboxUtils.js             # Integração com Mapbox
  │       │   │
  │       │   ├── /economy
  │       │   │   ├── EconomyPanel.jsx           # Componente Painel de Economia
  │       │   │   └── economyState.js            # Estado de economia
  │       │   │
  │       │   ├── /military
  │       │   │   ├── MilitaryPanel.jsx          # Componente Painel Militar
  │       │   │   └── militaryState.js           # Estado militar
  │       │   │
  │       │   ├── /politics
  │       │   │   ├── PoliticsPanel.jsx          # Componente Painel de Política
  │       │   │   └── politicsState.js           # Estado político
  │       │   │
  │       │   ├── /trade
  │       │   │   ├── TradePanel.jsx             # Componente Painel de Comercio
  │       │   │   └── tradeState.js              # Estado do comércio
  │       │   │
  │       │   ├── /network
  │       │   │   └── socketService.js           # Comunicação via Socket.io
  │       │   │
  │       │   └── /room
  │       │       └── roomState.js               # Estado das salas
  │       │ 
  │       ├── /pages                            
  │       │   ├── AuthPage.jsx                   # Tela de autenticação/login
  │       │   ├── GamePage.jsx                   # Tela principal do jogo
  │       │   └── RoomPage.jsx                   # Tela de seleção de sala
  │       │ 
  │       ├── /store                            
  │       │   ├── index.js                       # Criação e combinação dos reducers
  │       │   └── /middleware                    
  │       │       └── socketMiddleware.js        # Middleware para Socket.io
  │       │   
  │       └── /shared                           
  │           ├── /layout                        
  │           │   ├── Sideview.jsx               # Layout da sidebar direita Sideview
  │           │   └── Sidetools.jsx              # Layout da sidebar esquerda Sidetools
  │           │
  │           ├── /styles                        
  │           │   └── (arquivos css)             # Todos os arquivos css
  │           │
  │           └── /ui                            
  │               └── empty
  │
  └── /server                                   
      ├── server.js                              # Entry point do servidor
      ├── package.json                               
      ├── .env         
      │
      ├── /middlewares       
      │   └── socketServerMiddleware.js          # Handlers para autenticação  
      │
      ├── /modules
      │   ├── index.js
      │   │
      │   ├── /auth
      │   │   └── authHandlers.js                # Handlers de autenticação        
      │   │
      │   ├── /chat
      │   │   └── chatHandlers.js                # Handlers do chat
      │   │
      │   ├── /country
      │   │   ├── countryAssignment.js           # Atribuições de países
      │   │   └── countryUtils.js                # Utilitários para países
      │   │
      │   ├── /player
      │   │   ├── playerHandlers.js              # Handlers para jogadores
      │   │   ├── playerRoomHandlers.js          # Handlers para jogadores na sala
      │   │   ├── playerStateManager.js          # Gerencia estado dos jogadores
      │   │   └── playerUtils.js                 # Funções utilitárias 
      │   │
      │   └── /room
      │       ├── roomHandlers.js                # Handlers para sala
      │       ├── roomManagement.js              # Gerenciamento de sala
      │       ├── roomNotifications.js           # Notificações da Sala
      │       └── roomUtils.js                   # Utilitários da sala
      │
      ├── /shared                                
      │   ├── redisClient.js                     # Infraestrutura do Redis
      │   └── gameStateUtils.js                  # Utilitários de estado para o jogo
      │
      └── /public                               
          └── /data                              
              ├── countriesData.json             # Dados JSON dos países
              └── countriesCoordinates.json      # Dados JSON de coordenadas
