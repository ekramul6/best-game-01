// Keyboard and mouse, read by the loop once a frame. Movement keys are held;
// confirm / pause / restart are edges, consumed by takeActions() so one press
// never fires twice. The mouse position is kept in logical playfield pixels.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

/** Keys that move the ship: WASD plus the arrow keys. */
const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDown = false;
  const mouse = { x: 640, y: 360 };

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    mouse.x = (event.clientX - rect.left) * scaleX;
    mouse.y = (event.clientY - rect.top) * scaleY;
  }

  function onKeyDown(event) {
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyR') {
      actions |= ACTION_RESTART;
    }
    if (MOVE_KEYS[event.code]) {
      held.add(event.code);
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseDown(event) {
    updateMouse(event);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  }

  function onMouseUp() {
    mouseDown = false;
  }

  function onMouseMove(event) {
    updateMouse(event);
  }

  function onBlur() {
    held.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    get firing() {
      return mouseDown || held.has('Space');
    },
    /** Normalised movement direction from the held keys, or {x:0,y:0}. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const move = MOVE_KEYS[code];
        if (move) {
          x += move[0];
          y += move[1];
        }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** Take and clear the edge actions queued since the last call. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
