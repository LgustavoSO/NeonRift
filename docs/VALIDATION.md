# Validação do Neon Rift — 24/09/2026

## Correções e balanceamento

- Ondas duram pelo menos 24s e avançam ao limpar o campo abaixo da meta; o limite é 36s. O intervalo de reagrupamento foi aumentado para 4s.
- Mira automática mantém o primeiro disparo manual e redireciona tiros seguintes da rajada existente, sem gerar projéteis extras nem reduzir o dano. Após pegar o primeiro fragmento, o Peregrino espera no máximo 1,75s no nível 1 (menos a cada nível) e retorna para entregar; inicia nova coleta logo após a entrega.
- Escolhas só funcionam no estado correto, uma vez por tela; botões antigos não podem repetir uma recompensa, recrutar outro aliado ou reabrir uma partida encerrada.
- Dano fatal interrompe o restante do frame. Cura e XP não são coletados depois da derrota; a tela final é emitida apenas uma vez.
- Escudos automático e manual recarregam **após** a proteção terminar, eliminando invulnerabilidade contínua em ranks altos.
- A pressão dos inimigos considera a variedade de poderes e o número de aliados, não cada nível comprado no Hangar. Depois da redução geral de 15%, o fluxo de inimigos comuns caiu mais 10% (23,5% abaixo do ritmo original). Ondas e hordas de nível usam o ajuste; mini-chefes e guardiões agendados mantêm suas aparições. O teto de população continua único (86 inimigos já em campo, com chefes agendados podendo excedê-lo).
- Sobrecarga nunca piora a cadência de uma nave já rápida. As prévias mostram o efeito total de ativação, com intervalos e custos reais.
- Vitória final não exige escolher mais uma recompensa. Recompensas comuns não travam com XP excedente no nível 32.
- Projéteis da nave usam colisão pelo trajeto e ordem de impacto, evitando atravessar alvos sem causar dano em frames mais lentos.
- Busca do alvo mais próximo usa distâncias ao quadrado e ignora inimigos mortos; Tempestade usa embaralhamento sem reposição, sem ordenar aleatoriamente.
- Asteroides que ainda vão entrar na arena não são descartados antes da hora. Cápsulas não são gastas quando o casco está cheio. A atração de XP não ultrapassa a nave.
- Perfil salvo normaliza níveis inteiros, valores finitos e desbloqueios conhecidos, mantendo a migração de saves antigos.
- Pausa por botão/tecla e ao perder o foco. HUD estreito sem sobreposição entre atributos e horda; poderes ativos têm nomes e quebra de linha.

## Verificação automatizada

```powershell
npm test
npm run build
git diff --check
```

Resultado: **45/45 testes aprovados**, build gerado e diff sem erros de whitespace. Os testes incluem escolhas consumidas, níveis máximos, compras, migração de perfil, cura ao subir de nível, chefes, aliados individuais, interceptação por 2 segundos, aimbot reto, colisões rápidas, escudos e término da partida.

A simulação determinística executa 3.600 frames a 60 Hz para cada configuração de nível 1, 16 e 32. A nave fica invulnerável somente no teste para exercitar a simulação continuamente. Verifica coordenadas finitas, estados válidos e limites de inimigos/partículas. Isso não é uma medição de FPS nem comprova o balanceamento de uma campanha jogada por uma pessoa.

## Verificação no navegador

Foi usada a origem isolada `http://127.0.0.1:4174`, sem alterar o save principal da porta 4173. Menu, início, escolhas pelo teclado, seleção individual de aliado, pausa/retomada, compra no Hangar, combate avançado, derrota e vitória foram exercitados. Telas conferidas em 1280×720 e 390×844; sem erros/avisos no console durante os cenários executados.

O build de produção também foi servido temporariamente com `vite preview` na porta 4175: menu, início da arena e comando de pausa funcionaram, sem erros no console. O diretório `dist` contém apenas a entrada de produção e seus assets, sem o cenário QA. Os servidores/aba temporários de teste foram encerrados.

Para repetir os cenários preparados:

```powershell
npm run dev -- --host 127.0.0.1 --port 4174 --strictPort
```

Abra `/tests/browser-fixture.html` **nessa porta separada**. Os botões QA configuram partidas e créditos fictícios e podem sobrescrever o save da origem de teste. Essa entrada não integra o build de produção, cujo ponto de entrada continua sendo `index.html`.

## Limites

Não houve campanha completa manual, teste em aparelho móvel físico, Safari/Firefox ou verificação do site publicado no Render. O ajuste de dificuldade precisa de playtests reais para avaliar sensação de combate e tempo até os chefes. Nenhum commit, push ou deploy foi realizado nesta revisão.
