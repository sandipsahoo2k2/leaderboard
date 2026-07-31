/** Drives N streamed completions for one model and summarises them. */

import type { OpenRouterClient } from '../clients/openrouter.ts';
import type { ModelConfig, PerfSummary, RunDefaults, StreamSample } from '../types.ts';
import { PERF_PROMPT, summarize } from './perf.ts';

export interface CollectOptions {
  trials: number;
  temperature: number;
  maxTokens: number;
  /** Discard the first sample. Cold routing on OpenRouter skews TTFT badly. */
  warmup: boolean;
  onSample?: (index: number, sample: StreamSample) => void;
}

export async function collectPerf(
  client: OpenRouterClient,
  model: ModelConfig,
  opts: CollectOptions,
): Promise<PerfSummary> {
  const slug = model.openrouter?.slug;
  if (!slug) throw new Error(`Model "${model.key}" has no openrouter.slug, cannot measure it`);

  const request = { temperature: opts.temperature, maxTokens: opts.maxTokens };
  if (opts.warmup) await client.complete(slug, PERF_PROMPT, { ...request, maxTokens: 16 });

  const samples: StreamSample[] = [];
  for (let i = 0; i < opts.trials; i++) {
    const sample = await client.complete(slug, PERF_PROMPT, request);
    samples.push(sample);
    opts.onSample?.(i, sample);
  }
  return summarize(samples);
}

export function defaultsFor(defaults: RunDefaults, trialsOverride?: number): CollectOptions {
  return {
    trials: trialsOverride ?? defaults.trials,
    temperature: defaults.temperature,
    maxTokens: defaults.maxTokens,
    warmup: true,
  };
}
