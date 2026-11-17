// The simulation: the lake, the boat, the lantern's cone, the shadows that live outside it and the
// oil that keeps it burning. Nothing here reads the clock or the screen: a step takes its inputs and
// a fixed dt, so the same seed and the same inputs give the same game, which is what makes the
// screenshot scenes and the replays repeatable.
//
// The one rule the whole game rests on: the wick is light, life and weapon at once. It burns down
// on its own, faster with the shutter open and faster still with a shadow in the beam, and every
// shadow that reaches the boat bites it. There is no separate health bar to watch.

import { BEAM, BOAT, FIELD, FLARE, OIL, POOL, SHADOW, WAVE } from './config.js';

export const EVENT_BITE = 1;
export const EVENT_KILL = 2;
export const EVENT_OIL = 4;
export const EVENT_WAVE = 8;
export const EVENT_FLARE = 16;
export const EVENT_OVER = 32;

const KINDS = Object.keys(SHADOW);

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

/** Distance from a point to the boat, and the unit vector toward it. */
function toward(boat, x, y) {
  const dx = x - boat.x;
  const dy = y - boat.y;
  const distance = Math.hypot(dx, dy) || 1;
  return { dx, dy, distance, ux: dx / distance, uy: dy / distance };
}

/** True when a point lies inside the lantern's cone: near enough and within the half angle. */
export function inCone(boat, halfAngle, range, x, y) {
  const { distance, ux, uy } = toward(boat, x, y);
  if (distance > range) return false;
  const dot = ux * boat.aimX + uy * boat.aimY;
  if (dot <= 0) return false;
  return dot >= Math.cos(halfAngle);
}

export function createWorld(random) {
  const boat = { x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, aimX: 0, aimY: -1, lit: false, wick: BOAT.wickStart, biteFlash: 0 };
  const state = {
    boat,
    decor: [],
    shadows: [],
    oil: [],
    sparks: [],
    ripples: [],
    wave: 1,
    waveLeft: WAVE.seconds,
    score: 0,
    killed: 0,
    rescued: 0,
    time: 0,
    flareCharges: FLARE.chargesPerWave,
    flareT: 0,
    shake: 0,
    flash: 0,
    oilTimer: OIL.spawnEvery * 0.6,
    over: false,
    reason: '',
  };

  function freeShadow() {
    for (let i = 0; i < state.shadows.length; i += 1) if (!state.shadows[i].active) return state.shadows[i];
    if (state.shadows.length >= POOL.shadows) return null;
    const fresh = { active: false };
    state.shadows.push(fresh);
    return fresh;
  }

  /** A spark burst, capped: the pool is a ring, so the oldest are reused rather than growing. */
  function burst(x, y, count, speed, colour, life) {
    for (let i = 0; i < count; i += 1) {
      let slot = null;
      for (let s = 0; s < state.sparks.length; s += 1) if (!state.sparks[s].active) { slot = state.sparks[s]; break; }
      if (!slot) {
        if (state.sparks.length >= POOL.spark) return;
        slot = { active: false };
        state.sparks.push(slot);
      }
      const angle = random() * Math.PI * 2;
      const away = speed * (0.35 + random() * 0.65);
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.vx = Math.cos(angle) * away;
      slot.vy = Math.sin(angle) * away;
      slot.life = life * (0.6 + random() * 0.6);
      slot.max = slot.life;
      slot.colour = colour;
      slot.size = 1.4 + random() * 2.2;
    }
  }

  function ripple(x, y, r, colour) {
    let slot = null;
    for (let i = 0; i < state.ripples.length; i += 1) if (!state.ripples[i].active) { slot = state.ripples[i]; break; }
    if (!slot) {
      if (state.ripples.length >= POOL.ripple) return;
      slot = { active: false };
      state.ripples.push(slot);
    }
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.r = r;
    slot.life = 0.85;
    slot.max = 0.85;
    slot.colour = colour;
  }

  /** Put a shadow in the water, never on top of the boat: the lake is big and it comes from it. */
  function spawn(kind) {
    const spec = SHADOW[kind];
    const slot = freeShadow();
    if (!slot) return null;
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 24; tries += 1) {
      x = 40 + random() * (FIELD.width - 80);
      y = 40 + random() * (FIELD.height - 80);
      if (Math.hypot(x - boat.x, y - boat.y) > 240) break;
    }
    const angle = random() * Math.PI * 2;
    slot.active = true;
    slot.kind = kind;
    slot.x = x;
    slot.y = y;
    slot.vx = Math.cos(angle) * spec.speed * 0.4;
    slot.vy = Math.sin(angle) * spec.speed * 0.4;
    slot.radius = spec.radius;
    slot.hp = spec.hp * (1 + (state.wave - 1) * WAVE.hpPerWave);
    slot.hpMax = slot.hp;
    slot.speed = spec.speed * (1 + (state.wave - 1) * WAVE.speedPerWave);
    slot.accel = spec.accel;
    slot.score = spec.score;
    slot.phase = random() * Math.PI * 2;
    slot.hitFlash = 0;
    slot.born = 0;
    return slot;
  }

  function spawnOil() {
    let slot = null;
    for (let i = 0; i < state.oil.length; i += 1) if (!state.oil[i].active) { slot = state.oil[i]; break; }
    if (!slot) {
      if (state.oil.length >= POOL.oil) return null;
      slot = { active: false };
      state.oil.push(slot);
    }
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 24; tries += 1) {
      x = 50 + random() * (FIELD.width - 100);
      y = 50 + random() * (FIELD.height - 100);
      if (Math.hypot(x - boat.x, y - boat.y) > 200) break;
    }
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.phase = random() * Math.PI * 2;
    slot.angle = random() * Math.PI * 2;
    return slot;
  }

  /**
   * The lake's own furniture: lily pads and reed beds, laid out once from the seed so the water has
   * something in it. Presentation only — they never collide, hide or slow anything, and the boat
   * rows straight over them. Faint enough to sit behind the light, present enough that the arena
   * reads as a place rather than an empty field.
   */
  function buildDecor() {
    state.decor.length = 0;
    for (let i = 0; i < 30; i += 1) {
      state.decor.push({
        kind: 'pad',
        x: 40 + random() * (FIELD.width - 80),
        y: 40 + random() * (FIELD.height - 80),
        r: 11 + random() * 13,
        phase: random() * Math.PI * 2,
        notch: random() * Math.PI * 2,
      });
    }
    for (let i = 0; i < 26; i += 1) {
      const edge = Math.floor(random() * 4);
      const along = random();
      state.decor.push({
        kind: 'reed',
        x: edge === 0 ? along * FIELD.width : edge === 1 ? along * FIELD.width : edge === 2 ? 18 + random() * 40 : FIELD.width - 18 - random() * 40,
        y: edge === 0 ? 16 + random() * 34 : edge === 1 ? FIELD.height - 16 - random() * 34 : along * FIELD.height,
        h: 18 + random() * 26,
        phase: random() * Math.PI * 2,
      });
    }
  }

  /** Begin a run: the boat centred, the wick part burnt, the first wave announced. */
  function reset(seedWave = 1) {
    buildDecor();
    boat.x = FIELD.width / 2;
    boat.y = FIELD.height / 2;
    boat.vx = 0;
    boat.vy = 0;
    boat.aimX = 0;
    boat.aimY = -1;
    boat.lit = false;
    boat.wick = BOAT.wickStart;
    boat.biteFlash = 0;
    for (let i = 0; i < state.shadows.length; i += 1) state.shadows[i].active = false;
    for (let i = 0; i < state.oil.length; i += 1) state.oil[i].active = false;
    for (let i = 0; i < state.sparks.length; i += 1) state.sparks[i].active = false;
    for (let i = 0; i < state.ripples.length; i += 1) state.ripples[i].active = false;
    state.wave = seedWave;
    state.waveLeft = WAVE.seconds;
    state.score = 0;
    state.killed = 0;
    state.rescued = 0;
    state.time = 0;
    state.flareCharges = FLARE.chargesPerWave;
    state.flareT = 0;
    state.shake = 0;
    state.flash = 0;
    state.oilTimer = OIL.spawnEvery * 0.6;
    state.over = false;
    state.reason = '';
    for (let i = 0; i < WAVE.first + state.wave * WAVE.growth && i < POOL.shadows; i += 1) {
      spawn(KINDS[Math.floor(random() * KINDS.length)]);
    }
    for (let i = 0; i < 2; i += 1) spawnOil();
  }

  /** Open a wave: more shadows, and the flare comes back. */
  function nextWave() {
    state.wave += 1;
    state.waveLeft = WAVE.seconds;
    state.flareCharges = Math.min(FLARE.maxCharges, state.flareCharges + FLARE.chargesPerWave);
    const count = WAVE.first + state.wave * WAVE.growth;
    for (let i = 0; i < count; i += 1) spawn(KINDS[Math.floor(random() * KINDS.length)]);
    return EVENT_WAVE;
  }

  function step(dt, input, idle) {
    let events = 0;
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 2.6);
    state.flash = Math.max(0, state.flash - dt * 3.4);
    boat.biteFlash = Math.max(0, boat.biteFlash - dt * 3.0);
    if (state.flareT > 0) state.flareT = Math.max(0, state.flareT - dt * 2.2);

    if (idle) {
      // The title screen: the lake breathes, the lantern sits lit, nothing is at stake.
      boat.wick = BOAT.wickStart;
      boat.x = FIELD.width / 2 + Math.sin(state.time * 0.32) * 26;
      boat.y = FIELD.height / 2 + Math.cos(state.time * 0.21) * 12;
      boat.aimX = Math.sin(state.time * 0.5);
      boat.aimY = Math.cos(state.time * 0.5);
      boat.lit = true;
    } else {
      if (input.flare && state.flareCharges > 0 && state.flareT <= 0 && boat.wick > FLARE.wickCost) {
        state.flareCharges -= 1;
        state.flareT = 0.42;
        boat.wick = clamp(boat.wick - FLARE.wickCost, 0, 1);
        state.shake = Math.max(state.shake, 0.9);
        ripple(boat.x, boat.y, 30, 'flare');
        events |= EVENT_FLARE;
        for (let i = 0; i < state.shadows.length; i += 1) {
          const s = state.shadows[i];
          if (!s.active) continue;
          const { distance, ux, uy } = toward(boat, s.x, s.y);
          if (distance > FLARE.radius) continue;
          s.hp -= FLARE.damage;
          s.hitFlash = 1;
          s.vx += ux * FLARE.push;
          s.vy += uy * FLARE.push;
        }
        burst(boat.x, boat.y, 34, 340, 'flare', 0.7);
      }
      // Rowing: thrust toward the keys, drag always. The boat keeps a little way on, which is what
      // makes the water feel like water.
      const ax = input.ax || 0;
      const ay = input.ay || 0;
      const len = Math.hypot(ax, ay) || 1;
      boat.vx += (ax / len) * BOAT.accel * dt;
      boat.vy += (ay / len) * BOAT.accel * dt;
      const damp = Math.max(0, 1 - BOAT.drag * dt);
      boat.vx *= damp;
      boat.vy *= damp;
      boat.x = clamp(boat.x + boat.vx * dt, BOAT.radius, FIELD.width - BOAT.radius);
      boat.y = clamp(boat.y + boat.vy * dt, BOAT.radius, FIELD.height - BOAT.radius);
      if (boat.x <= BOAT.radius || boat.x >= FIELD.width - BOAT.radius) boat.vx = 0;
      if (boat.y <= BOAT.radius || boat.y >= FIELD.height - BOAT.radius) boat.vy = 0;
      boat.lit = !!input.lit;
      const aimX = input.aimX - boat.x;
      const aimY = input.aimY - boat.y;
      const aimLen = Math.hypot(aimX, aimY) || 1;
      boat.aimX = aimX / aimLen;
      boat.aimY = aimY / aimLen;
      if (Math.hypot(boat.vx, boat.vy) > 60 && random() < dt * 9) {
        ripple(boat.x - boat.aimX * 12, boat.y - boat.aimY * 12, 4 + random() * 5, 'wake');
      }
    }

    // The lantern: the cone is the weapon and the wick is the price.
    const halfAngle = boat.lit ? BEAM.halfAngleLit : BEAM.halfAngle;
    const dps = boat.lit ? BEAM.dpsLit : BEAM.dpsDim;
    const push = boat.lit ? BEAM.pushLit : BEAM.pushDim;
    let litCount = 0;
    for (let i = 0; i < state.shadows.length; i += 1) {
      const s = state.shadows[i];
      if (!s.active) continue;
      s.born += dt;
      s.hitFlash = Math.max(0, s.hitFlash - dt * 3.2);
      if (inCone(boat, halfAngle, BEAM.range, s.x, s.y)) {
        litCount += 1;
        s.hp -= dps * dt * (1 + (s.kind === 'husk' ? 0.25 : 0));
        const { ux, uy } = toward(boat, s.x, s.y);
        s.vx += ux * push * dt;
        s.vy += uy * push * dt;
        if (random() < dt * (boat.lit ? 26 : 7)) burst(s.x, s.y, 1, 60, 'burn', 0.28);
        if (s.hp <= 0) {
          s.active = false;
          state.score += s.score;
          state.killed += 1;
          events |= EVENT_KILL;
          burst(s.x, s.y, 14, 190, 'kill', 0.6);
          ripple(s.x, s.y, 10, 'kill');
        }
      }
    }

    // The shadows: they drift at the light's edge and close when it thins.
    for (let i = 0; i < state.shadows.length; i += 1) {
      const s = state.shadows[i];
      if (!s.active) continue;
      const { ux, uy, distance } = toward(boat, s.x, s.y);
      const want = s.speed * (distance > 360 ? 1.25 : distance < 120 ? 0.72 : 1);
      s.vx += (ux * want - s.vx) * Math.min(1, s.accel * dt / Math.max(1, want));
      s.vy += (uy * want - s.vy) * Math.min(1, s.accel * dt / Math.max(1, want));
      s.vx += Math.cos(state.time * 1.7 + s.phase) * 26 * dt;
      s.vy += Math.sin(state.time * 1.4 + s.phase) * 26 * dt;
      const sp = Math.hypot(s.vx, s.vy);
      const cap = s.speed * 2.6;
      if (sp > cap) {
        s.vx = (s.vx / sp) * cap;
        s.vy = (s.vy / sp) * cap;
      }
      s.x = clamp(s.x + s.vx * dt, s.radius, FIELD.width - s.radius);
      s.y = clamp(s.y + s.vy * dt, s.radius, FIELD.height - s.radius);
      if (!idle && distance < BOAT.radius + s.radius + 2) {
        s.active = false;
        boat.wick = clamp(boat.wick - BOAT.biteWick, 0, 1);
        boat.biteFlash = 1;
        state.shake = Math.max(state.shake, 1);
        state.flash = 1;
        events |= EVENT_BITE;
        burst(s.x, s.y, 18, 230, 'bite', 0.55);
        ripple(s.x, s.y, 14, 'bite');
      }
    }

    // The oil: the only way the wick comes back, and it floats where the shadow already is.
    if (!idle) {
      boat.wick = clamp(boat.wick - (BOAT.drainIdle + (boat.lit ? BOAT.drainLit : 0) + litCount * BOAT.drainPerShadow) * dt, 0, 1);
      state.oilTimer -= dt;
      if (state.oilTimer <= 0) {
        state.oilTimer = OIL.spawnEvery * (0.75 + random() * 0.5);
        spawnOil();
      }
      for (let i = 0; i < state.oil.length; i += 1) {
        const o = state.oil[i];
        if (!o.active) continue;
        o.angle += dt * 0.6;
        o.x = clamp(o.x + Math.cos(o.angle * 0.7 + o.phase) * OIL.drift * dt, 30, FIELD.width - 30);
        o.y = clamp(o.y + Math.sin(o.angle * 0.5 + o.phase) * OIL.drift * dt, 30, FIELD.height - 30);
        if (Math.hypot(o.x - boat.x, o.y - boat.y) < BOAT.radius + OIL.radius + 3) {
          o.active = false;
          boat.wick = clamp(boat.wick + OIL.warm, 0, 1);
          state.rescued += 1;
          state.score += OIL.score;
          events |= EVENT_OIL;
          burst(o.x, o.y, 12, 130, 'oil', 0.5);
          ripple(o.x, o.y, 12, 'oil');
        }
      }
      state.waveLeft -= dt;
      if (state.waveLeft <= 0 && state.shadows.filter((s) => s.active).length < WAVE.maxLive) events |= nextWave();
      if (boat.wick <= 0) {
        boat.wick = 0;
        state.over = true;
        state.reason = 'the wick burned out';
        events |= EVENT_OVER;
      }
    }

    // Sparks and ripples: presentation only, and they never feed back into a rule.
    for (let i = 0; i < state.sparks.length; i += 1) {
      const p = state.sparks[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.max(0, 1 - 2.4 * dt);
      p.vy *= Math.max(0, 1 - 2.4 * dt);
    }
    for (let i = 0; i < state.ripples.length; i += 1) {
      const w = state.ripples[i];
      if (!w.active) continue;
      w.life -= dt;
      if (w.life <= 0) w.active = false;
      else w.r += dt * 74;
    }
    return events;
  }

  return { state, reset, step, spawn, spawnOil, burst };
}
