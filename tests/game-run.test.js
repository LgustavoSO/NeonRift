import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../src/core/state.js';
import { buyShipUpgrade, buySuperpowerUpgrade, createDefaultProfile, normalizeProfile, rewardLevel } from '../src/core/profile.js';
import { BOSS_SCHEDULE, COMPANION_MODELS, MAX_COMPANION_LEVEL, MAX_PERMANENT_UPGRADE_LEVEL, MAX_RUN_LEVEL, SHIP_UPGRADES, TOTAL_BOSSES } from '../src/data/hangar.js';
import { ENEMY_PROGRESSION, MINI_BOSS_VARIANTS, unlockedEnemyTypes, unlockedMiniBossVariants } from '../src/data/enemy-progression.js';
import { PERMANENT_POWER_UPGRADES, POWERS, UPGRADES, pickChoices } from '../src/data/upgrades.js';
import { getChoiceNextEffect, getChoiceProgress } from '../src/data/choice-details.js';
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
    showUpgrade(_state, choices) { game.lastChoices = choices; },
    showPlaying() {},
    showBossReward(_state, choose) { choose({ key: 'charged' }); },
    showGameOver() {},
  };
  game.bestScore = 0;
  return game;
}

test('choice randomizer shuffles without replacement and never mutates the source pool', () => {
  const source = ['a', 'b', 'c', 'd'];
  const first = pickChoices(source, 3, () => 0);
  const second = pickChoices(source, 3, () => .999);
  assert.equal(new Set(first).size, 3);
  assert.deepEqual(source, ['a', 'b', 'c', 'd']);
  assert.notDeepEqual(first, second);
});

test('choice preview shows current level, resulting level, and the actual next-level gain', () => {
  const game = createHarness();
  const upgrade = UPGRADES.find(item => item.key === 'damage');
  game.state.upgradeLevels.damage = 2;
  assert.deepEqual(getChoiceProgress(upgrade, game.state), { current: 2, next: 3, max: 5, label: 'HABILIDADE' });
  assert.equal(getChoiceNextEffect(upgrade, game.state), '+30% de dano por tiro.');

  const power = POWERS.find(item => item.key === 'charged');
  game.state.powers.charged = 1;
  game.state.powerBonuses = { charged: 1 };
  assert.deepEqual(getChoiceProgress(power, game.state), { current: 1, next: 3, max: 4, label: 'HABILIDADE' });
  assert.match(getChoiceNextEffect(power, game.state), /\+2× dano base/);
});

test('companion choice preview reports only the selected ally and its rank gain', () => {
  const game = createHarness();
  game.grantPower({ key: 'companion', modelId: 'scout' });
  const scout = game.state.companions[0];
  game.state.powerBonuses = { companion: 1 };
  const choice = { targetId: scout.id, companionGainLevels: 2 };
  assert.deepEqual(getChoiceProgress(choice, game.state), { current: 1, next: 3, max: MAX_COMPANION_LEVEL, label: 'ALIADO' });
  assert.match(getChoiceNextEffect(choice, game.state), /\+10,3% de bônus de dano para este aliado/);
  game.grantPower({ key: 'companion', targetId: scout.id });
  assert.equal(scout.level, 3);
  assert.equal(scout.damageMultiplier, COMPANION_MODELS.find(model => model.id === 'scout').damageMultiplier * 1.05 ** 2);
});

test('level-up choices mix unlocked powers and regular skills while excluding maxed options', () => {
  const game = createHarness();
  game.state.upgradeLevels = Object.fromEntries(UPGRADES.filter(item => !item.special).map(item => [item.key, item.maxLevel]));
  game.state.upgradeLevels.damage = 0;
  game.state.powers.shield = 3;
  game.state.powers.aimbot = 2;
  game.profile.unlockedSkills = ['shield', 'aimbot'];

  game.levelUp();

  assert.deepEqual(new Set(game.lastChoices.map(choice => choice.key)), new Set(['damage', 'aimbot', 'companion']));
  assert.equal(game.lastChoices.some(choice => choice.key === 'shield'), false);
  assert.equal(game.lastChoices.some(choice => choice.apply && (game.state.upgradeLevels[choice.key] ?? 0) >= choice.maxLevel), false);
});

test('a power at run cap is filtered, and a permanent bonus cannot push it past the cap', () => {
  const game = createHarness();
  game.profile.unlockedSkills = ['shield', 'charged'];
  game.state.powers.shield = 3;
  game.state.powers.charged = 4;
  game.state.powerBonuses = { charged: 2 };
  assert.deepEqual(game.availableRunPowers().map(power => power.key), ['charged']);

  game.grantPower(POWERS.find(power => power.key === 'charged'));
  assert.equal(game.state.powers.charged, 5);
  assert.deepEqual(game.availableRunPowers(), []);
});

test('hangar purchases and in-run power choices use separate catalogs', () => {
  const game = createHarness();
  game.profile.unlockedSkills = ['shield'];
  const runPower = game.availableRunPowers()[0];
  const permanentUpgrade = PERMANENT_POWER_UPGRADES.find(upgrade => upgrade.key === 'shield');
  assert.equal(runPower, POWERS.find(power => power.key === 'shield'));
  assert.notEqual(runPower, permanentUpgrade);
  assert.equal('baseCost' in runPower, false);
  assert.equal('runMaxLevel' in permanentUpgrade, false);
});

test('boss reward is skipped cleanly when every unlocked power is maxed', () => {
  const game = createHarness();
  game.profile.unlockedSkills = ['shield'];
  game.state.powers.shield = 3;
  game.state.pendingBossRewards = 1;
  game.state.finalBossDefeated = true;

  game.openBossReward();

  assert.equal(game.state.pendingBossRewards, 0);
  assert.equal(game.state.stageCompleted, true);
  assert.equal(game.state.outcome, 'victory');
});

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

test('enemy and mini-boss archetypes unlock one new type per defeated Guardian', () => {
  assert.deepEqual(unlockedEnemyTypes(0), ['grunt']);
  assert.deepEqual(unlockedEnemyTypes(1), ['grunt', 'runner']);
  assert.deepEqual(unlockedEnemyTypes(2), ['grunt', 'runner', 'tank']);
  assert.deepEqual(unlockedEnemyTypes(99), ENEMY_PROGRESSION.map(enemy => enemy.type));
  assert.deepEqual(unlockedMiniBossVariants(0).map(variant => variant.id), ['rammer']);
  assert.deepEqual(unlockedMiniBossVariants(1).map(variant => variant.id), ['rammer', 'seeker']);
  assert.deepEqual(unlockedMiniBossVariants(2), MINI_BOSS_VARIANTS);
  assert.deepEqual(unlockedMiniBossVariants(99), MINI_BOSS_VARIANTS);

  const game = createHarness();
  const originalRandom = Math.random;
  Math.random = () => .999;
  try {
    for (let defeated = 0; defeated <= ENEMY_PROGRESSION.length + 1; defeated += 1) {
      game.state.bossesDefeated = defeated;
      const enemyPool = unlockedEnemyTypes(defeated);
      const miniPool = unlockedMiniBossVariants(defeated);
      assert.deepEqual(game.unlockedEnemyTypes(), enemyPool);
      assert.deepEqual(game.unlockedMiniBossVariants(), miniPool);
      for (let sample = 0; sample < 20; sample += 1) assert.ok(enemyPool.includes(game.randomUnlockedEnemyType()));
      game.state.level = 6;
      const miniBoss = Game.prototype.spawn.call(game, 'miniboss');
      assert.ok(miniPool.some(variant => variant.id === miniBoss.miniVariant.id));
    }
    game.state.bossesDefeated = 0;
    const requestedLockedMiniBoss = Game.prototype.spawn.call(game, 'miniboss', { variant: MINI_BOSS_VARIANTS.at(-1) });
    assert.equal(requestedLockedMiniBoss.miniVariant.id, 'rammer');
  } finally {
    Math.random = originalRandom;
  }

  const unlockLabels = [];
  game.label = (_x, _y, message) => unlockLabels.push(message);
  game.killEnemy({ type: 'boss', value: 35, color: '#fff', x: 100, y: 100, bossVariant: { name: 'BASTILHA' } });
  assert.ok(unlockLabels.includes('NOVO INIMIGO · PERSEGUIDOR'));
  assert.ok(unlockLabels.includes('MINI-CHEFE LIBERADO · RASTREADOR'));
});

test('permanent upgrades cap at level 10 and companion ranks cap at level 5 per ally', () => {
  assert.ok(SHIP_UPGRADES.every(upgrade => upgrade.maxLevel === MAX_PERMANENT_UPGRADE_LEVEL));
  assert.ok(PERMANENT_POWER_UPGRADES.every(upgrade => upgrade.maxLevel === MAX_PERMANENT_UPGRADE_LEVEL));
  assert.ok(POWERS.every(power => !('baseCost' in power) && !('maxLevel' in power)));
  assert.equal(PERMANENT_POWER_UPGRADES.some(upgrade => upgrade.key === 'companion'), false);
  assert.equal(MAX_COMPANION_LEVEL, 5);
  const clampedProfile = normalizeProfile({ shipUpgrades: { hull: 99 }, superpowerUpgrades: { shield: 99 } });
  assert.equal(clampedProfile.shipUpgrades.hull, 10);
  assert.equal(clampedProfile.superpowerUpgrades.shield, 10);

  const game = createHarness();
  game.state.powerBonuses = { companion: 9 };
  game.grantPower({ key: 'companion', modelId: 'scout' });
  const scout = game.state.companions[0];
  assert.equal(scout.level, MAX_COMPANION_LEVEL);
  assert.equal(game.state.powers.companion, MAX_COMPANION_LEVEL);

  game.state.companions = [];
  for (const model of COMPANION_MODELS.slice(0, 4)) game.addCompanion(model, MAX_COMPANION_LEVEL);
  game.profile.unlockedSkills = ['companion'];
  assert.equal(game.availableRunPowers().some(power => power.key === 'companion'), false);
  game.state.companions[0].level -= 1;
  assert.equal(game.availableRunPowers().some(power => power.key === 'companion'), true);
  game.grantPower({ key: 'companion', targetId: game.state.companions[0].id });
  assert.equal(game.state.companions[0].level, MAX_COMPANION_LEVEL);
  assert.ok(game.state.companions.every(companion => companion.level <= MAX_COMPANION_LEVEL));
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

test('one Guardian appears every four levels and the Rift Core is the final boss at level 32', () => {
  const game = createHarness();
  game.spawn = Game.prototype.spawn.bind(game);
  let total = 0;
  const guardianVariants = [];
  for (const level of [4, 8, 12, 16, 20, 24, 28, 32]) {
    game.state.level = level;
    const before = game.state.bossSequence;
    game.spawnBossesForLevel();
    total += game.state.bossSequence - before;
    assert.equal(game.state.bossSequence - before, BOSS_SCHEDULE[level]);
    if (level < MAX_RUN_LEVEL) guardianVariants.push(game.state.entities.enemies.at(-1).bossVariant.id);
  }
  assert.equal(total, TOTAL_BOSSES);
  assert.equal(TOTAL_BOSSES, 8);
  assert.equal(game.state.entities.enemies.at(-1).bossVariant.id, 'rift-core');
  assert.equal(game.state.entities.enemies.at(-1).isFinalBoss, true);
  assert.equal(new Set(guardianVariants).size, 6);
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
