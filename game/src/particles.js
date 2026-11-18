// The particle pool and the screen shake. Particles are allocated once at
// boot and reused: a burst writes into dead slots, nothing is allocated
// while the game runs.

export function createParticles(capacity = 320) {
  const items = [];
  for (let index = 0; index < capacity; index += 1) {
    items.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, colour: '#ffffff' });
  }
  let shake = 0;

  function spawn(x, y, vx, vy, life, size, colour) {
    for (let index = 0; index < items.length; index += 1) {
      const particle = items[index];
      if (particle.active) continue;
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = vx;
      particle.vy = vy;
      particle.life = life;
      particle.maxLife = life;
      particle.size = size;
      particle.colour = colour;
      return;
    }
  }

  return {
    items,
    get shake() {
      return shake;
    },
    /** A ring of sparks, as when an enemy pops. */
    burst(x, y, colour, count, speed) {
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4;
        const velocity = speed * (0.4 + Math.random() * 0.8);
        spawn(x, y, Math.cos(angle) * velocity, Math.sin(angle) * velocity, 0.35 + Math.random() * 0.4, 2 + Math.random() * 3, colour);
      }
    },
    /** A short trail puff behind the ship's engines. */
    thrust(x, y, colour) {
      spawn(x, y, (Math.random() - 0.5) * 40, 60 + Math.random() * 60, 0.3, 2.5, colour);
    },
    /** A hit flash: a few bright shards and a kick to the shake. */
    hit(x, y, colour) {
      this.burst(x, y, colour, 8, 160);
      shake = Math.min(14, shake + 5);
    },
    /** A big death: many sparks and the strongest shake. */
    explode(x, y, colour) {
      this.burst(x, y, colour, 26, 260);
      this.burst(x, y, '#ffffff', 10, 180);
      shake = Math.min(18, shake + 9);
    },
    step(dt) {
      shake = Math.max(0, shake - dt * 42);
      for (const particle of items) {
        if (!particle.active) continue;
        particle.life -= dt;
        if (particle.life <= 0) {
          particle.active = false;
          continue;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.96;
        particle.vy *= 0.96;
      }
    },
  };
}
