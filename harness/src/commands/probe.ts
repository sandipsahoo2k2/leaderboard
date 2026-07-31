/**
 * `bench probe` — the cheap smoke test.
 *
 * Checks every configured slug against OpenRouter's live model list, then does
 * ONE short streamed call per model. Proves auth, slug resolution, streaming,
 * TTFT capture and the tokens/sec maths before any expensive run.
 */

import { loadConfig, selectModels } from '../config.ts';
import { OpenRouterClient, nearestSlugs } from '../clients/openrouter.ts';
import { collectPerf } from '../measure/collect.ts';
import { fmt, heading, table } from '../report.ts';
import type { ModelConfig, PerfSummary } from '../types.ts';

export interface ProbeOptions {
  models?: string[];
  trials?: number;
  /** Throwaway call before sampling, to avoid cold-routing skew. Off by default. */
  warmup?: boolean;
}

export interface ProbeResult {
  perfByModel: Map<string, PerfSummary>;
  models: ModelConfig[];
}

export async function probe(opts: ProbeOptions = {}): Promise<ProbeResult> {
  const config = loadConfig();
  const models = selectModels(config, opts.models).filter((m) => m.openrouter);
  if (models.length === 0) throw new Error('No enabled models have an `openrouter.slug`');

  const client = new OpenRouterClient(process.env.OPENROUTER_API_KEY ?? '');

  console.log(heading('1. Slug validation (OpenRouter /models, unauthenticated)'));
  const available = await client.listSlugs();
  const unresolved: string[] = [];

  for (const model of models) {
    const slug = model.openrouter!.slug;
    if (available.includes(slug)) {
      console.log(`  ok    ${model.key.padEnd(14)} ${slug}`);
    } else {
      unresolved.push(model.key);
      const hint = nearestSlugs(slug, available);
      console.log(`  MISS  ${model.key.padEnd(14)} ${slug}`);
      console.log(`        did you mean: ${hint.length ? hint.join(', ') : '(no close match)'}`);
    }
  }
  if (unresolved.length) {
    throw new Error(
      `Unresolvable slug(s): ${unresolved.join(', ')}. Fix config/models.yaml and re-run.`,
    );
  }

  const trials = opts.trials ?? 1;
  console.log(heading(`2. Live measurement (${trials} trial${trials > 1 ? 's' : ''} per model)`));

  const perfByModel = new Map<string, PerfSummary>();
  for (const model of models) {
    process.stdout.write(`  ${model.key.padEnd(14)} `);
    try {
      const perf = await collectPerf(client, model, {
        trials,
        temperature: config.defaults.temperature,
        maxTokens: config.defaults.maxTokens,
        warmup: opts.warmup ?? false, // probe is cheap by default: no throwaway call
      });
      perfByModel.set(model.key, perf);
      console.log('ok');
    } catch (err) {
      console.log(`FAILED — ${(err as Error).message}`);
    }
  }

  console.log(heading('Measured'));
  console.log(
    table(
      ['Model', 'tok/s', 'TTFT s', 'Total s', 'n'],
      models.map((m) => {
        const p = perfByModel.get(m.key);
        return [
          m.label,
          fmt(p?.medianOutputTokensPerSecond),
          fmt(p?.medianTtftSeconds, 2),
          fmt(p?.medianTotalResponseSeconds, 2),
          String(p?.trials ?? 0),
        ];
      }),
    ),
  );

  return { perfByModel, models };
}
