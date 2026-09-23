import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../src/core/state.js';
import { Game } from '../src/game/Game.js';
import { buyCompanion, buyShipUpgrade, createDefaultProfile, rewardLevel, toggleCompanion, upgradeCompanion } from '../src/core/profile.js';
import { COMPANION_MODELS } from '../src/data/hangar.js';

function createHarness() {
  const game = Object.create(Game.prototype);
  game.state = createGameState(1024, 768);
  game.profile = createDefaultProfile();
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

test('defeating the fourth Guardian completes stage one but keeps the run alive', () => {
  const game = createHarness();
  game.spawn = Game.prototype.spawn.bind(game);
  game.state.level = 20;
  game.state.bossSequence = 3;
  game.spawnBoss();
  const finalBoss = game.state.entities.enemies.at(-1);
  assert.equal(finalBoss.isFinalBoss, true);
  assert.equal(finalBoss.bossVariant.id, 'rift-core');
  game.killEnemy(finalBoss);
  assert.equal(game.state.finalBossDefeated, true);
  game.openBossReward();
  assert.equal(game.state.stageCompleted, true);
  assert.equal(game.state.outcome, null);
  assert.equal(game.state.mode, 'playing');
});

test('career level rewards credits and unlocks the level skill once', () => {
  const first = rewardLevel(createDefaultProfile(), 2);
  assert.equal(first.credits, 16);
  assert.ok(first.profile.unlockedSkills.includes('companion'));
  const again = rewardLevel(first.profile, 2);
  assert.deepEqual(again.unlocked, []);
});

test('hangar purchases and equipment respect currency and the two-companion limit', () => {
  const funded = { ...createDefaultProfile(), credits: 300 };
  const hull = buyShipUpgrade(funded, 'hull');
  assert.equal(hull.profile.shipUpgrades.hull, 1);
  const scout = buyCompanion(hull.profile, 'scout');
  const scoutUpgrade = upgradeCompanion(scout.profile, 'scout');
  assert.equal(scoutUpgrade.profile.companionLevels.scout, 2);
  assert.equal(scoutUpgrade.profile.companionLevels.striker, 1);
  const striker = buyCompanion(scoutUpgrade.profile, 'striker');
  const bulwark = buyCompanion(striker.profile, 'bulwark');
  assert.equal(bulwark.ok, true);
  assert.equal(bulwark.profile.equippedCompanions.length, 2);
  const cannotEquipThird = toggleCompanion(bulwark.profile, 'bulwark');
  assert.equal(cannotEquipThird.ok, false);
});

test('hangar ship and companion upgrades are applied when a new run starts', () => {
  const game = createHarness();
  const hull = buyShipUpgrade({ ...game.profile, credits: 200 }, 'hull');
  const scout = buyCompanion(hull.profile, 'scout');
  game.profile = upgradeCompanion(scout.profile, 'scout').profile;
  game.start();
  assert.equal(game.state.player.maxHp, 115);
  assert.equal(game.state.companions.length, 1);
  assert.equal(game.state.companions[0].modelId, 'scout');
  assert.equal(game.state.companions[0].level, 2);
});

test('superpower activations add their own visible effect types', () => {
  const game = createHarness();
  game.state.powers.nova = 1;
  game.state.powers.singularity = 1;
  game.state.powers.ionStorm = 1;
  game.state.entities.enemies.push({ x: 400, y: 350, radius: 12, hp: 100, slow: 0 });
  game.updatePowers(.016);
  assert.deepEqual(new Set(game.state.entities.rings.map(ring => ring.kind)), new Set(['nova', 'singularity', 'ion']));
});

test('companion models have distinct combat signatures', () => {
  const game = createHarness();
  const target = { x: 600, y: 384, radius: 12, hp: 100, slow: 0 };
  game.state.entities.enemies.push(target);
  const scout = COMPANION_MODELS.find(model => model.id === 'scout');
  const striker = COMPANION_MODELS.find(model => model.id === 'striker');
  game.companionShoot({ ...scout, level: 1, x: 500, y: 384 });
  const scoutShot = game.state.entities.bullets.pop();
  game.companionShoot({ ...striker, level: 1, x: 500, y: 384 });
  const strikerShot = game.state.entities.bullets.pop();
  assert.ok(scoutShot.slow > 0);
  assert.equal(scoutShot.pierce, 0);
  assert.equal(strikerShot.slow, 0);
  assert.equal(strikerShot.pierce, 1);
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
