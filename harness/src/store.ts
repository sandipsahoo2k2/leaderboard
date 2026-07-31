/** All disk writes for run output live here, so paths are defined once. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { REPO_ROOT } from './config.ts';
import type { LeaderboardSnapshot } from './types.ts';

/** What the web app fetches. The only file the UI knows about. */
export const LATEST_PATH = resolve(REPO_ROOT, 'data/latest.json');
const RUNS_DIR = resolve(REPO_ROOT, 'data/runs');

export function saveSnapshot(snapshot: LeaderboardSnapshot): { latest: string; run: string } {
  const runId = snapshot.generatedAt.replace(/[:.]/g, '-');
  const runPath = resolve(RUNS_DIR, `${runId}.json`);
  writeJson(runPath, snapshot);
  writeJson(LATEST_PATH, snapshot);
  return { latest: LATEST_PATH, run: runPath };
}

export function loadLatest(): LeaderboardSnapshot | null {
  if (!existsSync(LATEST_PATH)) return null;
  return JSON.parse(readFileSync(LATEST_PATH, 'utf8')) as LeaderboardSnapshot;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}
