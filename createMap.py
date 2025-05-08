import os
import argparse

# CHAMA ASSIM: python3 createMap.py -o FOLDER-MAP.md 
# DEFININDO LOCAL: python3 createMap.py [coloque o diretorio] -o FOLDER-MAP.md 

def generate_tree(path, prefix="", is_last=True, ignore_hidden=True, name_comments=None):
    if name_comments is None:
        name_comments = {}
    basename = os.path.basename(path.rstrip(os.sep)) or path
    # filtros iniciais
    if ignore_hidden and basename.startswith('.'):
        return []
    if basename == 'node_modules':
        return []
    if basename == 'createMap.py':
        return []
    # comentário associado
    comment = name_comments.get(basename, '')
    comment_suffix = f"  # {comment}" if comment else ''
    # conector e linha base
    connector = "└── " if is_last else "├── "
    line = f"{prefix}{connector}{basename}{comment_suffix}"
    lines = [line]
    # itera em diretórios
    if os.path.isdir(path):
        entries = sorted(os.listdir(path))
        if ignore_hidden:
            entries = [e for e in entries if not e.startswith('.')]
        entries = [e for e in entries if e not in ('node_modules', 'createMap.py')]
        entries_paths = [os.path.join(path, e) for e in entries]
        count = len(entries_paths)
        for idx, entry_path in enumerate(entries_paths):
            last = (idx == count - 1)
            extension = "    " if is_last else "│   "
            lines.extend(
                generate_tree(
                    entry_path,
                    prefix + extension,
                    last,
                    ignore_hidden,
                    name_comments
                )
            )
    return lines


def main():
    parser = argparse.ArgumentParser(
        description="Gera um arquivo folder-map.md mapeando diretórios em ASCII tree format"
    )
    parser.add_argument(
        "directory",
        nargs="?",
        default=os.getcwd(),
        help="Diretório raiz para gerar o mapa de pastas (padrão: diretório atual)"
    )
    parser.add_argument(
        "-o", "--output",
        default="folder-map.md",
        help="Arquivo de saída Markdown (padrão: folder-map.md)"
    )
    parser.add_argument(
        "--no-ignore-hidden",
        action="store_false",
        dest="ignore_hidden",
        help="Incluir arquivos e pastas ocultos"
    )
    args = parser.parse_args()

    # mapeamento de comentários por nome de arquivo/pasta
    name_comments = {
        'README.md': 'Documentação do front-end',
        'eslint.config.js': 'Configuração do lint para os dois ambientes client e server',
        'package.json': 'Dependências e scripts principais (monorepo)',
        '.gitignore': 'Não subir pro git',
        'node_modules': 'Node Modules',
        'index.html': 'HTML principal',
        'vite.config.js': 'Configuração do Vite',
        '.env.local': 'Variáveis de ambiente local (React)',
        '.env.production': 'Variáveis de ambiente produção (React)',
        'favicon.ico': 'Ícone do site',
        'App.jsx': 'Componente raiz',
        'main.jsx': 'Entry point (Vite)',
        'authState.js': 'Estado de autenticação',
        'ChatPanel.jsx': 'Componente de chat',
        'chatState.js': 'Estado do chat',
        'countryService.js': 'Identificação dos países',
        'CountryDetails.jsx': 'Componente de detalhes',
        'gameState.js': 'Estado do jogo',
        'MapView.jsx': 'Mapa principal',
        'SeaRoutes.jsx': 'Rotas marítimas',
        'mapboxUtils.js': 'Integração com Mapbox',
        'EconomyPanel.jsx': 'Componente Painel de Economia',
        'economyState.js': 'Estado de economia',
        'MilitaryPanel.jsx': 'Componente Painel Militar',
        'militaryState.js': 'Estado militar',
        'PoliticsPanel.jsx': 'Componente Painel de Política',
        'politicsState.js': 'Estado político',
        'TradePanel.jsx': 'Componente Painel de Comercio',
        'tradeState.js': 'Estado do comércio',
        'socketService.js': 'Comunicação via Socket.io',
        'roomState.js': 'Estado das salas',
        'AuthPage.jsx': 'Tela de autenticação/login',
        'GamePage.jsx': 'Tela principal do jogo',
        'RoomPage.jsx': 'Tela de seleção de sala',
        'index.js': 'Criação e combinação dos reducers',
        'socketMiddleware.js': 'Middleware para Socket.io',
        'Sideview.jsx': 'Layout da sidebar direita Sideview',
        'Sidetools.jsx': 'Layout da sidebar esquerda Sidetools',
        'redisClient.js': 'Infraestrutura do Redis',
        'gameStateUtils.js': 'Utilitários de estado para o jogo',
        'server.js': 'Entry point do servidor',
        'authHandlers.js': 'Handlers de autenticação',
        'chatHandlers.js': 'Handlers do chat',
        'countryAssignment.js': 'Atribuições de países',
        'countryUtils.js': 'Utilitários para países',
        'playerHandlers.js': 'Handlers para jogadores',
        'playerRoomHandlers.js': 'Handlers para jogadores na sala',
        'playerStateManager.js': 'Gerencia estado dos jogadores',
        'playerUtils.js': 'Funções utilitárias',
        'roomHandlers.js': 'Handlers para sala',
        'roomManagement.js': 'Gerenciamento de sala',
        'roomNotifications.js': 'Notificações da Sala',
        'roomUtils.js': 'Utilitários da sala',
        'gameStateUtils.js': 'Utilitários de estado para o jogo'
    }

    root = os.path.abspath(args.directory)
    root_name = os.path.basename(root.rstrip(os.sep)) or root
    header = [f"# {args.output}", "", f"  /{root_name}"]
    tree_lines = []
    entries = sorted(os.listdir(root))
    if args.ignore_hidden:
        entries = [e for e in entries if not e.startswith('.')]
    entries = [e for e in entries if e not in ('node_modules', 'createMap.py')]
    entries_paths = [os.path.join(root, e) for e in entries]
    count = len(entries_paths)
    for idx, entry_path in enumerate(entries_paths):
        last = (idx == count - 1)
        tree_lines.extend(
            generate_tree(
                entry_path,
                prefix="  ",
                is_last=last,
                ignore_hidden=args.ignore_hidden,
                name_comments=name_comments
            )
        )

    with open(args.output, 'w', encoding='utf-8') as f:
        for line in header + tree_lines:
            f.write(line + "\n")
    print(f"Arquivo '{args.output}' gerado com sucesso. (ignoring hidden: {args.ignore_hidden})")

if __name__ == "__main__":
    main()
