import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../src/core/state.js';
import { buyShipUpgrade, buySuperpowerUpgrade, createDefaultProfile, normalizeProfile, rewardLevel } from '../src/core/profile.js';
import { COMPANION_MODELS, MAX_RUN_LEVEL } from '../src/data/hangar.js';
import { UPGRADES } from '../src/data/upgrades.js';
import { Game } from '../src/game/Game.js';

function createHarness() {
  const game = Object.create(Game.prototype);
  game.state = createGameState(1024, 768);
  game.profile = createDefaultProfile();
  game.renderer = { width: 1024, height: 768 };
  game.input = { pointer: { active: false, x: 0, y: 0 }, movement: () => ({ x: 0, y: 0 }) };
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

test('regular level choices apply their player upgrade instead of becoming superpowers', () => {
  const game = createHarness();
  game.applyChoice(UPGRADES.find(upgrade => upgrade.key === 'damage'));
  assert.equal(game.state.player.damage, 19 * 1.3);
  assert.equal(game.state.upgradeLevels.damage, 1);
  assert.equal(game.state.powers.damage, undefined);
});

test('repair is no longer an upgrade choice; hull reinforcement raises only maximum HP', () => {
  const game = createHarness();
  game.state.player.hp = 40;
  game.applyChoice(UPGRADES.find(upgrade => upgrade.key === 'hull'));
  assert.equal(game.state.player.maxHp, 130);
  assert.equal(game.state.player.hp, 40);
  assert.equal(UPGRADES.some(upgrade => upgrade.key === 'repair'), false);
});

test('campaign career and level cap are 32 and v1 hangar data migrates safely', () => {
  const migrated = normalizeProfile({ version: 1, credits: 87, careerLevel: 20, bestLevel: 25, shipUpgrades: { hull: 2 }, ownedCompanions: ['scout'] });
  assert.equal(MAX_RUN_LEVEL, 32);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.credits, 87);
  assert.equal(migrated.shipUpgrades.hull, 2);
  assert.equal(migrated.bestLevel, 25);
  assert.ok(!('ownedCompanions' in migrated));
});

test('companions are selected during a run and only the chosen ally evolves', () => {
  const game = createHarness();
  game.grantPower({ key: 'companion', modelId: 'scout' });
  const scout = game.state.companions[0];
  game.grantPower({ key: 'companion', modelId: 'striker' });
  game.grantPower({ key: 'companion', targetId: scout.id });
  assert.deepEqual(game.state.companions.map(companion => companion.modelId), ['scout', 'striker']);
  assert.deepEqual(game.state.companions.map(companion => companion.level), [2, 1]);
});

test('ship and superpower upgrades use credits, and superpowers require their career unlock', () => {
  const funded = { ...createDefaultProfile(), credits: 240 };
  const hull = buyShipUpgrade(funded, 'hull');
  assert.equal(hull.profile.shipUpgrades.hull, 1);
  const locked = buySuperpowerUpgrade(hull.profile, 'teleport');
  assert.equal(locked.ok, false);
  const unlocked = rewardLevel(hull.profile, 15).profile;
  const teleport = buySuperpowerUpgrade(unlocked, 'teleport');
  assert.equal(teleport.ok, true);
  assert.equal(teleport.profile.superpowerUpgrades.teleport, 1);
});

test('permanent impulse-duration upgrades extend dash movement without changing its cooldown', () => {
  const purchase = buyShipUpgrade({ ...createDefaultProfile(), credits: 500 }, 'dashDuration');
  assert.equal(purchase.ok, true);
  assert.equal(purchase.profile.shipUpgrades.dashDuration, 1);
  const game = createHarness();
  game.profile = purchase.profile;
  game.start();
  assert.equal(game.state.player.dashDuration, .46);
  game.dash();
  assert.equal(game.state.player.dashTime, .46);
  assert.equal(game.state.player.dash, 3);
});

test('level milestones schedule 11 Guardians, with pairs from level 20 and Rift Core at 32', () => {
  const game = createHarness();
  game.spawn = Game.prototype.spawn.bind(game);
  let total = 0;
  for (const level of [4, 8, 12, 16, 20, 24, 28, 32]) {
    game.state.level = level;
    const before = game.state.bossSequence;
    game.spawnBossesForLevel();
    total += game.state.bossSequence - before;
  }
  assert.equal(total, 11);
  assert.equal(game.state.entities.enemies.at(-1).bossVariant.id, 'rift-core');
  assert.equal(game.state.entities.enemies.at(-1).isFinalBoss, true);
});

test('defeating the final Rift Core ends the 32-level run in victory', () => {
  const game = createHarness();
  game.spawn = Game.prototype.spawn.bind(game);
  game.state.level = MAX_RUN_LEVEL;
  game.spawnBoss();
  const finalBoss = game.state.entities.enemies.at(-1);
  game.killEnemy(finalBoss);
  assert.equal(game.state.finalBossDefeated, true);
  game.openBossReward();
  assert.equal(game.state.outcome, 'victory');
  assert.equal(game.state.stageCompleted, true);
});

test('run-local companion roles have unique behavior data', () => {
  const scout = COMPANION_MODELS.find(model => model.id === 'scout');
  const striker = COMPANION_MODELS.find(model => model.id === 'striker');
  const reflector = COMPANION_MODELS.find(model => model.id === 'reflector');
  const collector = COMPANION_MODELS.find(model => model.id === 'collector');
  assert.ok(scout.slowBonus > 0);
  assert.equal(striker.shotPierce, 1);
  assert.equal(reflector.reflects, true);
  assert.equal(collector.collects, true);
});

test('collector delivers banked XP and does not give the ability to other companions', () => {
  const game = createHarness();
  game.addCompanion(COMPANION_MODELS.find(model => model.id === 'collector'));
  game.addCompanion(COMPANION_MODELS.find(model => model.id === 'striker'));
  const [collector, striker] = game.state.companions;
  collector.collectionPhase = 'deliver';
  collector.collectionTimer = 10;
  collector.carriedXp = 7;
  collector.x = game.state.player.x + 8;
  collector.y = game.state.player.y;
  game.updateCompanions(.016);
  assert.equal(game.state.xp, 7);
  assert.equal(collector.carriedXp, 0);
  assert.equal(striker.collects, false);
});

test('aimbot support fires straight bullets without changing the mouse-aimed primary shot', () => {
  const game = createHarness();
  const target = { x: 512, y: 200, radius: 12, hp: 100, slow: 0 };
  game.state.entities.enemies.push(target);
  game.state.powers.aimbot = 1;
  game.state.aimTarget = target;
  game.input.pointer = { active: true, x: 900, y: 384 };
  game.shoot();
  const [primary, assist] = game.state.entities.bullets;
  assert.ok(primary.vx > 0);
  assert.ok(Math.abs(primary.vy) < 1e-6);
  assert.equal(assist.autoAim, true);
  assert.equal(assist.homingTime, undefined);
});

test('teleport grants brief invulnerability and manual barrier prevents damage', () => {
  const game = createHarness();
  game.state.powers.teleport = 1;
  game.input.pointer = { active: true, x: 900, y: 384 };
  game.teleport();
  assert.ok(game.state.player.x > 512);
  const hp = game.state.player.hp;
  game.state.player.invulnerable = 0;
  game.state.powers.activeShield = 1;
  game.activateShield();
  game.hurt(40);
  assert.equal(game.state.player.hp, hp);
});

test('homing enemy projectiles have a hard cap and a limited steering window', () => {
  const game = createHarness();
  const sniper = { x: 0, y: 0, type: 'sniper', color: '#72a7ff' };
  for (let shot = 0; shot < 12; shot += 1) game.firePattern(sniper, 0, 1, 0, 240, 9);
  assert.equal(game.state.entities.enemyBullets.filter(bullet => bullet.homingTime > 0).length, 8);
  assert.ok(game.state.entities.enemyBullets[0].homingRange <= 260);
});

test('charged shots explode on asteroids and produce a readable effect ring', () => {
  const game = createHarness();
  game.state.powers.charged = 1;
  game.input.pointer = { active: true, x: 900, y: 384 };
  game.chargedShot();
  game.state.entities.asteroids.push({ x: 540, y: 384, radius: 25 });
  game.updateBullets(.02);
  assert.equal(game.state.entities.asteroids.length, 0);
  assert.ok(game.state.entities.rings.some(ring => ring.kind === 'charged'));
});

test('level-up hordes respect the increased browser enemy population ceiling', () => {
  const game = createHarness();
  game.state.entities.enemies = Array.from({ length: 95 }, () => ({}));
  let spawned = 0;
  game.spawn = () => { spawned += 1; };
  game.levelUp();
  assert.equal(spawned, 1);
});
