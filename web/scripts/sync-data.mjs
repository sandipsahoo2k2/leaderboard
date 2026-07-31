/**
 * Copies the harness output into the Angular app's static assets.
 *
 * data/latest.json is the contract between the two halves of this repo: the
 * harness writes it, the UI reads it, and nothing else crosses the boundary.
 * Runs automatically before `npm start` and `npm run build`.
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../data/latest.json');
const target = resolve(here, '../public/data/latest.json');

mkdirSync(dirname(target), { recursive: true });

if (existsSync(source)) {
  copyFileSync(source, target);
  console.log(`sync-data: copied ${source}`);
} else {
  // An empty board still builds and deploys — it just says "no runs yet".
  writeFileSync(target, JSON.stringify({ generatedAt: null, entries: [] }, null, 2));
  console.warn(`sync-data: ${source} missing, wrote an empty snapshot instead.`);
  console.warn('sync-data: run `npm run bench -- validate` in ../harness to populate it.');
}
