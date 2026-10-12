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

/**
 * The columns Artificial Analysis leads with, in their order: how smart, how
 * fast, how long you wait. These sit immediately after the model name so the
 * headline numbers are visible without scrolling sideways.
 */
export const HEADLINE_COLUMNS: readonly ColumnDef[] = [
  { key: 'intelligenceIndex', label: 'Intelligence Index', short: 'Intelligence', digits: 1, higherIsBetter: true },
  { key: 'outputTokensPerSecond', label: 'Output speed', short: 'Speed', digits: 1, higherIsBetter: true, unit: 't/s' },
  { key: 'timeToFirstTokenSeconds', label: 'Latency, first chunk', short: 'Latency', digits: 2, higherIsBetter: false, unit: 's' },
  { key: 'timeToFirstAnswerTokenSeconds', label: 'Latency, first answer token', short: 'To answer', digits: 2, higherIsBetter: false, unit: 's' },
  // AA does NOT publish an end-to-end total; their site derives it. We show our
  // own measured value here and leave the cell empty on the AA tab rather than
  // inventing a number.
  { key: 'totalResponseSeconds', label: 'End-to-end response time (measured only)', short: 'Total', digits: 2, higherIsBetter: false, unit: 's' },
] as const;

/** The per-benchmark breakdown behind the headline. All normalised to 0-100. */
export const DETAIL_COLUMNS: readonly ColumnDef[] = [
  { key: 'codingIndex', label: 'Coding Index', short: 'Coding', digits: 1, higherIsBetter: true },
  { key: 'mathIndex', label: 'Math Index', short: 'Math', digits: 1, higherIsBetter: true },
  { key: 'mmluPro', label: 'MMLU-Pro', short: 'MMLU-Pro', digits: 1, higherIsBetter: true },
  { key: 'gpqa', label: 'GPQA Diamond', short: 'GPQA', digits: 1, higherIsBetter: true },
  { key: 'math500', label: 'MATH-500', short: 'MATH-500', digits: 1, higherIsBetter: true },
  { key: 'aime', label: 'AIME', short: 'AIME', digits: 1, higherIsBetter: true },
  { key: 'aime25', label: 'AIME 2025', short: 'AIME-25', digits: 1, higherIsBetter: true },
  { key: 'livecodebench', label: 'LiveCodeBench', short: 'LCB', digits: 1, higherIsBetter: true },
  { key: 'hle', label: "Humanity's Last Exam", short: 'HLE', digits: 1, higherIsBetter: true },
  { key: 'scicode', label: 'SciCode', short: 'SciCode', digits: 1, higherIsBetter: true },
  { key: 'ifbench', label: 'IFBench', short: 'IFBench', digits: 1, higherIsBetter: true },
  { key: 'lcr', label: 'Long Context Reasoning', short: 'LCR', digits: 1, higherIsBetter: true },
  { key: 'tau2', label: 'Tau2', short: 'Tau2', digits: 1, higherIsBetter: true },
  { key: 'tauBanking', label: 'Tau Banking', short: 'Tau-Bank', digits: 1, higherIsBetter: true },
  { key: 'terminalbenchHard', label: 'Terminal-Bench Hard', short: 'TB-Hard', digits: 1, higherIsBetter: true },
  { key: 'terminalbenchV21', label: 'Terminal-Bench v2.1', short: 'TB-2.1', digits: 1, higherIsBetter: true },
  { key: 'terminalbenchV40', label: 'Terminal-Bench v4.0', short: 'TB-4.0', digits: 1, higherIsBetter: true },
] as const;

/** Headline first, breakdown after. Column order on the table follows this. */
export const ALL_COLUMNS: readonly ColumnDef[] = [...HEADLINE_COLUMNS, ...DETAIL_COLUMNS];

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
