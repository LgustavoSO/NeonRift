import { TOTAL_BOSSES } from './hangar.js';

export const RUN_RULES = Object.freeze({
  bossCount: TOTAL_BOSSES,
  waveLength: 24,
  waveDeadline: 36,
  waveBreak: 4,
  enemyCap: 86,
  enemySpawnScale: .85,
  commonEnemySpawnScale: .9,
});
