// The game state and its rules: the ship, three enemy kinds, bullets,
// pickups and escalating waves. Everything advances in fixed steps; the
// renderer and the audio only read what is here. Events are a bitmask so
// the loop can play one sound or banner per event, not per frame.

import { ENEMIES, FIELD, PICKUPS, PLAYER, STEP, WAVES } from './config.js';
import { createParticles } from './particles.js';

export const EVENT_NONE = 0;
export const EVENT_SHOOT = 1;
export const EVENT_ENEMY_HIT = 2;
export const EVENT_EXPLODE = 4;
export const EVENT_PLAYER_HIT = 8;
export const EVENT_PICKUP = 16;
export const EVENT_WAVE = 32;
export const EVENT_OVER = 64;

export const KIND_DRIFTER = 'drifter';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';

const TAU = Math.PI * 2;

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function createWorld(random) {
  const particles = createParticles();
  let state = null;

  function freshState() {
    return {
      time: 0,
      score: 0,
      wave: 1,
      kills: 0,
      shotsFired: 0,
      player: {
        x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
        angle: -Math.PI / 2, health: PLAYER.maxHealth, fireTimer: 0,
        invulnerable: 0, spreadTimer: 0, alive: true,
      },
      enemies: [],
      bullets: [],
      enemyBullets: [],
      pickups: [],
      waveState: 'fighting',
      waveTimer: 0,
      banner: '',
      bannerTimer: 0,
      spawnQueue: [],
      spawnTimer: 0,
      over: false,
    };
  }

  function edgeSpawn(kind) {
    const side = random.int(0, 4);
    const margin = 30;
    let x;
    let y;
    if (side === 0) { x = random.range(margin, FIELD.width - margin); y = -margin; }
    else if (side === 1) { x = FIELD.width + margin; y = random.range(margin, FIELD.height - margin); }
    else if (side === 2) { x = random.range(margin, FIELD.width - margin); y = FIELD.height + margin; }
    else { x = -margin; y = random.range(margin, FIELD.height - margin); }
    const spec = ENEMIES[kind];
    return {
      kind, x, y, radius: spec.radius, health: spec.health,
      speed: spec.speed * random.range(0.9, 1.15),
      angle: random.range(0, TAU), shotTimer: random.range(1, spec.shotInterval ?? 2),
      wobble: random.range(0, TAU), flash: 0,
    };
  }

  function buildWave(number) {
    const queue = [];
    const count = WAVES.baseCount + WAVES.perWave * number;
    for (let index = 0; index < count; index += 1) queue.push(KIND_DRIFTER);
    const spitters = Math.min(1 + Math.floor(number / 2), 5);
    for (let index = 0; index < spitters; index += 1) queue.push(KIND_SPITTER);
    const brutes = number >= 3 ? Math.min(Math.floor((number - 1) / 2), 3) : 0;
    for (let index = 0; index < brutes; index += 1) queue.push(KIND_BRUTE);
    // Shuffle the queue with the seeded generator.
    for (let index = queue.length - 1; index > 0; index -= 1) {
      const other = random.int(0, index + 1);
      [queue[index], queue[other]] = [queue[other], queue[index]];
    }
    return queue;
  }

  function startWave(number) {
    state.wave = number;
    state.spawnQueue = buildWave(number);
    state.spawnTimer = 0;
    state.waveState = 'fighting';
    state.banner = `WAVE ${number}`;
    state.bannerTimer = WAVES.bannerSeconds;
  }

  function reset() {
    state = freshState();
    startWave(1);
  }

  function fireBullet(angle, offsetAngle) {
    const player = state.player;
    const fireAngle = angle + offsetAngle;
    state.bullets.push({
      x: player.x + Math.cos(fireAngle) * 22,
      y: player.y + Math.sin(fireAngle) * 22,
      vx: Math.cos(fireAngle) * PLAYER.bulletSpeed,
      vy: Math.sin(fireAngle) * PLAYER.bulletSpeed,
      radius: PLAYER.bulletRadius,
    });
  }

  function dropPickup(x, y) {
    const roll = random.next();
    if (roll < PICKUPS.dropSpreadChance) {
      state.pickups.push({ kind: 'spread', x, y, radius: 13, life: 9 });
    } else if (roll < PICKUPS.dropSpreadChance + PICKUPS.dropHealChance) {
      state.pickups.push({ kind: 'heal', x, y, radius: 13, life: 9 });
    }
  }

  function killEnemy(index, events) {
    const enemy = state.enemies[index];
    const spec = ENEMIES[enemy.kind];
    state.score += spec.score;
    state.kills += 1;
    particles.explode(enemy.x, enemy.y, spec.colour);
    dropPickup(enemy.x, enemy.y);
    state.enemies.splice(index, 1);
    return events | EVENT_EXPLODE;
  }

  function stepPlayer(dt, move, aim, firing, attract) {
    const player = state.player;
    if (!player.alive) return EVENT_NONE;
    let events = EVENT_NONE;
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + move.x * PLAYER.speed * dt));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + move.y * PLAYER.speed * dt));
    player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.spreadTimer = Math.max(0, player.spreadTimer - dt);
    player.fireTimer -= dt;
    if (move.x !== 0 || move.y !== 0) {
      particles.thrust(player.x - Math.cos(player.angle) * 18, player.y - Math.sin(player.angle) * 18, '#39f5d6');
    }
    if ((firing || attract) && player.fireTimer <= 0) {
      player.fireTimer = PLAYER.fireInterval;
      state.shotsFired += 1;
      fireBullet(player.angle, 0);
      if (player.spreadTimer > 0) {
        fireBullet(player.angle, 0.22);
        fireBullet(player.angle, -0.22);
      }
      events |= EVENT_SHOOT;
    }
    return events;
  }

  function stepEnemies(dt) {
    const player = state.player;
    for (const enemy of state.enemies) {
      const spec = ENEMIES[enemy.kind];
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.wobble += dt * 2;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      if (enemy.kind === KIND_DRIFTER) {
        const wobble = Math.sin(enemy.wobble) * 0.35;
        enemy.x += ((dx / dist) * Math.cos(wobble) - (dy / dist) * Math.sin(wobble)) * enemy.speed * dt;
        enemy.y += ((dx / dist) * Math.sin(wobble) + (dy / dist) * Math.cos(wobble)) * enemy.speed * dt;
      } else if (enemy.kind === KIND_SPITTER) {
        // Keeps its distance: closes in past 320, backs off inside 200.
        const wanted = dist > 320 ? 1 : dist < 200 ? -1 : 0;
        enemy.x += (dx / dist) * enemy.speed * wanted * dt;
        enemy.y += (dy / dist) * enemy.speed * wanted * dt;
        enemy.shotTimer -= dt;
        if (enemy.shotTimer <= 0 && player.alive) {
          enemy.shotTimer = spec.shotInterval * random.range(0.9, 1.2);
          state.enemyBullets.push({
            x: enemy.x, y: enemy.y,
            vx: (dx / dist) * spec.bulletSpeed, vy: (dy / dist) * spec.bulletSpeed,
            radius: 6,
          });
        }
      } else {
        // Brute: slow, then a short charge when it lines up.
        const charging = Math.sin(enemy.wobble * 0.5) > 0.6;
        const speed = charging ? enemy.speed * 2.6 : enemy.speed;
        enemy.x += (dx / dist) * speed * dt;
        enemy.y += (dy / dist) * speed * dt;
      }
      enemy.x = Math.min(FIELD.width + 60, Math.max(-60, enemy.x));
      enemy.y = Math.min(FIELD.height + 60, Math.max(-60, enemy.y));
    }
  }

  function stepBullets(dt) {
    for (let index = state.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = state.bullets[index];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        state.bullets.splice(index, 1);
      }
    }
    for (let index = state.enemyBullets.length - 1; index >= 0; index -= 1) {
      const bullet = state.enemyBullets[index];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        state.enemyBullets.splice(index, 1);
      }
    }
  }

  function stepCollisions(events) {
    const player = state.player;
    // Player bullets against enemies.
    for (let bulletIndex = state.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
      const bullet = state.bullets[bulletIndex];
      let consumed = false;
      for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        const enemy = state.enemies[enemyIndex];
        if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < bullet.radius + enemy.radius) {
          enemy.health -= 1;
          enemy.flash = 0.12;
          particles.hit(bullet.x, bullet.y, '#ffe45e');
          state.bullets.splice(bulletIndex, 1);
          consumed = true;
          events = enemy.health <= 0 ? killEnemy(enemyIndex, events) : events | EVENT_ENEMY_HIT;
          break;
        }
      }
      if (consumed) continue;
    }
    if (!player.alive) return events;
    // Enemies touching the ship.
    for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = state.enemies[enemyIndex];
      const spec = ENEMIES[enemy.kind];
      if (distance(player.x, player.y, enemy.x, enemy.y) < player.radius + enemy.radius - 2) {
        // The enemy pops too: a ram costs both sides.
        events = killEnemy(enemyIndex, events);
        if (player.invulnerable <= 0) {
          player.health -= spec.damage;
          player.invulnerable = PLAYER.invulnerable;
          particles.hit(player.x, player.y, '#ff5470');
          events |= EVENT_PLAYER_HIT;
        }
      }
    }
    // Enemy bullets against the ship.
    for (let bulletIndex = state.enemyBullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
      const bullet = state.enemyBullets[bulletIndex];
      if (distance(bullet.x, bullet.y, player.x, player.y) < bullet.radius + player.radius - 2) {
        state.enemyBullets.splice(bulletIndex, 1);
        if (player.invulnerable <= 0) {
          player.health -= 10;
          player.invulnerable = PLAYER.invulnerable;
          particles.hit(player.x, player.y, '#ff5470');
          events |= EVENT_PLAYER_HIT;
        }
      }
    }
    // Pickups.
    for (let index = state.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = state.pickups[index];
      pickup.life -= STEP;
      if (pickup.life <= 0) {
        state.pickups.splice(index, 1);
        continue;
      }
      if (distance(pickup.x, pickup.y, player.x, player.y) < pickup.radius + player.radius + 4) {
        if (pickup.kind === 'spread') player.spreadTimer = PICKUPS.spreadSeconds;
        else player.health = Math.min(PLAYER.maxHealth, player.health + PICKUPS.healAmount);
        state.pickups.splice(index, 1);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  /**
   * Advance the world one fixed step. `move` and `aim` steer the ship,
   * `firing` holds the trigger; `attract` runs the title-screen demo, where
   * the ship flies and shoots on its own and never dies.
   */
  function step(dt, move, aim, firing, attract = false) {
    if (!state) reset();
    let events = EVENT_NONE;
    state.time += dt;
    state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    particles.step(dt);

    if (state.over) return events;

    if (state.waveState === 'between') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        startWave(state.wave + 1);
        events |= EVENT_WAVE;
      }
    } else if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = Math.max(0.25, 0.85 - state.wave * 0.04);
        state.enemies.push(edgeSpawn(state.spawnQueue.shift()));
      }
    } else if (state.enemies.length === 0) {
      state.score += 100 * state.wave;
      state.waveState = 'between';
      state.waveTimer = WAVES.betweenSeconds;
      state.banner = `WAVE ${state.wave} CLEAR  +${100 * state.wave}`;
      state.bannerTimer = WAVES.bannerSeconds;
    }

    events |= stepPlayer(dt, move, aim, firing, attract);
    stepEnemies(dt);
    stepBullets(dt);
    events = stepCollisions(events);

    if (state.player.alive && state.player.health <= 0) {
      state.player.alive = false;
      state.player.health = 0;
      state.over = true;
      particles.explode(state.player.x, state.player.y, '#39f5d6');
      events |= EVENT_OVER;
    }
    if (attract && state.player.health < PLAYER.maxHealth) {
      // The demo ship never dies: it is a title screen, not a run.
      state.player.health = PLAYER.maxHealth;
      state.player.alive = true;
      state.over = false;
    }
    return events;
  }

  reset();
  return { get state() { return state; }, particles, reset, step };
}
