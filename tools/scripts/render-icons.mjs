#!/usr/bin/env node
/**
 * Renders the app's icon (`apps/shell/public/icon.svg`) to the PNG sizes a
 * home screen needs, into `apps/shell/public/icons/`.
 *
 *   node tools/scripts/render-icons.mjs
 *
 * The PNGs are committed, so a normal build needs no image tooling; run
 * this again after changing the SVG. It uses macOS's own `sips`, which is
 * always there — no image library in the dependency tree for four files
 * that change once a year.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const SOURCE = join('apps', 'shell', 'public', 'icon.svg');
const TARGET = join('apps', 'shell', 'public', 'icons');

/** Why each size exists, so nobody deletes one as "duplicate". */
const SIZES = [
  {
    file: 'icon-192.png',
    size: 192,
    why: 'the smallest a manifest must offer',
  },
  {
    file: 'icon-512.png',
    size: 512,
    why: 'install dialogs and splash screens',
  },
  {
    file: 'icon-maskable-512.png',
    size: 512,
    why: 'Android may crop it to a circle; the drawing keeps clear of the edge',
  },
  { file: 'apple-touch-icon.png', size: 180, why: "iOS's home screen" },
];

async function main() {
  await rm(TARGET, { recursive: true, force: true });
  await mkdir(TARGET, { recursive: true });

  for (const { file, size, why } of SIZES) {
    const out = join(TARGET, file);
    execFileSync('sips', [
      '-s',
      'format',
      'png',
      '-z',
      String(size),
      String(size),
      SOURCE,
      '--out',
      out,
    ]);
    console.log(`${out} — ${size}px, ${why}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
