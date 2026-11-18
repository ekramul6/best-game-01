// NEON SWARM — a best-game-01 entry (Node 22, standard library only): the
// game is this directory's game/ folder, plain static files a desktop browser
// loads offline (game/index.html and its ES modules, no library and no
// network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// Neon Swarm is a top-down neon arena shooter: WASD to fly, mouse to aim,
// click or Space to shoot, three enemy kinds (drifter, spitter, brute),
// escalating waves, spread-shot and hull pickups, particles, screen shake
// and WebAudio sound, a title screen with the game playing behind it, pause,
// game over with stats and restart, and the best score in localStorage.
// Put 3 screenshots in screenshots/ (the first by name is the cover) and run:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve it locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Read back what was copied and refuse to hand in a mismatch: every file
// under game/ and screenshots/ must exist in /output with the same size and
// the same bytes as the source. A silent partial copy would be worse than a
// loud failure, so any difference exits non-zero before the dossier is written.
function verifyTree(sourceDir, destDir) {
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    const dest = join(destDir, entry.name);
    if (entry.isDirectory()) {
      verifyTree(source, dest);
    } else if (entry.isFile()) {
      const sourceStat = statSync(source);
      const destStat = statSync(dest);
      if (sourceStat.size !== destStat.size || !readFileSync(source).equals(readFileSync(dest))) {
        throw new Error(`copy mismatch: ${dest} does not match ${source}`);
      }
    }
  }
}
verifyTree(join(here, 'game'), join(out, 'game'));
if (existsSync(join(here, 'screenshots'))) verifyTree(join(here, 'screenshots'), join(out, 'screenshots'));

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
