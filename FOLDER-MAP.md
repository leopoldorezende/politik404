# FOLDER-MAP.md
Folder structure of the AI project with brief descriptions.

  /project-root
  │ 
  ├── /client                              # Código front-end em React
  │   ├── index.html                       # HTML principal
  │   │
  │   ├── /public                          # Arquivos estáticos públicos
  │   │   └── favicon.ico                  # Ícone do site
  │   │
  │   ├── /src                             # Código fonte React
  │   │   ├── main.jsx                     # Ponto de entrada do React (Vite usa main.jsx)
  │   │   ├── App.jsx                      # Componente principal
  │   │   │
  │   │   ├── /components                  # Componentes React reutilizáveis
  │   │   │   ├── /layout                  # Componentes de layout
  │   │   │   │   ├── Sideview.jsx         # Barra lateral de informações/chat
  │   │   │   │   └── Sidetools.jsx        # Ferramentas laterais
  │   │   │   │   └── EconomyChart.jsx     # Ferramentas de economia
  │   │   │   │
  │   │   │   ├── /chat                    # Componentes de chat
  │   │   │   │   ├── ChatContainer.jsx    # Container do chat
  │   │   │   │
  │   │   │   └─── /map                    # Componentes relacionados ao mapa
  │   │   │       ├── GameMap.jsx          # Componente do mapa principal
  │   │   │       ├── CountryDetails.jsx   # Detalhes do país selecionado
  │   │   │       └── MaritimeChockpoints.jsx # Controles do mapa
  │   │   │    
  │   │   ├── /store                       # Redux Toolkit store
  │   │   │   ├── index.js                 # Configuração da store
  │   │   │   ├── /slices                  # Slices do Redux Toolkit
  │   │   │   │   ├── authSlice.js         # Estado de autenticação
  │   │   │   │   ├── roomsSlice.js        # Estado das salas
  │   │   │   │   ├── gameSlice.js         # Estado do jogo
  │   │   │   │   ├── shipsSlice.js        # Estado dos navios
  │   │   │   │   └── chatSlice.js         # Estado do chat
  │   │   │   │
  │   │   │   └── /middleware              # Middleware personalizado
  │   │   │       └── socketReduxMiddleware.js # Middleware para Socket.io
  │   │   │
  │   │   ├── /services                    # Serviços da aplicação
  │   │   │   ├── countryService.js        # Identificar os dados de cada país
  │   │   │   ├── socketService.js         # Comunicação via Socket.io
  │   │   │   └── mapboxService.js         # Integração com Mapbox
  │   │   │
  │   │   ├── /screens                     # Telas principais da aplicação
  │   │   │   ├── LoginScreen.jsx          # Tela de login
  │   │   │   ├── RoomSelectionScreen.jsx  # Tela de seleção de salas
  │   │   │   └── GameScreen.jsx           # Tela principal do jogo
  │   │   │
  │   │   └── /assets                      # Recursos estáticos
  │   │       └── /styles                  # Arquivos CSS/SCSS
  │   │
  │   └── package.json                     # Dependências do cliente
  │
  ├── /server                              # Código back-end (Node.js)
  │   ├── server.js                        # Arquivo principal do servidor
  │   │
  │   ├── /middlewares    
  │   │   └── /socketServerMiddleware.js   # Handlers para autenticação
  │   │
  │   ├── /economy    
  │   │   └── economyHandlers.js           # Handlers para economia
  │   │   └── economyManager.js            # Gerenciamento para economia
  │   │   └── economyUtils.js              # cálculos para economia
  │   │
  │   ├── /socket         
  │   │   ├── /auth             
  │   │   │   └── authHandlers.js          # Handlers para autenticação
  │   │   │    
  │   │   ├── /chat   
  │   │   │   └── chatHandlers.js          # Handlers para chat
  │   │   │    
  │   │   ├── /country   
  │   │   │   ├── countryAssignment.js     # Atribuições de países
  │   │   │   └── countryUtils.js          # Utilitários para países
  │   │   │    
  │   │   ├── /player   
  │   │   │   └── playerHandlers.js        # Handlers para jogadores
  │   │   │   ├── playerRoomHandlers.js    # Handlers para jogadores na sala
  │   │   │   ├── playerStateManager.js    # Gerencia estado dos jogadores
  │   │   │   └── playerUtils.js           # Funções utilitárias 
  │   │   │    
  │   │   ├── /room   
  │   │   │   └── roomHandlers.js          # Handlers para sala
  │   │   │   ├── roomManagement.js        # Gerenciamento de sala
  │   │   │   ├── roomNotifications.js     # Notificações da Sala
  │   │   │   └── roomUtils.js             # Utilitários da sala
  │   │   │    
  │   │   ├── /ship   
  │   │   │   └── shipHandlers.js          # Handlers para ship
  │   │   │    
  │   │   └── index.js
  │   │
  │   ├── /utils                           # Utilitários do servidor
  │   │   └── gameStateUtils.js            # Utilitários de estado para o jogo
  │   │
  │   └── package.json                     # Dependências do servidor
  │
  ├── /public                              # Arquivos estáticos compartilhados
  │   ├── /data                            # Dados estáticos do jogo
  │   │   ├── countriesData.json           # Dados dos países
  │   │   ├── coordinates.json             # Coordenadas dos países
  │   │   └── routes.json                  # Rotas comerciais
  │   │
  │   └── /assets                          # Outros recursos estáticos
  │       └── /images                      # Imagens do jogo
  │
  ├── package.json                         # Dependências e scripts principais
  ├── .env                                 # Variáveis de ambiente
  ├── .gitignore                           # Arquivos ignorados pelo Git
  └── README.md                            # Documentação do projeto