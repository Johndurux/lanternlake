// Boot and the one loop: the world advances in fixed 1/60 s steps (several in a slow frame, none in
// a fast one), input is read once a frame, and the renderer paints whatever is there. The game
// moves between four screens: title, play, paused and over.
//
// ?seed=N fixes the lake. ?shot=start|play|flare|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot to take.
import { BEST_KEY, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_FLARE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EVENT_BITE, EVENT_FLARE, EVENT_KILL, EVENT_OIL, EVENT_OVER, EVENT_WAVE, createWorld } from './world.js';
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

/** Stage a scene for a screenshot and paint it until the frame is settled, twice over. */
function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
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

  /** Screen readers (and anyone reading the page's text) hear the screen changes and each bite. */
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.ambience();
    audio.play('start');
    announce('Rowing. Keep the wick fed.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.play('over');
    announce(`The light went out. Score ${world.state.score}. Best ${best}. Press Space to row again.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Rowing.');
    }
  }

  /** Sound only, never rules: the events the world reported this step. */
  function voice(events) {
    if (events & EVENT_KILL) audio.play('kill');
    if (events & EVENT_OIL) audio.play('oil');
    if (events & EVENT_BITE) audio.play('bite');
    if (events & EVENT_FLARE) audio.play('flare');
    if (events & EVENT_WAVE) audio.play('wave');
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, {}, true);
      return;
    }
    const events = world.step(STEP, input.take(), false);
    voice(events);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_BITE) announce(world.state.boat.wick < 0.3 ? 'Bitten. The wick is low.' : 'Bitten. A shadow reached the lantern.');
    else if (events & EVENT_WAVE) announce(`Wave ${world.state.wave}. More coming.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let guard = 8;
      while (accumulator >= STEP && guard > 0 && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
        guard -= 1;
      }
      if (accumulator > STEP * 8) accumulator = 0;
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a run rather than letting the lake move on unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lanternlake. Press Space or click to set out. Row with W and A and S and D, aim the lantern with the mouse.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
