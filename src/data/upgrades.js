export const UPGRADES = [
  { icon: '⚡', name: 'Motor de pulso', description: '+22% de cadência de disparo', apply: player => { player.rate *= .82; } },
  { icon: '💥', name: 'Núcleo pesado', description: '+30% de dano por tiro', apply: player => { player.damage *= 1.3; } },
  { icon: '🌀', name: 'Propulsão iônica', description: '+16% de velocidade de movimento', apply: player => { player.move *= 1.16; } },
  { icon: '🛡️', name: 'Blindagem viva', description: '+30 de vida máxima e cura 30', apply: player => { player.maxHp += 30; player.hp = Math.min(player.maxHp, player.hp + 30); } },
  { icon: '🎯', name: 'Projétil duplicado', description: '+1 disparo por rajada', apply: player => { player.shots = Math.min(6, player.shots + 1); } },
  { icon: '🔱', name: 'Perfuração', description: 'Os tiros atravessam mais um inimigo', apply: player => { player.pierce += 1; } },
  { icon: '🧲', name: 'Campo magnético', description: 'Coleta fragmentos a uma distância maior', apply: player => { player.magnet += 80; } },
  { icon: '❄️', name: 'Impacto criogênico', description: 'Tiros desaceleram os inimigos', apply: player => { player.slow = Math.min(.65, player.slow + .22); } },
  { icon: '✨', name: 'Crítico quântico', description: '+12% de chance de causar dano triplo', apply: player => { player.crit += .12; } },
  { icon: '🚀', name: 'Impulso rápido', description: 'Recarga do impulso 25% menor', apply: player => { player.dashCd *= .75; } },
  { icon: '💚', name: 'Reparo imediato', description: 'Recupera 45 de vida', apply: player => { player.hp = Math.min(player.maxHp, player.hp + 45); } },
  { icon: '🔰', name: 'Placas fotônicas', description: 'Reduz o dano recebido em 7% (máximo de 35%)', apply: player => { player.armor = Math.min(.35, player.armor + .07); } },
  { icon: '🛰️', name: 'Canhão de trilho', description: 'Aumenta em 18% a velocidade dos projéteis', apply: player => { player.projectileSpeed *= 1.18; } },
  { icon: '🧬', name: 'Matriz de ricochete', description: '+1 perfuração e +4% de chance crítica', apply: player => { player.pierce += 1; player.crit += .04; } },
];

export const POWERS = [
  { icon: '🤖', name: 'Companheiro de combate', description: 'Cada nível adiciona um drone (até 4) e melhora cadência e dano. No nível 3, eles interceptam projéteis.', tradeoff: 'Um drone atingido para de atirar por 2s. Cada nível reduz a velocidade da nave em 5%.', key: 'companion' },
  { icon: '🛡️', name: 'Escudo reativo', description: 'Bloqueia dano automaticamente por alguns segundos; depois recarrega.', tradeoff: 'A recarga do canhão fica 10% mais lenta por nível.', key: 'shield' },
  { icon: '☄️', name: 'Tiro carregado', description: 'A cada poucos segundos, dispara um projétil gigante que atravessa vários inimigos.', key: 'charged' },
  { icon: '🌌', name: 'Pulso gravitacional', description: 'Uma onda periódica atinge inimigos próximos e destrói projéteis.', tradeoff: 'O campo consome 8 pontos de vida máxima por nível.', key: 'nova' },
  { icon: '🎯', name: 'Mira automática', description: 'Trava no inimigo mais próximo e guia seus projéteis até ele.', tradeoff: 'O sistema de rastreamento reduz a cadência do canhão em 8% por nível.', key: 'aimbot' },
  { icon: '⚡', name: 'Sobrecarga', description: 'Aumenta bastante a cadência e o dano da nave.', tradeoff: 'O motor perde 6% da velocidade por nível.', key: 'overdrive' },
  { icon: '🕳️', name: 'Singularidade', description: 'A cada poucos segundos, atrai inimigos próximos e os desacelera.', tradeoff: 'A onda gravitacional reduz a vida máxima em 5 por nível.', key: 'singularity' },
  { icon: '🌩️', name: 'Tempestade iônica', description: 'Raios atingem inimigos em sequência automaticamente.', tradeoff: 'A tempestade sobrecarrega o escudo: −4% de blindagem por nível.', key: 'ionStorm' },
];

export function pickChoices(source, count = 3) {
  return [...source].sort(() => Math.random() - .5).slice(0, count);
}
