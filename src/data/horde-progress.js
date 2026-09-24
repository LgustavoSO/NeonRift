import { RUN_RULES } from './game-rules.js';

export function getHordeProgress(state) {
  const activeEnemies = state.entities.enemies.length;
  const clearTarget = Math.max(3, state.wave * 2);
  const waveClock = state.waveClock ?? 0;

  if (state.waveBreak > 0) {
    return { phase: 'break', progress: 0, remaining: state.waveBreak, activeEnemies, clearTarget };
  }

  if (waveClock < RUN_RULES.waveLength) {
    return {
      phase: 'combat',
      progress: waveClock / RUN_RULES.waveLength * .72,
      remaining: RUN_RULES.waveLength - waveClock,
      activeEnemies,
      clearTarget,
    };
  }

  if (activeEnemies < clearTarget || waveClock >= RUN_RULES.waveDeadline) {
    return { phase: 'ready', progress: 1, remaining: 0, activeEnemies, clearTarget };
  }

  const cleanupWindow = RUN_RULES.waveDeadline - RUN_RULES.waveLength;
  const cleanupProgress = Math.min(1, (waveClock - RUN_RULES.waveLength) / cleanupWindow);
  return {
    phase: 'cleanup',
    progress: .72 + cleanupProgress * .28,
    remaining: RUN_RULES.waveDeadline - waveClock,
    activeEnemies,
    clearTarget,
  };
}
