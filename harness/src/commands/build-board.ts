/**
 * Shared body of `bench validate` and `bench run`: measure, pull the reference,
 * merge the two keeping provenance, write data/latest.json.
 *
 * The only difference between the two commands is how many trials they buy and
 * whether they print the divergence table, so both live off this.
 */

import { artificialAnalysisRow, compareEntry, measuredRow, buildSnapshot } from '../merge.ts';
import { saveSnapshot } from '../store.ts';
import { fmt, heading, table } from '../report.ts';
import type { LeaderboardSnapshot, SourcedRow } from '../types.ts';
import { probe } from './probe.ts';
import { syncAa } from './sync-aa.ts';

export interface BuildBoardOptions {
  models?: string[];
  trials: number;
  warmup: boolean;
  refresh?: boolean;
  compare: boolean;
}

export async function buildBoard(opts: BuildBoardOptions): Promise<LeaderboardSnapshot> {
  const { perfByModel } = await probe({
    models: opts.models,
    trials: opts.trials,
    warmup: opts.warmup,
  });

  // AA is optional: without a key we still ship a Measured-only board.
  let aaByModelKey = new Map<string, import('../clients/artificial-analysis.ts').AaModel>();
  let fetchedAt = new Date().toISOString();
  try {
    const sync = await syncAa({ models: opts.models, refresh: opts.refresh });
    aaByModelKey = sync.aaByModelKey;
    fetchedAt = sync.fetchedAt;
  } catch (err) {
    console.warn(`\n  ! Skipping Artificial Analysis: ${(err as Error).message}`);
  }

  const { loadConfig, selectModels } = await import('../config.ts');
  const models = selectModels(loadConfig(), opts.models);

  const rowsByModel = new Map<string, SourcedRow[]>();
  for (const model of models) {
    const rows: SourcedRow[] = [];
    const perf = perfByModel.get(model.key);
    if (perf) rows.push(measuredRow(model, perf));
    const aa = aaByModelKey.get(model.key);
    if (aa) rows.push(artificialAnalysisRow(model, aa, fetchedAt));
    rowsByModel.set(model.key, rows);
  }

  const snapshot = buildSnapshot(models, rowsByModel);

  if (opts.compare) printDivergence(snapshot);

  const paths = saveSnapshot(snapshot);
  console.log(heading('Written'));
  console.log(`  ${paths.latest}`);
  console.log(`  ${paths.run}`);
  return snapshot;
}

/**
 * Measured vs AA. A big delta on TTFT is expected (different network vantage
 * point, different provider routing); a big delta on tokens/sec usually means
 * our maths or our sampling is wrong.
 */
function printDivergence(snapshot: LeaderboardSnapshot): void {
  console.log(heading('Compare: measured vs Artificial Analysis'));

  const rows = snapshot.entries.flatMap((entry) =>
    compareEntry(entry).map((d) => [
      entry.label,
      d.field === 'outputTokensPerSecond' ? 'tok/s' : 'TTFT s',
      fmt(d.measured, 2),
      fmt(d.reference, 2),
      d.deltaPercent === null ? '--' : `${d.deltaPercent > 0 ? '+' : ''}${d.deltaPercent.toFixed(0)}%`,
      d.status,
    ]),
  );

  console.log(table(['Model', 'Metric', 'Measured', 'AA', 'Delta', 'Status'], rows));
  console.log(
    '\n  ok = within 15% of the reference. diverged = worth a look. missing = one side had no number.',
  );
}
