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
};

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

  previewState() { return { mode: 'menu', time: this.now / 1000, shake: 0, flash: 0, powers: {}, chargeTimer: 0, entities: { bullets: [], enemyBullets: [], enemies: [], gems: [], heals: [], asteroids: [], rings: [], particles: [], floaters: [] }, player: { x: this.renderer.width / 2, y: this.renderer.height / 2, angle: 0, radius: 13, hp: 100, maxHp: 100, dash: 0, dashTime: 0, invulnerable: 0 }, wave: 0, level: 0, score: 0, xp: 0, nextXp: 1 }; }

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
    if (state.asteroidTimer <= 0) { const fromLeft = Math.random() < .5; const speed = random(180, 255); entities.asteroids.push({ x: fromLeft ? -65 : this.renderer.width + 65, y: random(55, Math.max(56, this.renderer.height - 55)), vx: fromLeft ? speed : -speed, vy: random(-36, 36), radius: random(24, 35), spin: random(0, TAU), hit: false }); state.asteroidTimer = random(14, 21); this.label(this.renderer.width / 2, this.renderer.height * .2, '☄ ASTEROIDE A CAMINHO', '#ffc17a'); this.audio.play(180, .38, 'sawtooth', .07); }
    for (let index = entities.asteroids.length - 1; index >= 0; index -= 1) { const asteroid = entities.asteroids[index]; asteroid.x += asteroid.vx * delta; asteroid.y += asteroid.vy * delta; asteroid.spin += delta * 2; if (!asteroid.hit && distance(asteroid, player) < asteroid.radius + player.radius && player.dashTime <= 0 && state.shieldTime <= 0) { asteroid.hit = true; this.hurt(Math.max(1, Math.ceil(player.hp * .33))); this.burst(player.x, player.y, '#ffb073', 25); this.label(player.x, player.y - 25, '-33% VIDA ATUAL', '#ffb073'); } if (asteroid.x < -100 || asteroid.x > this.renderer.width + 100) entities.asteroids.splice(index, 1); }
    if (state.healTimer <= 0) { entities.heals.push({ x: random(35, Math.max(36, this.renderer.width - 35)), y: random(110, Math.max(111, this.renderer.height - 35)), life: 17, radius: 11 }); state.healTimer = random(16, 24); this.label(this.renderer.width / 2, this.renderer.height * .2, '+ CÁPSULA DE CURA DISPONÍVEL', '#79ffb4'); }
    for (let index = entities.heals.length - 1; index >= 0; index -= 1) { const heal = entities.heals[index]; heal.life -= delta; if (distance(heal, player) < heal.radius + player.radius) { const amount = Math.min(35, player.maxHp - player.hp); player.hp += amount; this.label(player.x, player.y - 24, `+${Math.round(amount)} VIDA`, '#6dffc1'); this.burst(heal.x, heal.y, '#5dffab', 18); entities.heals.splice(index, 1); } else if (heal.life <= 0) entities.heals.splice(index, 1); }
    for (let index = entities.rings.length - 1; index >= 0; index -= 1) { entities.rings[index].life -= delta; if (entities.rings[index].life <= 0) entities.rings.splice(index, 1); }
  }

  updatePlayer(delta) {
    const state = this.state; const { player } = state; const movement = this.input.movement();
    if (movement.x || movement.y) { player.x = clamp(player.x + movement.x * player.move * (player.dashTime > 0 ? 3.8 : 1) * delta, player.radius, this.renderer.width - player.radius); player.y = clamp(player.y + movement.y * player.move * (player.dashTime > 0 ? 3.8 : 1) * delta, player.radius, this.renderer.height - player.radius); if (Math.random() < .25) this.burst(player.x - movement.x * 14, player.y - movement.y * 14, '#38b6ff', 1, .2); }
    if (this.input.pointer.active) player.angle = Math.atan2(this.input.pointer.y - player.y, this.input.pointer.x - player.x);
    player.invulnerable = Math.max(0, player.invulnerable - delta); player.dash = Math.max(0, player.dash - delta); player.dashTime = Math.max(0, player.dashTime - delta); player.shootTimer -= delta;
    if (player.shootTimer <= 0 && state.entities.enemies.length) { this.shoot(); player.shootTimer = player.rate; }
  }

  updatePowers(delta) {
    const state = this.state; const { player, entities } = state;
    state.shieldCooldown = Math.max(0, state.shieldCooldown - delta); state.shieldTime = Math.max(0, state.shieldTime - delta); state.chargeTimer = Math.max(0, state.chargeTimer - delta);
    if (state.powers.shield && state.shieldTime <= 0 && state.shieldCooldown <= 0) { state.shieldTime = 2.4 + .8 * state.powers.shield; state.shieldCooldown = Math.max(7, 16 - 2 * state.powers.shield); this.burst(player.x, player.y, '#81ffca', 18, .7); }
    if (state.powers.companion && entities.enemies.length) { state.companionShotTimer -= delta; if (state.companionShotTimer <= 0) { for (let index = 0; index < Math.min(4, state.powers.companion); index += 1) this.companionShoot(index); state.companionShotTimer = Math.max(.25, .75 - .06 * state.powers.companion); } }
    if (state.powers.nova) { state.novaTimer -= delta; if (state.novaTimer <= 0) { const radius = 155 + state.powers.nova * 25; for (const enemy of entities.enemies) if (distance(player, enemy) < radius) enemy.hp -= player.damage * (2 + state.powers.nova); for (let index = entities.enemyBullets.length - 1; index >= 0; index -= 1) if (distance(player, entities.enemyBullets[index]) < radius) entities.enemyBullets.splice(index, 1); this.burst(player.x, player.y, '#a790ff', 65, 2); entities.rings.push({ x: player.x, y: player.y, maxRadius: radius, life: .65, duration: .65, color: '#c4a3ff' }); state.novaTimer = Math.max(4.5, 10 - state.powers.nova); this.audio.play(110, .4, 'triangle', .1); } }
  }

  spawnEnemies(delta) {
    const state = this.state; const maximum = Math.min(95, 7 + state.wave * 3); state.spawnTimer -= delta; if (state.spawnTimer > 0 || state.entities.enemies.length >= maximum) return; const roll = Math.random(); const type = state.wave >= 3 && roll < .12 ? 'sniper' : state.wave >= 2 && roll < .3 ? 'runner' : state.wave >= 4 && roll < .43 ? 'tank' : 'grunt'; this.spawn(type); state.spawnTimer = Math.max(.16, .85 - state.wave * .046) * random(.7, 1.35); }

  spawn(type) {
    const state = this.state; const template = ENEMY_TYPES[type]; const position = randomSpawnPosition(this.renderer.width, this.renderer.height); const scale = 1 + state.wave * .12; state.entities.enemies.push({ ...position, type, radius: template.radius, hp: template.hp * scale, maxHp: template.hp * scale, speed: template.speed * (1 + state.wave * .025), damage: template.damage, value: template.value, color: template.color, shootTimer: random(.8, 2), pulse: random(0, TAU), slow: 0, adaptive: null, side: 1 }); }

  spawnBoss() { this.spawn('boss'); const state = this.state; const boss = state.entities.enemies.at(-1); const player = state.player; boss.adaptive = { shield: player.rate < .29 || player.shots > 1 || player.pierce > 0, agile: player.move > 185 || player.dashCooldown < 3, armor: player.damage > 19 || player.crit > .06, resist: player.slow > 0, barrage: player.maxHp > 100 || player.hp > 100 }; boss.hp *= 1 + (state.level - 5) * .14; boss.maxHp = boss.hp; boss.shootTimer = .8; this.label(this.renderer.width / 2, this.renderer.height * .25, `⚠ GUARDIÃO ADAPTATIVO · NÍVEL ${state.level}`, '#ff85df'); this.audio.play(170, .6, 'sawtooth', .11); }

  shoot() {
    const state = this.state; const { player, entities } = state; const target = entities.enemies.reduce((nearest, enemy) => !nearest || distance(player, enemy) < distance(player, nearest) ? enemy : nearest, null); if (!target) return; const center = this.input.pointer.active ? Math.atan2(this.input.pointer.y - player.y, this.input.pointer.x - player.x) : angleTo(player, target); player.angle = center; for (let index = 0; index < player.shots; index += 1) { const angle = center + (index - (player.shots - 1) / 2) * .16; entities.bullets.push({ x: player.x + Math.cos(angle) * 18, y: player.y + Math.sin(angle) * 18, vx: Math.cos(angle) * 710, vy: Math.sin(angle) * 710, life: 1.1, radius: 4, damage: player.damage, pierce: player.pierce, hit: new Set(), critical: Math.random() < player.crit, slow: player.slow }); } this.audio.play(450, .055, 'triangle', .016); this.burst(player.x + Math.cos(center) * 17, player.y + Math.sin(center) * 17, '#70f5ff', 3, .35); }

  companionShoot(index) { const state = this.state; const player = state.player; const angle = state.time * 1.6 + index * TAU / Math.min(4, state.powers.companion); const x = player.x + Math.cos(angle) * 44; const y = player.y + Math.sin(angle) * 44; const target = state.entities.enemies.reduce((nearest, enemy) => !nearest || distance({ x, y }, enemy) < distance({ x, y }, nearest) ? enemy : nearest, null); if (!target) return; const shotAngle = angleTo({ x, y }, target); state.entities.bullets.push({ x, y, vx: Math.cos(shotAngle) * 570, vy: Math.sin(shotAngle) * 570, life: 1.2, radius: 4, damage: player.damage * .7, pierce: 0, hit: new Set(), critical: false, slow: player.slow }); }

  updateBullets(delta) {
    const state = this.state; const { bullets, enemies } = state.entities;
    for (let index = bullets.length - 1; index >= 0; index -= 1) { const bullet = bullets[index]; bullet.x += bullet.vx * delta; bullet.y += bullet.vy * delta; bullet.life -= delta; if (bullet.life <= 0 || bullet.x < -40 || bullet.x > this.renderer.width + 40 || bullet.y < -40 || bullet.y > this.renderer.height + 40) { bullets.splice(index, 1); continue; } let remove = false; for (const enemy of enemies) { if (bullet.hit.has(enemy) || distance(bullet, enemy) > enemy.radius + bullet.radius) continue; bullet.hit.add(enemy); const damage = bullet.damage * (bullet.critical ? 3 : 1); enemy.hp -= enemy.adaptive?.shield ? damage * .78 : enemy.adaptive?.armor ? damage * .86 : damage; enemy.slow = Math.max(enemy.slow, bullet.slow * (enemy.adaptive?.resist ? .65 : 1.7)); this.burst(bullet.x, bullet.y, enemy.color, bullet.critical ? 10 : 5, .6); if (bullet.critical) this.label(enemy.x, enemy.y - 23, `✦ ${Math.round(damage)}`, '#fff18c'); if (bullet.pierce-- <= 0) { remove = true; break; } } if (remove) bullets.splice(index, 1); }
  }

  updateEnemies(delta) {
    const state = this.state; const { player, entities } = state;
    for (let index = entities.enemies.length - 1; index >= 0; index -= 1) { const enemy = entities.enemies[index]; if (enemy.hp <= 0) { this.killEnemy(enemy); entities.enemies.splice(index, 1); continue; } const direction = angleTo(enemy, player); const currentDistance = distance(player, enemy); enemy.pulse += delta * 3; enemy.slow = Math.max(0, enemy.slow - delta); let speed = enemy.speed * (1 - Math.min(.72, enemy.slow)); if (enemy.adaptive?.agile && currentDistance > 90) { enemy.x += Math.cos(direction + Math.PI / 2) * speed * .5 * enemy.side * delta; enemy.y += Math.sin(direction + Math.PI / 2) * speed * .5 * enemy.side * delta; if (Math.random() < delta * .65) enemy.side *= -1; } if (enemy.type === 'sniper' && currentDistance < 230) speed *= -.5; else if (enemy.type === 'sniper' && currentDistance < 350) speed = 0; enemy.x += Math.cos(direction) * speed * delta; enemy.y += Math.sin(direction) * speed * delta; if (currentDistance < player.radius + enemy.radius) this.hurt(enemy.damage); enemy.shootTimer -= delta; if (enemy.shootTimer <= 0 && (enemy.type === 'sniper' || enemy.type === 'boss') && currentDistance < 700) { const count = enemy.type === 'boss' ? (enemy.adaptive?.barrage ? 13 : 9) : 1; for (let shot = 0; shot < count; shot += 1) { const angle = enemy.type === 'boss' ? direction + (shot - (count - 1) / 2) * (enemy.adaptive?.barrage ? .14 : .19) : direction; entities.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * (enemy.type === 'boss' ? 165 : 240), vy: Math.sin(angle) * (enemy.type === 'boss' ? 165 : 240), life: 4, radius: enemy.type === 'boss' ? 6 : 5, damage: enemy.type === 'boss' ? 13 : 9 }); } enemy.shootTimer = enemy.type === 'boss' ? (enemy.adaptive?.agile ? 1.2 : 1.65) : 2.3; } }
  }

  killEnemy(enemy) { const state = this.state; const { gems } = state.entities; state.kills += 1; state.score += enemy.value * 10; this.burst(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 60 : 15, enemy.type === 'boss' ? 2 : 1); const pieces = enemy.type === 'boss' ? 16 : enemy.type === 'tank' ? 4 : 1; for (let index = 0; index < pieces; index += 1) gems.push({ x: enemy.x + random(-16, 16), y: enemy.y + random(-16, 16), value: enemy.type === 'boss' ? 5 : enemy.type === 'tank' ? 3 : 2, radius: 5 }); if (enemy.type === 'boss') { state.pendingBossRewards += 1; state.score += 2000; this.label(enemy.x, enemy.y, 'GUARDIÃO DESTRUÍDO +2000', '#ffe687'); this.audio.play(950, .4, 'sawtooth', .1); } }

  updateEnemyBullets(delta) { const state = this.state; const { enemyBullets } = state.entities; for (let index = enemyBullets.length - 1; index >= 0; index -= 1) { const bullet = enemyBullets[index]; bullet.x += bullet.vx * delta; bullet.y += bullet.vy * delta; bullet.life -= delta; if (distance(bullet, state.player) < state.player.radius + bullet.radius) { this.hurt(bullet.damage); enemyBullets.splice(index, 1); } else if (bullet.life <= 0) enemyBullets.splice(index, 1); } }

  collectGems(delta) { const state = this.state; const { player, gems } = state.entities ? { player: state.player, gems: state.entities.gems } : {}; for (let index = gems.length - 1; index >= 0; index -= 1) { const gem = gems[index]; const currentDistance = distance(gem, player); if (currentDistance < player.magnet) { const angle = angleTo(gem, player); const speed = (player.magnet - currentDistance) * 5 + 100; gem.x += Math.cos(angle) * speed * delta; gem.y += Math.sin(angle) * speed * delta; } if (currentDistance < 20) { state.xp += gem.value; gems.splice(index, 1); this.audio.play(650 + state.xp * 4, .045, 'sine', .008); } } }

  updateParticles(delta) { const { particles, floaters } = this.state.entities; for (let index = particles.length - 1; index >= 0; index -= 1) { const particle = particles[index]; particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vx *= .975; particle.vy *= .975; particle.life -= delta; if (particle.life <= 0) particles.splice(index, 1); } for (let index = floaters.length - 1; index >= 0; index -= 1) { const floater = floaters[index]; floater.y -= 25 * delta; floater.life -= delta; if (floater.life <= 0) floaters.splice(index, 1); } }

  nextWave() { this.state.wave += 1; this.state.waveClock = 0; this.state.spawnTimer = 1.2; this.label(this.renderer.width / 2, this.renderer.height * .28, `ONDA ${this.state.wave}`, '#6feeff'); this.audio.play(260, .35, 'sawtooth', .08); }

  levelUp() { const state = this.state; state.xp -= state.nextXp; state.level += 1; state.nextXp = Math.ceil(state.nextXp * 1.28 + 4); const count = Math.min(34, 7 + state.level * 2); for (let index = 0; index < count; index += 1) this.spawn(state.level >= 4 && index % 6 === 0 ? 'tank' : index % 3 === 0 ? 'runner' : 'grunt'); this.label(this.renderer.width / 2, this.renderer.height * .32, `⚠ HORDA DO NÍVEL ${state.level}`, '#ffba74'); state.mode = 'choice'; const choices = pickChoices(UPGRADES, 3); if (Math.random() < .28) choices[Math.floor(Math.random() * choices.length)] = POWERS[Math.floor(Math.random() * POWERS.length)]; this.ui.showUpgrade(state, choices, choice => this.applyChoice(choice)); }

  applyChoice(choice) { const state = this.state; if (choice.key) { state.powers[choice.key] += 1; if (choice.key === 'shield') { state.shieldTime = 4; state.shieldCooldown = 0; } if (choice.key === 'charged') state.chargeTimer = 0; if (choice.key === 'nova') state.novaTimer = 1; } else choice.apply(state.player); state.mode = 'playing'; this.ui.showPlaying(); this.audio.play(740, .22, 'triangle', .09); this.burst(state.player.x, state.player.y, '#7defff', 30, 1.5); if (state.level % 5 === 0) this.spawnBoss(); if (state.pendingBossRewards > 0) this.openBossReward(); else if (state.xp >= state.nextXp) this.levelUp(); }

  openBossReward() { const state = this.state; state.mode = 'choice'; this.ui.showBossReward(state, choice => { state.powers[choice.key] += 1; state.pendingBossRewards -= 1; if (choice.key === 'shield') { state.shieldTime = 4; state.shieldCooldown = 0; } if (choice.key === 'charged') state.chargeTimer = 0; if (choice.key === 'nova') state.novaTimer = 2; if (state.pendingBossRewards > 0) this.openBossReward(); else if (state.xp >= state.nextXp) this.levelUp(); else { state.mode = 'playing'; this.ui.showPlaying(); } }); }

  chargedShot() { const state = this.state; if (!state || state.mode !== 'playing' || !state.powers.charged || state.chargeTimer > 0) return; const { player } = state; const angle = this.input.pointer.active ? Math.atan2(this.input.pointer.y - player.y, this.input.pointer.x - player.x) : player.angle; state.entities.bullets.push({ x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20, vx: Math.cos(angle) * 590, vy: Math.sin(angle) * 590, life: 1.8, radius: 14, damage: player.damage * (3 + state.powers.charged), pierce: 4 + state.powers.charged * 2, hit: new Set(), critical: true, slow: player.slow, charged: true }); state.chargeTimer = Math.max(2.8, 7 - state.powers.charged * .7); this.audio.play(150, .45, 'sawtooth', .1); this.burst(player.x, player.y, '#ffcf67', 26, 1); }

  dash() { const state = this.state; if (!state || state.mode !== 'playing' || state.player.dash > 0) return; const player = state.player; player.dash = player.dashCooldown; player.dashTime = .38; player.invulnerable = Math.max(player.invulnerable, .42); this.burst(player.x, player.y, '#7ffaff', 22, 1.3); this.audio.play(280, .18, 'sawtooth', .06); }

  hurt(amount) { const state = this.state; const { player } = state; if (player.invulnerable > 0 || player.dashTime > 0 || state.shieldTime > 0) return; player.hp -= amount; player.invulnerable = .55; state.shake = 11; state.flash = .22; this.burst(player.x, player.y, '#ff587e', 15); this.label(player.x, player.y - 25, `-${Math.round(amount)}`, '#ff8098'); this.audio.play(180, .16, 'sawtooth', .065); if (player.hp <= 0) this.gameOver(); }

  gameOver() { const state = this.state; state.mode = 'dead'; state.shake = 20; this.burst(state.player.x, state.player.y, '#71f5ff', 65, 2); this.audio.play(130, .65, 'sawtooth', .14); this.bestScore = Math.max(this.bestScore, state.score); saveBestScore(this.bestScore); this.ui.showGameOver(state, this.bestScore); }

  togglePause() { if (!this.state || !['playing', 'paused'].includes(this.state.mode)) return; this.state.mode = this.state.mode === 'playing' ? 'paused' : 'playing'; this.lastTime = performance.now(); }
  burst(x, y, color, amount = 12, power = 1) { const particles = this.state.entities.particles; for (let index = 0; index < amount; index += 1) { const angle = random(0, TAU); const speed = random(30, 180) * power; const life = random(.25, .7); particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, radius: random(1, 4), color }); } if (particles.length > 430) particles.splice(0, particles.length - 430); }
  label(x, y, text, color = '#fff') { this.state.entities.floaters.push({ x, y, text, color, life: .85 }); }
}
