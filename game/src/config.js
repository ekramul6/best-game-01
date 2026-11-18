// NEON SWARM — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 360,
  maxHealth: 100,
  fireInterval: 0.16,
  bulletSpeed: 640,
  bulletRadius: 5,
  contactDamage: 12,
  invulnerable: 1.0,
};

export const ENEMIES = {
  drifter: { radius: 16, health: 1, speed: 105, score: 50, colour: '#ff5d8f', damage: 12 },
  spitter: { radius: 15, health: 2, speed: 80, score: 100, colour: '#b388ff', damage: 10, shotInterval: 2.1, bulletSpeed: 230 },
  brute: { radius: 28, health: 6, speed: 55, score: 250, colour: '#ff9f43', damage: 22 },
};

export const PICKUPS = {
  spreadSeconds: 8,
  healAmount: 30,
  dropSpreadChance: 0.10,
  dropHealChance: 0.09,
};

export const WAVES = {
  /** Enemies in wave n, before the brute bonus. */
  baseCount: 4,
  perWave: 3,
  /** Seconds between waves, and the banner that announces the next one. */
  betweenSeconds: 1.6,
  bannerSeconds: 1.8,
};

export const PALETTE = {
  backdrop: '#070312',
  grid: '#1a0f33',
  star: '#cfd8ff',
  player: '#39f5d6',
  playerCore: '#eafffb',
  bullet: '#ffe45e',
  enemyBullet: '#ff6b81',
  spread: '#4fc3f7',
  heal: '#69f0ae',
  panel: '#140a2e',
  text: '#f2f0ff',
  muted: '#9d94c7',
  danger: '#ff5470',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-swarm.best';
