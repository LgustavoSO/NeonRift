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
];

export const POWERS = [
  { icon: '🤖', name: 'Companheiro de combate', description: 'Uma nave aliada acompanha você e atira automaticamente. Escolher de novo adiciona outra.', key: 'companion' },
  { icon: '🛡️', name: 'Escudo reativo', description: 'Bloqueia dano automaticamente por alguns segundos; depois recarrega.', key: 'shield' },
  { icon: '☄️', name: 'Tiro carregado', description: 'A cada poucos segundos, dispara um projétil gigante que atravessa vários inimigos.', key: 'charged' },
  { icon: '🌌', name: 'Pulso gravitacional', description: 'Uma onda periódica atinge inimigos próximos e destrói projéteis.', key: 'nova' },
];

export function pickChoices(source, count = 3) {
  return [...source].sort(() => Math.random() - .5).slice(0, count);
}
