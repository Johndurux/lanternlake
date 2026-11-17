// All drawing, and nothing else. Every colour comes from the palette's role (config.js), so what
// the screen shows means something: amber is the keeper's own light, the cold violet is the danger,
// the teal glint is the reward, and red appears only when the wick is bitten.
//
// The one idea the composition serves: a small lit boat on a real lake, with cold things closing on
// it out of the dark. Protagonist, danger and reward must be tellable apart in a single still frame
// with the HUD covered — that is the test this renderer is built to pass.

import { BEAM, FIELD, FONT, FLARE, OIL, PALETTE, WAVE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    scale = Math.min(width / FIELD.width, height / FIELD.height);
    offsetX = (width - FIELD.width * scale) / 2;
    offsetY = (height - FIELD.height * scale) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * The lake. A soft gradient from a far, faintly lit shore down into black water, slow wave lines,
   * then the lake's furniture: reed beds at the edges and lily pads across it. No hard edges
   * anywhere, so nothing reads as a misplaced panel.
   */
  function drawWater(state) {
    const water = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    water.addColorStop(0, '#070c17');
    water.addColorStop(0.28, '#0a1324');
    water.addColorStop(0.55, '#070d19');
    water.addColorStop(1, '#03050b');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // The far shore: a wide, soft band of cold light on the water, never a rectangle.
    const shore = ctx.createRadialGradient(FIELD.width * 0.5, -60, 40, FIELD.width * 0.5, -60, FIELD.height * 0.92);
    shore.addColorStop(0, rgba(PALETTE.waterEdge, 0.5));
    shore.addColorStop(0.45, rgba(PALETTE.waterEdge, 0.16));
    shore.addColorStop(1, rgba(PALETTE.waterEdge, 0));
    ctx.fillStyle = shore;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height * 0.72);

    ctx.strokeStyle = rgba(PALETTE.waterEdge, 0.46);
    for (let i = 0; i < 11; i += 1) {
      const y = 74 + i * 62 + Math.sin(state.time * 0.42 + i * 0.9) * 6;
      ctx.lineWidth = i < 4 ? 1.6 : 2.2;
      ctx.beginPath();
      ctx.moveTo(-20, y);
      for (let x = 0; x <= FIELD.width + 20; x += 56) {
        ctx.lineTo(x, y + Math.sin(state.time * 0.62 + i * 1.2 + x * 0.007) * 4.5);
      }
      ctx.stroke();
    }

    for (const d of state.decor) {
      if (d.kind === 'reed') {
        const sway = Math.sin(state.time * 0.9 + d.phase) * 3;
        ctx.strokeStyle = rgba(PALETTE.waterEdge, 0.5);
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(d.x + i * 5, d.y);
          ctx.quadraticCurveTo(d.x + i * 5 + sway * 0.6, d.y - d.h * 0.6, d.x + i * 5 + sway, d.y - d.h);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = rgba(PALETTE.waterEdge, 0.36);
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + Math.sin(state.time * 0.7 + d.phase) * 1.4, d.r, d.r * 0.62, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba(PALETTE.waterEdge, 0.55);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + Math.cos(d.notch) * d.r, d.y + Math.sin(d.notch) * d.r * 0.62);
        ctx.stroke();
      }
    }
  }

  function drawRipples(state) {
    for (let i = 0; i < state.ripples.length; i += 1) {
      const w = state.ripples[i];
      if (!w.active) continue;
      const t = w.life / w.max;
      const colour = w.colour === 'oil' ? PALETTE.oil : w.colour === 'flare' ? PALETTE.lightHot : w.colour === 'bite' ? PALETTE.hull : w.colour === 'kill' ? PALETTE.shadowEye : PALETTE.waterEdge;
      ctx.strokeStyle = rgba(colour, t * 0.7);
      ctx.lineWidth = 1 + t * 2.6;
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, w.r, w.r * 0.78, 0, 0, TAU);
      ctx.stroke();
    }
  }

  /** The reward: a teal glint with a halo, the only cold colour in the game that is good news. */
  function drawOil(state) {
    for (let i = 0; i < state.oil.length; i += 1) {
      const o = state.oil[i];
      if (!o.active) continue;
      const pulse = 0.62 + Math.sin(state.time * 3.1 + o.phase) * 0.38;
      const bob = Math.sin(state.time * 1.9 + o.phase) * 3;
      const halo = ctx.createRadialGradient(o.x, o.y + bob, 2, o.x, o.y + bob, OIL.radius * 4.4);
      halo.addColorStop(0, rgba(PALETTE.oilHot, 0.5 * pulse));
      halo.addColorStop(0.35, rgba(PALETTE.oil, 0.28 * pulse));
      halo.addColorStop(1, rgba(PALETTE.oil, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(o.x, o.y + bob, OIL.radius * 4.4, 0, TAU);
      ctx.fill();
      // a droplet of oil, not a coin: a teardrop with a white core
      ctx.save();
      ctx.translate(o.x, o.y + bob);
      const body = ctx.createLinearGradient(0, -OIL.radius * 1.5, 0, OIL.radius);
      body.addColorStop(0, PALETTE.oilHot);
      body.addColorStop(0.55, PALETTE.oil);
      body.addColorStop(1, '#1f6f5c');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(0, -OIL.radius * 1.6);
      ctx.quadraticCurveTo(OIL.radius * 1.05, -OIL.radius * 0.35, OIL.radius * 0.78, OIL.radius * 0.5);
      ctx.quadraticCurveTo(0, OIL.radius * 1.3, -OIL.radius * 0.78, OIL.radius * 0.5);
      ctx.quadraticCurveTo(-OIL.radius * 1.05, -OIL.radius * 0.35, 0, -OIL.radius * 1.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.5 + pulse * 0.4);
      ctx.beginPath();
      ctx.arc(0, OIL.radius * 0.1, OIL.radius * 0.3, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = rgba(PALETTE.oil, 0.5 * pulse);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(o.x, o.y + bob, OIL.radius * 2.1, 0, TAU);
      ctx.stroke();
    }
  }

  /**
   * A shadow: a hard cold silhouette that keeps its own dark core, so it never reads as a hole in
   * the water, with a rim that brightens as the light burns it and two eyes that always face the
   * boat. A husk is bigger and carries a health arc.
   */
  function drawShadow(state, s, lit) {
    const hurt = 1 - Math.max(0, s.hp) / s.hpMax;
    const wobble = Math.sin(state.time * 2.2 + s.phase) * 0.16;
    const r = s.radius;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.atan2(s.vy, s.vx) + wobble);
    const body = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.7);
    body.addColorStop(0, rgba(PALETTE.shadow, 0.98));
    body.addColorStop(0.55, rgba(PALETTE.shadow, 0.5));
    body.addColorStop(1, rgba(PALETTE.shadow, 0));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.7, r * 1.25, 0, 0, TAU);
    ctx.fill();
    // the body proper: a torn disc with real mass, so it reads as a shape rather than a glowing ring
    ctx.fillStyle = rgba(s.kind === 'husk' ? '#1d2350' : '#1a2048', 0.98);
    ctx.beginPath();
    for (let i = 0; i <= 14; i += 1) {
      const a = (i / 14) * TAU;
      const spike = i % 2 === 0 ? 1 : 0.78;
      const rr = r * spike * (1 + hurt * 0.18);
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr * 1.14, Math.sin(a) * rr * 0.94);
    }
    ctx.closePath();
    ctx.fill();
    // tendrils dragged behind it, the thing that makes it read as a swimmer and not a coin
    ctx.strokeStyle = rgba(PALETTE.shadow, 0.75);
    ctx.lineWidth = Math.max(2, r * 0.2);
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, i * r * 0.4);
      ctx.quadraticCurveTo(-r * 1.7, i * r * 0.7 + Math.sin(state.time * 4 + s.phase + i) * r * 0.3, -r * 2.4, i * r * 0.4);
      ctx.stroke();
    }
    const rim = lit ? 1 : 0.78;
    ctx.strokeStyle = rgba(s.hitFlash > 0 ? PALETTE.lightHot : PALETTE.shadowEye, rim * (0.5 + hurt * 0.5));
    ctx.lineWidth = lit ? 3 : 2.4;
    ctx.stroke();
    ctx.fillStyle = rgba(s.hitFlash > 0 ? PALETTE.lightHot : PALETTE.shadowEye, lit ? 1 : 0.6);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(r * 0.42, side * r * 0.3, Math.max(1.6, r * 0.13), Math.max(1.2, r * 0.08), 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (s.hpMax > 1.2 && s.hp < s.hpMax) {
      ctx.strokeStyle = rgba(PALETTE.light, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + 10, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, s.hp / s.hpMax));
      ctx.stroke();
    }
  }

  /** The lantern's cone, added over the water so what it crosses brightens instead of flattening. */
  function drawBeam(state) {
    const b = state.boat;
    const range = BEAM.range * (b.lit ? 1.06 : 0.94);
    const half = b.lit ? BEAM.halfAngleLit : BEAM.halfAngle;
    const angle = Math.atan2(b.aimY, b.aimX);
    const flicker = 0.9 + Math.sin(state.time * 21) * 0.05 + Math.sin(state.time * 7.3) * 0.05;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(b.x, b.y, 8, b.x, b.y, range);
    glow.addColorStop(0, rgba(PALETTE.lightHot, (b.lit ? 0.55 : 0.32) * flicker));
    glow.addColorStop(0.18, rgba(PALETTE.light, (b.lit ? 0.34 : 0.18) * flicker));
    glow.addColorStop(0.62, rgba(PALETTE.light, (b.lit ? 0.13 : 0.06) * flicker));
    glow.addColorStop(1, rgba(PALETTE.light, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.arc(b.x, b.y, range, angle - half, angle + half);
    ctx.closePath();
    ctx.fill();
    // the pole of light just above the water, so the cone has a spine
    const spine = ctx.createLinearGradient(b.x, b.y, b.x + Math.cos(angle) * range, b.y + Math.sin(angle) * range);
    spine.addColorStop(0, rgba(PALETTE.lightHot, (b.lit ? 0.5 : 0.22) * flicker));
    spine.addColorStop(1, rgba(PALETTE.light, 0));
    ctx.strokeStyle = spine;
    ctx.lineWidth = b.lit ? 7 : 4;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + Math.cos(angle) * range * 0.98, b.y + Math.sin(angle) * range * 0.98);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The keeper's boat: a pointed hull with a lantern hung out over the bow. It is the brightest solid
   * thing on the water and the only shape with a warm rim, so the eye finds it first at any size.
   */
  function drawBoat(state) {
    const b = state.boat;
    const low = b.wick < 0.28;
    const pulse = low ? 0.55 + Math.abs(Math.sin(state.time * 6)) * 0.45 : 1;
    const angle = Math.atan2(b.aimY, b.aimX);
    const halo = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 96 * pulse);
    halo.addColorStop(0, rgba(PALETTE.lightHot, 0.8 * pulse));
    halo.addColorStop(0.22, rgba(PALETTE.light, 0.34 * pulse));
    halo.addColorStop(1, rgba(PALETTE.light, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 96 * pulse, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 40) {
      ctx.strokeStyle = rgba(PALETTE.waterEdge, Math.min(0.85, speed / 380));
      ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-16, side * 10);
        ctx.quadraticCurveTo(-40, side * 20, -68, side * 28);
        ctx.stroke();
      }
    }
    // the hull's own shadow on the water, offset away from the lantern
    ctx.fillStyle = rgba(PALETTE.deep, 0.8);
    ctx.beginPath();
    ctx.ellipse(-6, 8, 54, 20, 0, 0, TAU);
    ctx.fill();
    // hull: a pointed bow, a squared stern, a visible gunwale
    ctx.fillStyle = '#13203a';
    ctx.beginPath();
    ctx.moveTo(58, 0);
    ctx.quadraticCurveTo(28, 25, -29, 21);
    ctx.quadraticCurveTo(-43, 0, -29, -21);
    ctx.quadraticCurveTo(28, -25, 58, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(b.biteFlash > 0 ? PALETTE.hull : PALETTE.lightHot, b.biteFlash > 0 ? 1 : 0.98);
    ctx.lineWidth = 4.2;
    ctx.stroke();
    // the deck, so the hull reads as a shape with an inside rather than a blob
    ctx.fillStyle = rgba(PALETTE.light, 0.26);
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.quadraticCurveTo(22, 14, -22, 13);
    ctx.quadraticCurveTo(-30, 0, -22, -13);
    ctx.quadraticCurveTo(22, -14, 42, 0);
    ctx.closePath();
    ctx.fill();
    // the keeper, hunched at the stern
    ctx.fillStyle = rgba(PALETTE.deep, 0.95);
    ctx.beginPath();
    ctx.arc(-16, 0, 8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(PALETTE.lightHot, 0.95);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(-16, 0, 8, 0, TAU);
    ctx.stroke();
    // the lantern pole, run out over the bow
    ctx.strokeStyle = rgba(PALETTE.light, 0.98);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(60, 0);
    ctx.stroke();
    ctx.restore();
    const lx = b.x + Math.cos(angle) * 64;
    const ly = b.y + Math.sin(angle) * 64;
    ctx.fillStyle = b.lit ? PALETTE.lightHot : PALETTE.light;
    ctx.beginPath();
    ctx.arc(lx, ly, 11 * (0.72 + pulse * 0.28), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(PALETTE.lightHot, 0.9);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(lx, ly, 19 * (0.8 + pulse * 0.2), 0, TAU);
    ctx.stroke();
  }

  /** The flare, at the moment it goes off: a shockwave ring, a white core and thrown shards. */
  function drawFlare(state) {
    if (state.flareT <= 0) return;
    const b = state.boat;
    const t = 1 - Math.min(1, state.flareT / 0.42);
    const radius = 46 + t * (FLARE.radius - 46);
    const heat = 1 - t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // the whole lake jumps: a broad pop behind everything else
    const flash = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, FIELD.width * 0.72);
    flash.addColorStop(0, rgba(PALETTE.lightHot, heat * 0.3));
    flash.addColorStop(0.5, rgba(PALETTE.light, heat * 0.12));
    flash.addColorStop(1, rgba(PALETTE.light, 0));
    ctx.fillStyle = flash;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // the fireball: a white core that cools as it grows
    const core = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, radius * 0.9);
    core.addColorStop(0, rgba('#ffffff', heat * 0.95));
    core.addColorStop(0.25, rgba(PALETTE.lightHot, heat * 0.85));
    core.addColorStop(0.62, rgba(PALETTE.light, heat * 0.45));
    core.addColorStop(1, rgba(PALETTE.light, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(b.x, b.y, radius * 0.9, 0, TAU);
    ctx.fill();
    // two shockwave rings, the outer one thin and fast
    for (const [scale, width, alpha] of [[1, 10, 0.95], [0.66, 5, 0.7]]) {
      ctx.strokeStyle = rgba(PALETTE.lightHot, heat * alpha);
      ctx.lineWidth = width * (0.35 + heat * 0.65);
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, radius * scale, radius * scale * 0.9, 0, 0, TAU);
      ctx.stroke();
    }
    // debris: wedges thrown outward, each a sliver of light
    ctx.fillStyle = rgba(PALETTE.lightHot, heat * 0.9);
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * TAU + t * 0.7;
      const inner = radius * (0.92 + (i % 3) * 0.05);
      const outer = inner + radius * (0.16 + (i % 4) * 0.06);
      const spread = 0.035 + (i % 3) * 0.012;
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(a) * inner, b.y + Math.sin(a) * inner);
      ctx.lineTo(b.x + Math.cos(a - spread) * outer, b.y + Math.sin(a - spread) * outer);
      ctx.lineTo(b.x + Math.cos(a + spread) * outer, b.y + Math.sin(a + spread) * outer);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSparks(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < state.sparks.length; i += 1) {
      const p = state.sparks[i];
      if (!p.active) continue;
      const t = Math.max(0, p.life / p.max);
      const colour = p.colour === 'oil' ? PALETTE.oilHot : p.colour === 'bite' ? PALETTE.hull : p.colour === 'kill' ? PALETTE.shadowEye : p.colour === 'flare' ? PALETTE.lightHot : PALETTE.light;
      ctx.fillStyle = rgba(colour, t * 0.95);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + t), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The hurt vignette: red only ever means the wick was bitten. */
  function drawHurt(state) {
    if (state.boat.biteFlash <= 0) return;
    const glow = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.3, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.78);
    glow.addColorStop(0, rgba(PALETTE.hull, 0));
    glow.addColorStop(1, rgba(PALETTE.hull, 0.45 * state.boat.biteFlash));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function label(text, x, y, size, colour, align = 'left', weight = '600') {
    ctx.fillStyle = colour;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }

  /**
   * The HUD. Four answers only: how much light is left, what the run is worth, how deep into the
   * lake this is, and whether the flare is up. A scrim across the top keeps shadows from fighting
   * the numbers.
   */
  function drawHud(state) {
    const pad = 26;
    const scrim = ctx.createLinearGradient(0, 0, 0, 150);
    scrim.addColorStop(0, rgba(PALETTE.deep, 0.82));
    scrim.addColorStop(1, rgba(PALETTE.deep, 0));
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, FIELD.width, 150);

    const wick = Math.max(0, state.boat.wick);
    const low = wick < 0.28;
    ctx.fillStyle = rgba(PALETTE.panel, 0.8);
    ctx.beginPath();
    ctx.roundRect(pad, pad, 430, 78, 12);
    ctx.fill();
    label('WICK', pad + 18, pad + 27, 17, low ? PALETTE.hull : PALETTE.muted);
    ctx.fillStyle = rgba(PALETTE.deep, 0.92);
    ctx.beginPath();
    ctx.roundRect(pad + 18, pad + 38, 394, 24, 12);
    ctx.fill();
    const fill = low ? PALETTE.hull : PALETTE.light;
    const bar = ctx.createLinearGradient(pad + 18, 0, pad + 18 + 394, 0);
    bar.addColorStop(0, fill);
    bar.addColorStop(1, low ? PALETTE.hull : PALETTE.lightHot);
    ctx.fillStyle = bar;
    ctx.beginPath();
    ctx.roundRect(pad + 18, pad + 38, Math.max(4, 394 * wick), 24, 12);
    ctx.fill();
    ctx.strokeStyle = rgba(PALETTE.lightHot, 0.45);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pad + 18, pad + 38, 394, 24, 12);
    ctx.stroke();
    if (low) label('LOW — FIND OIL', pad + 412, pad + 56, 15, PALETTE.hull, 'right');

    label('SCORE', FIELD.width - pad - 296, pad + 25, 15, PALETTE.muted);
    label(String(state.score), FIELD.width - pad - 296, pad + 62, 36, PALETTE.text, 'left', '700');
    label('WAVE', FIELD.width - pad - 168, pad + 25, 15, PALETTE.muted);
    label(String(state.wave), FIELD.width - pad - 168, pad + 62, 36, PALETTE.text, 'left', '700');
    const waveLeft = Math.max(0, state.waveLeft / WAVE.seconds);
    ctx.fillStyle = rgba(PALETTE.shadow, 0.8);
    ctx.beginPath();
    ctx.roundRect(FIELD.width - pad - 168, pad + 72, 140, 6, 3);
    ctx.fill();
    ctx.fillStyle = rgba(PALETTE.shadowEye, 0.95);
    ctx.beginPath();
    ctx.roundRect(FIELD.width - pad - 168, pad + 72, 140 * waveLeft, 6, 3);
    ctx.fill();

    for (let i = 0; i < 3; i += 1) {
      const x = FIELD.width - pad - 74 + i * 26;
      const up = i < state.flareCharges;
      ctx.fillStyle = up ? rgba(PALETTE.lightHot, 0.95) : rgba(PALETTE.muted, 0.25);
      ctx.beginPath();
      ctx.arc(x, pad + 34, 8, 0, TAU);
      ctx.fill();
      if (up) {
        ctx.strokeStyle = rgba(PALETTE.light, 0.75);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, pad + 34, 12, 0, TAU);
        ctx.stroke();
      }
    }
    label('FLARE  ·  E', FIELD.width - pad - 2, pad + 68, 14, PALETTE.muted, 'right');
  }

  function drawTitle(state, best) {
    ctx.fillStyle = rgba(PALETTE.deep, 0.78);
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const cx = FIELD.width / 2;
    label('LANTERNLAKE', cx, 196, 96, PALETTE.lightHot, 'center', '800');
    label('your light is your life, and the dark is hungry', cx, 246, 25, '#a9b6d4', 'center', '500');
    ctx.fillStyle = rgba(PALETTE.panel, 0.82);
    ctx.beginPath();
    ctx.roundRect(cx - 330, 292, 660, 210, 14);
    ctx.fill();
    const lines = [
      ['W A S D', 'row the boat'],
      ['MOUSE', 'swing the lantern'],
      ['HOLD LEFT MOUSE', 'open the shutter: burns shadows fast, and the wick with it'],
      ['E', 'flare: one blast, paid for in light'],
    ];
    for (let i = 0; i < lines.length; i += 1) {
      label(lines[i][0], cx - 300, 336 + i * 44, 20, PALETTE.light, 'left', '700');
      label(lines[i][1], cx - 150, 336 + i * 44, 20, PALETTE.text, 'left', '500');
    }
    label('Collect the teal oil to feed the wick. A shadow that reaches you bites it.', cx, 552, 21, PALETTE.oil, 'center', '600');
    const pulse = 0.6 + Math.abs(Math.sin(state.time * 2.4)) * 0.4;
    label('PRESS SPACE OR CLICK TO SET OUT', cx, 620, 28, rgba(PALETTE.light, pulse), 'center', '700');
    if (best > 0) label(`BEST  ${best}`, cx, 664, 20, PALETTE.muted, 'center', '600');
  }

  function drawPaused(state) {
    ctx.fillStyle = rgba(PALETTE.deep, 0.7);
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    label('PAUSED', FIELD.width / 2, FIELD.height / 2 - 8, 70, PALETTE.text, 'center', '700');
    label('ESC or P to row on', FIELD.width / 2, FIELD.height / 2 + 46, 25, PALETTE.muted, 'center', '500');
    drawHud(state);
  }

  /** The results screen: the run summed up, and the way back in, on one frame. */
  function drawOver(state, best) {
    ctx.fillStyle = rgba(PALETTE.deep, 0.84);
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const cx = FIELD.width / 2;
    label('THE LIGHT WENT OUT', cx, 158, 68, PALETTE.hull, 'center', '800');
    label(state.reason, cx, 196, 22, '#a9b6d4', 'center', '500');
    ctx.fillStyle = rgba(PALETTE.panel, 0.9);
    ctx.beginPath();
    ctx.roundRect(cx - 310, 240, 620, 200, 14);
    ctx.fill();
    const rows = [
      ['SCORE', String(state.score)],
      ['SHADOWS BANISHED', String(state.killed)],
      ['WAVES HELD', String(Math.max(1, state.wave))],
      ['OIL RESCUED', String(state.rescued)],
    ];
    for (let i = 0; i < rows.length; i += 1) {
      label(rows[i][0], cx - 272, 292 + i * 42, 19, PALETTE.muted, 'left', '600');
      label(rows[i][1], cx + 272, 292 + i * 42, 26, PALETTE.text, 'right', '700');
    }
    label(`BEST  ${Math.max(best, state.score)}`, cx, 490, 24, PALETTE.oil, 'center', '700');
    const pulse = 0.6 + Math.abs(Math.sin(state.time * 2.4)) * 0.4;
    label('SPACE or CLICK to row again', cx, 566, 28, rgba(PALETTE.light, pulse), 'center', '700');
    label('ESC to the title', cx, 606, 19, PALETTE.muted, 'center', '500');
  }

  /** Whether a shadow currently stands in the cone: the renderer only needs it to pick a rim. */
  function inBeam(b, s) {
    const dx = s.x - b.x;
    const dy = s.y - b.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance > BEAM.range) return false;
    const dot = (dx / distance) * b.aimX + (dy / distance) * b.aimY;
    return dot >= Math.cos(b.lit ? BEAM.halfAngleLit : BEAM.halfAngle);
  }

  function draw(state, screen, best) {
    resize();
    ctx.save();
    const shakeX = Math.sin(state.time * 57) * state.shake * 7;
    const shakeY = Math.cos(state.time * 61) * state.shake * 7;
    ctx.translate(offsetX + shakeX * scale, offsetY + shakeY * scale);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, FIELD.width, FIELD.height);
    ctx.clip();
    drawWater(state);
    drawRipples(state);
    drawOil(state);
    const b = state.boat;
    for (let i = 0; i < state.shadows.length; i += 1) {
      const s = state.shadows[i];
      if (!s.active || s.kind === 'husk') continue;
      drawShadow(state, s, inBeam(b, s));
    }
    for (let i = 0; i < state.shadows.length; i += 1) {
      const s = state.shadows[i];
      if (!s.active || s.kind !== 'husk') continue;
      drawShadow(state, s, inBeam(b, s));
    }
    drawBeam(state);
    drawFlare(state);
    drawSparks(state);
    drawBoat(state);
    drawHurt(state);
    if (screen === SCREEN_PLAY) drawHud(state);
    else if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused(state);
    else if (screen === SCREEN_OVER) drawOver(state, best);
    ctx.restore();
  }

  return { draw, resize };
}