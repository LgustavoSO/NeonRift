export const MAX_RUN_LEVEL = 20;
export const MAX_EQUIPPED_COMPANIONS = 2;

export const SHIP_UPGRADES = [
  { key: 'hull', name: 'Casco de titânio', icon: '🛡️', baseCost: 30, maxLevel: 5, description: 'Aumenta a vida máxima em 15 por melhoria.' },
  { key: 'cannon', name: 'Núcleo de canhão', icon: '💥', baseCost: 35, maxLevel: 5, description: 'Aumenta o dano inicial em 8% por melhoria.' },
  { key: 'engine', name: 'Vetores de impulso', icon: '🚀', baseCost: 32, maxLevel: 5, description: 'Aumenta a velocidade inicial em 5% por melhoria.' },
  { key: 'cadence', name: 'Sincronizador', icon: '⚡', baseCost: 40, maxLevel: 5, description: 'Aumenta a cadência inicial em 5% por melhoria.' },
];

export const COMPANION_MODELS = [
  { id: 'scout', name: 'Vaga-lume', role: 'Batedor', icon: '🛸', cost: 55, upgradeCost: 28, maxLevel: 5, damageMultiplier: .72, cadenceMultiplier: 1.35, flightSpeed: 1.2, interceptLevel: 4, slowBonus: .28, color: '#66f5dc', description: 'Tiros rápidos que deixam os inimigos lentos; reposiciona-se depressa.' },
  { id: 'striker', name: 'Lança', role: 'Atacante', icon: '✦', cost: 75, upgradeCost: 38, maxLevel: 5, damageMultiplier: 1.28, cadenceMultiplier: .92, flightSpeed: .95, interceptLevel: 3, shotPierce: 1, color: '#ffc96b', description: 'Dispara lanças de alto dano que atravessam um inimigo.' },
  { id: 'bulwark', name: 'Égide', role: 'Guardião', icon: '◉', cost: 90, upgradeCost: 45, maxLevel: 5, damageMultiplier: .65, cadenceMultiplier: 1.18, flightSpeed: 1.45, interceptLevel: 2, color: '#91b8ff', description: 'Intercepta projéteis a partir do nível 2.' },
];

export const SKILL_UNLOCKS = [
  { level: 1, key: 'shield', name: 'Escudo reativo', icon: '🛡️' },
  { level: 2, key: 'companion', name: 'Companheiro de combate', icon: '🛸' },
  { level: 3, key: 'aimbot', name: 'Mira automática', icon: '🎯' },
  { level: 4, key: 'charged', name: 'Tiro carregado', icon: '☄️' },
  { level: 5, key: 'nova', name: 'Pulso gravitacional', icon: '🌌' },
  { level: 8, key: 'overdrive', name: 'Sobrecarga', icon: '⚡' },
  { level: 11, key: 'singularity', name: 'Singularidade', icon: '🕳️' },
  { level: 14, key: 'ionStorm', name: 'Tempestade iônica', icon: '🌩️' },
];
