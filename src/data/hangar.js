export const MAX_RUN_LEVEL = 32;
export const MAX_RUN_COMPANIONS = 4;
export const MAX_PERMANENT_UPGRADE_LEVEL = 10;
export const MAX_RUN_POWER_LEVEL = 10;
export const MAX_COMPANION_LEVEL = 5;
export const BOSS_SCHEDULE = Object.freeze({ 4: 1, 8: 1, 12: 1, 16: 1, 20: 1, 24: 1, 28: 1, 32: 1 });
export const TOTAL_BOSSES = Object.values(BOSS_SCHEDULE).reduce((total, count) => total + count, 0);

export const SHIP_UPGRADES = [
  { key: 'hull', name: 'Casco de titânio', icon: '🛡️', baseCost: 30, maxLevel: MAX_PERMANENT_UPGRADE_LEVEL, description: 'Aumenta a vida máxima em 15 por melhoria.' },
  { key: 'cannon', name: 'Núcleo de canhão', icon: '💥', baseCost: 35, maxLevel: MAX_PERMANENT_UPGRADE_LEVEL, description: 'Aumenta o dano inicial em 8% por melhoria.' },
  { key: 'engine', name: 'Vetores de impulso', icon: '🚀', baseCost: 32, maxLevel: MAX_PERMANENT_UPGRADE_LEVEL, description: 'Aumenta a velocidade inicial em 5% por melhoria.' },
  { key: 'dashDuration', name: 'Capacitor de impulso', icon: '⏱️', baseCost: 38, maxLevel: MAX_PERMANENT_UPGRADE_LEVEL, description: 'Aumenta a duração do impulso em 0,08 s por melhoria (base: 0,38 s).' },
  { key: 'cadence', name: 'Sincronizador', icon: '⚡', baseCost: 40, maxLevel: MAX_PERMANENT_UPGRADE_LEVEL, description: 'Aumenta a cadência inicial em 5% por melhoria.' },
];

// Companion ownership is intentionally run-local. These are choices, not hangar purchases.
export const COMPANION_MODELS = [
  { id: 'scout', name: 'Vaga-lume', role: 'Batedor', icon: '🛸', damageMultiplier: .72, cadenceMultiplier: 1.35, flightSpeed: 1.2, interceptLevel: 4, slowBonus: .28, color: '#66f5dc', description: 'Dispara rápido e desacelera alvos.' },
  { id: 'striker', name: 'Lança', role: 'Atacante', icon: '✦', damageMultiplier: 1.28, cadenceMultiplier: .92, flightSpeed: .95, interceptLevel: 3, shotPierce: 1, color: '#ffc96b', description: 'Projéteis de alto dano atravessam inimigos.' },
  { id: 'bulwark', name: 'Égide', role: 'Escudo', icon: '◉', damageMultiplier: .45, cadenceMultiplier: 1.25, flightSpeed: 1.5, interceptLevel: 1, shieldCharges: 1, color: '#91b8ff', description: 'Intercepta projéteis e pode bloquear inimigos próximos.' },
  { id: 'reflector', name: 'Prisma', role: 'Refletor', icon: '◇', damageMultiplier: .68, cadenceMultiplier: 1.16, flightSpeed: 1.3, interceptLevel: 1, reflects: true, color: '#ef9cff', description: 'Devolve projéteis inimigos contra quem os disparou.' },
  { id: 'collector', name: 'Peregrino', role: 'Coletor de XP', icon: '✧', damageMultiplier: .55, cadenceMultiplier: 1.4, flightSpeed: 1.55, interceptLevel: 99, collects: true, color: '#86ffd1', description: 'Busca fragmentos de experiência e os entrega à nave.' },
];

export const SKILL_UNLOCKS = [
  { level: 1, key: 'shield', name: 'Escudo reativo', icon: '🛡️' },
  { level: 2, key: 'companion', name: 'Companheiro de combate', icon: '🛸' },
  { level: 3, key: 'aimbot', name: 'Mira automática', icon: '🎯' },
  { level: 4, key: 'charged', name: 'Tiro carregado', icon: '☄️' },
  { level: 5, key: 'nova', name: 'Pulso gravitacional', icon: '🌌' },
  { level: 7, key: 'overdrive', name: 'Sobrecarga', icon: '⚡' },
  { level: 9, key: 'singularity', name: 'Singularidade', icon: '🕳️' },
  { level: 11, key: 'ionStorm', name: 'Tempestade iônica', icon: '🌩️' },
  { level: 13, key: 'activeShield', name: 'Barreira manual', icon: '🔰' },
  { level: 15, key: 'teleport', name: 'Salto de fase', icon: '🌀' },
  { level: 18, key: 'minefield', name: 'Campo de minas', icon: '💣' },
  { level: 22, key: 'riftLance', name: 'Lança do Rift', icon: '⚔️' },
];
