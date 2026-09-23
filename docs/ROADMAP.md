# Neon Rift — plano de evolução

## Direção

Neon Rift é um roguelite de arena para navegador. O ciclo central deve ser: sobreviver, coletar experiência, escolher uma build, aprender padrões de chefes e tentar novamente com uma estratégia diferente. A nave e o esquadrão são o diferencial do jogo; a progressão precisa reforçar esse papel.

## Fatia 1 — partida completa e ritmo legível

**Implementada:**

- Meta de campanha explícita: derrotar três Guardiões e selar o Núcleo do Rift.
- Terceiro Guardião com identidade, resistência e padrões próprios; vitória aparece após escolher a recompensa final.
- Tela de resultado informa pontuação, abates, tempo e chefes derrotados.
- Ondas têm transição curta de reagrupamento e prazo máximo para não ficarem presas esperando a arena esvaziar.
- Limite de inimigos para preservar a legibilidade e o desempenho do canvas.
- Mini-chefes com espaçamento maior entre aparições.

## Fatia 2 — identidade das builds e decisões de esquadrão

- Classificar melhorias por função (dano, controle, mobilidade, defesa e esquadrão) e evitar ofertas redundantes.
- Criar especializações opcionais para cada companheiro, além do crescimento de dano/cadência já existente.
- Mostrar sinergias da build no HUD e no resumo de fim de partida.
- Afinar padrões dos chefes para que cada um teste uma habilidade diferente, com telegráficos claros.

## Fatia 3 — equilíbrio orientado por testes

- Fazer sessões curtas de teste em desktop e celular e anotar duração, nível de derrota, Guardiões vencidos e escolhas mais comuns.
- Ajustar vida, dano, densidade de projéteis, XP e frequência de cura com base nesses resultados.
- Manter os números de balanceamento num único catálogo configurável, em vez de espalhados pelo loop do jogo.

## Fatia 4 — progresso entre partidas

- Adicionar desbloqueios de conteúdo, desafios e cosméticos com salvamento local versionado.
- Evitar bônus permanentes de poder que tornem a dificuldade inicial irrelevante.
- Considerar contas/sincronização no servidor apenas se houver necessidade concreta de compartilhar progresso.

## Fatia 5 — robustez de navegador

- Cobrir regras de combate, XP, chefe final e gravação com testes automatizados.
- Medir o custo do canvas em celulares; só então introduzir object pooling ou separar sistemas em módulos menores.
- Adicionar PWA/offline depois de estabilizar o fluxo de atualização e cache do jogo.
