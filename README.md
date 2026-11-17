# Lanternlake

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Johndurux/lanternlake/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Johndurux/lanternlake/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Your light is your life, and the dark is hungry.**

A small boat on a night lake. Your lantern is the only warm thing on the water, and it is three
things at once: it shows you the lake, it burns the shadows that live outside it, and it is the
only life you have. The wick burns down on its own, faster with the shutter open and faster still
with a shadow in the beam. Teal oil floats out there in the dark; row out and take it, or the light
goes out where you sit.

An entry in make.fun's [“Make the best game”](https://make.fun/bounty/best-game-01) bounty.

## Play it

```
node serve.ts
```

Then open <http://localhost:8080>. Desktop Chrome, keyboard and mouse, no build step and no network
request: the game is static files, ES modules and canvas.

| | |
|---|---|
| **W A S D** | row the boat |
| **Mouse** | swing the lantern |
| **Hold left mouse** | open the shutter: burns shadows fast, and the wick with it |
| **E** | flare: one blast, paid for in light |
| **Space / click** | set out, and row again after the light goes out |
| **Esc / P** | pause |

Shadows close in from every side. A shadow that reaches the boat bites the wick, so the thing you
are spending to kill them is the thing they take from you. Waves bring more of them, faster and
tougher, and each wave hands back one flare.

## How it is built

The rules live in one place and nothing reads the clock or the screen, so a seed and a set of
inputs always produce the same lake — which is what makes the screenshots and any replay line up
frame for frame.

| file | what it does |
|---|---|
| `game/src/config.js` | every tuning number and colour, each colour given a gameplay role |
| `game/src/world.js` | the simulation: boat, lantern cone, shadows, oil, waves, events |
| `game/src/render.js` | all drawing, and the four screens |
| `game/src/input.js` | keys, pointer, and the one-off actions |
| `game/src/audio.js` | the sound, synthesised at run time with Web Audio; no files |
| `game/src/shots.js` | the staged scenes behind `?shot=start\|play\|flare\|end` |
| `game/src/random.js` | seeded RNG |
| `game/src/main.js` | boot, the fixed-step loop, and the screen changes |
| `main.ts` | the hand-in program: lays the entry out and writes the dossier |

The screenshots are real renders of the game's own code, taken from the staged scenes with a
headless browser: a title screen, play in progress with the HUD, the flare going off, and the
results screen.

`vendor/makefun-game.ts` is the kit's library, unchanged.

## Hand it in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes `out/game/`, `out/screenshots/` and `out/dossier.json` — the same layout the grader
reads.

## Licence

MIT. See `LICENSE`.