# Neon Rift — plano de evolução

## Direção

Neon Rift é um roguelite de arena para navegador. O ciclo central deve ser: sobreviver, coletar experiência, escolher uma build, aprender padrões de chefes e tentar novamente com uma estratégia diferente. A nave e o esquadrão são o diferencial do jogo; a progressão precisa reforçar esse papel.

## Fatia 1 — ciclo roguelite e etapa inicial

**Implementada:**

- Progressão de carreira, moedas, habilidades liberadas e melhorias compradas persistem localmente no navegador.
- Hangar entre partidas para evoluir casco, canhão, motor e cadência; comprar, equipar e melhorar companheiros individualmente, com até dois na equipe.
- Créditos concedidos a cada nível alcançado, mais uma escolha de habilidade garantida quando uma habilidade nova é liberada.
- Evolução da run separada da meta: superpoderes, invocações/reforços de companheiros e atributos temporários.
- Nível 20 como limite da primeira etapa; quatro Guardiões nos níveis 5, 10, 15 e 20.
- Derrotar o quarto Guardião marca a etapa como concluída, mas a run continua até a nave ser destruída.
- Tela de resultado mostra nível máximo, Guardiões, build e créditos daquela run, com acesso direto ao hangar ou nova tentativa.
- Ondas têm transição curta de reagrupamento e prazo máximo para não ficarem presas esperando a arena esvaziar.
- Limite de inimigos para preservar a legibilidade e o desempenho do canvas.
- Mini-chefes com espaçamento maior entre aparições.

## Fatia 2 — identidade das builds e decisões de esquadrão

- Classificar melhorias por função (dano, controle, mobilidade, defesa e esquadrão) e evitar ofertas redundantes.
- **Parcialmente implementado:** Vaga-lume desacelera inimigos, Lança atravessa um alvo e Égide intercepta projéteis; próximos passos são escolhas de especialização dentro da run.
- Mostrar sinergias da build no HUD e no resumo de fim de partida.
- Afinar padrões dos chefes para que cada um teste uma habilidade diferente, com telegráficos claros.

## Fatia 3 — equilíbrio orientado por testes

- Fazer sessões curtas de teste em desktop e celular e anotar duração, nível de derrota, Guardiões vencidos e escolhas mais comuns.
- Ajustar vida, dano, densidade de projéteis, XP e frequência de cura com base nesses resultados.
- Manter os números de balanceamento num único catálogo configurável, em vez de espalhados pelo loop do jogo.

## Fatia 4 — expansão de metajogo

- Adicionar desafios, objetivos opcionais e cosméticos ao progresso local versionado.
- Avaliar a curva de custos e recompensas com dados de sessões reais; evitar que bônus permanentes trivializem a dificuldade.
- Considerar contas/sincronização no servidor apenas se houver necessidade concreta de compartilhar progresso.

## Fatia 5 — robustez de navegador

- Cobrir regras de combate, XP, chefe final e gravação com testes automatizados.
- Medir o custo do canvas em celulares; só então introduzir object pooling ou separar sistemas em módulos menores.
- Adicionar PWA/offline depois de estabilizar o fluxo de atualização e cache do jogo.
