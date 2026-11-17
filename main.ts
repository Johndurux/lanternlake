// Lanternlake's hand-in program (Node 22, standard library only).
//
// The game itself is the static folder beside this file: game/index.html and the ES modules it
// loads. Nothing here plays the game, builds it or bundles it — a browser opens index.html and the
// game runs. This program's whole job is to lay the entry out the way the grader reads it:
//
//   /output/game/          the playable files, copied as they sit in the repository
//   /output/screenshots/   the four frames the judge is shown first
//   /output/dossier.json   the judge's view: the contact sheet plus the source outline
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output, so the same command builds the same
// layout on a laptop:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** Where the entry is assembled: /output in the grader, out/ on this machine. */
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** This file's own folder: the repository root, whatever it is called. */
const repoDir = fileURLToPath(new URL('.', import.meta.url));

/**
 * The scorer's limits, mirrored from reference/gate.json. Only text_max_bytes changes what gets
 * written (it truncates the source text); the rest are here so a layout the scorer would refuse is
 * refused now, loudly, instead of at submission.
 */
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/**
 * Copy one folder into the output. `cpSync` keeps the tree exactly as committed — the gate compares
 * the dossier's file list against the files themselves, so nothing may be renamed, minified or
 * filtered on the way through.
 */
function place(name) {
  const from = join(repoDir, name);
  if (!existsSync(from)) return false;
  cpSync(from, join(outputDir, name), { recursive: true });
  return true;
}

function main() {
  mkdirSync(outputDir, { recursive: true });

  if (!place('game')) {
    throw new Error('game/ is missing: the playable files belong beside main.ts');
  }
  if (!place('screenshots')) {
    throw new Error('screenshots/ is missing: the judge reads the game through its screenshots');
  }

  // The dossier is written by the kit's own library, never by hand: the gate rebuilds it with the
  // same library and compares the two byte for byte.
  const dossier = buildDossier(outputDir, DOSSIER_LIMITS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);

  const kilobytes = (bytes) => `${Math.round(bytes / 1024)} KiB`;
  process.stdout.write(
    `lanternlake: game and ${'screenshots'} placed under ${outputDir}, dossier ${kilobytes(Buffer.byteLength(dossier))}\n`,
  );
}

main();