import { MAX_PERMANENT_UPGRADE_LEVEL } from './hangar.js';

export const UPGRADES = [
  { key: 'cadence', icon: '⚡', name: 'Motor de pulso', description: '+22% de cadência de disparo', maxLevel: 5, apply: player => { player.rate *= .82; } },
  { key: 'damage', icon: '💥', name: 'Núcleo pesado', description: '+30% de dano por tiro', maxLevel: 5, apply: player => { player.damage *= 1.3; } },
  { key: 'move', icon: '🌀', name: 'Propulsão iônica', description: '+16% de velocidade de movimento', maxLevel: 4, apply: player => { player.move *= 1.16; } },
  { key: 'hull', icon: '🛡️', name: 'Blindagem viva', description: '+30 de casco máximo, sem restaurar vida', maxLevel: 4, apply: player => { player.maxHp += 30; } },
  { key: 'shots', icon: '🎯', name: 'Projétil duplicado', description: '+1 disparo por rajada', maxLevel: 5, available: player => player.shots < 6, apply: player => { player.shots = Math.min(6, player.shots + 1); } },
  { key: 'pierce', icon: '🔱', name: 'Perfuração', description: 'Os tiros atravessam mais um inimigo', maxLevel: 4, apply: player => { player.pierce += 1; } },
  { key: 'magnet', icon: '🧲', name: 'Campo magnético', description: 'Aumenta o alcance de coleta de experiência', maxLevel: 4, apply: player => { player.magnet += 80; } },
  { key: 'slow', icon: '❄️', name: 'Impacto criogênico', description: 'Tiros desaceleram mais os inimigos', maxLevel: 3, apply: player => { player.slow = Math.min(.65, player.slow + .22); } },
  { key: 'critical', icon: '✨', name: 'Crítico quântico', description: '+12% de chance de causar dano triplo', maxLevel: 4, apply: player => { player.crit = Math.min(.6, player.crit + .12); } },
  { key: 'dash', icon: '🚀', name: 'Impulso rápido', description: 'Recarga do impulso 18% menor', maxLevel: 4, apply: player => { player.dashCooldown = Math.max(1.25, player.dashCooldown * .82); } },
  { key: 'armor', icon: '🔰', name: 'Placas fotônicas', description: 'Reduz o dano recebido em 7%', maxLevel: 5, available: player => player.armor < .35, apply: player => { player.armor = Math.min(.35, player.armor + .07); } },
  { key: 'projectile', icon: '🛰️', name: 'Canhão de trilho', description: '+18% de velocidade dos projéteis', maxLevel: 4, apply: player => { player.projectileSpeed *= 1.18; } },
  { key: 'ricochet', icon: '🧬', name: 'Matriz de ricochete', description: '+1 perfuração e +4% de chance crítica', maxLevel: 4, apply: player => { player.pierce += 1; player.crit = Math.min(.6, player.crit + .04); } },
  { key: 'firewheel', icon: '🔥', name: 'Anel de plasma', description: 'Um anel de fogo atinge inimigos que chegam perto', maxLevel: 3, apply: (_player, state) => { state.firewheelLevel += 1; } },
  { key: 'companion', icon: '🤖', name: 'Reforço de esquadrão', description: 'Adiciona um aliado ou escolhe um companheiro específico para evoluir', maxLevel: 99, special: true },
];

const SUPERPOWER_DEFINITIONS = [
  { icon: '🤖', name: 'Companheiro de combate', description: 'Escolha um drone novo ou evolua um aliado específico nesta expedição.', tradeoff: 'Aliados atingidos ficam 2 segundos sem atirar.', key: 'companion', baseCost: 55 },
  { icon: '🛡️', name: 'Escudo reativo', description: 'Bloqueia dano automaticamente por alguns segundos; depois recarrega.', tradeoff: 'A recarga do canhão fica 5% mais lenta por nível de hangar.', key: 'shield', baseCost: 50 },
  { icon: '☄️', name: 'Tiro carregado', description: 'Projétil de energia atravessa a linha de frente e explode ao atingir chefes ou asteroides.', key: 'charged', baseCost: 60 },
  { icon: '🌌', name: 'Pulso gravitacional', description: 'Uma onda periódica atinge inimigos próximos e destrói projéteis.', tradeoff: 'Consome 5 pontos de vida máxima por nível de hangar.', key: 'nova', baseCost: 65 },
  { icon: '🎯', name: 'Mira automática', description: 'Guia parte dos disparos existentes da nave até o inimigo mais próximo.', tradeoff: 'Reduz a cadência em 4% por nível de hangar.', key: 'aimbot', baseCost: 55 },
  { icon: '⚡', name: 'Sobrecarga', description: 'Aumenta a cadência e o dano da nave.', tradeoff: 'Reduz a velocidade em 3% por nível de hangar.', key: 'overdrive', baseCost: 65 },
  { icon: '🕳️', name: 'Singularidade', description: 'Marca um ponto na mira; após 1,5 s, atrai XP e projéteis hostis de toda a arena para esse núcleo.', tradeoff: 'Reduz a vida máxima em 3 pontos por nível de hangar.', key: 'singularity', baseCost: 70 },
  { icon: '🌩️', name: 'Tempestade iônica', description: 'Raios atingem alvos em sequência automaticamente.', tradeoff: 'Reduz a blindagem em 2% por nível de hangar.', key: 'ionStorm', baseCost: 75 },
  { icon: '🔰', name: 'Barreira manual', description: 'Pressione E para ativar uma proteção temporária de emergência.', key: 'activeShield', baseCost: 75 },
  { icon: '🌀', name: 'Salto de fase', description: 'Pressione Q para se teleportar na direção da mira e escapar de perigo.', key: 'teleport', baseCost: 85 },
  { icon: '💣', name: 'Campo de minas', description: 'Cria minas aliadas que detonam em área quando inimigos se aproximam.', key: 'minefield', baseCost: 80 },
  { icon: '⚔️', name: 'Lança do Rift', description: 'Dispara periodicamente uma sequência de lanças energéticas em alvos próximos.', key: 'riftLance', baseCost: 95 },
];

// Gameplay receives run-only definitions; permanent purchases have their own catalog below.
export const POWERS = SUPERPOWER_DEFINITIONS.map(({ key, icon, name, description, tradeoff }) => ({ key, icon, name, description, tradeoff }));
export const PERMANENT_POWER_UPGRADES = SUPERPOWER_DEFINITIONS
  .filter(power => power.key !== 'companion')
  .map(({ key, icon, name, description, tradeoff, baseCost }) => ({ key, icon, name, description, tradeoff, baseCost, maxLevel: MAX_PERMANENT_UPGRADE_LEVEL }));

export function pickChoices(source, count = 3, random = Math.random) {
  const shuffled = [...source];
  const limit = Math.max(0, Math.min(shuffled.length, Math.floor(count)));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, limit);
}
