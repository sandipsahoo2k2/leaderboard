/**
 * Pure comparison logic, shared by the harness (which prints it to a terminal)
 * and the Angular app (which renders it in the Compare tab). One definition of
 * "diverged", so the CLI and the UI can never disagree.
 */

import type { Divergence, LeaderboardEntry, Metric, MetricSource, SourcedRow } from './leaderboard-types.ts';

/** Measured and reference numbers further apart than this get flagged. */
export const DIVERGENCE_THRESHOLD_PERCENT = 15;

/** Fields both sources report — the only ones that can be compared. */
export const COMPARABLE_FIELDS = [
  'outputTokensPerSecond',
  'timeToFirstTokenSeconds',
] as const satisfies ReadonlyArray<keyof SourcedRow>;

export type ComparableField = (typeof COMPARABLE_FIELDS)[number];

/** Safely digs a numeric metric out of a row, whatever the field. */
export function metricValue(
  row: SourcedRow | undefined,
  field: keyof SourcedRow,
): number | null {
  const cell = row?.[field] as Metric | null | undefined;
  return cell?.value ?? null;
}

export function metricAt(
  entry: LeaderboardEntry,
  source: MetricSource,
  field: keyof SourcedRow,
): Metric | null {
  return (entry.bySource[source]?.[field] as Metric | null | undefined) ?? null;
}

export function compareEntry(entry: LeaderboardEntry): Divergence[] {
  const measured = entry.bySource['measured'];
  const reference = entry.bySource['artificial-analysis'];

  return COMPARABLE_FIELDS.map((field) => {
    const m = metricValue(measured, field);
    const r = metricValue(reference, field);

    if (m === null || r === null || r === 0) {
      return { modelKey: entry.modelKey, field, measured: m, reference: r, deltaPercent: null, status: 'missing' };
    }
    const deltaPercent = ((m - r) / r) * 100;
    return {
      modelKey: entry.modelKey,
      field,
      measured: m,
      reference: r,
      deltaPercent,
      status: Math.abs(deltaPercent) > DIVERGENCE_THRESHOLD_PERCENT ? 'diverged' : 'ok',
    };
  });
}
