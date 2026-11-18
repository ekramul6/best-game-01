// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
//
// The play pilot flies toward the nearest enemy's flank, keeps its distance
// from the pack and fires at the nearest enemy; the end pilot is timid — it
// barely moves and rarely fires — so the swarm catches it, as a hurried
// player is caught.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 240;

function nearestEnemy(state) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }
  return { enemy: nearest, dist: nearestDist };
}

function playPilot(state) {
  const player = state.player;
  const { enemy, dist } = nearestEnemy(state);
  let move = { x: 0, y: 0 };
  let aim = { x: player.x + Math.cos(player.angle) * 100, y: player.y + Math.sin(player.angle) * 100 };
  let firing = true;
  if (enemy) {
    aim = { x: enemy.x, y: enemy.y };
    // Strafe: keep about 220 away, circling the nearest enemy.
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const radial = dist > 260 ? 1 : dist < 170 ? -1 : 0;
    const tx = (dx / length) * radial + (-dy / length) * 0.7;
    const ty = (dy / length) * radial + (dx / length) * 0.7;
    const moveLength = Math.hypot(tx, ty) || 1;
    move = { x: tx / moveLength, y: ty / moveLength };
    // Chase a nearby pickup when it is safe.
    for (const pickup of state.pickups) {
      if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 160) {
        const px = pickup.x - player.x;
        const py = pickup.y - player.y;
        const pl = Math.hypot(px, py) || 1;
        move = { x: px / pl, y: py / pl };
        break;
      }
    }
  } else {
    move = { x: 0, y: 0 };
    aim = { x: FIELD.width / 2, y: FIELD.height / 2 - 200 };
  }
  return { move, aim, firing };
}

function endPilot(state) {
  const player = state.player;
  const { enemy } = nearestEnemy(state);
  const aim = enemy ? { x: enemy.x, y: enemy.y } : { x: player.x, y: player.y - 100 };
  // Drifts slowly toward the centre and fires only once in a while.
  const move = { x: (FIELD.width / 2 - player.x) * 0.001, y: (FIELD.height / 2 - player.y) * 0.001 };
  const length = Math.hypot(move.x, move.y) || 1;
  const firing = Math.floor(state.time * 2) % 5 === 0;
  return { move: { x: move.x / length * 0.4, y: move.y / length * 0.4 }, aim, firing };
}

function attractPilot(state) {
  // The title screen's demo ship: same steering as the play pilot.
  return playPilot(state);
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      const pilot = attractPilot(world.state);
      world.step(STEP, pilot.move, pilot.aim, pilot.firing, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      if (world.state.over) break;
      const pilot = playPilot(world.state);
      world.step(STEP, pilot.move, pilot.aim, pilot.firing, false);
    }
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
    const pilot = endPilot(world.state);
    if (world.step(STEP, pilot.move, pilot.aim, pilot.firing, false) & EVENT_OVER) break;
  }
  return { screen: SCREEN_OVER, best: world.state.score };
}
