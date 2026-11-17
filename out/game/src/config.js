// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area; the
// renderer scales it to the window, so no rule below depends on the screen size.
//
// The palette gives every colour one gameplay role, so the screen is readable without reading it:
//   light   the keeper's wick: light, life and weapon at once
//   shadow  the danger: things that live outside the light
//   oil     the reward: what a brave row out into the dark buys
//   hull    the damage flash, used only when the wick is bitten
//   text    what a number means, never a game object

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const BOAT = {
  radius: 17,
  accel: 1500,
  drag: 3.1,
  turn: 7,
  wickMax: 1,
  wickStart: 0.72,
  /** The wick always burns, faster with the shutter open: the clock is the pressure. */
  drainIdle: 0.012,
  drainLit: 0.052,
  /** Each shadow inside the beam costs the wick extra, so a crowd is a real threat. */
  drainPerShadow: 0.011,
  /** A shadow that reaches the boat bites the wick: letting one through is the loss condition. */
  biteWick: 0.085,
};

/** The lantern's cone. Aim is the mouse; the shutter is the left button. */
export const BEAM = {
  range: 470,
  halfAngle: 0.30,
  halfAngleLit: 0.40,
  /** Damage a second to a shadow standing in the cone, dim and lit. */
  dpsDim: 0.85,
  dpsLit: 3.1,
  /** How hard the light shoves a shadow away, in pixels a second. */
  pushDim: 74,
  pushLit: 210,
};

export const FLARE = {
  radius: 300,
  damage: 2.4,
  push: 620,
  wickCost: 0.16,
  chargesPerWave: 1,
  maxCharges: 3,
};

/** Shadow kinds. `hp` is light-damage taken, not hits: a husk drinks a sustained beam. */
export const SHADOW = {
  drifter: { hp: 1.0, speed: 46, accel: 120, radius: 15, score: 10, bite: true },
  lurker: { hp: 0.8, speed: 88, accel: 260, radius: 12, score: 16, bite: true },
  husk: { hp: 3.4, speed: 30, accel: 70, radius: 27, score: 40, bite: true },
};

export const OIL = { radius: 12, spawnEvery: 6.2, warm: 0.34, drift: 16, score: 4 };

/** A wave lasts this long; the next brings more, faster, tougher shadows. */
export const WAVE = { seconds: 22, first: 4, growth: 2, speedPerWave: 0.05, hpPerWave: 0.14, maxLive: 60 };

/** How many things can exist at once; the pools are allocated once, at boot. */
export const POOL = { shadows: 96, oil: 24, spark: 260, ripple: 40 };

export const PALETTE = {
  deep: '#05070e',
  water: '#0b1220',
  waterEdge: '#16233c',
  light: '#ffb454',
  lightHot: '#ffe6b0',
  lightFaint: '#7a5227',
  shadow: '#6f7fd6',
  shadowEye: '#c3ccff',
  oil: '#4fd1a5',
  oilHot: '#d8fff0',
  hull: '#ff5d6c',
  panel: '#0e1729',
  text: '#e8eefc',
  muted: '#7b88a8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lanternlake.best';
