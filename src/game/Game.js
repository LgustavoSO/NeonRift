import { UPGRADES, POWERS, pickChoices } from '../data/upgrades.js';
import { powerLevelsAdded, powerRunMaxLevel } from '../data/choice-details.js';
import { angleTo, clamp, distance, random, TAU } from '../core/math.js';
import { createGameState, randomSpawnPosition, resizeState } from '../core/state.js';
import { loadBestScore, saveBestScore } from '../core/storage.js';
import { AudioManager } from '../core/audio.js';
import { loadProfile, saveProfile, rewardLevel, buyShipUpgrade, buySuperpowerUpgrade } from '../core/profile.js';
import { BOSS_SCHEDULE, COMPANION_MODELS, MAX_COMPANION_LEVEL, MAX_RUN_COMPANIONS, MAX_RUN_LEVEL, MAX_RUN_POWER_LEVEL, TOTAL_BOSSES } from '../data/hangar.js';
import { ENEMY_PROGRESSION, MINI_BOSS_VARIANTS, unlockedEnemyTypes, unlockedMiniBossVariants } from '../data/enemy-progression.js';

const ENEMY_TYPES = {
  grunt: { radius: 13, hp: 28, speed: 75, damage: 13, value: 2, color: '#fb6384' },
  runner: { radius: 9, hp: 17, speed: 142, damage: 10, value: 3, color: '#ffbd69' },
  tank: { radius: 22, hp: 110, speed: 48, damage: 22, value: 6, color: '#b36dff' },
  sniper: { radius: 12, hp: 38, speed: 63, damage: 11, value: 5, color: '#72a7ff' },
  minelayer: { radius: 15, hp: 52, speed: 70, damage: 14, value: 7, color: '#ff8466' },
  boss: { radius: 37, hp: 650, speed: 56, damage: 27, value: 35, color: '#ff4fc6' },
  miniboss: { radius: 25, hp: 250, speed: 60, damage: 21, value: 18, color: '#ff9b62' },
};

const BOSS_VARIANTS = [
  { id: 'bulwark', name: 'BASTILHA', color: '#ff4fc6' },
  { id: 'lancer', name: 'LANÇA-VAZIO', color: '#ff795e' },
  { id: 'tempest', name: 'TEMPESTADE', color: '#a884ff' },
  { id: 'devourer', name: 'DEVORADOR', color: '#78dbff' },
  { id: 'oracle', name: 'ORÁCULO', color: '#ffe783' },
  { id: 'shatter', name: 'ESTILHAÇADOR', color: '#ff8fc8' },
];

const RUN_RULES = { bossCount: TOTAL_BOSSES, waveLength: 21, waveDeadline: 31, waveBreak: 2.1, enemyCap: 96 };

export class Game {
  constructor({ renderer, input, ui }) {
    this.renderer = renderer;
    this.input = input;
    this.ui = ui;
    this.audio = new AudioManager();
    this.state = null;
    this.bestScore = loadBestScore();
    this.profile = loadProfile();
    this.lastTime = performance.now();
    this.now = 0;
    this.ui.onStart = () => this.start();
    this.ui.onOpenHangar = () => this.openHangar();
    this.ui.showMenu(this.profile);
    this.input.onDash = () => this.dash();
    this.input.onChargedShot = () => this.chargedShot();
    this.input.onTeleport = () => this.teleport();
    this.input.onActiveShield = () => this.activateShield();
    this.input.onPointerMove = pointer => {
      if (this.state?.mode === 'playing') this.state.player.angle = Math.atan2(pointer.y - this.state.player.y, pointer.x - this.state.player.x);
    };
    this.input.onPause = () => this.togglePause();
    this.input.onChoice = index => this.ui.chooseByIndex(index);
    addEventListener('resize', () => { if (this.state) resizeState(this.state, this.renderer.width, this.renderer.height); });
    requestAnimationFrame(time => this.loop(time));
  }

  start() {
    this.state = createGameState(this.renderer.width, this.renderer.height);
    this.state.powerBonuses = { ...this.profile.superpowerUpgrades };
    this.profile.runs += 1;
    this.profile = saveProfile(this.profile);
    const upgrades = this.profile.shipUpgrades;
    this.state.player.maxHp += upgrades.hull * 15;
    this.state.player.hp = this.state.player.maxHp;
    this.state.player.damage *= 1 + upgrades.cannon * .08;
    this.state.player.move *= 1 + upgrades.engine * .05;
    this.state.player.dashDuration += upgrades.dashDuration * .08;
    this.state.player.rate *= .95 ** upgrades.cadence;
    this.ui.showPlaying();
    this.lastTime = performance.now();
    this.audio.play(650, .25, 'sawtooth', .06);
  }

  openHangar() {
    this.state = null;
    this.ui.showHangar(this.profile, {
      buyUpgrade: key => this.updateProfile(buyShipUpgrade(this.profile, key)),
      buyPowerUpgrade: key => this.updateProfile(buySuperpowerUpgrade(this.profile, key)),
    });
  }

  updateProfile(result) {
    if (result.ok) this.profile = saveProfile(result.profile);
    this.ui.showHangar(this.profile, {
      buyUpgrade: key => this.updateProfile(buyShipUpgrade(this.profile, key)),
      buyPowerUpgrade: key => this.updateProfile(buySuperpowerUpgrade(this.profile, key)),
    });
  }

  addCompanion(model = {}, level = 1) {
    const state = this.state;
    const player = state.player;
    const phase = state.time * 1.25 + state.companions.length * TAU / Math.max(1, state.companions.length + 1);
    state.companions.push({ id: state.companionSequence++, modelId: model.id ?? 'scout', role: model.role, name: model.name ?? 'Vaga-lume', icon: model.icon ?? '🛸', color: model.color ?? '#a6fff1', level, damageMultiplier: model.damageMultiplier ?? 1, cadenceMultiplier: model.cadenceMultiplier ?? 1, flightSpeed: model.flightSpeed ?? 1, interceptLevel: model.interceptLevel ?? 3, slowBonus: model.slowBonus ?? 0, shotPierce: model.shotPierce ?? 0, reflects: Boolean(model.reflects), collects: Boolean(model.collects), x: player.x + Math.cos(phase) * 52, y: player.y + Math.sin(phase) * 52, phase, angle: 0, shootTimer: .4, disabledTimer: 0, hitFlash: 0, intercepting: false, collectionPhase: 'collect', collectionTimer: level * 5, carriedXp: 0, shieldCooldown: 0 });
  }

  loop(time) {
    const delta = Math.min((time - this.lastTime) / 1000, .04);
    this.lastTime = time;
    this.now = time;
    if (this.state?.mode === 'playing') this.update(delta);
    this.renderer.draw(this.state ?? this.previewState(), this.input.pointer, this.bestScore, time);
    requestAnimationFrame(nextTime => this.loop(nextTime));
  }

  previewState() { return { mode: 'menu', time: this.now / 1000, shake: 0, flash: 0, powers: {}, companions: [], chargeTimer: 0, shieldTime: 0, entities: { bullets: [], enemyBullets: [], enemies: [], gems: [], heals: [], asteroids: [], rings: [], particles: [], floaters: [] }, player: { x: this.renderer.width / 2, y: this.renderer.height / 2, angle: 0, radius: 13, hp: 100, maxHp: 100, dash: 0, dashTime: 0, invulnerable: 0 }, wave: 0, level: 0, score: 0, xp: 0, nextXp: 1 }; }

  update(delta) {
    const state = this.state;
    const { player, entities } = state;
    state.time += delta; state.waveClock += delta; state.asteroidTimer -= delta; state.healTimer -= delta;
    state.waveBreak = Math.max(0, state.waveBreak - delta);
    this.updateWorldHazards(delta);
    this.updatePlayer(delta);
    this.updatePowers(delta);
    this.spawnEnemies(delta);
    this.updateBullets(delta);
    this.updateEnemies(delta);
    this.updateEnemyBullets(delta);
    this.collectGems(delta);
    this.updateParticles(delta);
    state.shake = Math.max(0, state.shake - 28 * delta); state.flash = Math.max(0, state.flash - delta);
    if (state.waveClock >= RUN_RULES.waveLength && (entities.enemies.length < Math.max(3, state.wave * 2) || state.waveClock >= RUN_RULES.waveDeadline)) this.nextWave();
    if (state.pendingBossRewards > 0 && state.mode === 'playing') this.openBossReward();
    if (state.level < MAX_RUN_LEVEL && state.xp >= state.nextXp && state.mode === 'playing') this.levelUp();
  }

  updateWorldHazards(delta) {
    const state = this.state; const { player, entities } = state;
    if (state.asteroidTimer <= 0) {
      const pressure = this.threatLevel();
      const count = Math.min(5, 2 + (Math.random() < .55 ? 1 : 0) + (pressure > 1.3 ? 1 : 0) + (state.level >= 20 ? 1 : 0));
      for (let index = 0; index < count; index += 1) {
        const fromLeft = Math.random() < .5;
        const levelSpeed = Math.max(0, state.level - 1) * 4 + Math.max(0, state.level - 19) * 8;
        const speed = random(300 + state.wave * 10 + levelSpeed, 390 + state.wave * 14 + levelSpeed);
        entities.asteroids.push({ x: fromLeft ? -65 - index * 28 : this.renderer.width + 65 + index * 28, y: random(55, Math.max(56, this.renderer.height - 55)), vx: fromLeft ? speed : -speed, vy: random(-76, 76), radius: random(24, 36), spin: random(0, TAU), hit: false });
      }
      const gap = Math.max(2.8, 8 - state.wave * .2 - state.level * .055 - this.powerCount() * .28);
      state.asteroidTimer = random(gap, gap + 2.4);
      this.label(this.renderer.width / 2, this.renderer.height * .2, `☄ CHUVA DE ASTEROIDES · ${count}`, '#ffc17a');
      this.audio.play(180, .38, 'sawtooth', .07);
    }
    for (let index = entities.asteroids.length - 1; index >= 0; index -= 1) { const asteroid = entities.asteroids[index]; asteroid.x += asteroid.vx * delta; asteroid.y += asteroid.vy * delta; asteroid.spin += delta * 2; if (!asteroid.hit && distance(asteroid, player) < asteroid.radius + player.radius && player.dashTime <= 0 && state.shieldTime <= 0) { asteroid.hit = true; this.hurt(Math.max(1, Math.ceil(player.hp * .33))); this.burst(player.x, player.y, '#ffb073', 25); this.label(player.x, player.y - 25, '-33% VIDA ATUAL', '#ffb073'); } if (asteroid.x < -100 || asteroid.x > this.renderer.width + 100) entities.asteroids.splice(index, 1); }
    this.updateMines(delta);
    if (state.healTimer <= 0) { entities.heals.push({ x: random(42, Math.max(43, this.renderer.width - 42)), y: random(125, Math.max(126, this.renderer.height - 42)), life: 22, radius: 16, phase: random(0, TAU) }); state.healTimer = random(16, 24); this.label(this.renderer.width / 2, this.renderer.height * .2, '✚ CÁPSULA DE REPARO · +35 VIDA', '#8aff9e'); }
    for (let index = entities.heals.length - 1; index >= 0; index -= 1) { const heal = entities.heals[index]; heal.life -= delta; if (distance(heal, player) < heal.radius + player.radius) { const amount = Math.min(35, player.maxHp - player.hp); player.hp += amount; this.label(player.x, player.y - 24, `+${Math.round(amount)} VIDA`, '#6dffc1'); this.burst(heal.x, heal.y, '#5dffab', 18); entities.heals.splice(index, 1); } else if (heal.life <= 0) entities.heals.splice(index, 1); }
    for (let index = entities.rings.length - 1; index >= 0; index -= 1) { entities.rings[index].life -= delta; if (entities.rings[index].life <= 0) entities.rings.splice(index, 1); }
  }

  updateMines(delta) {
    const { player, entities } = this.state;
    for (let index = entities.mines.length - 1; index >= 0; index -= 1) {
      const mine = entities.mines[index];
      mine.life -= delta;
      mine.armTime = Math.max(0, mine.armTime - delta);
      const triggered = mine.friendly
        ? entities.enemies.some(enemy => distance(mine, enemy) < mine.triggerRadius + enemy.radius)
        : distance(mine, player) < mine.triggerRadius;
      if (mine.armTime <= 0 && triggered) {
        const radius = mine.blastRadius;
        if (!mine.friendly && distance(mine, player) < radius + player.radius) this.hurt(mine.damage);
        for (const enemy of entities.enemies) if (mine.friendly && distance(mine, enemy) < radius + enemy.radius) enemy.hp -= mine.damage * 2;
        entities.rings.push({ kind: 'mine', x: mine.x, y: mine.y, maxRadius: radius, life: .55, duration: .55, color: mine.friendly ? '#78ffe0' : '#ff765f' });
        this.burst(mine.x, mine.y, mine.friendly ? '#78ffe0' : '#ff765f', 26, 1.4);
        entities.mines.splice(index, 1);
      } else if (mine.life <= 0) entities.mines.splice(index, 1);
    }
  }

  updatePlayer(delta) {
    const state = this.state; const { player } = state; const movement = this.input.movement();
    if (movement.x || movement.y) { player.x = clamp(player.x + movement.x * player.move * (player.dashTime > 0 ? 3.8 : 1) * delta, player.radius, this.renderer.width - player.radius); player.y = clamp(player.y + movement.y * player.move * (player.dashTime > 0 ? 3.8 : 1) * delta, player.radius, this.renderer.height - player.radius); if (Math.random() < .25) this.burst(player.x - movement.x * 14, player.y - movement.y * 14, '#38b6ff', 1, .2); }
    state.aimTarget = state.powers.aimbot ? this.nearestEnemy(player) : null;
    if (this.input.pointer.active) player.angle = Math.atan2(this.input.pointer.y - player.y, this.input.pointer.x - player.x);
    else if (state.aimTarget) player.angle = angleTo(player, state.aimTarget);
    player.invulnerable = Math.max(0, player.invulnerable - delta); player.dash = Math.max(0, player.dash - delta); player.dashTime = Math.max(0, player.dashTime - delta); player.shootTimer -= delta;
    if (player.shootTimer <= 0 && state.entities.enemies.length) { this.shoot(); player.shootTimer = player.rate; }
  }

  updatePowers(delta) {
    const state = this.state; const { player, entities } = state;
    state.shieldCooldown = Math.max(0, state.shieldCooldown - delta); state.shieldTime = Math.max(0, state.shieldTime - delta); state.chargeTimer = Math.max(0, state.chargeTimer - delta);
    state.activeShieldTime = Math.max(0, state.activeShieldTime - delta);
    state.activeShieldCooldown = Math.max(0, state.activeShieldCooldown - delta);
    state.teleportCooldown = Math.max(0, state.teleportCooldown - delta);
    if (state.powers.shield && state.shieldTime <= 0 && state.shieldCooldown <= 0) { state.shieldTime = 2.4 + .8 * state.powers.shield; state.shieldCooldown = Math.max(7, 16 - 2 * state.powers.shield); this.burst(player.x, player.y, '#81ffca', 18, .7); }
    if (state.companions.length) this.updateCompanions(delta);
    if (state.firewheelLevel) {
      state.firewheelTimer -= delta;
      if (state.firewheelTimer <= 0) {
        const radius = 74 + state.firewheelLevel * 15;
        for (const enemy of entities.enemies) if (distance(player, enemy) < radius + enemy.radius) enemy.hp -= player.damage * (.45 + state.firewheelLevel * .22);
        entities.rings.push({ kind: 'firewheel', x: player.x, y: player.y, maxRadius: radius, life: .45, duration: .45, color: '#ff9f5e' });
        state.firewheelTimer = Math.max(.65, 1.65 - state.firewheelLevel * .2);
      }
    }
    if (state.powers.nova) { state.novaTimer -= delta; if (state.novaTimer <= 0) { const radius = 155 + state.powers.nova * 25; for (const enemy of entities.enemies) if (distance(player, enemy) < radius) enemy.hp -= player.damage * (2 + state.powers.nova); for (let index = entities.enemyBullets.length - 1; index >= 0; index -= 1) if (distance(player, entities.enemyBullets[index]) < radius) entities.enemyBullets.splice(index, 1); this.burst(player.x, player.y, '#a790ff', 65, 2); entities.rings.push({ kind: 'nova', x: player.x, y: player.y, maxRadius: radius, life: .9, duration: .9, color: '#c4a3ff' }); state.novaTimer = Math.max(4.5, 10 - state.powers.nova); this.audio.play(110, .4, 'triangle', .1); } }
    if (state.powers.singularity) {
      state.singularityTimer -= delta;
      if (state.singularityTimer <= 0) {
        const radius = 230 + state.powers.singularity * 24;
        for (const enemy of entities.enemies) {
          if (distance(player, enemy) > radius) continue;
          const angle = angleTo(enemy, player);
          const pull = enemy.type === 'boss' || enemy.type === 'miniboss' ? 18 : 74;
          enemy.x += Math.cos(angle) * pull;
          enemy.y += Math.sin(angle) * pull;
          enemy.slow = Math.max(enemy.slow, .55 + state.powers.singularity * .08);
          enemy.hp -= player.damage * (.7 + state.powers.singularity * .2);
        }
        this.burst(player.x, player.y, '#ba8cff', 44, 1.4);
        entities.rings.push({ kind: 'singularity', x: player.x, y: player.y, maxRadius: radius, life: 1.05, duration: 1.05, color: '#b78bff' });
        state.singularityTimer = Math.max(4.2, 8 - state.powers.singularity * .7);
        this.audio.play(125, .38, 'triangle', .09);
      }
    }
    if (state.powers.ionStorm) {
      state.ionStormTimer -= delta;
      if (state.ionStormTimer <= 0 && entities.enemies.length) {
        const count = Math.min(MAX_RUN_POWER_LEVEL, 2 + state.powers.ionStorm);
        const targets = [...entities.enemies].sort(() => Math.random() - .5).slice(0, count);
        for (const enemy of targets) {
          enemy.hp -= player.damage * (1.15 + state.powers.ionStorm * .28);
          enemy.slow = Math.max(enemy.slow, .35);
          this.burst(enemy.x, enemy.y, '#a9f9ff', 14, 1.1);
          entities.rings.push({ kind: 'ion', x: enemy.x, y: enemy.y, originX: player.x, originY: player.y, maxRadius: enemy.radius + 28, life: .5, duration: .5, color: '#85f2ff' });
        }
        this.label(player.x, player.y - 42, 'TEMPESTADE IÔNICA', '#a9f9ff');
        state.ionStormTimer = Math.max(2.4, 5 - state.powers.ionStorm * .45);
        this.audio.play(520, .2, 'sawtooth', .06);
      }
    }
    if (state.powers.minefield) {
      state.minefieldTimer -= delta;
      if (state.minefieldTimer <= 0 && entities.mines.length < 14) {
        const angle = random(0, TAU);
        const radius = random(90, 210);
        entities.mines.push({ x: clamp(player.x + Math.cos(angle) * radius, 28, this.renderer.width - 28), y: clamp(player.y + Math.sin(angle) * radius, 72, this.renderer.height - 28), life: 18, armTime: .65, triggerRadius: 55, blastRadius: 112, damage: player.damage * (1.8 + state.powers.minefield * .5), friendly: true });
        this.label(player.x, player.y - 34, 'MINA DO RIFT INSTALADA', '#8dffe2');
        state.minefieldTimer = Math.max(2.2, 5.4 - state.powers.minefield * .55);
      }
    }
    if (state.powers.riftLance) {
      state.riftLanceTimer -= delta;
      if (state.riftLanceTimer <= 0 && entities.enemies.length) {
        const targets = [...entities.enemies].sort((a, b) => distance(player, a) - distance(player, b)).slice(0, Math.min(MAX_RUN_POWER_LEVEL, 1 + state.powers.riftLance));
        for (const enemy of targets) {
          enemy.hp -= player.damage * (1.4 + state.powers.riftLance * .55);
          entities.rings.push({ kind: 'riftLance', x: enemy.x, y: enemy.y, originX: player.x, originY: player.y, maxRadius: enemy.radius + 20, life: .45, duration: .45, color: '#ffb8ff' });
          this.burst(enemy.x, enemy.y, '#ffb8ff', 10, .8);
        }
        state.riftLanceTimer = Math.max(1.5, 3.8 - state.powers.riftLance * .45);
      }
    }
  }

  updateCompanions(delta) {
    const state = this.state;
    const { player, entities, companions } = state;
    const count = companions.length;
    for (let index = 0; index < count; index += 1) {
      const companion = companions[index];
      companion.disabledTimer = Math.max(0, companion.disabledTimer - delta);
      companion.hitFlash = Math.max(0, companion.hitFlash - delta);
      companion.shootTimer -= delta;
      companion.shieldCooldown = Math.max(0, (companion.shieldCooldown ?? 0) - delta);
      companion.phase = state.time * 1.25 + index * TAU / count;
      const orbitRadius = 52 + index % 2 * 12;
      const homeX = player.x + Math.cos(companion.phase) * orbitRadius;
      const homeY = player.y + Math.sin(companion.phase) * orbitRadius;
      const intercept = !companion.collects && companion.level >= companion.interceptLevel && companion.disabledTimer <= 0 ? this.findProjectileIntercept(companion) : null;
      companion.intercepting = Boolean(intercept);
      let targetX = intercept?.x ?? homeX;
      let targetY = intercept?.y ?? homeY;
      if (companion.collects) {
        companion.collectionTimer -= delta;
        if (companion.collectionTimer <= 0) {
          companion.collectionPhase = companion.collectionPhase === 'collect' ? 'deliver' : 'collect';
          companion.collectionTimer = companion.level * 5;
          if (companion.collectionPhase === 'collect') companion.deliveryDone = false;
        }
        if (companion.collectionPhase === 'collect') {
          const gem = entities.gems.reduce((nearest, item) => !nearest || distance(companion, item) < distance(companion, nearest) ? item : nearest, null);
          if (gem) {
            targetX = gem.x; targetY = gem.y;
            if (distance(companion, gem) < 18) {
              companion.carriedXp += gem.value;
              entities.gems.splice(entities.gems.indexOf(gem), 1);
              this.burst(gem.x, gem.y, companion.color, 6, .4);
            }
          }
        } else {
          targetX = player.x; targetY = player.y;
          if (!companion.deliveryDone && distance(companion, player) < 34 && companion.carriedXp > 0) {
            state.xp += companion.carriedXp;
            this.label(player.x, player.y - 38, `PEREGRINO ENTREGOU +${companion.carriedXp} XP`, '#8dffe2');
            companion.carriedXp = 0;
            companion.deliveryDone = true;
          }
        }
      }
      this.moveCompanionToward(companion, targetX, targetY, (intercept ? 540 : 390) * companion.flightSpeed, delta);
      companion.angle = Math.atan2(targetY - companion.y, targetX - companion.x);
      if (!companion.collects && companion.disabledTimer <= 0 && entities.enemies.length && companion.shootTimer <= 0) {
        this.companionShoot(companion);
        companion.shootTimer = Math.max(.24, .82 * Math.pow(.86, companion.level - 1) / companion.cadenceMultiplier);
      }
    }
  }

  findProjectileIntercept(companion) {
    const state = this.state;
    const { player, entities } = state;
    let best = null;
    for (const bullet of entities.enemyBullets) {
      const speed = Math.hypot(bullet.vx, bullet.vy);
      if (!speed) continue;
      const ux = bullet.vx / speed;
      const uy = bullet.vy / speed;
      const toPlayerX = player.x - bullet.x;
      const toPlayerY = player.y - bullet.y;
      const along = toPlayerX * ux + toPlayerY * uy;
      if (along <= 0 || along > Math.min(speed * 1.15, 520)) continue;
      const miss = Math.abs(toPlayerX * uy - toPlayerY * ux);
      if (miss > player.radius + bullet.radius + 18) continue;
      const safeDistance = player.radius + bullet.radius + 10;
      const x = bullet.x + ux * Math.max(0, along - safeDistance);
      const y = bullet.y + uy * Math.max(0, along - safeDistance);
      const timeToIntercept = distance(companion, { x, y }) / (540 * companion.flightSpeed);
      const timeToImpact = along / speed;
      if (timeToIntercept > timeToImpact + .04) continue;
      if (!best || timeToImpact < best.timeToImpact) best = { x, y, timeToImpact };
    }
    return best;
  }

  moveCompanionToward(companion, x, y, speed, delta) {
    const dx = x - companion.x;
    const dy = y - companion.y;
    const distanceToTarget = Math.hypot(dx, dy);
    if (!distanceToTarget) return;
    const step = Math.min(distanceToTarget, speed * delta);
    companion.x += dx / distanceToTarget * step;
    companion.y += dy / distanceToTarget * step;
  }

  spawnEnemies(delta) {
    const state = this.state;
    const pressure = this.threatLevel();
    const maximum = Math.min(RUN_RULES.enemyCap, 14 + state.wave * 5 + state.level * 2 + this.powerCount() * 3);
    state.spawnTimer -= delta;
    if (state.waveBreak > 0 || state.spawnTimer > 0 || state.entities.enemies.length >= maximum) return;
    this.spawn(this.randomUnlockedEnemyType());
    const interval = Math.max(.15, .7 - state.wave * .025 - state.level * .008 - this.powerCount() * .035 - pressure * .035);
    state.spawnTimer = interval * random(.72, 1.25);
  }

  unlockedEnemyTypes() { return unlockedEnemyTypes(this.state.bossesDefeated); }

  unlockedMiniBossVariants() { return unlockedMiniBossVariants(this.state.bossesDefeated); }

  randomUnlockedEnemyType() {
    const types = this.unlockedEnemyTypes();
    return types[Math.floor(Math.random() * types.length)];
  }

  canUpgradeCompanion() {
    const state = this.state;
    return state.companions.some(companion => companion.level < MAX_COMPANION_LEVEL)
      || (state.companions.length < MAX_RUN_COMPANIONS && COMPANION_MODELS.some(model => !state.companions.some(companion => companion.modelId === model.id)));
  }

  spawn(type, options = {}) {
    const state = this.state;
    const template = ENEMY_TYPES[type];
    const position = randomSpawnPosition(this.renderer.width, this.renderer.height);
    const pressure = this.threatLevel();
    const scale = 1 + state.wave * .08 + pressure * .14 + Math.max(0, state.level - 12) * .035;
    const elite = !['boss', 'miniboss'].includes(type) && pressure > .35 && Math.random() < Math.min(.2, pressure * .075);
    const enemy = {
      ...position, type, radius: template.radius, hp: template.hp * scale * (elite ? 1.45 : 1),
      maxHp: template.hp * scale * (elite ? 1.45 : 1),
      speed: template.speed * (1 + state.wave * .021 + state.level * .004 + pressure * .04) * (elite ? 1.1 : 1),
      damage: template.damage * (1 + pressure * .09 + state.level * .006) * (elite ? 1.16 : 1),
      value: template.value, color: template.color, shootTimer: random(.8, 2), pulse: random(0, TAU),
      slow: 0, adaptive: null, side: 1, elite, eliteShotTimer: random(2.4, 4), specialTimer: random(2, 4),
    };
    if (type === 'boss') Object.assign(enemy, { bossVariant: options.variant, color: options.variant.color, radius: 40, hp: template.hp * scale * (1 + state.level * .09), maxHp: template.hp * scale * (1 + state.level * .09), speed: template.speed * (1 + pressure * .025) });
    if (type === 'miniboss') {
      const variants = this.unlockedMiniBossVariants();
      const requestedVariant = variants.find(item => item.id === options.variant?.id);
      const variant = requestedVariant ?? variants[Math.max(0, Math.floor(state.level / 3) - 1) % variants.length];
      Object.assign(enemy, { miniVariant: variant, color: variant.color, radius: 29, hp: template.hp * scale * 1.8, maxHp: template.hp * scale * 1.8, speed: template.speed * (1 + pressure * .025), shootTimer: 1.5 });
    }
    state.entities.enemies.push(enemy);
    return enemy;
  }

  spawnBoss() {
    const state = this.state;
    const isFinalBoss = state.level >= MAX_RUN_LEVEL;
    const variant = isFinalBoss
      ? { id: 'rift-core', name: 'NÚCLEO DO RIFT', color: '#ffe783' }
      : BOSS_VARIANTS[state.bossSequence % BOSS_VARIANTS.length];
    state.bossSequence += 1;
    const boss = this.spawn('boss', { variant });
    const player = state.player;
    boss.adaptive = { shield: player.rate < .29 || player.shots > 1 || player.pierce > 0, agile: player.move > 185 || player.dashCooldown < 3, armor: player.damage > 19 || player.crit > .06, resist: player.slow > 0, barrage: player.maxHp > 100 || player.hp > 100 };
    boss.hp *= Math.max(.9, 1 + (state.level - 4) * .045);
    if (isFinalBoss) {
      boss.isFinalBoss = true;
      boss.radius = 49;
      boss.hp *= 1.65;
    }
    boss.maxHp = boss.hp;
    boss.shootTimer = .8;
    this.label(this.renderer.width / 2, this.renderer.height * .25, `${isFinalBoss ? '☢ CHEFE FINAL' : '⚠ GUARDIÃO'} ${variant.name} · NÍVEL ${state.level}`, variant.color);
    this.audio.play(170, .6, 'sawtooth', .11);
  }

  spawnBossesForLevel() {
    const level = this.state.level;
    const count = BOSS_SCHEDULE[level] ?? 0;
    for (let index = 0; index < count; index += 1) this.spawnBoss();
  }

  threatLevel() {
    const state = this.state;
    return Math.min(2.4, Math.max(0, state.wave - 1) * .075 + Math.max(0, state.level - 1) * .045 + this.powerCount() * .14 + state.companions.length * .08);
  }

  powerCount() { return Object.values(this.state.powers).reduce((total, count) => total + count, 0) + this.state.companions.length * .35; }

  nearestEnemy(origin = this.state.player) {
    return this.state.entities.enemies.reduce((nearest, enemy) => !nearest || distance(origin, enemy) < distance(origin, nearest) ? enemy : nearest, null);
  }

  shoot() {
    const state = this.state;
    const { player, entities } = state;
    const target = this.nearestEnemy(player);
    if (!target) return;
    const center = this.input.pointer.active ? Math.atan2(this.input.pointer.y - player.y, this.input.pointer.x - player.x) : angleTo(player, target);
    player.angle = center;
    const fire = (angle, isAutoAim = false) => {
      const speed = player.projectileSpeed;
      entities.bullets.push({ x: player.x + Math.cos(angle) * 18, y: player.y + Math.sin(angle) * 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, life: 1.1, radius: 4, damage: player.damage * (isAutoAim ? .62 : 1), pierce: player.pierce, hit: new Set(), critical: Math.random() < player.crit, slow: player.slow, overdrive: state.powers.overdrive > 0, autoAim: isAutoAim });
    };
    for (let index = 0; index < player.shots; index += 1) {
      fire(center + (index - (player.shots - 1) / 2) * .16);
    }
    const autoTarget = state.powers.aimbot ? state.aimTarget : null;
    const autoShots = Math.min(MAX_RUN_POWER_LEVEL, state.powers.aimbot);
    if (autoTarget && entities.enemies.includes(autoTarget)) {
      const targetAngle = angleTo(player, autoTarget);
      for (let index = 0; index < autoShots; index += 1) fire(targetAngle + (index - (autoShots - 1) / 2) * .08, true);
    }
    this.audio.play(450, .055, 'triangle', .016);
    this.burst(player.x + Math.cos(center) * 17, player.y + Math.sin(center) * 17, state.powers.overdrive ? '#ffbd58' : '#70f5ff', state.powers.overdrive ? 6 : 3, state.powers.overdrive ? .7 : .35);
  }

  companionShoot(companion) {
    const state = this.state;
    const player = state.player;
    const origin = { x: companion.x, y: companion.y };
    const target = state.entities.enemies.reduce((nearest, enemy) => !nearest || distance(origin, enemy) < distance(origin, nearest) ? enemy : nearest, null);
    if (!target) return;
    const angle = angleTo(origin, target);
    const level = companion.level;
    const speed = 570 + Math.min(level - 1, 5) * 22;
    const damage = player.damage * Math.min(.9, .42 + (level - 1) * .09) * companion.damageMultiplier;
    state.entities.bullets.push({ x: origin.x, y: origin.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.2, radius: 4, damage, pierce: companion.shotPierce ?? 0, hit: new Set(), critical: false, slow: Math.min(.7, player.slow + (companion.slowBonus ?? 0)), companionShot: true, color: companion.color });
  }

  updateBullets(delta) {
    const state = this.state; const { bullets, enemies } = state.entities;
    for (let index = bullets.length - 1; index >= 0; index -= 1) {
      const bullet = bullets[index];
      bullet.x += bullet.vx * delta; bullet.y += bullet.vy * delta; bullet.life -= delta;
      if (bullet.life <= 0 || bullet.x < -40 || bullet.x > this.renderer.width + 40 || bullet.y < -40 || bullet.y > this.renderer.height + 40) { bullets.splice(index, 1); continue; }
      if (bullet.charged) {
        const asteroidIndex = state.entities.asteroids.findIndex(asteroid => distance(bullet, asteroid) < asteroid.radius + bullet.radius);
        if (asteroidIndex >= 0) {
          const asteroid = state.entities.asteroids.splice(asteroidIndex, 1)[0];
          this.explodeChargedShot(bullet, asteroid.x, asteroid.y);
          bullets.splice(index, 1);
          continue;
        }
      }
      let remove = false;
      for (const enemy of enemies) {
        if (bullet.hit.has(enemy) || distance(bullet, enemy) > enemy.radius + bullet.radius) continue;
        bullet.hit.add(enemy);
        const damage = bullet.damage * (bullet.critical ? 3 : 1);
        enemy.hp -= enemy.adaptive?.shield ? damage * .78 : enemy.adaptive?.armor ? damage * .86 : damage;
        enemy.slow = Math.max(enemy.slow, bullet.slow * (enemy.adaptive?.resist ? .65 : 1.7));
        this.burst(bullet.x, bullet.y, enemy.color, bullet.critical ? 10 : 5, .6);
        if (bullet.critical) this.label(enemy.x, enemy.y - 23, `✦ ${Math.round(damage)}`, '#fff18c');
        if (bullet.charged && enemy.type === 'boss') {
          this.explodeChargedShot(bullet, enemy.x, enemy.y);
          remove = true;
          break;
        }
        if (bullet.pierce-- <= 0) { remove = true; break; }
      }
      if (remove) bullets.splice(index, 1);
    }
  }

  explodeChargedShot(bullet, x, y) {
    const radius = 105 + this.state.powers.charged * 12;
    for (const enemy of this.state.entities.enemies) if (distance({ x, y }, enemy) < radius + enemy.radius) enemy.hp -= bullet.damage * .72;
    this.state.entities.rings.push({ kind: 'charged', x, y, maxRadius: radius, life: .6, duration: .6, color: '#ffd174' });
    this.burst(x, y, '#ffd174', 42, 1.8);
    this.label(x, y - 30, 'DETONAÇÃO CARREGADA', '#ffe19c');
  }

  updateEnemies(delta) {
    const state = this.state; const { player, entities } = state;
    for (let index = entities.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = entities.enemies[index];
      if (enemy.hp <= 0) { this.killEnemy(enemy); entities.enemies.splice(index, 1); continue; }

      const direction = angleTo(enemy, player);
      const currentDistance = distance(player, enemy);
      enemy.pulse += delta * 3;
      enemy.slow = Math.max(0, enemy.slow - delta);
      let speed = enemy.speed * (1 - Math.min(.72, enemy.slow));

      if ((enemy.adaptive?.agile || enemy.type === 'runner' || enemy.miniVariant?.id === 'seeker') && currentDistance > 90) {
        const weave = enemy.type === 'runner' || enemy.miniVariant?.id === 'seeker' ? .72 : .5;
        enemy.x += Math.cos(direction + Math.PI / 2) * speed * weave * enemy.side * delta;
        enemy.y += Math.sin(direction + Math.PI / 2) * speed * weave * enemy.side * delta;
        if (Math.random() < delta * (enemy.type === 'runner' ? 1.8 : .65)) enemy.side *= -1;
      }

      if (enemy.type === 'sniper' && currentDistance < 230) speed *= -.5;
      else if (enemy.type === 'sniper' && currentDistance < 350) speed = 0;

      if (enemy.type === 'minelayer' && enemy.specialTimer <= 0 && entities.mines.length < 14) {
        const mineAngle = angleTo(enemy, player) + random(-.8, .8);
        entities.mines.push({ x: clamp(player.x + Math.cos(mineAngle) * random(95, 175), 24, this.renderer.width - 24), y: clamp(player.y + Math.sin(mineAngle) * random(95, 175), 70, this.renderer.height - 24), life: 13, armTime: 1.1, triggerRadius: 48, blastRadius: 90, damage: enemy.damage * 1.5, friendly: false });
        enemy.specialTimer = random(4.2, 6.2);
        this.label(enemy.x, enemy.y - 22, 'MINA INIMIGA', '#ff9272');
      }

      if (enemy.miniVariant?.id === 'rammer' && currentDistance < 260 && enemy.specialTimer <= 0) {
        enemy.ramAngle = direction;
        enemy.ramTime = .42;
        enemy.specialTimer = 3.6;
        this.label(enemy.x, enemy.y - enemy.radius - 8, 'INVESTIDA', enemy.color);
      }
      if (enemy.ramTime > 0) {
        enemy.ramTime -= delta;
        enemy.x += Math.cos(enemy.ramAngle) * speed * 4 * delta;
        enemy.y += Math.sin(enemy.ramAngle) * speed * 4 * delta;
      } else {
        enemy.x += Math.cos(direction) * speed * delta;
        enemy.y += Math.sin(direction) * speed * delta;
      }
      enemy.specialTimer -= delta;

      if (currentDistance < player.radius + enemy.radius) {
        const guard = state.companions.find(companion => companion.modelId === 'bulwark' && companion.shieldCooldown <= 0 && distance(companion, enemy) < companion.level * 18 + 34);
        if (guard) {
          guard.shieldCooldown = Math.max(1.2, 3.8 - guard.level * .35);
          enemy.hp -= player.damage * (.8 + guard.level * .25);
          enemy.x += Math.cos(angleTo(guard, enemy)) * 42;
          enemy.y += Math.sin(angleTo(guard, enemy)) * 42;
          entities.rings.push({ kind: 'companionShield', x: guard.x, y: guard.y, maxRadius: 42 + guard.level * 5, life: .35, duration: .35, color: guard.color });
        } else this.hurt(enemy.damage);
      }
      enemy.shootTimer -= delta;
      if (enemy.shootTimer <= 0 && currentDistance < 760) {
        if (enemy.type === 'boss') this.fireBossPattern(enemy, direction);
        else if (enemy.type === 'miniboss') this.fireMiniBossPattern(enemy, direction);
        else if (enemy.type === 'minelayer') {
          this.firePattern(enemy, direction, 3, .2, 185, 10);
          enemy.shootTimer = 2.6;
        }
        else if (enemy.type === 'sniper') {
          this.firePattern(enemy, direction, 1, 0, 260, 9);
          enemy.shootTimer = 2.3;
        }
        else if (enemy.elite && currentDistance < 560) {
          this.firePattern(enemy, direction, 3, .18, 205, 8);
          enemy.shootTimer = Math.max(1.35, 3.2 - this.threatLevel() * .35);
        }
        if (enemy.type === 'tank' && enemy.specialTimer <= 0 && currentDistance < 190) {
          this.firePattern(enemy, enemy.pulse, 8, TAU / 8, 135, 7);
          enemy.specialTimer = 4.6;
        }
      }
    }
  }

  firePattern(enemy, direction, count, spread, speed, damage) {
    const state = this.state;
    for (let shot = 0; shot < count; shot += 1) {
      const offset = count === 1 ? 0 : (shot - (count - 1) / 2) * spread;
      const angle = direction + offset;
      const homing = (enemy.type === 'sniper' || enemy.type === 'minelayer' || enemy.bossVariant?.id === 'oracle') && shot === 0;
      if (homing && state.entities.enemyBullets.filter(bullet => bullet.homingTime > 0).length >= 8) continue;
      state.entities.enemyBullets.push({ x: enemy.x, y: enemy.y, originX: enemy.x, originY: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: homing ? 3.6 : 4, radius: enemy.type === 'boss' || enemy.type === 'miniboss' ? 6 : 5, damage: damage * (1 + this.threatLevel() * .08), color: enemy.color, homingTime: homing ? 1.45 : 0, homingRange: homing ? 260 : 0, homingTravel: 0 });
    }
  }

  fireBossPattern(boss, direction) {
    const state = this.state;
    const broadside = boss.adaptive?.barrage ? 13 : 9;
    if (boss.bossVariant.id === 'rift-core') {
      boss.finalAttackMode = !boss.finalAttackMode;
      if (boss.finalAttackMode) this.firePattern(boss, boss.pulse * .42, 10, TAU / 10, 190, 10);
      else this.firePattern(boss, direction, 5, .13, 255, 12);
      boss.shootTimer = 1.45;
    } else if (boss.bossVariant.id === 'lancer') {
      this.firePattern(boss, direction, 5, .12, 260, 12);
      boss.shootTimer = boss.adaptive?.agile ? 1.05 : 1.4;
    } else if (boss.bossVariant.id === 'tempest') {
      this.firePattern(boss, direction + boss.pulse * .32, 11, TAU / 11, 175, 10);
      boss.shootTimer = 1.25;
    } else if (boss.bossVariant.id === 'devourer') {
      this.firePattern(boss, boss.pulse * .28, 13, TAU / 13, 150, 11);
      boss.shootTimer = 1.5;
    } else if (boss.bossVariant.id === 'oracle') {
      this.firePattern(boss, direction, 5, .11, 235, 11);
      boss.shootTimer = 1.7;
    } else if (boss.bossVariant.id === 'shatter') {
      this.firePattern(boss, direction, 7, .14, 285, 9);
      this.firePattern(boss, boss.pulse, 9, TAU / 9, 145, 9);
      boss.shootTimer = 2.35;
    } else {
      this.firePattern(boss, direction, broadside, boss.adaptive?.barrage ? .15 : .2, 180, 12);
      boss.shootTimer = boss.adaptive?.agile ? 1.15 : 1.55;
    }
  }

  fireMiniBossPattern(boss, direction) {
    if (boss.miniVariant.id === 'bomber') {
      this.firePattern(boss, boss.pulse, 10, TAU / 10, 150, 8);
      boss.shootTimer = 2.25;
    } else if (boss.miniVariant.id === 'seeker') {
      this.firePattern(boss, direction, 5, .13, 225, 8);
      boss.shootTimer = 1.55;
    } else {
      this.firePattern(boss, direction, 3, .17, 195, 10);
      boss.shootTimer = 1.9;
    }
  }

  killEnemy(enemy) {
    const state = this.state;
    const { gems } = state.entities;
    const isBoss = enemy.type === 'boss';
    const isMiniBoss = enemy.type === 'miniboss';
    state.kills += 1;
    state.score += enemy.value * 10;
    this.burst(enemy.x, enemy.y, enemy.color, isBoss ? 60 : isMiniBoss ? 38 : 15, isBoss ? 2 : isMiniBoss ? 1.5 : 1);
    const pieces = isBoss ? 16 : isMiniBoss ? 8 : enemy.type === 'tank' ? 4 : 1;
    for (let index = 0; index < pieces; index += 1) gems.push({ x: enemy.x + random(-16, 16), y: enemy.y + random(-16, 16), value: isBoss ? 5 : isMiniBoss ? 3 : enemy.type === 'tank' ? 3 : 2, radius: 5 });
    if (isBoss) {
      state.bossesDefeated += 1;
      state.pendingBossRewards += 1;
      state.score += 2000;
      if (enemy.isFinalBoss) state.finalBossDefeated = true;
      this.label(enemy.x, enemy.y, `${enemy.isFinalBoss ? 'NÚCLEO DO RIFT DESTRUÍDO' : 'GUARDIÃO DESTRUÍDO'} +2000`, '#ffe687');
      if (!enemy.isFinalBoss) {
        const nextEnemy = ENEMY_PROGRESSION[state.bossesDefeated];
        const nextMiniBoss = MINI_BOSS_VARIANTS[state.bossesDefeated];
        if (nextEnemy) this.label(enemy.x, enemy.y - 24, `NOVO INIMIGO · ${nextEnemy.name}`, '#ff9bb0');
        if (nextMiniBoss) this.label(enemy.x, enemy.y - 42, `MINI-CHEFE LIBERADO · ${nextMiniBoss.name}`, nextMiniBoss.color);
      }
      this.audio.play(950, .4, 'sawtooth', .1);
    } else if (isMiniBoss) {
      state.score += 650;
      this.label(enemy.x, enemy.y, `${enemy.miniVariant.name} ELIMINADO · +650`, '#ffe687');
      this.audio.play(760, .32, 'triangle', .08);
    }
  }

  updateEnemyBullets(delta) {
    const state = this.state;
    const { enemyBullets } = state.entities;
    for (let index = enemyBullets.length - 1; index >= 0; index -= 1) {
      const bullet = enemyBullets[index];
      if (bullet.homingTime > 0) {
        const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
        if ((bullet.homingTravel ?? 0) >= bullet.homingRange || distance(bullet, state.player) > bullet.homingRange) bullet.homingTime = 0;
        else {
          const currentAngle = Math.atan2(bullet.vy, bullet.vx);
          const targetAngle = angleTo(bullet, state.player);
          const deltaAngle = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
          const aimedAngle = currentAngle + clamp(deltaAngle, -.65 * delta, .65 * delta);
          bullet.vx = Math.cos(aimedAngle) * speed;
          bullet.vy = Math.sin(aimedAngle) * speed;
          bullet.homingTime -= delta;
        }
      }
      const oldX = bullet.x; const oldY = bullet.y;
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      bullet.life -= delta;
      bullet.homingTravel = (bullet.homingTravel ?? 0) + distance({ x: oldX, y: oldY }, bullet);
      const interceptor = state.companions.find(companion => companion.level >= companion.interceptLevel && companion.disabledTimer <= 0 && distance(bullet, companion) < 9 + bullet.radius);
      if (interceptor) {
        interceptor.disabledTimer = 2;
        interceptor.hitFlash = .3;
        interceptor.intercepting = false;
        if (interceptor.reflects) {
          const target = this.nearestEnemy(interceptor);
          if (target) {
            const angle = angleTo(interceptor, target);
            const speed = Math.max(450, Math.hypot(bullet.vx, bullet.vy));
            state.entities.bullets.push({ x: interceptor.x, y: interceptor.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.6, radius: bullet.radius + 1, damage: bullet.damage * 1.35, pierce: 0, hit: new Set(), critical: false, slow: 0, color: interceptor.color, companionShot: true });
          }
        }
        this.burst(interceptor.x, interceptor.y, interceptor.color, 12, .8);
        this.label(interceptor.x, interceptor.y - 20, `${interceptor.name} OFFLINE · 2s`, '#ffc17c');
        enemyBullets.splice(index, 1);
      } else if (distance(bullet, state.player) < state.player.radius + bullet.radius) {
        this.hurt(bullet.damage);
        enemyBullets.splice(index, 1);
      } else if (bullet.life <= 0) enemyBullets.splice(index, 1);
    }
  }

  collectGems(delta) { const state = this.state; const { player, gems } = state.entities ? { player: state.player, gems: state.entities.gems } : {}; for (let index = gems.length - 1; index >= 0; index -= 1) { const gem = gems[index]; const currentDistance = distance(gem, player); if (currentDistance < player.magnet) { const angle = angleTo(gem, player); const speed = (player.magnet - currentDistance) * 5 + 100; gem.x += Math.cos(angle) * speed * delta; gem.y += Math.sin(angle) * speed * delta; } if (currentDistance < 20) { if (state.level < MAX_RUN_LEVEL) state.xp += gem.value; else state.score += gem.value * 2; gems.splice(index, 1); this.audio.play(650 + state.xp * 4, .045, 'sine', .008); } } }

  updateParticles(delta) { const { particles, floaters } = this.state.entities; for (let index = particles.length - 1; index >= 0; index -= 1) { const particle = particles[index]; particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vx *= .975; particle.vy *= .975; particle.life -= delta; if (particle.life <= 0) particles.splice(index, 1); } for (let index = floaters.length - 1; index >= 0; index -= 1) { const floater = floaters[index]; floater.y -= 25 * delta; floater.life -= delta; if (floater.life <= 0) floaters.splice(index, 1); } }

  nextWave() { this.state.wave += 1; this.state.waveClock = 0; this.state.waveBreak = RUN_RULES.waveBreak; this.state.spawnTimer = RUN_RULES.waveBreak; this.label(this.renderer.width / 2, this.renderer.height * .28, `ONDA ${this.state.wave} · REAGRUPAMENTO`, '#6feeff'); this.audio.play(260, .35, 'sawtooth', .08); }

  levelUp() {
    const state = this.state;
    if (state.level >= MAX_RUN_LEVEL) return;
    state.xp -= state.nextXp;
    state.level += 1;
    const reward = rewardLevel(this.profile, state.level);
    this.profile = saveProfile(reward.profile);
    state.creditsEarned += reward.credits;
    const hpRestored = Math.min(Math.ceil(state.player.maxHp * .5), state.player.maxHp - state.player.hp);
    state.player.hp += hpRestored;
    state.nextXp = Math.ceil(state.nextXp * 1.16 + state.level * 1.1);
    const count = Math.min(48, 12 + state.level * 2, Math.max(0, RUN_RULES.enemyCap - state.entities.enemies.length));
    for (let index = 0; index < count; index += 1) this.spawn(this.randomUnlockedEnemyType());
    if (state.level >= 3 && state.level % 3 === 0 && state.level % 4 !== 0) {
      const variants = this.unlockedMiniBossVariants();
      const variant = variants[Math.max(0, Math.floor(state.level / 3) - 1) % variants.length];
      this.spawn('miniboss', { variant });
      this.label(this.renderer.width / 2, this.renderer.height * .24, `⚠ MINI-CHEFE · ${variant.name}`, variant.color);
    }
    this.label(state.player.x, state.player.y - 40, `REPARO 50% DO CASCO · +${hpRestored} VIDA`, '#80ffc2');
    this.label(this.renderer.width / 2, this.renderer.height * .32, `⚠ HORDA DO NÍVEL ${state.level}`, '#ffba74');
    if (reward.credits) this.label(this.renderer.width / 2, this.renderer.height * .37, `+${reward.credits} CRÉDITOS`, '#ffe687');
    for (const skill of reward.unlocked) this.label(this.renderer.width / 2, this.renderer.height * .42, `HABILIDADE DESBLOQUEADA · ${skill.name}`, '#8df4ff');
    state.mode = 'choice';
    const eligibleUpgrades = UPGRADES.filter(upgrade => !upgrade.special && (state.upgradeLevels[upgrade.key] ?? 0) < upgrade.maxLevel && (!upgrade.available || upgrade.available(state.player)));
    const eligiblePowers = this.availableRunPowers();
    const candidates = [...eligibleUpgrades, ...eligiblePowers];
    const choiceCount = Math.min(3, candidates.length);
    const recent = state.recentChoiceKeys ?? [];
    const freshCandidates = candidates.filter(choice => !recent.includes(choice.key));
    const choices = pickChoices(freshCandidates.length >= choiceCount ? freshCandidates : candidates, choiceCount);
    const newlyUnlockedPower = reward.unlocked
      .map(skill => eligiblePowers.find(power => power.key === skill.key))
      .find(Boolean);
    if (newlyUnlockedPower && !choices.some(choice => choice.key === newlyUnlockedPower.key)) {
      if (choices.length < choiceCount) choices.push(newlyUnlockedPower);
      else if (choices.length) choices[Math.floor(Math.random() * choices.length)] = newlyUnlockedPower;
    }
    if (!choices.length) {
      this.finishChoice();
      return;
    }
    state.recentChoiceKeys = [...recent, ...choices.map(choice => choice.key)].slice(-6);
    this.ui.showUpgrade(state, choices, choice => this.applyChoice(choice));
  }

  availableRunPowers() {
    const state = this.state;
    return POWERS.filter(power => this.profile.unlockedSkills.includes(power.key)
      && (power.key === 'companion' ? this.canUpgradeCompanion() : (powerRunMaxLevel(power, state) == null || (state.powers[power.key] ?? 0) < powerRunMaxLevel(power, state))));
  }

  applyChoice(choice) {
    const state = this.state;
    if (choice.key === 'companion' && !choice.apply) {
      this.ui.showCompanionUpgrade(state, target => {
        this.grantPower({ ...choice, ...target });
        this.finishChoice();
      });
      return;
    }
    if (choice.apply) {
      choice.apply(state.player, state);
      state.upgradeLevels[choice.key] = (state.upgradeLevels[choice.key] ?? 0) + 1;
    } else if (choice.key) this.grantPower(choice);
    this.finishChoice();
  }

  finishChoice() {
    const state = this.state;
    state.mode = 'playing';
    this.ui.showPlaying();
    this.audio.play(740, .22, 'triangle', .09);
    this.burst(state.player.x, state.player.y, '#7defff', 30, 1.5);
    this.spawnBossesForLevel();
    if (state.pendingBossRewards > 0) this.openBossReward();
    else if (state.xp >= state.nextXp) this.levelUp();
  }

  grantPower(power) {
    const state = this.state;
    const player = state.player;
    const definition = POWERS.find(item => item.key === power.key);
    let levelsAdded = definition ? powerLevelsAdded(definition, state) : 1;
    let target = null;
    let model = null;
    if (power.key === 'companion') {
      target = state.companions.find(companion => companion.id === power.targetId && companion.level < MAX_COMPANION_LEVEL);
      model = !target && state.companions.length < MAX_RUN_COMPANIONS
        ? COMPANION_MODELS.find(item => item.id === power.modelId && !state.companions.some(companion => companion.modelId === item.id))
          ?? COMPANION_MODELS.find(item => !state.companions.some(companion => companion.modelId === item.id))
        : null;
      const remainingLevels = target ? MAX_COMPANION_LEVEL - target.level : model ? MAX_COMPANION_LEVEL : 0;
      levelsAdded = Math.min(levelsAdded, remainingLevels);
    }
    if (!levelsAdded) return;
    state.powers[power.key] = (state.powers[power.key] ?? 0) + levelsAdded;
    if (power.key === 'companion') {
      if (target) {
        target.level += levelsAdded;
        target.damageMultiplier *= 1.05 ** levelsAdded;
      } else if (model) {
        this.addCompanion(model, levelsAdded);
      }
      this.label(player.x, player.y - 38, target ? `${target.name} · NÍVEL ${target.level}` : 'REFORÇO DE COMPANHEIRO', '#8dfff0');
    }
    if (power.key === 'shield') {
      player.rate = Math.min(1.35, player.rate * (1 + .05 * levelsAdded));
      state.shieldTime = 4;
      state.shieldCooldown = 0;
      this.burst(player.x, player.y, '#80ffc5', 28, 1.2);
      this.label(player.x, player.y - 38, 'ESCUDO REATIVO ATIVO', '#a9ffd1');
    }
    if (power.key === 'charged') { state.chargeTimer = 0; this.burst(player.x, player.y, '#ffd174', 22, 1); this.label(player.x, player.y - 38, 'TIRO CARREGADO · PRONTO', '#ffe19c'); }
    if (power.key === 'aimbot') { player.rate = Math.min(1.35, player.rate * (1 + .04 * levelsAdded)); this.burst(player.x, player.y, '#ffd45c', 18, .8); this.label(player.x, player.y - 38, 'MIRA AUTOMÁTICA · DISPAROS RETOS', '#ffe28a'); }
    if (power.key === 'nova') {
      player.maxHp = Math.max(60, player.maxHp - 5 * levelsAdded);
      player.hp = Math.min(player.hp, player.maxHp);
      state.novaTimer = 1;
      this.burst(player.x, player.y, '#c498ff', 36, 1.2);
      this.label(player.x, player.y - 38, 'PULSO GRAVITACIONAL', '#d3b4ff');
    }
    if (power.key === 'overdrive') {
      player.rate = Math.max(.13, player.rate * .86 ** levelsAdded);
      player.damage *= 1.12 ** levelsAdded;
      player.move = Math.max(120, player.move * .97 ** levelsAdded);
      this.burst(player.x, player.y, '#ffc05b', 30, 1.1);
      this.label(player.x, player.y - 38, 'SOBRECARGA · POTÊNCIA MÁXIMA', '#ffd18a');
    }
    if (power.key === 'singularity') {
      player.maxHp = Math.max(60, player.maxHp - 3 * levelsAdded);
      player.hp = Math.min(player.hp, player.maxHp);
      state.singularityTimer = 1.2;
      this.burst(player.x, player.y, '#bb8bff', 32, 1.1);
      this.label(player.x, player.y - 38, 'SINGULARIDADE ATIVADA', '#d3aeff');
    }
    if (power.key === 'ionStorm') {
      player.armor = Math.max(-.3, player.armor - .02 * levelsAdded);
      state.ionStormTimer = .8;
      this.burst(player.x, player.y, '#91f6ff', 24, 1);
      this.label(player.x, player.y - 38, 'TEMPESTADE IÔNICA', '#adf8ff');
    }
    if (power.key === 'activeShield') this.label(player.x, player.y - 38, 'BARREIRA MANUAL · E', '#a9d9ff');
    if (power.key === 'teleport') this.label(player.x, player.y - 38, 'SALTO DE FASE · Q', '#d0aaff');
    if (power.key === 'minefield') { state.minefieldTimer = .6; this.label(player.x, player.y - 38, 'CAMPO DE MINAS ARMADO', '#8dffe2'); }
    if (power.key === 'riftLance') { state.riftLanceTimer = .6; this.label(player.x, player.y - 38, 'LANÇA DO RIFT ATIVA', '#ffb8ff'); }
  }

  openBossReward() {
    const state = this.state;
    const availablePowers = this.availableRunPowers();
    if (!availablePowers.length) {
      this.finishBossReward();
      return;
    }
    state.mode = 'choice';
    this.ui.showBossReward(state, choice => {
      if (choice.key === 'companion') this.ui.showCompanionUpgrade(state, target => this.finishBossReward({ ...choice, ...target }));
      else this.finishBossReward(choice);
    }, availablePowers);
  }

  finishBossReward(choice = null) {
    const state = this.state;
    if (choice) {
      this.grantPower(choice);
      if (choice.key === 'nova') state.novaTimer = 2;
    }
    state.pendingBossRewards = Math.max(0, state.pendingBossRewards - 1);
    if (state.pendingBossRewards > 0) this.openBossReward();
    else if (state.finalBossDefeated) { state.stageCompleted = true; this.finishRun('victory'); }
    else if (state.xp >= state.nextXp) this.levelUp();
    else { state.mode = 'playing'; this.ui.showPlaying(); }
  }

  chargedShot() {
    const state = this.state;
    if (!state || state.mode !== 'playing' || !state.powers.charged || state.chargeTimer > 0) return;
    const { player } = state;
    const angle = this.input.pointer.active ? Math.atan2(this.input.pointer.y - player.y, this.input.pointer.x - player.x) : player.angle;
    const speed = 590 * player.projectileSpeed / 710;
    state.entities.bullets.push({ x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, life: 2.2, radius: 14, damage: player.damage * (3 + state.powers.charged), pierce: 8, hit: new Set(), critical: true, slow: player.slow, charged: true });
    state.chargeTimer = Math.max(2.8, 7 - state.powers.charged * .7);
    this.audio.play(150, .45, 'sawtooth', .1);
    this.burst(player.x, player.y, '#ffcf67', 26, 1);
  }

  activateShield() {
    const state = this.state;
    if (!state || state.mode !== 'playing' || !state.powers.activeShield || state.activeShieldCooldown > 0) return;
    const rank = state.powers.activeShield;
    state.activeShieldTime = 1.8 + rank * .45;
    state.activeShieldCooldown = Math.max(5.5, 15 - rank * 1.4);
    state.entities.rings.push({ kind: 'activeShield', x: state.player.x, y: state.player.y, maxRadius: 60, life: .7, duration: .7, color: '#8ed4ff' });
    this.burst(state.player.x, state.player.y, '#8ed4ff', 30, 1.2);
    this.label(state.player.x, state.player.y - 38, `BARREIRA · ${state.activeShieldTime.toFixed(1)}s`, '#b9e4ff');
  }

  teleport() {
    const state = this.state;
    if (!state || state.mode !== 'playing' || !state.powers.teleport || state.teleportCooldown > 0) return;
    const { player } = state;
    const direction = this.input.pointer.active ? Math.atan2(this.input.pointer.y - player.y, this.input.pointer.x - player.x) : player.angle;
    const range = 190 + state.powers.teleport * 24;
    const oldX = player.x; const oldY = player.y;
    player.x = clamp(player.x + Math.cos(direction) * range, player.radius, this.renderer.width - player.radius);
    player.y = clamp(player.y + Math.sin(direction) * range, player.radius, this.renderer.height - player.radius);
    player.invulnerable = Math.max(player.invulnerable, .45);
    state.teleportCooldown = Math.max(4, 9 - state.powers.teleport * .8);
    state.entities.rings.push({ kind: 'teleport', x: oldX, y: oldY, maxRadius: 56, life: .45, duration: .45, color: '#d3a5ff' });
    state.entities.rings.push({ kind: 'teleport', x: player.x, y: player.y, maxRadius: 66, life: .6, duration: .6, color: '#d3a5ff' });
    this.burst(oldX, oldY, '#c59aff', 18, 1);
    this.burst(player.x, player.y, '#e2c6ff', 30, 1.2);
  }

  dash() { const state = this.state; if (!state || state.mode !== 'playing' || state.player.dash > 0) return; const player = state.player; player.dash = player.dashCooldown; player.dashTime = player.dashDuration; player.invulnerable = Math.max(player.invulnerable, .42); this.burst(player.x, player.y, '#7ffaff', 22, 1.3); this.audio.play(280, .18, 'sawtooth', .06); }

  hurt(amount) { const state = this.state; const { player } = state; if (player.invulnerable > 0 || player.dashTime > 0 || state.shieldTime > 0 || state.activeShieldTime > 0) return; const damage = Math.max(1, amount * (1 - player.armor)); player.hp -= damage; player.invulnerable = .55; state.shake = 11; state.flash = .22; this.burst(player.x, player.y, '#ff587e', 15); this.label(player.x, player.y - 25, `-${Math.round(damage)}`, '#ff8098'); this.audio.play(180, .16, 'sawtooth', .065); if (player.hp <= 0) this.gameOver(); }

  gameOver() { this.finishRun(this.state.stageCompleted ? 'stage-complete' : 'defeat'); }

  finishRun(outcome) {
    const state = this.state;
    state.mode = 'dead';
    state.outcome = outcome;
    state.shake = outcome === 'victory' ? 8 : 20;
    this.burst(state.player.x, state.player.y, outcome === 'victory' ? '#ffe783' : '#71f5ff', outcome === 'victory' ? 90 : 65, outcome === 'victory' ? 2.5 : 2);
    this.audio.play(outcome === 'victory' ? 880 : 130, outcome === 'victory' ? .8 : .65, outcome === 'victory' ? 'triangle' : 'sawtooth', .14);
    this.bestScore = Math.max(this.bestScore, state.score);
    saveBestScore(this.bestScore);
    this.ui.showGameOver(state, this.bestScore);
  }

  togglePause() { if (!this.state || !['playing', 'paused'].includes(this.state.mode)) return; this.state.mode = this.state.mode === 'playing' ? 'paused' : 'playing'; this.lastTime = performance.now(); }
  burst(x, y, color, amount = 12, power = 1) { const particles = this.state.entities.particles; for (let index = 0; index < amount; index += 1) { const angle = random(0, TAU); const speed = random(30, 180) * power; const life = random(.25, .7); particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, radius: random(1, 4), color }); } if (particles.length > 430) particles.splice(0, particles.length - 430); }
  label(x, y, text, color = '#fff') { this.state.entities.floaters.push({ x, y, text, color, life: .85 }); }
}
