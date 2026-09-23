import { TAU, clamp, hexagon } from '../core/math.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.width = innerWidth;
    this.height = innerHeight;
    this.dpr = 1;
    this.stars = [];
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.stars = Array.from({ length: Math.ceil(this.width * this.height / 8500) }, () => ({ x: Math.random() * this.width, y: Math.random() * this.height, radius: Math.random() * 1.3 + .4, phase: Math.random() * TAU }));
  }

  draw(state, pointer, bestScore, now) {
    const context = this.context;
    const { width, height } = this;
    this.canvas.style.cursor = pointer.active && state.mode === 'playing' ? 'none' : 'crosshair';
    context.fillStyle = '#050b17';
    context.fillRect(0, 0, width, height);
    context.save();
    context.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
    this.drawBackdrop(context, state, pointer, now);
    this.drawWorld(context, state, pointer, now);
    context.restore();
    if (pointer.active && state.mode === 'playing') this.drawReticle(context, pointer, now);
    if (state.flash > 0) { context.fillStyle = `rgba(255,60,100,${state.flash * .42})`; context.fillRect(0, 0, width, height); }
    if (state.mode !== 'menu') this.drawHud(context, state, bestScore, width);
  }

  drawBackdrop(context, state, pointer, now) {
    const { width, height } = this;
    const gap = 55;
    const offset = (state.time * 11) % gap;
    context.strokeStyle = '#1a3a5755';
    context.lineWidth = 1;
    for (let x = -gap + offset; x < width + gap; x += gap) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    for (let y = -gap + offset; y < height + gap; y += gap) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
    for (const star of this.stars) {
      context.globalAlpha = .3 + .35 * Math.sin(now * .0015 + star.phase);
      context.fillStyle = '#9adfff';
      context.beginPath(); context.arc(star.x, star.y, star.radius, 0, TAU); context.fill();
    }
    context.globalAlpha = 1;
  }

  drawReticle(context, pointer, now) {
    context.save();
    context.translate(pointer.x, pointer.y);
    context.strokeStyle = '#75f4ff';
    context.fillStyle = '#d8ffff';
    context.lineWidth = 1.4;
    context.shadowBlur = 9;
    context.shadowColor = '#42eaff';
    const pulse = Math.sin(now * .009) * .8;
    context.beginPath();
    context.arc(0, 0, 8 + pulse, 0, TAU);
    context.moveTo(-16, 0); context.lineTo(-7, 0);
    context.moveTo(16, 0); context.lineTo(7, 0);
    context.moveTo(0, -16); context.lineTo(0, -7);
    context.moveTo(0, 16); context.lineTo(0, 7);
    context.stroke();
    context.beginPath(); context.arc(0, 0, 1.5, 0, TAU); context.fill();
    context.restore();
  }

  drawWorld(context, state, pointer, now) {
    const { asteroids, heals, rings, gems, bullets, enemyBullets, enemies, particles, floaters } = state.entities;
    const { player } = state;
    for (const asteroid of asteroids) this.drawAsteroid(context, asteroid);
    for (const heal of heals) this.drawHeal(context, heal, now);
    for (const ring of rings) this.drawRing(context, ring);
    for (const gem of gems) { context.shadowBlur = 14; context.shadowColor = '#6bffed'; context.fillStyle = '#69f8dd'; hexagon(context, gem.x, gem.y, gem.radius, now * .001); context.fill(); }
    for (const bullet of bullets) this.drawBullet(context, bullet);
    for (const bullet of enemyBullets) this.drawEnemyBullet(context, bullet);
    for (const enemy of enemies) this.drawEnemy(context, enemy, now);
    this.drawPlayer(context, state, now);
    for (const particle of particles) { context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1); context.fillStyle = particle.color; context.beginPath(); context.arc(particle.x, particle.y, particle.radius, 0, TAU); context.fill(); }
    context.globalAlpha = 1;
    for (const floater of floaters) { context.globalAlpha = clamp(floater.life, 0, 1); context.fillStyle = floater.color; context.textAlign = 'center'; context.font = 'bold 16px system-ui'; context.fillText(floater.text, floater.x, floater.y); }
    context.globalAlpha = 1;
  }

  drawAsteroid(context, asteroid) {
    context.save(); context.translate(asteroid.x, asteroid.y); context.rotate(asteroid.spin); context.shadowBlur = 23; context.shadowColor = '#ff995f'; context.fillStyle = '#534558'; context.strokeStyle = '#ffa765'; context.lineWidth = 3;
    context.beginPath(); for (let i = 0; i < 9; i += 1) { const angle = i * TAU / 9; const radius = asteroid.radius * (i % 3 === 0 ? .78 : 1); context[i ? 'lineTo' : 'moveTo'](Math.cos(angle) * radius, Math.sin(angle) * radius); } context.closePath(); context.fill(); context.stroke(); context.restore();
  }

  drawHeal(context, heal, now) { context.shadowBlur = 19; context.shadowColor = '#72ffad'; context.fillStyle = '#2a7655'; context.beginPath(); context.arc(heal.x, heal.y, heal.radius + 2 + Math.sin(now * .007) * 2, 0, TAU); context.fill(); context.fillStyle = '#b9ffdb'; context.fillRect(heal.x - 2, heal.y - 8, 4, 16); context.fillRect(heal.x - 8, heal.y - 2, 16, 4); context.shadowBlur = 0; }
  drawRing(context, ring) { context.globalAlpha = ring.life / ring.duration; context.strokeStyle = ring.color; context.lineWidth = 9 * ring.life / ring.duration + 2; context.shadowBlur = 35; context.shadowColor = ring.color; context.beginPath(); context.arc(ring.x, ring.y, ring.maxRadius * (1 - ring.life / ring.duration), 0, TAU); context.stroke(); context.globalAlpha = 1; context.shadowBlur = 0; }
  drawBullet(context, bullet) { context.shadowBlur = 16; context.shadowColor = bullet.charged ? '#ffaf48' : bullet.critical ? '#ffe487' : '#5ff6ff'; context.fillStyle = bullet.charged ? '#ffd06c' : bullet.critical ? '#fff4a5' : '#a0ffff'; context.beginPath(); context.arc(bullet.x, bullet.y, bullet.radius, 0, TAU); context.fill(); context.shadowBlur = 0; }
  drawEnemyBullet(context, bullet) { context.shadowBlur = 17; context.shadowColor = '#ff59b3'; context.fillStyle = '#ff8bd4'; context.beginPath(); context.arc(bullet.x, bullet.y, bullet.radius, 0, TAU); context.fill(); context.shadowBlur = 0; }

  drawEnemy(context, enemy, now) {
    const isBoss = enemy.type === 'boss';
    const isMiniBoss = enemy.type === 'miniboss';
    context.save(); context.translate(enemy.x, enemy.y); context.rotate(enemy.pulse * .18); context.shadowBlur = enemy.elite || isBoss || isMiniBoss ? 25 : 22; context.shadowColor = enemy.elite ? '#ffd36a' : enemy.color; context.strokeStyle = enemy.elite ? '#ffe08a' : enemy.color; context.lineWidth = enemy.elite ? 3 : 2.5; context.fillStyle = '#15203b'; hexagon(context, 0, 0, enemy.radius, Math.PI / 6); context.fill(); context.stroke(); context.fillStyle = enemy.color; hexagon(context, 0, 0, isBoss ? 17 : isMiniBoss ? 12 : enemy.radius * .38, Math.PI / 6); context.fill(); if (isBoss || isMiniBoss || enemy.elite) { context.strokeStyle = isBoss ? '#ffbadf' : enemy.elite ? '#fff0ad' : '#ffe0a8'; context.lineWidth = isBoss ? 3 : 2; hexagon(context, 0, 0, enemy.radius + (isBoss ? 8 : 5), now * (isBoss ? .0008 : .0012)); context.stroke(); } context.restore();
    if (enemy.hp < enemy.maxHp || isBoss || isMiniBoss) {
      const barY = enemy.y - enemy.radius - (isBoss ? 24 : 15);
      if (isBoss || isMiniBoss) { context.textAlign = 'center'; context.font = `bold ${isBoss ? 12 : 10}px system-ui`; context.fillStyle = enemy.color; context.fillText(isBoss ? enemy.bossVariant.name : enemy.miniVariant.name, enemy.x, barY - 5); }
      context.fillStyle = '#0009'; context.fillRect(enemy.x - enemy.radius, barY, enemy.radius * 2, isBoss ? 6 : 4); context.fillStyle = enemy.elite ? '#ffe08a' : enemy.color; context.fillRect(enemy.x - enemy.radius, barY, enemy.radius * 2 * clamp(enemy.hp / enemy.maxHp, 0, 1), isBoss ? 6 : 4);
    }
  }

  drawPlayer(context, state, now) {
    const { player } = state;
    context.save(); context.translate(player.x, player.y); context.rotate(player.angle + Math.PI / 2); if (player.invulnerable > 0 && Math.floor(now / 65) % 2) context.globalAlpha = .4; context.shadowBlur = 25; context.shadowColor = '#50eaff'; context.fillStyle = '#111d38'; context.strokeStyle = '#8af5ff'; context.lineWidth = 2.5; context.beginPath(); context.moveTo(0, -19); context.lineTo(13, 12); context.lineTo(0, 7); context.lineTo(-13, 12); context.closePath(); context.fill(); context.stroke(); const thrusterColor = player.dashTime > 0 ? '#ffffff' : player.dash <= 0 ? '#ffd34f' : '#42d9ff'; context.fillStyle = thrusterColor; context.shadowColor = thrusterColor; context.shadowBlur = player.dash <= 0 ? 22 : 15; context.beginPath(); context.moveTo(-6, 12); context.lineTo(0, player.dashTime > 0 ? 35 : player.dash <= 0 ? 31 + Math.sin(now * .012) * 2 : 28); context.lineTo(6, 12); context.fill(); context.restore();
    if (state.shieldTime > 0) { context.strokeStyle = '#8cffc9'; context.shadowBlur = 25; context.shadowColor = '#76ffbd'; context.lineWidth = 3; context.beginPath(); context.arc(player.x, player.y, 31 + Math.sin(now * .01) * 2, 0, TAU); context.stroke(); context.shadowBlur = 0; }
    for (let i = 0; i < Math.min(4, state.powers.companion); i += 1) { const angle = state.time * 1.6 + i * TAU / Math.min(4, state.powers.companion); context.fillStyle = '#b4b6ff'; context.shadowBlur = 16; context.shadowColor = '#949aff'; hexagon(context, player.x + Math.cos(angle) * 44, player.y + Math.sin(angle) * 44, 7, now * .002); context.fill(); context.shadowBlur = 0; }
  }

  drawHud(context, state, bestScore, width) {
    const { player } = state;
    const padding = width < 600 ? 13 : 25;
    const panelWidth = width < 600 ? 224 : 238;
    const panelHeight = 139;
    context.fillStyle = '#081426dc';
    context.fillRect(padding, padding, panelWidth, panelHeight);
    context.strokeStyle = '#407590';
    context.strokeRect(padding, padding, panelWidth, panelHeight);
    context.textAlign = 'left';
    context.fillStyle = '#e5f9ff';
    context.font = 'bold 14px system-ui';
    context.fillText(`ONDA ${state.wave}   ·   NÍVEL ${state.level}`, padding + 11, padding + 20);
    context.fillStyle = '#294258';
    context.fillRect(padding + 11, padding + 28, panelWidth - 22, 11);
    context.fillStyle = player.hp / player.maxHp < .3 ? '#ff5877' : '#4df8a8';
    context.fillRect(padding + 11, padding + 28, (panelWidth - 22) * clamp(player.hp / player.maxHp, 0, 1), 11);
    context.fillStyle = '#294258';
    context.fillRect(padding + 11, padding + 47, panelWidth - 22, 6);
    context.fillStyle = '#6ee6ff';
    context.fillRect(padding + 11, padding + 47, (panelWidth - 22) * clamp(state.xp / state.nextXp, 0, 1), 6);
    context.fillStyle = '#a8c5d6';
    context.font = '10px system-ui';
    context.fillText(`CASCO ${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}  ·  XP ${state.xp}/${state.nextXp}`, padding + 11, padding + 68);
    context.strokeStyle = '#40759080';
    context.beginPath(); context.moveTo(padding + 11, padding + 77); context.lineTo(padding + panelWidth - 11, padding + 77); context.stroke();

    const stats = [
      { label: 'DANO', value: Math.round(player.damage) },
      { label: 'CADÊNCIA', value: `${(1 / player.rate).toFixed(1)}/s` },
      { label: 'VELOCIDADE', value: `${Math.round(player.move)}` },
      { label: 'CRÍTICO', value: `${Math.round(player.crit * 100)}%` },
    ];
    const columnWidth = (panelWidth - 22) / 2;
    stats.forEach((stat, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = padding + 11 + column * columnWidth;
      const y = padding + 95 + row * 20;
      context.fillStyle = '#82a4ba';
      context.font = '9px system-ui';
      context.fillText(stat.label, x, y);
      context.fillStyle = '#e8faff';
      context.font = 'bold 11px system-ui';
      context.fillText(String(stat.value), x + columnWidth - 34, y);
    });

    context.textAlign = 'right';
    context.font = 'bold 18px system-ui';
    context.fillStyle = '#e8faff';
    context.fillText(`${state.score} PTS`, width - padding, padding + 21);
    context.font = '11px system-ui';
    context.fillStyle = '#83aec8';
    context.fillText(`RECORDE ${bestScore}`, width - padding, padding + 40);
    context.fillStyle = player.dash <= 0 ? '#ffd34f' : '#83aec8';
    context.font = 'bold 12px system-ui';
    context.fillText(`IMPULSO ${player.dash <= 0 ? 'PRONTO' : `${player.dash.toFixed(1)}s`}`, width - padding, padding + 60);
    const powerIcons = { companion: '🤖', shield: '🛡', charged: '☄', nova: '🌌' };
    const activePowers = Object.entries(state.powers).filter(([, value]) => value > 0).map(([key, value]) => `${powerIcons[key]}×${value}`).join('  ');
    context.fillStyle = '#d5b4ff';
    context.font = '12px system-ui';
    context.fillText(activePowers, width - padding, padding + 80);
    if (state.powers.charged) {
      context.fillStyle = state.chargeTimer <= 0 ? '#ffd581' : '#9eabbb';
      context.fillText(`TIRO CARREGADO ${state.chargeTimer <= 0 ? 'PRONTO' : `${state.chargeTimer.toFixed(1)}s`}`, width - padding, padding + 99);
    }
    if (state.mode === 'paused') { context.fillStyle = '#020914b8'; context.fillRect(0, 0, width, this.height); context.textAlign = 'center'; context.fillStyle = '#fff'; context.font = 'bold 40px system-ui'; context.fillText('PAUSADO', width / 2, this.height / 2); context.font = '16px system-ui'; context.fillText('Pressione P para continuar', width / 2, this.height / 2 + 30); }
  }
}
