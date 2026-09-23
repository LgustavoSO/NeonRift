import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../src/core/state.js';
import { Game } from '../src/game/Game.js';

function createHarness() {
  const game = Object.create(Game.prototype);
  game.state = createGameState(1024, 768);
  game.renderer = { width: 1024, height: 768 };
  game.input = { pointer: { active: false, x: 0, y: 0 } };
  game.audio = { play() {} };
  game.burst = () => {};
  game.label = () => {};
  game.spawn = () => {};
  game.ui = {
    showUpgrade() {},
    showPlaying() {},
    showBossReward(_state, choose) { choose({ key: 'charged' }); },
    showGameOver() {},
  };
  game.bestScore = 0;
  return game;
}

test('level-up restores half the existing maximum without increasing it', () => {
  const game = createHarness();
  game.state.player.hp = 40;
  game.levelUp();
  assert.equal(game.state.player.maxHp, 100);
  assert.equal(game.state.player.hp, 90);
});

test('companion upgrades affect only the selected drone', () => {
  const game = createHarness();
  game.grantPower({ key: 'companion' });
  const first = game.state.companions[0];
  game.grantPower({ key: 'companion', addNew: true });
  game.grantPower({ key: 'companion', targetId: first.id });
  assert.deepEqual(game.state.companions.map(companion => companion.level), [2, 1]);
});

test('defeating the third Guardian and claiming its reward completes the run', () => {
  const game = createHarness();
  game.spawn = Game.prototype.spawn.bind(game);
  game.state.bossSequence = 2;
  game.spawnBoss();
  const finalBoss = game.state.entities.enemies.at(-1);
  assert.equal(finalBoss.isFinalBoss, true);
  assert.equal(finalBoss.bossVariant.id, 'rift-core');
  game.killEnemy(finalBoss);
  assert.equal(game.state.finalBossDefeated, true);
  game.openBossReward();
  assert.equal(game.state.outcome, 'victory');
  assert.equal(game.state.mode, 'dead');
});

test('wave changes provide a short regroup and reset their timer', () => {
  const game = createHarness();
  game.nextWave();
  assert.equal(game.state.wave, 2);
  assert.equal(game.state.waveClock, 0);
  assert.ok(game.state.waveBreak > 0);
});

test('level-up hordes respect the browser enemy population ceiling', () => {
  const game = createHarness();
  game.state.entities.enemies = Array.from({ length: 77 }, () => ({}));
  let spawned = 0;
  game.spawn = () => { spawned += 1; };
  game.levelUp();
  assert.equal(spawned, 1);
});
