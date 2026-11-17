// Reading the player: which way the oars are pulled, where the lantern is pointed, whether the
// shutter is open and the one-off actions since the last frame. Nothing here touches the
// simulation; it hands over a small record and is done.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_FLARE = 4;

const LEFT_KEYS = ['a', 'arrowleft'];
const RIGHT_KEYS = ['d', 'arrowright'];
const UP_KEYS = ['w', 'arrowup'];
const DOWN_KEYS = ['s', 'arrowdown'];

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let pointerX = FIELD.width / 2;
  let pointerY = FIELD.height * 0.25;
  let shutter = false;

  /** Window coordinates to the game's fixed 1280x720 space, so aim means the same everywhere. */
  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const padX = (rect.width - FIELD.width * scale) / 2;
    const padY = (rect.height - FIELD.height * scale) / 2;
    pointerX = (event.clientX - rect.left - padX) / scale;
    pointerY = (event.clientY - rect.top - padY) / scale;
  }

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    }
    if (key === 'escape' || key === 'p') actions |= ACTION_PAUSE;
    if (key === 'e') actions |= ACTION_FLARE;
    held.add(key);
    if ([...LEFT_KEYS, ...RIGHT_KEYS, ...UP_KEYS, ...DOWN_KEYS].includes(key)) event.preventDefault();
  });

  window.addEventListener('keyup', (event) => held.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => {
    held.clear();
    shutter = false;
  });

  canvas.addEventListener('pointermove', toField);
  canvas.addEventListener('pointerdown', (event) => {
    toField(event);
    shutter = true;
    actions |= ACTION_CONFIRM;
    if (event.button === 2) actions |= ACTION_FLARE;
  });
  window.addEventListener('pointerup', () => {
    shutter = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function axis() {
    let ax = 0;
    let ay = 0;
    for (const key of held) {
      if (LEFT_KEYS.includes(key)) ax -= 1;
      if (RIGHT_KEYS.includes(key)) ax += 1;
      if (UP_KEYS.includes(key)) ay -= 1;
      if (DOWN_KEYS.includes(key)) ay += 1;
    }
    return { ax, ay };
  }

  function take() {
    const { ax, ay } = axis();
    const record = { ax, ay, aimX: pointerX, aimY: pointerY, lit: shutter, flare: (actions & ACTION_FLARE) !== 0 };
    return record;
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { take, takeActions, isShutterOpen: () => shutter, pointer: () => ({ x: pointerX, y: pointerY }) };
}
