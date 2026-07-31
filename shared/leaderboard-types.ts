/**
 * Shared vocabulary for the whole project. The web app imports these same
 * shapes, so a change here is a change everywhere — deliberately.
 */

/** Where a number came from. Drives the tab + badge in the UI. */
export type MetricSource = 'measured' | 'artificial-analysis';

/**
 * Every number on the leaderboard is wrapped. We never store a bare value,
 * because a bare value loses the answer to "who says so?".
 */
export interface Metric<T = number> {
  value: T | null;
  source: MetricSource;
  /** ISO timestamp of when this number was produced. */
  capturedAt: string;
  /** Trial count behind a median. Present on measured metrics only. */
  sampleSize?: number;
}

export function metric<T>(
  value: T | null,
  source: MetricSource,
  sampleSize?: number,
): Metric<T> {
  return { value, source, capturedAt: new Date().toISOString(), sampleSize };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ModelConfig {
  key: string;
  label: string;
  creator: string;
  openWeights: boolean;
  contextWindow: number | null;
  enabled: boolean;
  openrouter?: { slug: string };
  artificialAnalysis?: { slug: string };
}

export interface RunDefaults {
  trials: number;
  temperature: number;
  maxTokens: number;
}

export interface AppConfig {
  defaults: RunDefaults;
  models: ModelConfig[];
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

/** Raw timings from one streamed completion. Milliseconds, tokens. */
export interface StreamSample {
  ttftMs: number;
  totalMs: number;
  completionTokens: number;
  promptTokens: number;
  text: string;
}

/** Aggregate of N StreamSamples for one model. */
export interface PerfSummary {
  medianTtftSeconds: number;
  medianOutputTokensPerSecond: number;
  medianTotalResponseSeconds: number;
  trials: number;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/**
 * Quality scores are 0-100. Perf is seconds / tokens-per-second.
 * No pricing fields anywhere by design.
 */
export interface ScoreFields {
  intelligenceIndex: Metric | null;
  codingIndex: Metric | null;
  mathIndex: Metric | null;
  mmluPro: Metric | null;
  gpqa: Metric | null;
  math500: Metric | null;
  aime: Metric | null;
  livecodebench: Metric | null;
  hle: Metric | null;
}

export interface PerfFields {
  outputTokensPerSecond: Metric | null;
  timeToFirstTokenSeconds: Metric | null;
  totalResponseSeconds: Metric | null;
}

/** One model, one source. The UI's Measured and AA tabs each render a list of these. */
export interface SourcedRow extends ScoreFields, PerfFields {
  modelKey: string;
  source: MetricSource;
  /** Slug as known to that source — useful when debugging a mismatch. */
  sourceSlug: string | null;
}

/** One model across all sources, plus static facts. What ships in latest.json. */
export interface LeaderboardEntry {
  modelKey: string;
  label: string;
  creator: string;
  openWeights: boolean;
  contextWindow: number | null;
  bySource: Partial<Record<MetricSource, SourcedRow>>;
}

export interface LeaderboardSnapshot {
  generatedAt: string;
  entries: LeaderboardEntry[];
}

/** One measured-vs-AA comparison, for the Compare tab and `bench validate`. */
export interface Divergence {
  modelKey: string;
  field: string;
  measured: number | null;
  reference: number | null;
  /** Signed percent difference of measured against reference. */
  deltaPercent: number | null;
  status: 'ok' | 'diverged' | 'missing';
}
