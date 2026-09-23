import { UPGRADES, POWERS, pickChoices } from '../data/upgrades.js';
import { angleTo, clamp, distance, random, TAU } from '../core/math.js';
import { createGameState, randomSpawnPosition, resizeState } from '../core/state.js';
import { loadBestScore, saveBestScore } from '../core/storage.js';
import { AudioManager } from '../core/audio.js';

const ENEMY_TYPES = {
  grunt: { radius: 13, hp: 28, speed: 75, damage: 13, value: 2, color: '#fb6384' },
  runner: { radius: 9, hp: 17, speed: 142, damage: 10, value: 3, color: '#ffbd69' },
  tank: { radius: 22, hp: 110, speed: 48, damage: 22, value: 6, color: '#b36dff' },
  sniper: { radius: 12, hp: 38, speed: 63, damage: 11, value: 5, color: '#72a7ff' },
  boss: { radius: 37, hp: 650, speed: 56, damage: 27, value: 35, color: '#ff4fc6' },
  miniboss: { radius: 25, hp: 250, speed: 60, damage: 21, value: 18, color: '#ff9b62' },
};

const BOSS_VARIANTS = [
  { id: 'bulwark', name: 'BASTILHA', color: '#ff4fc6' },
  { id: 'lancer', name: 'LANÇA-VAZIO', color: '#ff795e' },
  { id: 'tempest', name: 'TEMPESTADE', color: '#a884ff' },
];

const MINI_BOSS_VARIANTS = [
  { id: 'rammer', name: 'ARÍETE', color: '#ff9b62' },
  { id: 'seeker', name: 'RASTREADOR', color: '#70baff' },
  { id: 'bomber', name: 'DETONADOR', color: '#e779ff' },
];

export class Game {
  constructor({ renderer, input, ui }) {
    this.renderer = renderer;
    this.input = input;
    this.ui = ui;
    this.audio = new AudioManager();
    this.state = null;
    this.bestScore = loadBestScore();
    this.lastTime = performance.now();
    this.now = 0;
    this.ui.onStart = () => this.start();
    this.input.onDash = () => this.dash();
    this.input.onChargedShot = () => this.chargedShot();
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
    this.ui.showPlaying();
    this.lastTime = performance.now();
    this.audio.play(650, .25, 'sawtooth', .06);
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
    if (state.waveClock > 24 && entities.enemies.length < Math.max(3, state.wave * 2)) this.nextWave();
    if (state.pendingBossRewards > 0 && state.mode === 'playing') this.openBossReward();
    if (state.xp >= state.nextXp && state.mode === 'playing') this.levelUp();
  }

  updateWorldHazards(delta) {
    const state = this.state; const { player, entities } = state;
    if (state.asteroidTimer <= 0) {
      const pressure = this.threatLevel();
      const count = Math.min(4, 2 + (Math.random() < .55 ? 1 : 0) + (pressure > 1.3 ? 1 : 0));
      for (let index = 0; index < count; index += 1) {
        const fromLeft = Math.random() < .5;
        const speed = random(275 + state.wave * 9, 355 + state.wave * 13);
        entities.asteroids.push({ x: fromLeft ? -65 - index * 28 : this.renderer.width + 65 + index * 28, y: random(55, Math.max(56, this.renderer.height - 55)), vx: fromLeft ? speed : -speed, vy: random(-58, 58), radius: random(24, 35), spin: random(0, TAU), hit: false });
      }
      const gap = Math.max(3.8, 9 - state.wave * .18 - this.powerCount() * .28);
      state.asteroidTimer = random(gap, gap + 3.5);
      this.label(this.renderer.width / 2, this.renderer.height * .2, `☄ CHUVA DE ASTEROIDES · ${count}`, '#ffc17a');
      this.audio.play(180, .38, 'sawtooth', .07);
    }
    for (let index = entities.asteroids.length - 1; index >= 0; index -= 1) { const asteroid = entities.asteroids[index]; asteroid.x += asteroid.vx * delta; asteroid.y += asteroid.vy * delta; asteroid.spin += delta * 2; if (!asteroid.hit && distance(asteroid, player) < asteroid.radius + player.radius && player.dashTime <= 0 && state.shieldTime <= 0) { asteroid.hit = true; this.hurt(Math.max(1, Math.ceil(player.hp * .33))); this.burst(player.x, player.y, '#ffb073', 25); this.label(player.x, player.y - 25, '-33% VIDA ATUAL', '#ffb073'); } if (asteroid.x < -100 || asteroid.x > this.renderer.width + 100) entities.asteroids.splice(index, 1); }
    if (state.healTimer <= 0) { entities.heals.push({ x: random(35, Math.max(36, this.renderer.width - 35)), y: random(110, Math.max(111, this.renderer.height - 35)), life: 17, radius: 11 }); state.healTimer = random(16, 24); this.label(this.renderer.width / 2, this.renderer.height * .2, '+ CÁPSULA DE CURA DISPONÍVEL', '#79ffb4'); }
    for (let index = entities.heals.length - 1; index >= 0; index -= 1) { const heal = entities.heals[index]; heal.life -= delta; if (distance(heal, player) < heal.radius + player.radius) { const amount = Math.min(35, player.maxHp - player.hp); player.hp += amount; this.label(player.x, player.y - 24, `+${Math.round(amount)} VIDA`, '#6dffc1'); this.burst(heal.x, heal.y, '#5dffab', 18); entities.heals.splice(index, 1); } else if (heal.life <= 0) entities.heals.splice(index, 1); }
    for (let index = entities.rings.length - 1; index >= 0; index -= 1) { entities.rings[index].life -= delta; if (entities.rings[index].life <= 0) entities.rings.splice(index, 1); }
  }

  updatePlayer(delta) {
    const state = this.state; const { player } = state; const movement = this.input.movement();
    if (movement.x || movement.y) { player.x = clamp(player.x + movement.x * player.move * (player.dashTime > 0 ? 3.8 : 1) * delta, player.radius, this.renderer.width - player.radius); player.y = clamp(player.y + movement.y * player.move * (player.dashTime > 0 ? 3.8 : 1) * delta, player.radius, this.renderer.height - player.radius); if (Math.random() < .25) this.burst(player.x - movement.x * 14, player.y - movement.y * 14, '#38b6ff', 1, .2); }
    state.aimTarget = state.powers.aimbot ? this.nearestEnemy(player) : null;
    if (state.aimTarget) player.angle = angleTo(player, state.aimTarget);
    else if (this.input.pointer.active) player.angle = Math.atan2(this.input.pointer.y - player.y, this.input.pointer.x - player.x);
    player.invulnerable = Math.max(0, player.invulnerable - delta); player.dash = Math.max(0, player.dash - delta); player.dashTime = Math.max(0, player.dashTime - delta); player.shootTimer -= delta;
    if (player.shootTimer <= 0 && state.entities.enemies.length) { this.shoot(); player.shootTimer = player.rate; }
  }

  updatePowers(delta) {
    const state = this.state; const { player, entities } = state;
    state.shieldCooldown = Math.max(0, state.shieldCooldown - delta); state.shieldTime = Math.max(0, state.shieldTime - delta); state.chargeTimer = Math.max(0, state.chargeTimer - delta);
    if (state.powers.shield && state.shieldTime <= 0 && state.shieldCooldown <= 0) { state.shieldTime = 2.4 + .8 * state.powers.shield; state.shieldCooldown = Math.max(7, 16 - 2 * state.powers.shield); this.burst(player.x, player.y, '#81ffca', 18, .7); }
    if (state.powers.companion) this.updateCompanions(delta);
    if (state.powers.nova) { state.novaTimer -= delta; if (state.novaTimer <= 0) { const radius = 155 + state.powers.nova * 25; for (const enemy of entities.enemies) if (distance(player, enemy) < radius) enemy.hp -= player.damage * (2 + state.powers.nova); for (let index = entities.enemyBullets.length - 1; index >= 0; index -= 1) if (distance(player, entities.enemyBullets[index]) < radius) entities.enemyBullets.splice(index, 1); this.burst(player.x, player.y, '#a790ff', 65, 2); entities.rings.push({ x: player.x, y: player.y, maxRadius: radius, life: .65, duration: .65, color: '#c4a3ff' }); state.novaTimer = Math.max(4.5, 10 - state.powers.nova); this.audio.play(110, .4, 'triangle', .1); } }
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
        entities.rings.push({ x: player.x, y: player.y, maxRadius: radius, life: .9, duration: .9, color: '#b78bff' });
        state.singularityTimer = Math.max(4.2, 8 - state.powers.singularity * .7);
        this.audio.play(125, .38, 'triangle', .09);
      }
    }
    if (state.powers.ionStorm) {
      state.ionStormTimer -= delta;
      if (state.ionStormTimer <= 0 && entities.enemies.length) {
        const count = Math.min(5, 2 + state.powers.ionStorm);
        const targets = [...entities.enemies].sort(() => Math.random() - .5).slice(0, count);
        for (const enemy of targets) {
          enemy.hp -= player.damage * (1.15 + state.powers.ionStorm * .28);
          enemy.slow = Math.max(enemy.slow, .35);
          this.burst(enemy.x, enemy.y, '#a9f9ff', 14, 1.1);
          entities.rings.push({ x: enemy.x, y: enemy.y, maxRadius: enemy.radius + 28, life: .35, duration: .35, color: '#85f2ff' });
        }
        this.label(player.x, player.y - 42, 'TEMPESTADE IÔNICA', '#a9f9ff');
        state.ionStormTimer = Math.max(2.4, 5 - state.powers.ionStorm * .45);
        this.audio.play(520, .2, 'sawtooth', .06);
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
      companion.phase = state.time * 1.25 + index * TAU / count;
      const orbitRadius = 52 + index % 2 * 12;
      const homeX = player.x + Math.cos(companion.phase) * orbitRadius;
      const homeY = player.y + Math.sin(companion.phase) * orbitRadius;
      const intercept = companion.level >= 3 && companion.disabledTimer <= 0 ? this.findProjectileIntercept(companion) : null;
      companion.intercepting = Boolean(intercept);
      const targetX = intercept?.x ?? homeX;
      const targetY = intercept?.y ?? homeY;
      this.moveCompanionToward(companion, targetX, targetY, intercept ? 540 : 390, delta);
      companion.angle = Math.atan2(targetY - companion.y, targetX - companion.x);
      if (companion.disabledTimer <= 0 && entities.enemies.length && companion.shootTimer <= 0) {
        this.companionShoot(companion);
        companion.shootTimer = Math.max(.24, .82 * Math.pow(.86, companion.level - 1));
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
      if (along <= 0 || along > speed * 1.15) continue;
      const miss = Math.abs(toPlayerX * uy - toPlayerY * ux);
      if (miss > player.radius + bullet.radius + 18) continue;
      const safeDistance = player.radius + bullet.radius + 10;
      const x = bullet.x + ux * Math.max(0, along - safeDistance);
      const y = bullet.y + uy * Math.max(0, along - safeDistance);
      const timeToIntercept = distance(companion, { x, y }) / 540;
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
    const maximum = Math.min(145, 12 + state.wave * 5 + state.level * 2 + this.powerCount() * 3);
    state.spawnTimer -= delta;
    if (state.spawnTimer > 0 || state.entities.enemies.length >= maximum) return;
    const roll = Math.random();
    const type = state.wave >= 3 && roll < .16 ? 'sniper' : state.wave >= 2 && roll < .37 ? 'runner' : state.wave >= 4 && roll < .53 ? 'tank' : 'grunt';
    this.spawn(type);
    const interval = Math.max(.19, .72 - state.wave * .025 - this.powerCount() * .035 - pressure * .035);
    state.spawnTimer = interval * random(.72, 1.25);
  }

  spawn(type, options = {}) {
    const state = this.state;
    const template = ENEMY_TYPES[type];
    const position = randomSpawnPosition(this.renderer.width, this.renderer.height);
    const pressure = this.threatLevel();
    const scale = 1 + state.wave * .075 + pressure * .12;
    const elite = !['boss', 'miniboss'].includes(type) && pressure > .35 && Math.random() < Math.min(.2, pressure * .075);
    const enemy = {
      ...position, type, radius: template.radius, hp: template.hp * scale * (elite ? 1.45 : 1),
      maxHp: template.hp * scale * (elite ? 1.45 : 1),
      speed: template.speed * (1 + state.wave * .018 + pressure * .035) * (elite ? 1.1 : 1),
      damage: template.damage * (1 + pressure * .075) * (elite ? 1.12 : 1),
      value: template.value, color: template.color, shootTimer: random(.8, 2), pulse: random(0, TAU),
      slow: 0, adaptive: null, side: 1, elite, eliteShotTimer: random(2.4, 4), specialTimer: random(2, 4),
    };
    if (type === 'boss') Object.assign(enemy, { bossVariant: options.variant, color: options.variant.color, radius: 40, hp: template.hp * scale * (1 + state.level * .09), maxHp: template.hp * scale * (1 + state.level * .09), speed: template.speed * (1 + pressure * .025) });
    if (type === 'miniboss') {
      const variant = options.variant ?? MINI_BOSS_VARIANTS[(state.level + state.wave) % MINI_BOSS_VARIANTS.length];
      Object.assign(enemy, { miniVariant: variant, color: variant.color, radius: 29, hp: template.hp * scale * 1.8, maxHp: template.hp * scale * 1.8, speed: template.speed * (1 + pressure * .025), shootTimer: 1.5 });
    }
    state.entities.enemies.push(enemy);
    return enemy;
  }

  spawnBoss() {
    const state = this.state;
    const variant = BOSS_VARIANTS[state.bossSequence % BOSS_VARIANTS.length];
    state.bossSequence += 1;
    const boss = this.spawn('boss', { variant });
    const player = state.player;
    boss.adaptive = { shield: player.rate < .29 || player.shots > 1 || player.pierce > 0, agile: player.move > 185 || player.dashCooldown < 3, armor: player.damage > 19 || player.crit > .06, resist: player.slow > 0, barrage: player.maxHp > 100 || player.hp > 100 };
    boss.hp *= 1 + (state.level - 5) * .1;
    boss.maxHp = boss.hp;
    boss.shootTimer = .8;
    this.label(this.renderer.width / 2, this.renderer.height * .25, `⚠ GUARDIÃO ${variant.name} · NÍVEL ${state.level}`, variant.color);
    this.audio.play(170, .6, 'sawtooth', .11);
  }

  threatLevel() {
    const state = this.state;
    return Math.min(2.4, Math.max(0, state.wave - 1) * .075 + Math.max(0, state.level - 1) * .045 + this.powerCount() * .14);
  }

  powerCount() { return Object.values(this.state.powers).reduce((total, count) => total + count, 0); }

  nearestEnemy(origin = this.state.player) {
    return this.state.entities.enemies.reduce((nearest, enemy) => !nearest || distance(origin, enemy) < distance(origin, nearest) ? enemy : nearest, null);
  }

  shoot() {
    const state = this.state;
    const { player, entities } = state;
    const target = this.nearestEnemy(player);
    if (!target) return;
    const center = state.powers.aimbot ? angleTo(player, target) : this.input.pointer.active ? Math.atan2(this.input.pointer.y - player.y, this.input.pointer.x - player.x) : angleTo(player, target);
    player.angle = center;
    for (let index = 0; index < player.shots; index += 1) {
      const angle = center + (index - (player.shots - 1) / 2) * .16;
      const speed = player.projectileSpeed;
      entities.bullets.push({ x: player.x + Math.cos(angle) * 18, y: player.y + Math.sin(angle) * 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, life: 1.1, radius: 4, damage: player.damage, pierce: player.pierce, hit: new Set(), critical: Math.random() < player.crit, slow: player.slow });
    }
    this.audio.play(450, .055, 'triangle', .016);
    this.burst(player.x + Math.cos(center) * 17, player.y + Math.sin(center) * 17, '#70f5ff', 3, .35);
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
    const damage = player.damage * Math.min(.9, .42 + (level - 1) * .09);
    state.entities.bullets.push({ x: origin.x, y: origin.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.2, radius: 4, damage, pierce: 0, hit: new Set(), critical: false, slow: player.slow, companionShot: true });
  }

  updateBullets(delta) {
    const state = this.state; const { bullets, enemies } = state.entities;
    for (let index = bullets.length - 1; index >= 0; index -= 1) {
      const bullet = bullets[index];
      bullet.x += bullet.vx * delta; bullet.y += bullet.vy * delta; bullet.life -= delta;
      if (bullet.life <= 0 || bullet.x < -40 || bullet.x > this.renderer.width + 40 || bullet.y < -40 || bullet.y > this.renderer.height + 40) { bullets.splice(index, 1); continue; }
      let remove = false;
      for (const enemy of enemies) {
        if (bullet.hit.has(enemy) || distance(bullet, enemy) > enemy.radius + bullet.radius) continue;
        bullet.hit.add(enemy);
        const damage = bullet.damage * (bullet.critical ? 3 : 1);
        enemy.hp -= enemy.adaptive?.shield ? damage * .78 : enemy.adaptive?.armor ? damage * .86 : damage;
        enemy.slow = Math.max(enemy.slow, bullet.slow * (enemy.adaptive?.resist ? .65 : 1.7));
        this.burst(bullet.x, bullet.y, enemy.color, bullet.critical ? 10 : 5, .6);
        if (bullet.critical) this.label(enemy.x, enemy.y - 23, `✦ ${Math.round(damage)}`, '#fff18c');
        if (bullet.pierce-- <= 0) { remove = true; break; }
      }
      if (remove) bullets.splice(index, 1);
    }
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

      if (currentDistance < player.radius + enemy.radius) this.hurt(enemy.damage);
      enemy.shootTimer -= delta;
      if (enemy.shootTimer <= 0 && currentDistance < 760) {
        if (enemy.type === 'boss') this.fireBossPattern(enemy, direction);
        else if (enemy.type === 'miniboss') this.fireMiniBossPattern(enemy, direction);
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
      state.entities.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 4, radius: enemy.type === 'boss' || enemy.type === 'miniboss' ? 6 : 5, damage: damage * (1 + this.threatLevel() * .08), color: enemy.color });
    }
  }

  fireBossPattern(boss, direction) {
    const state = this.state;
    const broadside = boss.adaptive?.barrage ? 13 : 9;
    if (boss.bossVariant.id === 'lancer') {
      this.firePattern(boss, direction, 5, .12, 260, 12);
      boss.shootTimer = boss.adaptive?.agile ? 1.05 : 1.4;
    } else if (boss.bossVariant.id === 'tempest') {
      this.firePattern(boss, direction + boss.pulse * .32, 11, TAU / 11, 175, 10);
      boss.shootTimer = 1.25;
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
      state.pendingBossRewards += 1;
      state.score += 2000;
      this.label(enemy.x, enemy.y, 'GUARDIÃO DESTRUÍDO +2000', '#ffe687');
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
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      bullet.life -= delta;
      const interceptor = state.companions.find(companion => companion.level >= 3 && companion.disabledTimer <= 0 && distance(bullet, companion) < 9 + bullet.radius);
      if (interceptor) {
        interceptor.disabledTimer = 2;
        interceptor.hitFlash = .3;
        interceptor.intercepting = false;
        this.burst(interceptor.x, interceptor.y, '#ffb36b', 12, .8);
        this.label(interceptor.x, interceptor.y - 20, 'DRONE OFFLINE · 2s', '#ffc17c');
        enemyBullets.splice(index, 1);
      } else if (distance(bullet, state.player) < state.player.radius + bullet.radius) {
        this.hurt(bullet.damage);
        enemyBullets.splice(index, 1);
      } else if (bullet.life <= 0) enemyBullets.splice(index, 1);
    }
  }

  collectGems(delta) { const state = this.state; const { player, gems } = state.entities ? { player: state.player, gems: state.entities.gems } : {}; for (let index = gems.length - 1; index >= 0; index -= 1) { const gem = gems[index]; const currentDistance = distance(gem, player); if (currentDistance < player.magnet) { const angle = angleTo(gem, player); const speed = (player.magnet - currentDistance) * 5 + 100; gem.x += Math.cos(angle) * speed * delta; gem.y += Math.sin(angle) * speed * delta; } if (currentDistance < 20) { state.xp += gem.value; gems.splice(index, 1); this.audio.play(650 + state.xp * 4, .045, 'sine', .008); } } }

  updateParticles(delta) { const { particles, floaters } = this.state.entities; for (let index = particles.length - 1; index >= 0; index -= 1) { const particle = particles[index]; particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vx *= .975; particle.vy *= .975; particle.life -= delta; if (particle.life <= 0) particles.splice(index, 1); } for (let index = floaters.length - 1; index >= 0; index -= 1) { const floater = floaters[index]; floater.y -= 25 * delta; floater.life -= delta; if (floater.life <= 0) floaters.splice(index, 1); } }

  nextWave() { this.state.wave += 1; this.state.waveClock = 0; this.state.spawnTimer = 1.2; this.label(this.renderer.width / 2, this.renderer.height * .28, `ONDA ${this.state.wave}`, '#6feeff'); this.audio.play(260, .35, 'sawtooth', .08); }

  levelUp() {
    const state = this.state;
    state.xp -= state.nextXp;
    state.level += 1;
    const previousMaxHp = state.player.maxHp;
    state.player.maxHp = Math.ceil(previousMaxHp * 1.5);
    const hpBonus = state.player.maxHp - previousMaxHp;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + hpBonus);
    state.nextXp = Math.ceil(state.nextXp * 1.28 + 4);
    const count = Math.min(40, 9 + state.level * 2);
    for (let index = 0; index < count; index += 1) this.spawn(state.level >= 4 && index % 5 === 0 ? 'tank' : index % 3 === 0 ? 'runner' : 'grunt');
    if (state.level >= 4 && state.level % 2 === 0) {
      const variant = MINI_BOSS_VARIANTS[Math.floor(state.level / 2) % MINI_BOSS_VARIANTS.length];
      this.spawn('miniboss', { variant });
      this.label(this.renderer.width / 2, this.renderer.height * .24, `⚠ MINI-CHEFE · ${variant.name}`, variant.color);
    }
    this.label(state.player.x, state.player.y - 40, `CASCO +50% · +${hpBonus} VIDA`, '#80ffc2');
    this.label(this.renderer.width / 2, this.renderer.height * .32, `⚠ HORDA DO NÍVEL ${state.level}`, '#ffba74');
    state.mode = 'choice';
    const choices = pickChoices(UPGRADES, 3);
    if (Math.random() < .28) choices[Math.floor(Math.random() * choices.length)] = POWERS[Math.floor(Math.random() * POWERS.length)];
    this.ui.showUpgrade(state, choices, choice => this.applyChoice(choice));
  }

  applyChoice(choice) {
    const state = this.state;
    if (choice.key === 'companion' && state.companions.length) {
      this.ui.showCompanionUpgrade(state, target => {
        this.grantPower({ ...choice, ...target });
        this.finishChoice();
      });
      return;
    }
    if (choice.key) this.grantPower(choice);
    else choice.apply(state.player);
    this.finishChoice();
  }

  finishChoice() {
    const state = this.state;
    state.mode = 'playing';
    this.ui.showPlaying();
    this.audio.play(740, .22, 'triangle', .09);
    this.burst(state.player.x, state.player.y, '#7defff', 30, 1.5);
    if (state.level % 5 === 0) this.spawnBoss();
    if (state.pendingBossRewards > 0) this.openBossReward();
    else if (state.xp >= state.nextXp) this.levelUp();
  }

  grantPower(power) {
    const state = this.state;
    const player = state.player;
    state.powers[power.key] += 1;
    if (power.key === 'companion') {
      player.move = Math.max(120, player.move * .95);
      const target = state.companions.find(companion => companion.id === power.targetId);
      if (target) {
        target.level += 1;
      } else if (power.addNew || !state.companions.length) {
        const phase = state.time * 1.25 + state.companions.length * TAU / Math.max(1, state.companions.length + 1);
        state.companions.push({ id: state.companionSequence++, level: 1, x: player.x + Math.cos(phase) * 52, y: player.y + Math.sin(phase) * 52, phase, angle: 0, shootTimer: .4, disabledTimer: 0, hitFlash: 0, intercepting: false });
      }
    }
    if (power.key === 'shield') {
      player.rate = Math.min(1.35, player.rate * 1.1);
      state.shieldTime = 4;
      state.shieldCooldown = 0;
    }
    if (power.key === 'charged') state.chargeTimer = 0;
    if (power.key === 'aimbot') player.rate = Math.min(1.35, player.rate * 1.08);
    if (power.key === 'nova') {
      player.maxHp = Math.max(60, player.maxHp - 8);
      player.hp = Math.min(player.hp, player.maxHp);
      state.novaTimer = 1;
    }
    if (power.key === 'overdrive') {
      player.rate = Math.max(.13, player.rate * .84);
      player.damage *= 1.12;
      player.move = Math.max(120, player.move * .94);
    }
    if (power.key === 'singularity') {
      player.maxHp = Math.max(60, player.maxHp - 5);
      player.hp = Math.min(player.hp, player.maxHp);
      state.singularityTimer = 1.2;
    }
    if (power.key === 'ionStorm') {
      player.armor = Math.max(-.3, player.armor - .04);
      state.ionStormTimer = .8;
    }
  }

  openBossReward() {
    const state = this.state;
    state.mode = 'choice';
    this.ui.showBossReward(state, choice => {
      const grant = selected => {
        this.grantPower(selected);
        state.pendingBossRewards -= 1;
        if (selected.key === 'nova') state.novaTimer = 2;
        if (state.pendingBossRewards > 0) this.openBossReward();
        else if (state.xp >= state.nextXp) this.levelUp();
        else { state.mode = 'playing'; this.ui.showPlaying(); }
      };
      if (choice.key === 'companion' && state.companions.length) this.ui.showCompanionUpgrade(state, target => grant({ ...choice, ...target }));
      else grant(choice);
    });
  }

  chargedShot() {
    const state = this.state;
    if (!state || state.mode !== 'playing' || !state.powers.charged || state.chargeTimer > 0) return;
    const { player } = state;
    const target = state.powers.aimbot ? this.nearestEnemy(player) : null;
    const angle = target ? angleTo(player, target) : this.input.pointer.active ? Math.atan2(this.input.pointer.y - player.y, this.input.pointer.x - player.x) : player.angle;
    const speed = 590 * player.projectileSpeed / 710;
    state.entities.bullets.push({ x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, life: 1.8, radius: 14, damage: player.damage * (3 + state.powers.charged), pierce: 4 + state.powers.charged * 2, hit: new Set(), critical: true, slow: player.slow, charged: true });
    state.chargeTimer = Math.max(2.8, 7 - state.powers.charged * .7);
    this.audio.play(150, .45, 'sawtooth', .1);
    this.burst(player.x, player.y, '#ffcf67', 26, 1);
  }

  dash() { const state = this.state; if (!state || state.mode !== 'playing' || state.player.dash > 0) return; const player = state.player; player.dash = player.dashCooldown; player.dashTime = .38; player.invulnerable = Math.max(player.invulnerable, .42); this.burst(player.x, player.y, '#7ffaff', 22, 1.3); this.audio.play(280, .18, 'sawtooth', .06); }

  hurt(amount) { const state = this.state; const { player } = state; if (player.invulnerable > 0 || player.dashTime > 0 || state.shieldTime > 0) return; const damage = Math.max(1, amount * (1 - player.armor)); player.hp -= damage; player.invulnerable = .55; state.shake = 11; state.flash = .22; this.burst(player.x, player.y, '#ff587e', 15); this.label(player.x, player.y - 25, `-${Math.round(damage)}`, '#ff8098'); this.audio.play(180, .16, 'sawtooth', .065); if (player.hp <= 0) this.gameOver(); }

  gameOver() { const state = this.state; state.mode = 'dead'; state.shake = 20; this.burst(state.player.x, state.player.y, '#71f5ff', 65, 2); this.audio.play(130, .65, 'sawtooth', .14); this.bestScore = Math.max(this.bestScore, state.score); saveBestScore(this.bestScore); this.ui.showGameOver(state, this.bestScore); }

  togglePause() { if (!this.state || !['playing', 'paused'].includes(this.state.mode)) return; this.state.mode = this.state.mode === 'playing' ? 'paused' : 'playing'; this.lastTime = performance.now(); }
  burst(x, y, color, amount = 12, power = 1) { const particles = this.state.entities.particles; for (let index = 0; index < amount; index += 1) { const angle = random(0, TAU); const speed = random(30, 180) * power; const life = random(.25, .7); particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, radius: random(1, 4), color }); } if (particles.length > 430) particles.splice(0, particles.length - 430); }
  label(x, y, text, color = '#fff') { this.state.entities.floaters.push({ x, y, text, color, life: .85 }); }
}
