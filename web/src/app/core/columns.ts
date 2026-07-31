/**
 * The single place that decides what appears on the board.
 *
 * Add a metric to the leaderboard = add one entry here. The table, the ranking
 * cards, the sort controls and the scatter axes all read from this list, so
 * nothing else needs touching.
 */

import type { PerfFields, ScoreFields } from '@shared/leaderboard-types';

export type MetricKey = keyof ScoreFields | keyof PerfFields;

export interface ColumnDef {
  key: MetricKey;
  /** Full name, used in tooltips and the scatter axis. */
  label: string;
  /** Column heading. Keep it short — these are narrow columns. */
  short: string;
  digits: number;
  /** Which direction is good. Drives sort default and the ranking cards. */
  higherIsBetter: boolean;
  unit?: string;
}

/** Quality scores, all normalised to 0-100. Currently sourced from AA only. */
export const SCORE_COLUMNS: readonly ColumnDef[] = [
  { key: 'intelligenceIndex', label: 'Intelligence Index', short: 'Intelligence', digits: 1, higherIsBetter: true },
  { key: 'codingIndex', label: 'Coding Index', short: 'Coding', digits: 1, higherIsBetter: true },
  { key: 'mathIndex', label: 'Math Index', short: 'Math', digits: 1, higherIsBetter: true },
  { key: 'mmluPro', label: 'MMLU-Pro', short: 'MMLU-Pro', digits: 1, higherIsBetter: true },
  { key: 'gpqa', label: 'GPQA Diamond', short: 'GPQA', digits: 1, higherIsBetter: true },
  { key: 'math500', label: 'MATH-500', short: 'MATH-500', digits: 1, higherIsBetter: true },
  { key: 'aime', label: 'AIME', short: 'AIME', digits: 1, higherIsBetter: true },
  { key: 'livecodebench', label: 'LiveCodeBench', short: 'LCB', digits: 1, higherIsBetter: true },
  { key: 'hle', label: "Humanity's Last Exam", short: 'HLE', digits: 1, higherIsBetter: true },
] as const;

/** Performance. We measure these ourselves; AA publishes the first two. */
export const PERF_COLUMNS: readonly ColumnDef[] = [
  { key: 'outputTokensPerSecond', label: 'Output speed', short: 'Tokens/s', digits: 1, higherIsBetter: true, unit: 't/s' },
  { key: 'timeToFirstTokenSeconds', label: 'Time to first token', short: 'TTFT', digits: 2, higherIsBetter: false, unit: 's' },
  { key: 'totalResponseSeconds', label: 'Total response time', short: 'Total', digits: 2, higherIsBetter: false, unit: 's' },
] as const;

export const ALL_COLUMNS: readonly ColumnDef[] = [...SCORE_COLUMNS, ...PERF_COLUMNS];

/** Both sources report these, so they are the only ones the Compare tab can use. */
export const COMPARABLE_KEYS: readonly MetricKey[] = ['outputTokensPerSecond', 'timeToFirstTokenSeconds'];

/** Headline cards at the top of the page, mirroring AA's summary row. */
export const HIGHLIGHT_KEYS: readonly MetricKey[] = [
  'intelligenceIndex',
  'outputTokensPerSecond',
  'timeToFirstTokenSeconds',
];

export function columnFor(key: MetricKey): ColumnDef {
  const found = ALL_COLUMNS.find((c) => c.key === key);
  if (!found) throw new Error(`No column defined for "${key}"`);
  return found;
}
