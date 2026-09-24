export const ENEMY_PROGRESSION = Object.freeze([
  { type: 'grunt', name: 'CAÇADOR' },
  { type: 'runner', name: 'PERSEGUIDOR' },
  { type: 'tank', name: 'COLOSSO' },
  { type: 'sniper', name: 'FRANCO-ATIRADOR' },
  { type: 'minelayer', name: 'LANÇA-MINAS' },
]);

export const MINI_BOSS_VARIANTS = Object.freeze([
  { id: 'rammer', name: 'ARÍETE', color: '#ff9b62' },
  { id: 'seeker', name: 'RASTREADOR', color: '#70baff' },
  { id: 'bomber', name: 'DETONADOR', color: '#e779ff' },
]);

function unlockCount(bossesDefeated, total) {
  return Math.min(total, Math.max(1, 1 + Math.floor(Number(bossesDefeated) || 0)));
}

export function unlockedEnemyTypes(bossesDefeated = 0) {
  return ENEMY_PROGRESSION.slice(0, unlockCount(bossesDefeated, ENEMY_PROGRESSION.length)).map(enemy => enemy.type);
}

export function unlockedMiniBossVariants(bossesDefeated = 0) {
  return MINI_BOSS_VARIANTS.slice(0, unlockCount(bossesDefeated, MINI_BOSS_VARIANTS.length));
}
