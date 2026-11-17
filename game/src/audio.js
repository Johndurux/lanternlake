// Every sound the game makes, synthesised at run time with the Web Audio API: no files, no
// requests, nothing to download. The cues are short and each one answers an event the player just
// caused, which is what makes a hit feel like a hit.
//
// Browsers hold audio until the player interacts, so the context starts suspended and the first
// click or keypress resumes it. A browser that refuses audio entirely leaves the game silent and
// otherwise untouched.

const CUES = {
  kill: { type: 'sawtooth', from: 620, to: 180, seconds: 0.18, gain: 0.16 },
  bite: { type: 'square', from: 180, to: 62, seconds: 0.34, gain: 0.2 },
  oil: { type: 'triangle', from: 520, to: 1240, seconds: 0.22, gain: 0.15 },
  flare: { type: 'sawtooth', from: 90, to: 900, seconds: 0.5, gain: 0.2 },
  wave: { type: 'triangle', from: 260, to: 520, seconds: 0.7, gain: 0.14 },
  start: { type: 'triangle', from: 300, to: 760, seconds: 0.4, gain: 0.16 },
  over: { type: 'sawtooth', from: 300, to: 48, seconds: 1.1, gain: 0.22 },
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let enabled = true;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        enabled = false;
        return null;
      }
      try {
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      } catch {
        enabled = false;
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /** One short tone with a falling or rising pitch: the whole sound design, in six lines. */
  function play(name) {
    const cue = CUES[name];
    const audio = cue ? ensure() : null;
    if (!audio) return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = cue.type;
    osc.frequency.setValueAtTime(cue.from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, cue.to), now + cue.seconds);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(cue.gain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + cue.seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + cue.seconds + 0.02);
  }

  /** The low bed the lake sits on: one quiet pair of detuned tones, started once. */
  function ambience() {
    const audio = ensure();
    if (!audio || audio.__bed) return;
    audio.__bed = true;
    for (const [detune, gainValue] of [[0, 0.05], [7, 0.035]]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = 55;
      osc.detune.value = detune;
      gain.gain.value = gainValue;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
    }
  }

  return { play, ambience };
}
