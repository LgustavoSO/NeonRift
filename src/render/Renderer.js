import { TAU, clamp, hexagon } from '../core/math.js';
import { MAX_COMPANION_LEVEL, TOTAL_BOSSES } from '../data/hangar.js';
import { getHordeProgress } from '../data/horde-progress.js';
import { firewheelStats } from '../data/power-stats.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.width = innerWidth;
    this.height = innerHeight;
    this.dpr = 1;
    this.stars = [];
    this.coarsePointer = matchMedia('(pointer: coarse)');
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
    if (state.mode === 'playing') this.drawNotifications(context, state);
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
    const { asteroids, heals, mines = [], rings, gems, bullets, enemyBullets, enemies, particles, floaters } = state.entities;
    const { player } = state;
    for (const asteroid of asteroids) this.drawAsteroid(context, asteroid);
    for (const heal of heals) this.drawHeal(context, heal, now);
    for (const mine of mines) this.drawMine(context, mine, now);
    for (const ring of rings) if (ring.kind !== 'riftLance') this.drawRing(context, ring, now);
    for (const gem of gems) { context.shadowBlur = 14; context.shadowColor = '#6bffed'; context.fillStyle = '#69f8dd'; hexagon(context, gem.x, gem.y, gem.radius, now * .001); context.fill(); }
    for (const bullet of bullets) this.drawBullet(context, bullet);
    for (const bullet of enemyBullets) this.drawEnemyBullet(context, bullet);
    for (const enemy of enemies) this.drawEnemy(context, enemy, now);
    for (const ring of rings) if (ring.kind === 'riftLance') this.drawRing(context, ring, now);
    if (state.singularityField) this.drawSingularityField(context, state.singularityField, now);
    if (state.powers.aimbot && state.aimTarget && enemies.includes(state.aimTarget)) {
      context.save(); context.strokeStyle = '#ffd45c65'; context.lineWidth = 1; context.setLineDash([4, 8]); context.beginPath(); context.moveTo(player.x, player.y); context.lineTo(state.aimTarget.x, state.aimTarget.y); context.stroke(); context.setLineDash([]); context.restore();
      this.drawTargetLock(context, state.aimTarget, now);
    }
    this.drawPowerEffects(context, state, now);
    for (const companion of state.companions) this.drawCompanion(context, companion, now);
    this.drawPlayer(context, state, now);
    for (const particle of particles) { context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1); context.fillStyle = particle.color; context.beginPath(); context.arc(particle.x, particle.y, particle.radius, 0, TAU); context.fill(); }
    context.globalAlpha = 1;
    for (const floater of floaters) { context.globalAlpha = clamp(floater.life, 0, 1); context.fillStyle = floater.color; context.textAlign = 'center'; context.font = 'bold 16px system-ui'; context.fillText(floater.text, floater.x, floater.y); }
    context.globalAlpha = 1;
  }

  drawAsteroid(context, asteroid) {
    const angle = Math.atan2(asteroid.vy, asteroid.vx);
    context.save(); context.translate(asteroid.x, asteroid.y); context.rotate(angle);
    const trail = context.createLinearGradient(-asteroid.radius * 4, 0, 0, 0);
    trail.addColorStop(0, '#ff6b2400'); trail.addColorStop(1, '#ffb56270');
    context.fillStyle = trail; context.beginPath(); context.moveTo(-asteroid.radius * 4, 0); context.lineTo(0, -asteroid.radius * .7); context.lineTo(0, asteroid.radius * .7); context.closePath(); context.fill(); context.restore();
    context.save(); context.translate(asteroid.x, asteroid.y); context.rotate(asteroid.spin); context.shadowBlur = 23; context.shadowColor = '#ff995f'; context.fillStyle = '#534558'; context.strokeStyle = '#ffa765'; context.lineWidth = 3;
    context.beginPath(); for (let i = 0; i < 9; i += 1) { const angle = i * TAU / 9; const radius = asteroid.radius * (i % 3 === 0 ? .78 : 1); context[i ? 'lineTo' : 'moveTo'](Math.cos(angle) * radius, Math.sin(angle) * radius); } context.closePath(); context.fill(); context.stroke(); context.restore();
  }

  drawHeal(context, heal, now) {
    const pulse = .5 + .5 * Math.sin(now * .006 + (heal.phase ?? 0));
    const radius = heal.radius + 5 + pulse * 4;
    context.save(); context.translate(heal.x, heal.y);
    context.globalAlpha = .15 + pulse * .12; context.fillStyle = '#59ff9b'; context.shadowBlur = 32; context.shadowColor = '#52ff9b';
    context.beginPath(); context.moveTo(-6, -12); context.lineTo(-12, -86); context.lineTo(12, -86); context.lineTo(6, -12); context.closePath(); context.fill();
    context.globalAlpha = 1; context.strokeStyle = '#9bffb7'; context.lineWidth = 2; context.shadowBlur = 22;
    context.beginPath(); context.ellipse(0, 5, radius + 5, 10 + pulse * 2, 0, 0, TAU); context.stroke();
    context.setLineDash([4, 5]); context.lineWidth = 1.5; context.beginPath(); context.arc(0, 0, radius + 3, now * .001, now * .001 + Math.PI * 1.55); context.stroke(); context.setLineDash([]);
    context.shadowBlur = 18; context.fillStyle = '#1c754f'; context.strokeStyle = '#b7ffd0'; context.lineWidth = 2.5;
    context.beginPath(); context.arc(0, 0, heal.radius + pulse * 2, 0, TAU); context.fill(); context.stroke();
    context.shadowBlur = 8; context.fillStyle = '#ffffff'; context.fillRect(-3.2, -10, 6.4, 20); context.fillRect(-10, -3.2, 20, 6.4);
    context.shadowBlur = 0; context.fillStyle = '#d9ffe5'; context.textAlign = 'center'; context.font = '900 10px system-ui'; context.fillText('+35', 0, -heal.radius - 10 - pulse * 2);
    context.restore();
  }

  drawMine(context, mine, now) {
    const armed = mine.armTime <= 0;
    const color = mine.friendly ? '#7dffe0' : '#ff795f';
    const pulse = .5 + Math.sin(now * (armed ? .009 : .004)) * .5;
    context.save(); context.translate(mine.x, mine.y); context.rotate(now * .0005);
    context.globalAlpha = mine.friendly ? .9 : .82; context.shadowBlur = 18 + pulse * 10; context.shadowColor = color;
    context.fillStyle = mine.friendly ? '#123f43' : '#401e35'; context.strokeStyle = color; context.lineWidth = 2;
    context.beginPath(); context.arc(0, 0, 10 + pulse * 2, 0, TAU); context.fill(); context.stroke();
    context.beginPath(); context.moveTo(0, -16); context.lineTo(4, -5); context.lineTo(15, 0); context.lineTo(4, 5); context.lineTo(0, 16); context.lineTo(-4, 5); context.lineTo(-15, 0); context.lineTo(-4, -5); context.closePath(); context.stroke();
    if (armed) { context.globalAlpha = .14 + pulse * .12; context.beginPath(); context.arc(0, 0, mine.triggerRadius, 0, TAU); context.fillStyle = color; context.fill(); }
    context.restore();
  }

  drawRing(context, ring, now) {
    const progress = 1 - ring.life / ring.duration;
    context.save(); context.globalAlpha = clamp(ring.life / ring.duration, 0, 1); context.strokeStyle = ring.color; context.shadowBlur = 28; context.shadowColor = ring.color;
    if (ring.kind === 'riftLance') {
      const dx = ring.x - ring.originX; const dy = ring.y - ring.originY;
      const length = Math.hypot(dx, dy);
      context.translate(ring.originX, ring.originY); context.rotate(Math.atan2(dy, dx));
      context.lineCap = 'round'; context.strokeStyle = '#b357ff'; context.lineWidth = 14 * (1 - progress) + 2;
      context.beginPath(); context.moveTo(12, 0); context.lineTo(length, 0); context.stroke();
      context.strokeStyle = '#ffeaff'; context.lineWidth = 2.5;
      context.beginPath(); context.moveTo(12, 0); context.lineTo(length, 0); context.stroke();
      // White spearhead extends through the impact, distinct from ion lightning.
      const head = length + progress * 24;
      context.fillStyle = '#fff2ff'; context.beginPath(); context.moveTo(head + 17, 0); context.lineTo(head - 35, -9); context.lineTo(head - 24, 0); context.lineTo(head - 35, 9); context.closePath(); context.fill();
      context.strokeStyle = '#ffb8ff'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(length, -ring.maxRadius * progress); context.lineTo(length, ring.maxRadius * progress); context.stroke();
    } else if (ring.kind === 'asteroidBlast' || ring.kind === 'firewheel') {
      const asteroid = ring.kind === 'asteroidBlast';
      const radius = ring.maxRadius * Math.min(1, progress * (asteroid ? 2 : 3));
      const glow = context.createRadialGradient(ring.x, ring.y, 0, ring.x, ring.y, Math.max(1, radius));
      glow.addColorStop(0, asteroid ? '#fff0b888' : '#ff621800');
      glow.addColorStop(.65, '#ff6b2430'); glow.addColorStop(.9, '#ff9f5e88'); glow.addColorStop(1, '#ffc26c00');
      context.shadowBlur = 0; context.fillStyle = glow; context.beginPath(); context.arc(ring.x, ring.y, radius, 0, TAU); context.fill();
      context.strokeStyle = '#ffac59'; context.lineWidth = (asteroid ? 16 : 11) * (1 - progress) + 2;
      context.beginPath(); context.arc(ring.x, ring.y, radius, 0, TAU); context.stroke();
      context.strokeStyle = '#fff3c0'; context.lineWidth = 2;
      context.beginPath(); context.arc(ring.x, ring.y, radius * .9, 0, TAU); context.stroke();
      for (let ray = 0; ray < 18; ray += 1) {
        const angle = ray * TAU / 18 + (asteroid ? 0 : now * .001);
        const reach = radius * (asteroid ? .6 : .85);
        context.beginPath(); context.moveTo(ring.x + Math.cos(angle) * reach, ring.y + Math.sin(angle) * reach);
        context.lineTo(ring.x + Math.cos(angle + .025) * radius, ring.y + Math.sin(angle + .025) * radius); context.stroke();
      }
    } else if (ring.kind === 'ion') {
      const dx = ring.x - ring.originX; const dy = ring.y - ring.originY; const length = Math.hypot(dx, dy) || 1; const nx = -dy / length; const ny = dx / length;
      context.lineWidth = 7; context.beginPath(); context.moveTo(ring.originX, ring.originY); context.lineTo(ring.x, ring.y); context.stroke();
      context.strokeStyle = '#efffff'; context.lineWidth = 2.2; context.beginPath(); context.moveTo(ring.originX, ring.originY);
      for (let step = 1; step < 7; step += 1) { const t = step / 7; const jag = Math.sin(step * 18 + now * .06) * 10 * context.globalAlpha; context.lineTo(ring.originX + dx * t + nx * jag, ring.originY + dy * t + ny * jag); }
      context.lineTo(ring.x, ring.y); context.stroke();
      context.fillStyle = '#f4ffff'; context.beginPath(); context.arc(ring.x, ring.y, 5 + progress * 4, 0, TAU); context.fill();
    } else {
      const r = ring.maxRadius * progress; context.lineWidth = ring.kind === 'nova' ? 13 * (1 - progress) + 3 : 9 * (1 - progress) + 2;
      context.beginPath(); context.arc(ring.x, ring.y, r, 0, TAU); context.stroke();
      if (ring.kind === 'nova') { context.strokeStyle = '#f5e6ff'; context.lineWidth = 3; context.beginPath(); context.arc(ring.x, ring.y, r * .83, now * .003, now * .003 + Math.PI * 1.45); context.stroke(); }
    }
    context.restore();
  }

  drawSingularityField(context, field, now) {
    const charging = field.phase === 'charging';
    const progress = charging
      ? 1 - clamp(field.timer, 0, 1)
      : 1 - clamp(field.timer / field.duration, 0, 1);
    const pulse = .5 + Math.sin(now * .012) * .5;
    const radius = charging ? 24 + progress * 18 : 31 + pulse * 7;

    context.save();
    context.translate(field.x, field.y);
    context.globalAlpha = .88;
    context.strokeStyle = charging ? '#d4a4ff' : '#c08aff';
    context.fillStyle = '#e5caff';
    context.shadowColor = '#a76cff';
    context.shadowBlur = charging ? 17 : 30;
    context.lineWidth = 2;
    context.setLineDash(charging ? [5, 5] : [3, 6]);
    context.beginPath();
    context.arc(0, 0, radius, now * .001, now * .001 + Math.PI * 1.8);
    context.stroke();
    context.setLineDash([]);

    for (let orbit = 0; orbit < 2; orbit += 1) {
      context.beginPath();
      context.ellipse(0, 0, radius * (1 - orbit * .18), radius * .56, now * .0014 * (orbit ? -1 : 1), now * .002 + orbit * Math.PI, now * .002 + orbit * Math.PI + Math.PI * 1.55);
      context.stroke();
    }
    if (!charging && field.suctionRadius) {
      context.globalAlpha = .16;
      context.strokeStyle = '#d9b7ff';
      context.lineWidth = 1;
      context.setLineDash([3, 8]);
      context.beginPath();
      context.arc(0, 0, field.suctionRadius, 0, TAU);
      context.stroke();
      context.setLineDash([]);
    }
    if (!charging) {
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = ray * TAU / 8 + now * .0018;
        const reach = 52 + Math.sin(now * .008 + ray) * 12;
        context.globalAlpha = .34 + pulse * .2;
        context.beginPath();
        context.moveTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
        context.lineTo(Math.cos(angle + .22) * 16, Math.sin(angle + .22) * 16);
        context.stroke();
      }
    }

    context.globalAlpha = 1;
    context.fillStyle = '#110c20';
    context.beginPath();
    context.arc(0, 0, charging ? 8 + pulse * 2 : 12 + pulse * 3, 0, TAU);
    context.fill();
    context.strokeStyle = '#f0dcff';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, charging ? 9 + pulse * 2 : 13 + pulse * 3, 0, TAU);
    context.stroke();
    context.fillStyle = '#f1ddff';
    context.textAlign = 'center';
    context.font = '900 10px system-ui';
    context.shadowBlur = 8;
    context.fillText(charging ? `COLAPSO EM ${field.timer.toFixed(1)}s` : 'ATRAÇÃO ATIVA', 0, -radius - 13);
    context.restore();
  }

  drawPowerEffects(context, state, now) {
    const { player } = state;
    context.save(); context.translate(player.x, player.y);
    if (state.firewheelLevel) {
      const { radius, interval } = firewheelStats(state.firewheelLevel);
      const charge = 1 - clamp(state.firewheelTimer / interval, 0, 1);
      context.globalAlpha = .2 + charge * .25; context.strokeStyle = '#ffad5f'; context.shadowBlur = 0; context.lineWidth = 1;
      context.setLineDash([3, 9]); context.beginPath(); context.arc(0, 0, radius, 0, TAU); context.stroke(); context.setLineDash([]);
      context.globalAlpha = .65; context.shadowBlur = 10; context.shadowColor = '#ff862e'; context.strokeStyle = '#ffc97f'; context.lineWidth = 3;
      for (let flame = 0; flame < 8; flame += 1) {
        const angle = now * .001 + flame * TAU / 8;
        context.beginPath(); context.arc(0, 0, radius, angle, angle + .07 + charge * .08); context.stroke();
      }
    }
    if (state.shieldTime > 0 || state.activeShieldTime > 0) {
      const pulse = Math.sin(now * .009) * 2; const alpha = .7 + .3 * Math.sin(now * .012);
      context.globalAlpha = alpha; context.strokeStyle = '#83ffc7'; context.shadowBlur = 24; context.shadowColor = '#59ffb4'; context.lineWidth = 2;
      context.beginPath(); context.arc(0, 0, 37 + pulse, 0, TAU); context.stroke();
      context.strokeStyle = '#c6ffe0'; context.lineWidth = 4; context.setLineDash([9, 8]); context.beginPath(); context.arc(0, 0, 43 + pulse, now * .001, now * .001 + Math.PI * 1.55); context.stroke(); context.setLineDash([]);
      for (let shard = 0; shard < 8; shard += 1) { const angle = now * .0013 + shard * TAU / 8; context.fillStyle = '#d8ffe9'; context.beginPath(); context.arc(Math.cos(angle) * 41, Math.sin(angle) * 41, 2.3, 0, TAU); context.fill(); }
    }
    if (state.powers.charged && state.chargeTimer <= 0) {
      context.globalAlpha = .9; context.strokeStyle = '#ffd276'; context.fillStyle = '#fff0b3'; context.shadowBlur = 18; context.shadowColor = '#ffae43'; context.lineWidth = 1.6;
      for (let shard = 0; shard < 3; shard += 1) { const angle = -now * .0018 + shard * TAU / 3; const x = Math.cos(angle) * 31; const y = Math.sin(angle) * 31; context.save(); context.translate(x, y); context.rotate(angle + now * .002); context.beginPath(); context.moveTo(0, -5); context.lineTo(4, 0); context.lineTo(0, 5); context.lineTo(-4, 0); context.closePath(); context.fill(); context.stroke(); context.restore(); }
    }
    if (state.powers.overdrive) {
      context.globalAlpha = .58; context.strokeStyle = '#ffb955'; context.shadowBlur = 17; context.shadowColor = '#ff9f2f'; context.lineWidth = 2; context.setLineDash([5, 7]); context.beginPath(); context.arc(0, 0, 30, -now * .002, -now * .002 + Math.PI * 1.7); context.stroke(); context.setLineDash([]);
    }
    context.restore();
  }

  drawNotifications(context, state) {
    const messages = state.notifications?.slice(0, 2) ?? [];
    if (!messages.length) return;
    const width = Math.min(460, this.width - 32);
    context.save(); context.shadowBlur = 0; context.textAlign = 'left'; context.font = '600 12px system-ui';
    const rows = messages.map(message => {
      const lines = [''];
      for (const word of message.text.split(' ')) {
        const index = lines.length - 1;
        const joined = lines[index] ? `${lines[index]} ${word}` : word;
        if (lines[index] && context.measureText(joined).width > width - 40) lines.push(word);
        else lines[index] = joined;
      }
      return { ...message, lines, height: 18 * lines.length + 16 };
    });
    const panelHeight = 26 + rows.reduce((sum, row) => sum + row.height, 0);
    const x = (this.width - width) / 2;
    // Clear the mobile joystick/utility controls without covering the ship.
    const bottom = this.coarsePointer?.matches ? 212 : this.width <= 760 ? 80 : 28;
    let y = Math.max(8, this.height - bottom - panelHeight);
    context.fillStyle = '#071321eb'; context.strokeStyle = '#345569'; context.lineWidth = 1;
    context.beginPath(); context.roundRect(x, y, width, panelHeight, 8); context.fill(); context.stroke();
    context.fillStyle = '#8aa7b9'; context.font = '700 9px system-ui';
    context.fillText('COMUNICAÇÕES DE VOO', x + 16, y + 17);
    y += 26;
    for (const row of rows) {
      context.globalAlpha = clamp(row.life / .5, 0, 1);
      context.fillStyle = row.color; context.fillRect(x + 12, y + 7, 3, row.height - 14);
      context.fillStyle = row.priority ? '#f2f8ff' : '#c7dbe9'; context.font = `${row.priority ? 700 : 500} 12px system-ui`;
      row.lines.forEach((line, index) => context.fillText(line, x + 24, y + 19 + index * 18));
      y += row.height;
    }
    context.restore();
  }

  drawBullet(context, bullet) {
    const color = bullet.charged ? '#ffd06c' : bullet.overdrive ? '#ffbf58' : bullet.color ?? (bullet.critical ? '#fff4a5' : '#a0ffff');
    context.save(); context.shadowBlur = bullet.charged ? 24 : bullet.overdrive || bullet.companionShot ? 17 : 12; context.shadowColor = color;
    if (bullet.charged || bullet.overdrive || bullet.companionShot) { const speed = Math.hypot(bullet.vx, bullet.vy) || 1; context.strokeStyle = color; context.globalAlpha = .8; context.lineWidth = bullet.charged ? 5 : 2.5; context.beginPath(); context.moveTo(bullet.x, bullet.y); context.lineTo(bullet.x - bullet.vx / speed * (bullet.charged ? 32 : 15), bullet.y - bullet.vy / speed * (bullet.charged ? 32 : 15)); context.stroke(); }
    context.globalAlpha = 1; context.fillStyle = bullet.charged ? '#fff4c8' : color; context.beginPath(); context.arc(bullet.x, bullet.y, bullet.radius, 0, TAU); context.fill(); context.restore();
  }
  drawEnemyBullet(context, bullet) { const homing = bullet.homingTime > 0; const color = homing ? '#ffb66f' : '#ff8bd4'; context.save(); context.shadowBlur = homing ? 20 : 17; context.shadowColor = color; context.fillStyle = color; if (homing) { const speed = Math.hypot(bullet.vx, bullet.vy) || 1; context.beginPath(); context.moveTo(bullet.x, bullet.y); context.lineTo(bullet.x - bullet.vx / speed * 18, bullet.y - bullet.vy / speed * 18); context.lineWidth = 3; context.strokeStyle = color; context.stroke(); } context.beginPath(); context.arc(bullet.x, bullet.y, bullet.radius, 0, TAU); context.fill(); context.restore(); }

  drawTargetLock(context, target, now) {
    const radius = target.radius + 12 + Math.sin(now * .01) * 1.5;
    context.save();
    context.strokeStyle = '#ffd45c';
    context.lineWidth = 1.8;
    context.shadowBlur = 14;
    context.shadowColor = '#ffb52e';
    context.beginPath();
    context.arc(target.x, target.y, radius, 0, TAU);
    context.stroke();
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI / 2 + Math.PI / 4;
      const x = target.x + Math.cos(angle) * radius;
      const y = target.y + Math.sin(angle) * radius;
      context.beginPath();
      context.moveTo(x - Math.cos(angle) * 5, y - Math.sin(angle) * 5);
      context.lineTo(x, y);
      context.lineTo(x - Math.cos(angle) * 5 + Math.cos(angle + Math.PI / 2) * 5, y - Math.sin(angle) * 5 + Math.sin(angle + Math.PI / 2) * 5);
      context.stroke();
    }
    context.restore();
  }

  drawEnemy(context, enemy, now) {
    const isBoss = enemy.type === 'boss';
    const isMiniBoss = enemy.type === 'miniboss';
    context.save();
    context.translate(enemy.x, enemy.y);
    context.rotate(enemy.pulse * .18);
    context.shadowBlur = enemy.elite || isBoss || isMiniBoss ? 25 : 22;
    context.shadowColor = enemy.elite ? '#ffd36a' : enemy.color;
    context.strokeStyle = enemy.elite ? '#ffe08a' : enemy.color;
    context.lineWidth = enemy.elite ? 3 : 2.5;
    context.fillStyle = '#15203b';
    hexagon(context, 0, 0, enemy.radius, Math.PI / 6);
    context.fill();
    context.stroke();
    context.fillStyle = enemy.color;
    hexagon(context, 0, 0, isBoss ? 17 : isMiniBoss ? 12 : enemy.radius * .38, Math.PI / 6);
    context.fill();
    if (isBoss || isMiniBoss || enemy.elite) {
      context.strokeStyle = isBoss ? '#ffbadf' : enemy.elite ? '#fff0ad' : '#ffe0a8';
      context.lineWidth = isBoss ? 3 : 2;
      hexagon(context, 0, 0, enemy.radius + (isBoss ? 8 : 5), now * (isBoss ? .0008 : .0012));
      context.stroke();
    }
    if (enemy.isFinalBoss) {
      context.shadowColor = '#fff3a1';
      context.shadowBlur = 28;
      context.strokeStyle = '#fff0a8';
      context.lineWidth = 2;
      context.beginPath(); context.ellipse(0, 0, enemy.radius + 12, enemy.radius * .55, now * .00065, 0, TAU); context.stroke();
      context.strokeStyle = '#ffd662';
      context.beginPath(); context.ellipse(0, 0, enemy.radius * .55, enemy.radius + 12, -now * .0008, 0, TAU); context.stroke();
      context.fillStyle = '#fff1a6';
      context.beginPath(); context.arc(0, 0, 7 + Math.sin(now * .008) * 1.2, 0, TAU); context.fill();
    }
    context.restore();
    if (enemy.hp < enemy.maxHp || isBoss || isMiniBoss) {
      const barY = enemy.y - enemy.radius - (isBoss ? 24 : 15);
      if (isBoss || isMiniBoss) { context.textAlign = 'center'; context.font = `bold ${isBoss ? 12 : 10}px system-ui`; context.fillStyle = enemy.color; context.fillText(isBoss ? enemy.bossVariant.name : enemy.miniVariant.name, enemy.x, barY - 5); }
      context.fillStyle = '#0009'; context.fillRect(enemy.x - enemy.radius, barY, enemy.radius * 2, isBoss ? 6 : 4); context.fillStyle = enemy.elite ? '#ffe08a' : enemy.color; context.fillRect(enemy.x - enemy.radius, barY, enemy.radius * 2 * clamp(enemy.hp / enemy.maxHp, 0, 1), isBoss ? 6 : 4);
    }
  }

  drawPlayer(context, state, now) {
    const { player } = state;
    context.save(); context.translate(player.x, player.y); context.rotate(player.angle + Math.PI / 2); context.scale(1.18, 1.18); if (player.invulnerable > 0 && Math.floor(now / 65) % 2) context.globalAlpha = .4;
    const thrusterColor = player.dashTime > 0 ? '#ffffff' : state.powers.overdrive ? '#ffb84c' : player.dash <= 0 ? '#ffd34f' : '#42d9ff';
    context.shadowBlur = 25; context.shadowColor = '#50eaff'; context.fillStyle = '#10233c'; context.strokeStyle = '#9af7ff'; context.lineWidth = 2.4;
    context.beginPath(); context.moveTo(0, -22); context.lineTo(8, -7); context.lineTo(26, 9); context.lineTo(11, 7); context.lineTo(8, 17); context.lineTo(0, 12); context.lineTo(-8, 17); context.lineTo(-11, 7); context.lineTo(-26, 9); context.lineTo(-8, -7); context.closePath(); context.fill(); context.stroke();
    context.shadowBlur = 12; context.strokeStyle = '#55dfff'; context.lineWidth = 1.6; context.beginPath(); context.moveTo(-18, 8); context.lineTo(-7, 1); context.lineTo(0, 3); context.lineTo(7, 1); context.lineTo(18, 8); context.stroke();
    context.fillStyle = '#d8fcff'; context.shadowColor = '#8ffaff'; context.shadowBlur = 16; context.beginPath(); context.ellipse(0, -6, 3.3, 8, 0, 0, TAU); context.fill();
    context.fillStyle = thrusterColor; context.shadowColor = thrusterColor; context.shadowBlur = player.dash <= 0 ? 22 : 15; context.beginPath(); context.moveTo(-5, 12); context.lineTo(0, player.dashTime > 0 ? 35 : player.dash <= 0 ? 31 + Math.sin(now * .012) * 2 : 27); context.lineTo(5, 12); context.fill(); context.restore();
    if (state.shieldTime > 0) { context.strokeStyle = '#8cffc9'; context.shadowBlur = 25; context.shadowColor = '#76ffbd'; context.lineWidth = 3; context.beginPath(); context.arc(player.x, player.y, 31 + Math.sin(now * .01) * 2, 0, TAU); context.stroke(); context.shadowBlur = 0; }
  }

  drawCompanion(context, companion, now) {
    const disabled = companion.disabledTimer > 0;
    context.save();
    if (companion.intercepting) { context.strokeStyle = '#a8fbff88'; context.lineWidth = 1; context.setLineDash([3, 4]); context.beginPath(); context.moveTo(companion.x, companion.y); context.lineTo(companion.x + Math.cos(companion.angle) * 24, companion.y + Math.sin(companion.angle) * 24); context.stroke(); }
    context.translate(companion.x, companion.y);
    context.rotate(companion.angle + Math.PI / 2);
    context.globalAlpha = disabled ? .58 : 1;
    if (companion.intercepting) {
      context.strokeStyle = '#8dfff0aa'; context.lineWidth = 1.5; context.setLineDash([]); context.beginPath(); context.ellipse(0, 0, 21, 15, 0, 0, TAU); context.stroke();
    }
    context.shadowBlur = companion.hitFlash > 0 ? 25 : 19;
    const accent = companion.color ?? '#4fffe0';
    context.shadowColor = companion.hitFlash > 0 ? '#ffae6b' : accent;
    context.fillStyle = disabled ? '#443b43' : '#103440';
    context.strokeStyle = companion.hitFlash > 0 ? '#ffc17c' : accent;
    context.lineWidth = 2;
    context.beginPath();
    if (companion.modelId === 'striker') {
      context.moveTo(0, -18); context.lineTo(6, -4); context.lineTo(3, 8); context.lineTo(0, 4); context.lineTo(-3, 8); context.lineTo(-6, -4); context.closePath();
    } else if (companion.modelId === 'bulwark') {
      context.moveTo(-11, -12); context.lineTo(11, -12); context.lineTo(10, 2); context.lineTo(0, 15); context.lineTo(-10, 2); context.closePath();
    } else if (companion.modelId === 'reflector') {
      context.moveTo(0, -19); context.lineTo(13, -4); context.lineTo(0, 15); context.lineTo(-13, -4); context.closePath();
    } else if (companion.modelId === 'collector') {
      context.roundRect(-12, -12, 24, 25, 6);
      context.moveTo(-17, -4); context.lineTo(-11, -1); context.moveTo(17, -4); context.lineTo(11, -1);
    } else {
      context.moveTo(0, -13);
      context.quadraticCurveTo(8, -9, 17, 3);
      context.quadraticCurveTo(10, 2, 5, 7);
      context.lineTo(1, 5);
      context.quadraticCurveTo(0, 9, -1, 5);
      context.lineTo(-5, 7);
      context.quadraticCurveTo(-10, 2, -17, 3);
      context.quadraticCurveTo(-8, -9, 0, -13);
      context.closePath();
    }
    context.fill(); context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = disabled ? '#9d7770' : accent; context.lineWidth = 1.1;
    if (companion.modelId === 'striker') {
      context.beginPath(); context.moveTo(0, -14); context.lineTo(0, 5); context.moveTo(-9, -3); context.lineTo(0, 1); context.lineTo(9, -3); context.stroke();
    } else if (companion.modelId === 'bulwark') {
      context.beginPath(); context.arc(0, 0, 19, Math.PI * 1.08, Math.PI * 1.92); context.stroke();
      context.fillStyle = accent; context.beginPath(); context.arc(0, -19, 2.4, 0, TAU); context.fill();
    } else if (companion.modelId === 'reflector') {
      context.beginPath(); context.moveTo(-8, -4); context.lineTo(0, -11); context.lineTo(8, -4); context.moveTo(-8, 3); context.lineTo(0, 10); context.lineTo(8, 3); context.stroke();
    } else if (companion.modelId === 'collector') {
      context.beginPath(); context.arc(0, 0, 5, 0, TAU); context.stroke();
      context.fillStyle = accent; context.fillRect(-4, 8, 8, 3);
    } else {
      context.beginPath(); context.moveTo(-12, 2); context.quadraticCurveTo(-5, -2, 0, 0); context.quadraticCurveTo(5, -2, 12, 2); context.stroke();
      context.beginPath(); context.moveTo(-13, -5); context.lineTo(-19, -10); context.lineTo(-17, -1); context.moveTo(13, -5); context.lineTo(19, -10); context.lineTo(17, -1); context.stroke();
    }
    context.fillStyle = disabled ? '#a96c58' : '#ffdc82';
    context.shadowColor = disabled ? '#ff9368' : '#ffdc82'; context.shadowBlur = disabled ? 5 : 12;
    context.beginPath(); context.ellipse(-7, 5, 2, 3.4, -.3, 0, TAU); context.ellipse(7, 5, 2, 3.4, .3, 0, TAU); context.fill();
    if (!disabled) { context.fillStyle = '#eaffff'; context.shadowColor = '#8affee'; context.shadowBlur = 13; context.beginPath(); context.ellipse(0, -4, 2.8, 5.5, 0, 0, TAU); context.fill(); }
    context.restore();
    context.textAlign = 'center';
    context.font = 'bold 9px system-ui';
    context.fillStyle = disabled ? '#ffc17c' : '#d6caff';
    context.fillText(disabled ? `${companion.disabledTimer.toFixed(1)}s` : `L${companion.level}/${MAX_COMPANION_LEVEL}`, companion.x, companion.y - 15);
  }

  drawHordeProgress(context, state, width, padding) {
    const compact = width < 600;
    const panelWidth = compact ? Math.floor(width * .44) : 244;
    const panelHeight = compact ? 91 : 130;
    const x = width - padding - panelWidth;
    const y = padding + 69;
    const progress = getHordeProgress(state);
    const enemyNoun = progress.activeEnemies === 1 ? 'inimigo' : 'inimigos';
    const phase = {
      break: { color: '#6feeff', title: 'REAGRUPAMENTO', detail: `Nova onda em ${progress.remaining.toFixed(1)}s` },
      combat: { color: '#71e8ff', title: 'ONDA EM COMBATE', detail: `${progress.activeEnemies} ${enemyNoun} em campo · avanço em ${Math.ceil(progress.remaining)}s` },
      cleanup: { color: '#ffcf75', title: 'LIMPE O CAMPO', detail: `Restam ${progress.activeEnemies} ${enemyNoun} · avanço em ${Math.ceil(progress.remaining)}s` },
      ready: { color: '#8effca', title: 'CAMPO LIMPO', detail: 'Avançando para a próxima onda' },
    }[progress.phase];

    context.save();
    context.fillStyle = '#071323e8';
    context.fillRect(x, y, panelWidth, panelHeight);
    context.strokeStyle = `${phase.color}88`;
    context.lineWidth = 1;
    context.strokeRect(x + .5, y + .5, panelWidth - 1, panelHeight - 1);
    context.fillStyle = phase.color;
    context.fillRect(x, y, 3, panelHeight);
    context.textAlign = 'left';
    context.fillStyle = '#9ab9cb';
    context.font = `bold ${compact ? 8 : 9}px system-ui`;
    context.fillText('PROGRESSO DA HORDA', x + 12, y + 16);
    context.textAlign = 'right';
    context.fillStyle = '#e9faff';
    context.font = `bold ${compact ? 12 : 14}px system-ui`;
    context.fillText(`ONDA ${String(state.wave).padStart(2, '0')}`, x + panelWidth - 11, y + 37);

    const barY = compact ? y + 46 : y + 52;
    context.fillStyle = '#21374b';
    context.fillRect(x + 11, barY, panelWidth - 22, 6);
    context.fillStyle = phase.color;
    context.fillRect(x + 11, barY, (panelWidth - 22) * clamp(progress.progress, 0, 1), 6);
    context.textAlign = 'left';
    context.fillStyle = phase.color;
    context.font = `bold ${compact ? 8 : 9}px system-ui`;
    context.fillText(phase.title, x + 11, compact ? y + 66 : y + 78, panelWidth - 22);
    context.fillStyle = '#c2d5e0';
    context.font = `${compact ? 8 : 9}px system-ui`;
    context.fillText(phase.detail, x + 11, compact ? y + 81 : y + 99, panelWidth - 22);
    context.restore();

    return { top: y, bottom: y + panelHeight, compact };
  }

  drawHud(context, state, bestScore, width) {
    const { player } = state;
    const compact = width < 600;
    const padding = width < 600 ? 13 : 25;
    const panelWidth = compact ? Math.floor(width * .5) - 18 : 300;
    const panelHeight = 278;
    context.fillStyle = '#081426dc';
    context.fillRect(padding, padding, panelWidth, panelHeight);
    context.strokeStyle = '#407590';
    context.strokeRect(padding, padding, panelWidth, panelHeight);
    context.textAlign = 'left';
    context.fillStyle = '#e5f9ff';
    context.font = 'bold 12px system-ui';
    context.fillText(`ETAPA 1 · NÍVEL ${state.level}/32`, padding + 11, padding + 20, panelWidth - 22);
    context.textAlign = 'left';
    context.fillStyle = '#a8c5d6';
    context.font = '10px system-ui';
    const hpPercent = Math.round(clamp(player.hp / player.maxHp, 0, 1) * 100);
    context.fillText(`${compact ? 'CASCO' : 'VIDA DO CASCO'} · ${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}${compact ? '' : ` (${hpPercent}%)`}`, padding + 11, padding + 39, panelWidth - 22);
    context.fillStyle = '#294258';
    context.fillRect(padding + 11, padding + 45, panelWidth - 22, 8);
    context.fillStyle = player.hp / player.maxHp < .3 ? '#ff5877' : '#4df8a8';
    context.fillRect(padding + 11, padding + 45, (panelWidth - 22) * clamp(player.hp / player.maxHp, 0, 1), 8);
    context.fillStyle = state.level >= 32 ? '#ffe783' : '#a8c5d6';
    context.font = '10px system-ui';
    context.fillText(state.level >= 32 ? 'NÍVEL MÁXIMO · NÚCLEO DO RIFT' : `${compact ? 'XP' : `EXPERIÊNCIA PARA O NÍVEL ${state.level + 1}`} · ${state.xp} / ${state.nextXp}`, padding + 11, padding + 69, panelWidth - 22);
    context.fillStyle = '#294258';
    context.fillRect(padding + 11, padding + 75, panelWidth - 22, 6);
    context.fillStyle = state.level >= 32 ? '#ffe783' : '#6ee6ff';
    context.fillRect(padding + 11, padding + 75, (panelWidth - 22) * (state.level >= 32 ? 1 : clamp(state.xp / state.nextXp, 0, 1)), 6);
    context.strokeStyle = '#40759080';
    context.beginPath(); context.moveTo(padding + 11, padding + 87); context.lineTo(padding + panelWidth - 11, padding + 87); context.stroke();

    const stats = [
      { label: 'Dano por disparo', value: `${Math.round(player.damage)}` },
      { label: 'Cadência de tiro', value: `${(1 / player.rate).toFixed(1)} tiros/s` },
      { label: 'Velocidade da nave', value: `${Math.round(player.move)} px/s` },
      { label: 'Disparos por rajada', value: `${player.shots}` },
      { label: 'Perfuração', value: `${player.pierce} alvos` },
      { label: 'Chance de crítico', value: `${Math.round(player.crit * 100)}%` },
      { label: 'Proteção contra dano', value: player.armor >= 0 ? `${Math.round(player.armor * 100)}% menos` : `${Math.round(Math.abs(player.armor) * 100)}% extra` },
    ];
    context.fillStyle = '#59daf2';
    context.font = 'bold 9px system-ui';
    context.fillText('ATRIBUTOS DE COMBATE', padding + 11, padding + 101);
    stats.forEach((stat, index) => {
      const y = padding + 117 + index * 15;
      context.textAlign = 'left';
      context.fillStyle = '#a8c5d6';
      context.font = '10px system-ui';
      const shortLabels = ['Dano', 'Cadência', 'Velocidade', 'Rajada', 'Perfuração', 'Crítico', 'Blindagem'];
      context.fillText(compact ? shortLabels[index] : stat.label, padding + 11, y, panelWidth * .48);
      context.textAlign = 'right';
      context.fillStyle = '#e8faff';
      context.font = 'bold 10px system-ui';
      context.fillText(String(stat.value), padding + panelWidth - 11, y, panelWidth * .43);
    });
    context.textAlign = 'left';
    context.strokeStyle = '#40759080';
    context.beginPath(); context.moveTo(padding + 11, padding + 231); context.lineTo(padding + panelWidth - 11, padding + 231); context.stroke();
    const crew = state.companions.length
      ? state.companions.map(companion => `${companion.name} L${companion.level}/${MAX_COMPANION_LEVEL}${companion.collects ? ` · ${companion.collectionPhase === 'collect' ? 'COLETA' : 'ENTREGA'}` : companion.disabledTimer > 0 ? ` · OFF ${companion.disabledTimer.toFixed(1)}s` : ''}`).join('  ·  ')
      : 'Nenhum companheiro na equipe';
    context.fillStyle = '#8debdc';
    context.font = 'bold 9px system-ui';
    context.fillText('ESQUADRÃO', padding + 11, padding + 250);
    context.textAlign = 'right';
    context.fillStyle = state.companions.length ? '#d9fff5' : '#8299ac';
    context.font = '9px system-ui';
    context.fillText(crew, padding + panelWidth - 11, padding + (compact ? 266 : 250), compact ? panelWidth - 22 : panelWidth - 91);

    context.textAlign = 'right';
    context.font = 'bold 18px system-ui';
    context.fillStyle = '#e8faff';
    context.fillText(`${state.score} PTS`, width - padding, padding + 21);
    context.font = '11px system-ui';
    context.fillStyle = '#83aec8';
    context.fillText(`RECORDE ${bestScore}`, width - padding, padding + 40);
    context.fillStyle = state.stageCompleted || state.bossesDefeated >= TOTAL_BOSSES ? '#ffe783' : '#83aec8';
    context.font = 'bold 11px system-ui';
    context.fillText(state.stageCompleted ? 'ETAPA 1 CONCLUÍDA' : `CHEFES ${state.bossesDefeated}/${TOTAL_BOSSES}`, width - padding, padding + 55);
    const hordeLayout = this.drawHordeProgress(context, state, width, padding);
    const rightStatusY = hordeLayout.bottom + 17;
    context.fillStyle = player.dash <= 0 ? '#ffd34f' : '#83aec8';
    context.font = 'bold 12px system-ui';
    context.fillText(`IMPULSO ${player.dash <= 0 ? 'PRONTO' : `${player.dash.toFixed(1)}s`}`, width - padding, rightStatusY);
    const powerNames = { shield: 'Escudo', charged: 'Carregado', nova: 'Pulso', aimbot: 'Mira', overdrive: 'Sobrecarga', singularity: 'Singularidade', ionStorm: 'Tempestade', activeShield: 'Barreira', teleport: 'Salto', minefield: 'Minas', riftLance: 'Lança' };
    const activePowers = Object.entries(state.powers).filter(([key, value]) => key !== 'companion' && value > 0).map(([key]) => `${powerNames[key]} H${state.powerBonuses?.[key] ?? 0}`);
    context.fillStyle = '#d5b4ff';
    context.font = `${compact ? 9 : 11}px system-ui`;
    const lines = [];
    const availableWidth = compact ? Math.floor(width * .44) : 244;
    for (const power of activePowers) {
      const last = lines.length - 1;
      const joined = last >= 0 ? `${lines[last]} · ${power}` : power;
      if (last >= 0 && context.measureText(joined).width <= availableWidth) lines[last] = joined;
      else lines.push(power);
    }
    if (!lines.length) lines.push('SEM SUPERPODERES ATIVOS');
    lines.forEach((line, index) => context.fillText(line, width - padding, rightStatusY + 20 + index * 19, availableWidth));
    let cooldownRow = lines.length - 1;
    if (state.powers.charged) {
      context.fillStyle = state.chargeTimer <= 0 ? '#ffd581' : '#9eabbb';
      context.fillText(`TIRO CARREGADO ${state.chargeTimer <= 0 ? 'PRONTO' : `${state.chargeTimer.toFixed(1)}s`}`, width - padding, rightStatusY + 39 + cooldownRow * 19); cooldownRow += 1;
    }
    if (state.powers.singularity) {
      const field = state.singularityField;
      const status = field?.phase === 'charging'
        ? `PONTO ${field.timer.toFixed(1)}s`
        : field?.phase === 'pulling'
          ? `ATIVA · ${state.singularityTimer.toFixed(1)}s`
          : state.singularityTimer <= 0 ? 'PRONTA' : `${state.singularityTimer.toFixed(1)}s`;
      context.fillStyle = field ? '#d5b4ff' : state.singularityTimer <= 0 ? '#d5b4ff' : '#9eabbb';
      context.fillText(`SINGULARIDADE ${status}`, width - padding, rightStatusY + 39 + cooldownRow * 19); cooldownRow += 1;
    }
    if (state.powers.teleport) { context.fillStyle = state.teleportCooldown <= 0 ? '#d5b4ff' : '#9eabbb'; context.fillText(`SALTO Q ${state.teleportCooldown <= 0 ? 'PRONTO' : `${state.teleportCooldown.toFixed(1)}s`}`, width - padding, rightStatusY + 39 + cooldownRow * 19); cooldownRow += 1; }
    if (state.powers.activeShield) { context.fillStyle = state.activeShieldCooldown <= 0 ? '#9fd7ff' : '#9eabbb'; context.fillText(`BARREIRA E ${state.activeShieldTime > 0 ? `${state.activeShieldTime.toFixed(1)}s` : state.activeShieldCooldown <= 0 ? 'PRONTA' : `${state.activeShieldCooldown.toFixed(1)}s`}`, width - padding, rightStatusY + 39 + cooldownRow * 19); cooldownRow += 1; }
    context.fillStyle = '#ffe783';
    context.font = 'bold 11px system-ui';
    context.fillText(`◈ ${state.creditsEarned} CR NESTA RUN`, width - padding, rightStatusY + 43 + cooldownRow * 19);
    if (state.mode === 'paused') { context.fillStyle = '#020914b8'; context.fillRect(0, 0, width, this.height); context.textAlign = 'center'; context.fillStyle = '#fff'; context.font = 'bold 40px system-ui'; context.fillText('PAUSADO', width / 2, this.height / 2); context.font = '14px system-ui'; context.fillText('Pressione P ou toque em RETOMAR', width / 2, this.height / 2 + 30); }
  }
}
