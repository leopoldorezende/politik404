# FOLDER-MAP.md
Estrutura organizada por domínios/funcionalidades (feature-based) para maior escalabilidade.

  /project-root
  │
  ├── /client                                 # Front-end React
  │   ├── index.html                          # HTML principal
  │   │
  │   ├── /public                             # Arquivos estáticos
  │   │   └── favicon.ico
  │   │
  │   └── /src                                # Código fonte
  │       ├── /app                            # Entradas e configurações principais
  │       │   ├── App.jsx                     # Componente raiz
  │       │   ├── main.jsx                    # Entry point (Vite)
  │       │   └── store.js                    # Configuração da store Redux
  │       │
  │       ├── /features                       # Módulos por domínio
  │       │   ├── /economy
  │       │   │   ├── EconomyChart.jsx        # Gráficos econômicos
  │       │   │   └── economySlice.js         # Estado da economia
  │       │   │
  │       │   ├── /chat
  │       │   │   ├── ChatContainer.jsx       # Componente de chat
  │       │   │   ├── chatSlice.js            # Estado do chat
  │       │   │   ├── ChatMessage.jsx         # Componente de mensagem do chat
  │       │   │   └── chatHandlers.js         # Handlers para chat
  │       │   │
  │       │   ├── /map
  │       │   │   ├── GameMap.jsx             # Mapa principal
  │       │   │   ├── CountryDetails.jsx      # Dados do país
  │       │   │   ├── MaritimeChokpoints.jsx  # Rotas marítimas
  │       │   │   └── mapSlice.js             # Estado do mapa
  │       │   │
  │       │   ├── /military
  │       │   │   ├── ShipsView.jsx           # Visualização dos navios
  │       │   │   └── shipsSlice.js           # Estado dos navios
  │       │   │
  │       │   ├── /auth
  │       │   │   ├── authSlice.js            # Autenticação
  │       │   │   ├── LoginScreen.jsx         # Tela de login
  │       │   │   └── authHandlers.js         # Handlers para autenticação
  │       │   │
  │       │   └── /room
  │       │       ├── RoomSelectionScreen.jsx # Tela de seleção de sala
  │       │       └── roomSlice.js            # Estado da sala
  │       │   
  │       └── /shared                         # Componentes, estilos e serviços reutilizáveis
  │               ├── /layout                 # Layout da interface
  │               │   ├── Sideview.jsx
  │               │   └── Sidetools.jsx
  │               │
  │               ├── /styles                 # Estilos globais e específicos
  │               │   └── (arquivos css)
  │               │
  │               ├── /ui                     # UI genérica (botões, modais, etc.)
  │               │   ├── Button.jsx
  │               │   └── Modal.jsx
  │               │
  │               └── /services               # Serviços genéricos
  │                   └── socketService.js
  │
  └── /server                                 # Back-end
      ├── index.js                            # Entry point do servidor
      │
      ├── /auth                               # Autenticação e usuários
      │   ├── authHandlers.js                 # Handlers de autenticação
      │   └── authUtils.js                    # Utilitários de autenticação
      │
      ├── /chat                               # Chat e comunicação
      │   ├── chatHandlers.js                 # Handlers do chat
      │   └── chatUtils.js                    # Utilitários do chat
      │
      ├── /map                                # Dados e lógica do mapa
      │   ├── mapHandlers.js                  # Handlers do mapa
      │   └── mapUtils.js                     # Utilitários do mapa
      │
      ├── /military                           # Dados militares
      │   ├── shipsHandlers.js                # Handlers dos navios
      │   └── shipsUtils.js                   # Utilitários dos navios
      │
      ├── /room                               # Salas e sessões
      │   ├── roomHandlers.js                 # Handlers das salas
      │   └── roomUtils.js                    # Utilitários das salas
      │
      ├── /shared                             # Utilitários e middlewares genéricos
      │   ├── logger.js
      │   └── middleware.js
      │
      └── /public                             # Dados públicos do servidor
          └── /data                           # Dados JSON e outros recursos públicos