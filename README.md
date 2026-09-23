# Neon Rift

Neon Rift é um roguelite de arena para navegador, originalmente prototipado em um único arquivo HTML. Esta versão transforma o protótipo em uma base de produto: o jogo continua sem backend e sem assets obrigatórios, mas agora tem fronteiras claras para crescer sem concentrar tudo em um script monolítico.

## Rodar localmente

```bash
npm install
npm run dev
```

Para uma verificação de produção:

```bash
npm run build
npm run preview
```

## Arquitetura

```text
index.html                shell sem lógica de jogo
src/
  main.js                 composição da aplicação
  core/
    audio.js              áudio procedural opcional
    math.js               operações geométricas compartilhadas
    state.js              contrato e ciclo de vida do estado
    storage.js            persistência local do recorde
  data/
    upgrades.js           melhorias e poderes como dados configuráveis
  game/
    Game.js               orquestração do loop e sistemas de jogo
  input/
    InputController.js    teclado, mouse, pointer e touch
  render/
    Renderer.js           canvas, mundo, HUD e feedback visual
  ui/
    UIController.js       menu, escolhas, pausa e fim de partida
  styles/
    tokens.css            identidade visual e tokens
    main.css              layout, responsividade e acessibilidade
```

## Decisões de fundação

- **Canvas 2D + ES Modules + Vite:** mantém o jogo leve, portátil e fácil de publicar em qualquer hospedagem estática. A troca por Phaser ou ECS pode acontecer depois, caso o volume de entidades exija isso.
- **Estado central explícito:** sistemas não dependem do DOM para saber o que está acontecendo. Isso facilita replay, testes, telemetria e salvar/carregar run no futuro.
- **Conteúdo orientado a dados:** upgrades e poderes vivem em `src/data/upgrades.js`; novos itens não precisam alterar o renderer.
- **Entrada desacoplada:** mouse, teclado e touch chegam ao jogo pelo mesmo contrato, mantendo a experiência de navegador e celular alinhada.
- **Progressive enhancement:** áudio e `localStorage` falham silenciosamente quando o navegador não oferece suporte; o jogo continua jogável.

## Próximas fatias recomendadas

1. Extrair os sistemas de `Game.js` para módulos independentes: `SpawnerSystem`, `CombatSystem`, `ProgressionSystem` e `HazardSystem`.
2. Criar um catálogo de inimigos e um `RunConfig` para balanceamento sem editar lógica.
3. Adicionar testes de regras puras: dano, colisão, XP, escolha de upgrade e adaptação de Guardião.
4. Introduzir tela de meta-progressão e seed de run para replays determinísticos.
5. Adicionar PWA, manifesto e service worker quando o loop principal estiver estável.

## Direção visual

O visual mantém o DNA do protótipo: arena escura, grade orbital e ciano elétrico. A assinatura é o contraste entre a precisão “instrumental” da HUD e o ruído orgânico de partículas, asteroides e Guardiões adaptativos. O CSS já inclui foco visível, layout mobile e respeito a `prefers-reduced-motion`.
