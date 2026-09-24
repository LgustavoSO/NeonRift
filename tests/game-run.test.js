import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../src/core/state.js';
import { buyShipUpgrade, buySuperpowerUpgrade, createDefaultProfile, normalizeProfile, rewardLevel } from '../src/core/profile.js';
import { BOSS_SCHEDULE, COMPANION_MODELS, MAX_COMPANION_LEVEL, MAX_PERMANENT_UPGRADE_LEVEL, MAX_RUN_LEVEL, SHIP_UPGRADES, TOTAL_BOSSES } from '../src/data/hangar.js';
import { ENEMY_PROGRESSION, MINI_BOSS_VARIANTS, unlockedEnemyTypes, unlockedMiniBossVariants } from '../src/data/enemy-progression.js';
import { PERMANENT_POWER_UPGRADES, POWERS, UPGRADES, pickChoices } from '../src/data/upgrades.js';
import { getChoiceNextEffect, getChoiceProgress } from '../src/data/choice-details.js';
import { getHordeProgress } from '../src/data/horde-progress.js';
import { RUN_RULES } from '../src/data/game-rules.js';
import { Game } from '../src/game/Game.js';
import { shieldStats } from '../src/data/power-stats.js';
import { segmentCircleEntry } from '../src/core/math.js';
import { UIController } from '../src/ui/UIController.js';

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

test('horde progress reflects combat, cleanup, a cleared field, and the regroup break', () => {
  const state = createGameState(1024, 768);
  state.wave = 2;
  state.entities.enemies = Array.from({ length: 4 }, () => ({}));

  state.waveBreak = 1.4;
  assert.deepEqual(getHordeProgress(state), {
    phase: 'break', progress: 0, remaining: 1.4, activeEnemies: 4, clearTarget: 4,
  });

  state.waveBreak = 0;
  state.waveClock = 10;
  const combat = getHordeProgress(state);
  assert.equal(combat.phase, 'combat');
  assert.equal(combat.remaining, RUN_RULES.waveLength - 10);
  assert.equal(combat.progress, 10 / RUN_RULES.waveLength * .72);

  state.waveClock = 25;
  const cleanup = getHordeProgress(state);
  assert.equal(cleanup.phase, 'cleanup');
  assert.equal(cleanup.remaining, RUN_RULES.waveDeadline - 25);
  assert.ok(cleanup.progress > .72 && cleanup.progress < 1);

  state.entities.enemies.pop();
  assert.equal(getHordeProgress(state).phase, 'ready');
  state.entities.enemies.push({});
  state.waveClock = RUN_RULES.waveDeadline;
  assert.deepEqual(getHordeProgress(state), {
    phase: 'ready', progress: 1, remaining: 0, activeEnemies: 4, clearTarget: 4,
  });
});

test('choice preview shows current level, resulting level, and the actual next-level gain', () => {
  const game = createHarness();
  const upgrade = UPGRADES.find(item => item.key === 'damage');
  game.state.upgradeLevels.damage = 2;
  assert.deepEqual(getChoiceProgress(upgrade, game.state), { current: 2, next: 3, max: 5, label: 'HABILIDADE' });
  assert.equal(getChoiceNextEffect(upgrade, game.state), '+30% de dano por tiro.');

  const power = POWERS.find(item => item.key === 'charged');
  game.state.powerBonuses = { charged: 1 };
  assert.deepEqual(getChoiceProgress(power, game.state), { current: null, next: null, max: null, label: 'ATIVAÇÃO ÚNICA' });
  assert.match(getChoiceNextEffect(power, game.state), /15× dano base \(crítico incluso\)/);
  game.state.powers.charged = 1;
  game.state.powerBonuses = { charged: 1 };
  assert.equal(getChoiceProgress(power, game.state).label, 'ATIVAÇÃO ÚNICA');
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

  assert.deepEqual(new Set(game.lastChoices.map(choice => choice.key)), new Set(['damage', 'companion']));
  assert.equal(game.lastChoices.some(choice => choice.key === 'shield'), false);
  assert.equal(game.lastChoices.some(choice => choice.key === 'aimbot'), false);
  assert.equal(game.lastChoices.some(choice => choice.apply && (game.state.upgradeLevels[choice.key] ?? 0) >= choice.maxLevel), false);
});

test('each superpower is acquired once per run, with potency set by its Hangar level', () => {
  const game = createHarness();
  game.profile.unlockedSkills = ['shield', 'charged'];
  game.state.powers.shield = 3;
  game.state.powerBonuses = { charged: 2 };
  assert.deepEqual(game.availableRunPowers().map(power => power.key), ['charged']);

  game.grantPower(POWERS.find(power => power.key === 'charged'));
  assert.equal(game.state.powers.charged, 3);
  assert.deepEqual(game.availableRunPowers(), []);
  game.state.chargeTimer = 4;
  game.grantPower(POWERS.find(power => power.key === 'charged'));
  assert.equal(game.state.powers.charged, 3);
  assert.equal(game.state.chargeTimer, 4);
});

test('Hangar rank powers a superpower, while negative attribute tradeoffs scale only with Hangar purchases', () => {
  const game = createHarness();
  game.state.powerBonuses = { nova: 2, aimbot: 0 };
  const nova = POWERS.find(power => power.key === 'nova');
  assert.match(getChoiceNextEffect(nova, game.state), /custa 10 de vida máxima/);
  game.grantPower(nova);
  assert.equal(game.state.powers.nova, 3);
  assert.equal(game.state.player.maxHp, 90);

  const startingRate = game.state.player.rate;
  game.grantPower(POWERS.find(power => power.key === 'aimbot'));
  assert.equal(game.state.powers.aimbot, 1);
  assert.equal(game.state.player.rate, startingRate);
});

test('hangar purchases and in-run power choices use separate catalogs', () => {
  const game = createHarness();
  game.profile.unlockedSkills = ['shield'];
  const runPower = game.availableRunPowers()[0];
  const permanentUpgrade = PERMANENT_POWER_UPGRADES.find(upgrade => upgrade.key === 'shield');
  assert.equal(runPower, POWERS.find(power => power.key === 'shield'));
  assert.notEqual(runPower, permanentUpgrade);
  assert.equal('baseCost' in runPower, false);
  assert.equal('runMaxLevel' in runPower, false);
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
  game.state.mode = 'choice';
  game.applyChoice(UPGRADES.find(upgrade => upgrade.key === 'damage'));
  assert.equal(game.state.player.damage, 19 * 1.3);
  assert.equal(game.state.upgradeLevels.damage, 1);
  assert.equal(game.state.powers.damage, undefined);
});

test('repair is no longer an upgrade choice; hull reinforcement raises only maximum HP', () => {
  const game = createHarness();
  game.state.mode = 'choice';
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
  assert.ok(POWERS.every(power => !('baseCost' in power) && !('maxLevel' in power) && !('runMaxLevel' in power)));
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

test('common enemies have a cumulative 23.5% lower flow and respect population cap', () => {
  const game = createHarness();
  game.state.entities.enemies = Array.from({ length: 19 }, () => ({}));
  game.state.spawnTimer = .1;
  let spawned = 0;
  game.spawn = () => { spawned += 1; };
  game.spawnEnemies(.2);
  assert.equal(spawned, 0);
  assert.equal(RUN_RULES.enemySpawnScale, .85);
  assert.equal(RUN_RULES.commonEnemySpawnScale, .9);
  assert.equal(RUN_RULES.enemySpawnScale * RUN_RULES.commonEnemySpawnScale, .765);
});

test('level-up common-enemy hordes spawn about 23.5% fewer mobs and keep bosses unchanged', () => {
  const game = createHarness();
  game.state.entities.enemies = Array.from({ length: 85 }, () => ({}));
  let spawned = 0;
  game.spawn = () => { spawned += 1; };
  game.levelUp();
  assert.equal(spawned, 1);

  const freshRun = createHarness();
  let hordeSize = 0;
  freshRun.spawn = () => { hordeSize += 1; };
  freshRun.levelUp();
  assert.equal(hordeSize, 13);
  assert.equal(RUN_RULES.enemyCap, 86);
});

test('consumed choices cannot be applied again during play, pause, or after death', () => {
  const game = createHarness();
  const choice = UPGRADES.find(upgrade => upgrade.key === 'damage');
  game.state.mode = 'choice';
  game.applyChoice(choice);
  const damage = game.state.player.damage;
  for (const mode of ['playing', 'paused', 'dead']) {
    game.state.mode = mode;
    game.applyChoice(choice);
    game.finishChoice();
    assert.equal(game.state.player.damage, damage);
    assert.equal(game.state.mode, mode);
  }
});

test('choice UI invalidates old buttons even when a new choice opens immediately', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ setAttribute() {}, addEventListener(_event, callback) { this.click = callback; } }) };
  try {
    const ui = Object.create(UIController.prototype);
    const state = createGameState(1024, 768);
    state.mode = 'choice';
    ui.pauseButton = { classList: { add() {} } };
    ui.choiceHint = {};
    ui.choiceScreen = { classList: { contains: () => false } };
    ui.choiceGrid = { children: [], replaceChildren() { this.children = []; }, append(child) { this.children.push(child); } };
    const choice = UPGRADES.find(item => item.key === 'damage');
    let chosen = 0;
    ui.renderChoices([choice], state, () => {
      chosen += 1;
      ui.renderChoices([choice], state, () => { chosen += 1; });
    });
    const oldButton = ui.choiceGrid.children[0];
    oldButton.click();
    oldButton.click();
    assert.equal(chosen, 1);
    ui.chooseByIndex(0);
    ui.chooseByIndex(0);
    assert.equal(chosen, 2);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('only the intercepting companion stops shooting for two seconds', () => {
  const game = createHarness();
  game.addCompanion(COMPANION_MODELS.find(model => model.id === 'scout'), 5);
  game.addCompanion(COMPANION_MODELS.find(model => model.id === 'striker'), 5);
  const [interceptor, other] = game.state.companions;
  game.state.entities.enemyBullets.push({ x: interceptor.x, y: interceptor.y, vx: 0, vy: 0, radius: 5, damage: 10, life: 3 });
  game.updateEnemyBullets(.016);
  assert.equal(interceptor.disabledTimer, 2);
  assert.equal(other.disabledTimer, 0);
  assert.equal(game.state.entities.enemyBullets.length, 0);
  game.updateCompanions(1);
  assert.equal(interceptor.disabledTimer, 1);
  game.updateCompanions(1);
  assert.equal(interceptor.disabledTimer, 0);
});

test('pause toggles the accessible control and cannot bypass a reward screen', () => {
  const game = createHarness();
  let paused;
  game.ui.setPaused = value => { paused = value; };
  game.togglePause();
  assert.equal(game.state.mode, 'paused');
  assert.equal(paused, true);
  game.togglePause();
  assert.equal(game.state.mode, 'playing');
  assert.equal(paused, false);
  game.state.mode = 'choice';
  game.togglePause();
  assert.equal(game.state.mode, 'choice');
});

test('maxed skills cannot be upgraded through a stale choice', () => {
  const game = createHarness();
  const choice = UPGRADES.find(upgrade => upgrade.key === 'damage');
  game.state.mode = 'choice';
  game.state.upgradeLevels.damage = choice.maxLevel;
  game.applyChoice(choice);
  assert.equal(game.state.player.damage, 19);
  assert.equal(game.state.upgradeLevels.damage, choice.maxLevel);
});

test('fatal hazards stop the frame before healing, XP collection, and enemy spawning', () => {
  const game = createHarness();
  const { player, entities } = game.state;
  let endScreens = 0;
  game.ui.showGameOver = () => { endScreens += 1; };
  player.hp = 1;
  entities.mines.push({ x: player.x, y: player.y, life: 5, armTime: 0, triggerRadius: 40, blastRadius: 80, damage: 50 });
  entities.heals.push({ x: player.x, y: player.y, radius: 16, life: 10 });
  entities.gems.push({ x: player.x, y: player.y, value: 999 });
  game.spawnEnemies = () => assert.fail('spawn after death');
  game.update(.016);
  game.finishRun('victory');
  game.hurt(10);
  assert.equal(player.hp, 0);
  assert.equal(game.state.xp, 0);
  assert.equal(game.state.outcome, 'defeat');
  assert.equal(endScreens, 1);
});

test('both max-rank shields have a full vulnerable recharge window', () => {
  for (const manual of [false, true]) {
    const game = createHarness();
    const key = manual ? 'activeShield' : 'shield';
    const timeKey = manual ? 'activeShieldTime' : 'shieldTime';
    const cooldownKey = manual ? 'activeShieldCooldown' : 'shieldCooldown';
    game.state.powerBonuses = { [key]: 10 };
    game.grantPower({ key });
    if (manual) game.activateShield();
    const { duration, cooldown } = shieldStats(11, manual);
    game.updatePowers(duration);
    assert.equal(game.state[timeKey], 0);
    assert.equal(game.state[cooldownKey], cooldown);
    game.hurt(10);
    assert.equal(game.state.player.hp, 90);
    game.updatePowers(cooldown - .1);
    if (manual) game.activateShield();
    assert.equal(game.state[timeKey], 0);
    game.updatePowers(.2);
    if (manual) game.activateShield();
    assert.ok(game.state[timeKey] > 0);
  }
});

test('Hangar ranks and repeated companion upgrades do not inflate enemy pressure', () => {
  const game = createHarness();
  game.state.powers.shield = 1;
  const base = game.threatLevel();
  game.state.powers.shield = 11;
  game.state.powers.companion = 25;
  assert.equal(game.threatLevel(), base);
  game.state.powers.nova = 1;
  assert.ok(game.threatLevel() > base);
});

test('overdrive never slows an already fast cannon and previews the applied gain', () => {
  const game = createHarness();
  game.state.player.rate = .075;
  const preview = getChoiceNextEffect(POWERS.find(power => power.key === 'overdrive'), game.state);
  game.grantPower({ key: 'overdrive' });
  assert.equal(game.state.player.rate, .07);
  assert.match(preview, /\+7,1% de cadência/);
});

test('swept collision finds crossings, stationary overlaps, tangencies, and misses', () => {
  const target = { x: 50, y: 0 };
  assert.equal(segmentCircleEntry(0, 0, 100, 0, target, 10), .4);
  assert.equal(segmentCircleEntry(50, 0, 50, 0, target, 10), 0);
  assert.equal(segmentCircleEntry(0, 10, 100, 10, target, 10), .5);
  assert.equal(segmentCircleEntry(0, 11, 100, 11, target, 10), null);
  assert.equal(segmentCircleEntry(0, 0, -100, 0, target, 10), null);
});

test('fast projectiles hit the first living target along their path, not array order', () => {
  const game = createHarness();
  const enemy = x => ({ x, y: 100, radius: 9, hp: 100, slow: 0, color: '#fff' });
  const near = enemy(50); const far = enemy(85); const dead = { ...enemy(25), hp: 0 };
  game.state.entities.enemies.push(far, dead, near);
  game.state.entities.bullets.push({ x: 0, y: 100, vx: 3000, vy: 0, life: 1, radius: 4, damage: 10, hit: new Set(), pierce: 0, slow: 0 });
  game.updateBullets(.04);
  assert.equal(near.hp, 90);
  assert.equal(far.hp, 100);
  assert.equal(dead.hp, 0);
  assert.equal(game.state.entities.bullets.length, 0);
  assert.equal(game.nearestEnemy({ x: 0, y: 100 }), near);
});

test('incoming asteroids are retained until they exit and full-health drops are not wasted', () => {
  const game = createHarness();
  const { player, entities } = game.state;
  entities.asteroids.push({ x: -160, y: 50, vx: 300, vy: 0, spin: 0, radius: 24 });
  entities.heals.push({ x: player.x, y: player.y, radius: 16, life: 10 });
  game.updateWorldHazards(.04);
  assert.equal(entities.asteroids.length, 1);
  assert.equal(entities.heals.length, 1);
  player.hp = 80;
  entities.asteroids[0].x = 1200;
  game.updateWorldHazards(.04);
  assert.equal(entities.asteroids.length, 0);
  assert.equal(entities.heals.length, 0);
  assert.equal(player.hp, 100);
});

test('large magnets collect nearby XP without overshooting on a slow frame', () => {
  const game = createHarness();
  game.state.player.magnet = 425;
  game.state.entities.gems.push({ x: game.state.player.x + 25, y: game.state.player.y, value: 3 });
  game.collectGems(.04);
  assert.equal(game.state.entities.gems.length, 0);
  assert.equal(game.state.xp, 3);
});

test('boss rewards resume at the campaign cap even with surplus XP', () => {
  const game = createHarness();
  game.state.level = MAX_RUN_LEVEL;
  game.state.xp = 999;
  game.state.pendingBossRewards = 1;
  game.state.mode = 'choice';
  game.finishBossReward();
  assert.equal(game.state.mode, 'playing');
  game.finishBossReward({ key: 'nova' });
  assert.equal(game.state.powers.nova, 0);
});

test('profile normalization rejects non-finite values, fractional ranks, and unknown skills', () => {
  assert.deepEqual(normalizeProfile(null), createDefaultProfile());
  const profile = normalizeProfile({ credits: Infinity, careerLevel: 3.7, bestLevel: NaN, runs: -1, shipUpgrades: { hull: 2.9, engine: Infinity }, superpowerUpgrades: { shield: 999 }, unlockedSkills: ['shield', 'unknown'] });
  assert.equal(profile.credits, 0);
  assert.equal(profile.careerLevel, 3);
  assert.equal(profile.bestLevel, 3);
  assert.equal(profile.runs, 0);
  assert.equal(profile.shipUpgrades.hull, 2);
  assert.equal(profile.shipUpgrades.engine, 0);
  assert.equal(profile.superpowerUpgrades.shield, 10);
  assert.ok(!profile.unlockedSkills.includes('unknown'));
});

test('late waves apply the population reduction once and stop at the shared cap', () => {
  const game = createHarness();
  game.state.wave = 20;
  game.state.level = 32;
  game.state.entities.enemies = Array.from({ length: 85 }, () => ({}));
  game.spawn = () => game.state.entities.enemies.push({});
  game.spawnEnemies(.1);
  assert.equal(game.state.entities.enemies.length, 86);
  game.spawnEnemies(1);
  assert.equal(game.state.entities.enemies.length, 86);
});

test('seeded combat simulation keeps early, mid, and max-rank builds finite and bounded', () => {
  const originalRandom = Math.random;
  let seed = 237;
  Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  try {
    for (const level of [1, 16, 32]) {
      const game = createHarness();
      game.spawn = Game.prototype.spawn;
      game.burst = Game.prototype.burst;
      game.label = Game.prototype.label;
      game.state.level = level;
      game.state.bossesDefeated = Math.floor((level - 1) / 4);
      game.state.nextXp = Number.MAX_SAFE_INTEGER;
      if (level > 1) {
        game.state.powerBonuses = Object.fromEntries(POWERS.filter(power => power.key !== 'companion').map(power => [power.key, level === 32 ? 10 : 3]));
        for (const power of POWERS.filter(power => power.key !== 'companion')) game.grantPower(power);
        for (const model of COMPANION_MODELS.slice(0, 3)) game.addCompanion(model, 5);
        game.state.player.shots = 6;
      }
      for (let frame = 0; frame < 3600; frame += 1) {
        // Invulnerability isolates long-running simulation health from player skill.
        game.state.player.invulnerable = 100;
        game.update(1 / 60);
        assert.equal(game.state.mode, 'playing');
        assert.ok(game.state.entities.enemies.length <= RUN_RULES.enemyCap);
        assert.ok(game.state.entities.particles.length <= 430);
        for (const entity of [game.state.player, ...Object.values(game.state.entities).flat()]) {
          assert.ok(Number.isFinite(entity.x) && Number.isFinite(entity.y));
        }
      }
    }
  } finally { Math.random = originalRandom; }
});
