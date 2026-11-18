// NEON SWARM — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between four
// screens: title, play, paused and game over.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ENEMY_HIT, EVENT_EXPLODE, EVENT_OVER, EVENT_PICKUP, EVENT_PLAYER_HIT, EVENT_SHOOT, EVENT_WAVE } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.particles);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Survive the swarm.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.gameOver();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if ((actions & ACTION_CONFIRM) && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if ((actions & ACTION_RESTART) && (screen === SCREEN_OVER || screen === SCREEN_PLAY)) startGame();
    else if ((actions & ACTION_PAUSE) && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if ((actions & (ACTION_PAUSE | ACTION_CONFIRM)) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function playSound(events) {
    if (events & EVENT_OVER) return; // endGame() plays the game-over sound.
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_EXPLODE) audio.explode();
    else if (events & EVENT_ENEMY_HIT) audio.enemyHit();
    if (events & EVENT_PLAYER_HIT) audio.playerHit();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_WAVE) audio.wave();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the ship flies and shoots behind the title.
      const player = world.state.player;
      const nearest = world.state.enemies[0];
      const aim = nearest ? { x: nearest.x, y: nearest.y } : { x: player.x, y: player.y - 100 };
      const move = { x: Math.sin(world.state.time * 0.7) * 0.6, y: Math.cos(world.state.time * 0.5) * 0.4 };
      world.step(STEP, move, aim, true, true);
      return;
    }
    const events = world.step(STEP, input.direction(), input.mouse, input.firing, false);
    playSound(events);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_PLAYER_HIT) announce(`Hit. Hull ${Math.max(0, Math.round(world.state.player.health))}.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world.particles);
  }

  // Leaving the tab pauses a running game rather than letting the swarm close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Swarm. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
