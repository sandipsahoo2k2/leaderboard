/**
 * Joins what we measured with what Artificial Analysis publishes, keeping the
 * two side by side rather than averaging them. Every number keeps its source,
 * so the UI can tab between them and show a delta.
 */

import type { AaModel } from './clients/artificial-analysis.ts';
import type {
  LeaderboardEntry,
  LeaderboardSnapshot,
  Metric,
  MetricSource,
  ModelConfig,
  PerfSummary,
  SourcedRow,
} from './types.ts';

// Comparison lives in shared/ so the CLI and the UI apply the same rule.
export { compareEntry, DIVERGENCE_THRESHOLD_PERCENT } from '../../shared/compare.ts';

function mk(
  value: number | null,
  source: MetricSource,
  capturedAt: string,
  sampleSize?: number,
): Metric | null {
  if (value === null || !Number.isFinite(value)) return null;
  return { value, source, capturedAt, sampleSize };
}

const EMPTY_SCORES = {
  intelligenceIndex: null,
  codingIndex: null,
  mathIndex: null,
  mmluPro: null,
  gpqa: null,
  math500: null,
  aime: null,
  livecodebench: null,
  hle: null,
} as const;

/** A row built from our own OpenRouter runs. Perf only until scorers land. */
export function measuredRow(
  model: ModelConfig,
  perf: PerfSummary,
  capturedAt = new Date().toISOString(),
): SourcedRow {
  const n = perf.trials;
  return {
    modelKey: model.key,
    source: 'measured',
    sourceSlug: model.openrouter?.slug ?? null,
    ...EMPTY_SCORES,
    outputTokensPerSecond: mk(perf.medianOutputTokensPerSecond, 'measured', capturedAt, n),
    timeToFirstTokenSeconds: mk(perf.medianTtftSeconds, 'measured', capturedAt, n),
    totalResponseSeconds: mk(perf.medianTotalResponseSeconds, 'measured', capturedAt, n),
  };
}

/** A row built from the AA API. */
export function artificialAnalysisRow(
  model: ModelConfig,
  aa: AaModel,
  capturedAt: string,
): SourcedRow {
  const s = 'artificial-analysis' as const;
  return {
    modelKey: model.key,
    source: s,
    sourceSlug: aa.slug || (model.artificialAnalysis?.slug ?? null),
    intelligenceIndex: mk(aa.intelligenceIndex, s, capturedAt),
    codingIndex: mk(aa.codingIndex, s, capturedAt),
    mathIndex: mk(aa.mathIndex, s, capturedAt),
    mmluPro: mk(aa.mmluPro, s, capturedAt),
    gpqa: mk(aa.gpqa, s, capturedAt),
    math500: mk(aa.math500, s, capturedAt),
    aime: mk(aa.aime, s, capturedAt),
    livecodebench: mk(aa.livecodebench, s, capturedAt),
    hle: mk(aa.hle, s, capturedAt),
    outputTokensPerSecond: mk(aa.outputTokensPerSecond, s, capturedAt),
    timeToFirstTokenSeconds: mk(aa.timeToFirstTokenSeconds, s, capturedAt),
    totalResponseSeconds: null, // AA does not publish this
  };
}

export function buildSnapshot(
  models: ModelConfig[],
  rowsByModel: Map<string, SourcedRow[]>,
): LeaderboardSnapshot {
  const entries: LeaderboardEntry[] = models.map((model) => {
    const bySource: LeaderboardEntry['bySource'] = {};
    for (const row of rowsByModel.get(model.key) ?? []) bySource[row.source] = row;
    return {
      modelKey: model.key,
      label: model.label,
      creator: model.creator,
      openWeights: model.openWeights,
      contextWindow: model.contextWindow,
      bySource,
    };
  });
  return { generatedAt: new Date().toISOString(), entries };
}

