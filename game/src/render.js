// Everything drawn: the neon arena, the ship, enemies, bullets, pickups,
// particles, the HUD and the title / pause / game-over screens. The canvas
// is a fixed 1280x720 logical field scaled to the window, so the game looks
// the same at any window size.

import { ENEMIES, FIELD, FONT, PALETTE, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const STARS = [];
for (let index = 0; index < 90; index += 1) {
  // Fixed starfield: the same sky every run.
  const seed = (index * 2654435761) % 100000;
  STARS.push({
    x: (seed % 1280),
    y: ((seed * 7) % 720),
    size: 1 + (seed % 3) * 0.5,
    twinkle: (seed % 100) / 100,
  });
}

function drawShip(ctx, x, y, angle, colour, invulnerable, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const blink = invulnerable > 0 && Math.floor(time * 12) % 2 === 0;
  ctx.globalAlpha = blink ? 0.35 : 1;
  ctx.shadowColor = colour;
  ctx.shadowBlur = 18;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-14, -12);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-14, 12);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, enemy) {
  const spec = ENEMIES[enemy.kind];
  const colour = enemy.flash > 0 ? '#ffffff' : spec.colour;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.shadowColor = spec.colour;
  ctx.shadowBlur = 16;
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  if (enemy.kind === 'drifter') {
    ctx.rotate(enemy.wobble * 0.5);
    ctx.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const px = Math.cos(angle) * enemy.radius;
      const py = Math.sin(angle) * enemy.radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#070312';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'spitter') {
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#070312';
    ctx.beginPath();
    ctx.arc(-4, -3, 3, 0, Math.PI * 2);
    ctx.arc(5, -3, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, 7);
    ctx.lineTo(6, 7);
    ctx.stroke();
  } else {
    ctx.rotate(enemy.wobble * 0.2);
    ctx.fillRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#070312';
    ctx.fillRect(-12, -4, 24, 8);
    ctx.fillRect(-4, -12, 8, 24);
  }
  ctx.restore();
  if (enemy.health > 1 && enemy.kind !== 'drifter') {
    ctx.fillStyle = '#ffffff33';
    ctx.fillRect(enemy.x - 16, enemy.y - enemy.radius - 10, 32, 4);
    ctx.fillStyle = spec.colour;
    ctx.fillRect(enemy.x - 16, enemy.y - enemy.radius - 10, 32 * (enemy.health / spec.health), 4);
  }
}

function drawPanel(ctx, x, y, width, height) {
  ctx.fillStyle = 'rgba(10, 4, 28, 0.82)';
  ctx.strokeStyle = '#39f5d6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 14);
  ctx.fill();
  ctx.stroke();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = FIELD.width;
    canvas.height = FIELD.height;
    canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
    canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  function drawBackground(time) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    for (const star of STARS) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 2 + star.twinkle * 6);
      ctx.fillStyle = PALETTE.star;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best) {
    const player = state.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(`SCORE ${state.score}`, 24, 18);
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 24, 52);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(`WAVE ${state.wave}`, FIELD.width / 2, 20);
    ctx.font = `600 15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${state.enemies.length + state.spawnQueue.length} HOSTILES LEFT`, FIELD.width / 2, 52);
    // Health bar, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText('HULL', FIELD.width - 24, 18);
    ctx.fillStyle = '#ffffff22';
    ctx.fillRect(FIELD.width - 224, 46, 200, 14);
    ctx.fillStyle = player.health > 40 ? PALETTE.player : PALETTE.danger;
    ctx.fillRect(FIELD.width - 224, 46, 200 * (player.health / PLAYER.maxHealth), 14);
    if (player.spreadTimer > 0) {
      ctx.fillStyle = PALETTE.spread;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(`SPREAD SHOT ${Math.ceil(player.spreadTimer)}s`, FIELD.width - 24, 68);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText('WASD move · mouse aim · click / Space fire · P pause', 24, FIELD.height - 26);
  }

  function drawBanner(state) {
    if (state.bannerTimer <= 0 || !state.banner) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.bannerTimer * 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.player;
    ctx.font = `800 44px ${FONT}`;
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 24;
    ctx.fillText(state.banner, FIELD.width / 2, 130);
    ctx.restore();
  }

  function drawTitle(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 3, 18, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.player;
    ctx.font = `800 84px ${FONT}`;
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 32;
    ctx.fillText('NEON SWARM', FIELD.width / 2, 150);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff5d8f';
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText('a top-down arena shooter', FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('WASD or arrows to fly · mouse to aim · click or Space to shoot', FIELD.width / 2, 330);
    ctx.fillText('Drifters chase you · spitters shoot back · brutes charge', FIELD.width / 2, 366);
    ctx.fillText('Grab spread-shot and hull pickups · survive the waves', FIELD.width / 2, 402);
    ctx.fillStyle = '#ffe45e';
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText('CLICK OR PRESS SPACE TO PLAY', FIELD.width / 2, 480);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 20px ${FONT}`;
      ctx.fillText(`BEST SCORE ${best}`, FIELD.width / 2, 530);
    }
    ctx.restore();
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(7, 3, 18, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 300);
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press P to keep playing', FIELD.width / 2, 380);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(7, 3, 18, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawPanel(ctx, FIELD.width / 2 - 300, 150, 600, 400);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText('SWARMED', FIELD.width / 2, 180);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`SCORE  ${state.score}`, FIELD.width / 2, 260);
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`WAVE REACHED  ${state.wave}      KILLS  ${state.kills}`, FIELD.width / 2, 310);
    ctx.fillText(`SHOTS FIRED  ${state.shotsFired}`, FIELD.width / 2, 344);
    ctx.fillStyle = state.score >= best && state.score > 0 ? '#ffe45e' : PALETTE.text;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(state.score >= best && state.score > 0 ? 'NEW BEST SCORE!' : `BEST  ${best}`, FIELD.width / 2, 392);
    ctx.fillStyle = '#ffe45e';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', FIELD.width / 2, 470);
  }

  return {
    draw(state, screen, best, particles) {
      const time = state.time;
      ctx.save();
      if (particles && particles.shake > 0.5) {
        ctx.translate((Math.random() - 0.5) * particles.shake, (Math.random() - 0.5) * particles.shake);
      }
      drawBackground(time);
      for (const pickup of state.pickups) {
        ctx.save();
        ctx.translate(pickup.x, pickup.y);
        ctx.shadowColor = pickup.kind === 'spread' ? PALETTE.spread : PALETTE.heal;
        ctx.shadowBlur = 14;
        ctx.fillStyle = pickup.kind === 'spread' ? PALETTE.spread : PALETTE.heal;
        ctx.beginPath();
        ctx.arc(0, 0, pickup.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#070312';
        ctx.font = `800 18px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pickup.kind === 'spread' ? '×3' : '+', 0, 1);
        ctx.restore();
      }
      ctx.textBaseline = 'alphabetic';
      for (const enemy of state.enemies) drawEnemy(ctx, enemy);
      ctx.fillStyle = PALETTE.bullet;
      ctx.shadowColor = PALETTE.bullet;
      ctx.shadowBlur = 10;
      for (const bullet of state.bullets) {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = PALETTE.enemyBullet;
      ctx.shadowColor = PALETTE.enemyBullet;
      for (const bullet of state.enemyBullets) {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      if (particles) {
        for (const particle of particles.items) {
          if (!particle.active) continue;
          ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
          ctx.fillStyle = particle.colour;
          ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
        }
        ctx.globalAlpha = 1;
      }
      if (state.player.alive) {
        drawShip(ctx, state.player.x, state.player.y, state.player.angle, PALETTE.player, state.player.invulnerable, time);
      }
      ctx.restore();
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
      drawBanner(state);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
    },
  };
}
