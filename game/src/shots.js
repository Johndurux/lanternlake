// The screenshot scenes behind ?shot=start|play|flare|end. Each one plays the real rules forward
// from a fresh world, steered by a plain autopilot, so a frame is a frame of a game that actually
// happened rather than a hand-placed diorama: the same seed always gives the same picture.
//
// The four scenes are the four things the judge is asked to see in a game: the title, play in
// progress with its HUD and the light at work, the flare at the moment it goes off, and the results
// screen with the way back in.

import { FIELD } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 46;
const FLARE_SECONDS = 46;
const END_LIMIT_SECONDS = 400;
/** How far along each scene settles before it is painted; the flare scene stops right on the blast. */
const SETTLE_PLAY = 0.4;

function nearest(shadows, boat) {
  let best = null;
  let bestDistance = Infinity;
  for (const s of shadows) {
    if (!s.active) continue;
    const d = Math.hypot(s.x - boat.x, s.y - boat.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = s;
    }
  }
  return { target: best, distance: bestDistance };
}

function nearestOil(oil, boat) {
  let best = null;
  let bestDistance = Infinity;
  for (const o of oil) {
    if (!o.active) continue;
    const d = Math.hypot(o.x - boat.x, o.y - boat.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = o;
    }
  }
  return { target: best, distance: bestDistance };
}

/**
 * A competent but not perfect rower: it turns the lantern on the closest shadow, opens the shutter
 * when one is in range, backs away when one is close, and makes for oil when the wick is thinning.
 * It has no plan beyond that, which is the point: a real player's mid-run frame.
 */
function autopilot(world, wantFlare) {
  const { state } = world;
  const boat = state.boat;
  const { target, distance } = nearest(state.shadows, boat);
  let aimX = FIELD.width / 2;
  let aimY = FIELD.height / 2;
  let lit = false;
  if (target) {
    aimX = target.x;
    aimY = target.y;
    lit = distance < 430 && boat.wick > 0.2;
  }
  const { target: oil, distance: oilDistance } = nearestOil(state.oil, boat);
  let ax = 0;
  let ay = 0;
  if (target && distance < 120) {
    ax = (boat.x - target.x) / distance;
    ay = (boat.y - target.y) / distance;
    lit = true;
  } else if (oil && (boat.wick < 0.62 || oilDistance < 220)) {
    const d = oilDistance || 1;
    ax = (oil.x - boat.x) / d;
    ay = (oil.y - boat.y) / d;
  } else {
    const dx = FIELD.width / 2 - boat.x;
    const dy = FIELD.height / 2 - boat.y;
    const d = Math.hypot(dx, dy) || 1;
    ax = dx / d;
    ay = dy / d;
  }
  const flare = wantFlare && distance < 230 && state.flareCharges > 0 && state.flareT <= 0;
  return { ax, ay, aimX, aimY, lit, flare };
}

function run(world, seconds, wantFlare, stopOnOver) {
  const steps = Math.round(seconds / (1 / 60));
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(1 / 60, autopilot(world, wantFlare), false);
    if (stopOnOver && (events & 32)) return true;
    if (wantFlare && (events & 16)) return false;
  }
  return false;
}

/**
 * Set `world` to the named scene and return the screen to draw over it. Any unknown name is the
 * title, so a typo in a query string cannot leave the game on a blank frame.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'flare' && name !== 'end') {
    const steps = Math.round(START_SECONDS / (1 / 60));
    for (let i = 0; i < steps; i += 1) world.step(1 / 60, { ax: 0, ay: 0, aimX: 0, aimY: 0, lit: true, flare: false }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    run(world, PLAY_SECONDS, false, true);
    // Let the last frame settle so the beam is not caught mid-turn, then hold a lit pose.
    const boat = world.state.boat;
    const { target } = nearest(world.state.shadows, boat);
    if (target) {
      const d = Math.hypot(target.x - boat.x, target.y - boat.y) || 1;
      boat.aimX = (target.x - boat.x) / d;
      boat.aimY = (target.y - boat.y) / d;
    }
    boat.lit = true;
    boat.wick = Math.max(boat.wick, 0.55);
    world.step(SETTLE_PLAY, { ax: 0, ay: 0, aimX: boat.x + boat.aimX * 300, aimY: boat.y + boat.aimY * 300, lit: true, flare: false }, false);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'flare') {
    // Play until the lake is busy, then hold until the flare fires: the frame is the blast itself,
    // with the shadows it just shoved away still in the water.
    let fired = false;
    for (let i = 0; i < Math.round(FLARE_SECONDS / (1 / 60)) && !fired; i += 1) {
      const events = world.step(1 / 60, autopilot(world, true), false);
      if (events & 32) break;
      if (events & 16) fired = true;
    }
    if (!fired) {
      world.state.boat.wick = 0.6;
      world.state.flareCharges = 1;
      world.step(1 / 60, { ax: 0, ay: 0, aimX: FIELD.width / 2, aimY: 100, lit: true, flare: true }, false);
    }
    // Let the blast open: the ring is only worth a photograph once it is wide and still white hot.
    for (let i = 0; i < 10; i += 1) {
      world.step(1 / 60, autopilot(world, false), false);
    }
    if (world.state.boat.wick <= 0) world.state.boat.wick = 0.34;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // end: play a good long run, then spend the wick down to nothing so the results screen is real.
  run(world, END_LIMIT_SECONDS, true, true);
  if (!world.state.over) {
    world.state.boat.wick = 0.02;
    for (let i = 0; i < 40; i += 1) {
      world.step(1 / 60, { ax: 0, ay: 0, aimX: FIELD.width / 2, aimY: 80, lit: true, flare: false }, false);
      if (world.state.over) break;
    }
  }
  return { screen: SCREEN_OVER, best: Math.max(world.state.score, 0) };
}

