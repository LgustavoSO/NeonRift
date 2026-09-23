import { clamp, random } from './math.js';

export function createGameState(width, height) {
  return {
    mode: 'playing',
    time: 0,
    wave: 1,
    waveClock: 0,
    spawnTimer: 0,
    asteroidTimer: 6,
    healTimer: 18,
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    nextXp: 12,
    pendingBossRewards: 0,
    bossSequence: 0,
    shake: 0,
    flash: 0,
    powers: { companion: 0, shield: 0, charged: 0, nova: 0, aimbot: 0 },
    aimTarget: null,
    companionShotTimer: 0,
    shieldTime: 0,
    shieldCooldown: 0,
    chargeTimer: 0,
    novaTimer: 0,
    player: {
      x: width / 2, y: height / 2, radius: 13, hp: 100, maxHp: 100,
      move: 185, damage: 19, rate: .34, shots: 1, pierce: 0, magnet: 105,
      slow: 0, crit: .06, dashCooldown: 3, dash: 0, dashTime: 0, invulnerable: 0,
      shootTimer: 0, angle: 0,
    },
    entities: { bullets: [], enemyBullets: [], enemies: [], gems: [], heals: [], asteroids: [], rings: [], particles: [], floaters: [] },
    dimensions: { width, height },
  };
}

export function resetTransientState(state) {
  for (const collection of Object.values(state.entities)) collection.length = 0;
  state.shake = 0;
  state.flash = 0;
  state.player.x = state.dimensions.width / 2;
  state.player.y = state.dimensions.height / 2;
}

export function resizeState(state, width, height) {
  state.dimensions = { width, height };
  state.player.x = clamp(state.player.x, state.player.radius, width - state.player.radius);
  state.player.y = clamp(state.player.y, state.player.radius, height - state.player.radius);
}

export function randomSpawnPosition(width, height) {
  const margin = 50;
  const side = Math.floor(random(0, 4));
  return {
    x: side < 2 ? (side ? width + margin : -margin) : random(0, width),
    y: side >= 2 ? (side === 2 ? -margin : height + margin) : random(0, height),
  };
}
