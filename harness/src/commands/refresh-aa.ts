/**
 * `bench refresh-aa` — repoint the board at fresh Artificial Analysis data
 * without re-measuring anything.
 *
 * This is the command the hourly schedule runs. It makes at most one AA
 * request and zero OpenRouter requests, so it is free to run often. Measured
 * rows are carried over untouched from the previous snapshot; only the
 * reference side is replaced.
 */

import { loadConfig, selectModels } from '../config.ts';
import { artificialAnalysisRow, buildSnapshot } from '../merge.ts';
import { loadLatest, saveSnapshot } from '../store.ts';
import { heading } from '../report.ts';
import type { LeaderboardSnapshot, SourcedRow } from '../types.ts';
import { syncAa } from './sync-aa.ts';

export interface RefreshOptions {
  models?: string[];
  refresh?: boolean;
}

export async function refreshAa(opts: RefreshOptions = {}): Promise<LeaderboardSnapshot> {
  const models = selectModels(loadConfig(), opts.models);
  const { aaByModelKey, fetchedAt } = await syncAa({ models: opts.models, refresh: opts.refresh });

  // Keep whatever we measured last time. Losing it would blank the Measured
  // tab every hour, which is worse than letting it age.
  const previous = loadLatest();
  const previousMeasured = new Map<string, SourcedRow>();
  for (const entry of previous?.entries ?? []) {
    const row = entry.bySource['measured'];
    if (row) previousMeasured.set(entry.modelKey, row);
  }

  const rowsByModel = new Map<string, SourcedRow[]>();
  for (const model of models) {
    const rows: SourcedRow[] = [];
    const carried = previousMeasured.get(model.key);
    if (carried) rows.push(carried);
    const aa = aaByModelKey.get(model.key);
    if (aa) rows.push(artificialAnalysisRow(model, aa, fetchedAt));
    rowsByModel.set(model.key, rows);
  }

  const snapshot = buildSnapshot(models, rowsByModel);
  const paths = saveSnapshot(snapshot);

  console.log(heading('Written'));
  console.log(`  ${paths.latest}`);
  console.log(
    `  measured rows carried over: ${previousMeasured.size}` +
      (previous ? ` (from ${previous.generatedAt})` : ' (no previous snapshot)'),
  );
  return snapshot;
}
