/**
 * Turns raw stream timings into the three perf numbers on the board.
 *
 * Definitions follow Artificial Analysis' methodology so our numbers and their
 * numbers mean the same thing and the Compare tab is honest:
 *   - Time to first token: request sent -> first token received.
 *   - Output speed: tokens per second *after* the first token arrives.
 * We report medians, which is what AA publishes (`median_*` fields).
 */

import type { PerfSummary, StreamSample } from '../types.ts';

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Tokens per second measured after the first token, per one sample. */
export function outputTokensPerSecond(sample: StreamSample): number {
  const generationMs = sample.totalMs - sample.ttftMs;
  if (generationMs <= 0 || sample.completionTokens <= 0) return 0;
  return sample.completionTokens / (generationMs / 1000);
}

export function summarize(samples: StreamSample[]): PerfSummary {
  if (samples.length === 0) throw new Error('summarize() needs at least one sample');
  return {
    medianTtftSeconds: median(samples.map((s) => s.ttftMs / 1000)),
    medianOutputTokensPerSecond: median(samples.map(outputTokensPerSecond)),
    medianTotalResponseSeconds: median(samples.map((s) => s.totalMs / 1000)),
    trials: samples.length,
  };
}

/**
 * Fixed prompt for perf sampling. Short input, long-ish output — the shape that
 * makes output speed the dominant term instead of prompt processing.
 */
export const PERF_PROMPT =
  'Explain how a hash table handles collisions. Write about 200 words of plain prose.';
