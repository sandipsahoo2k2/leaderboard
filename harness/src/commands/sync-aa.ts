/**
 * `bench sync-aa` — pulls published scores from Artificial Analysis.
 *
 * Exactly ONE API request, and only when the disk cache is stale or --refresh
 * is passed. Everything after that is free.
 */

import { ArtificialAnalysisClient, type AaModel } from '../clients/artificial-analysis.ts';
import { loadConfig, selectModels } from '../config.ts';
import { fmt, heading, table } from '../report.ts';
import type { ModelConfig } from '../types.ts';

export interface SyncOptions {
  models?: string[];
  refresh?: boolean;
}

export interface SyncResult {
  aaByModelKey: Map<string, AaModel>;
  fetchedAt: string;
  fromCache: boolean;
  models: ModelConfig[];
}

export async function syncAa(opts: SyncOptions = {}): Promise<SyncResult> {
  const config = loadConfig();
  const models = selectModels(config, opts.models);
  const client = new ArtificialAnalysisClient(process.env.ARTIFICIALANALYSIS_API_KEY);

  console.log(heading('Artificial Analysis reference data'));
  const { models: all, fetchedAt, fromCache } = await client.fetchModels({ force: opts.refresh });
  console.log(
    `  ${fromCache ? 'cache hit (0 requests)' : 'fetched (1 request)'} — ${all.length} models, as of ${fetchedAt}`,
  );

  const bySlug = new Map(all.map((m) => [m.slug.toLowerCase(), m]));
  const aaByModelKey = new Map<string, AaModel>();
  const unmatched: ModelConfig[] = [];

  for (const model of models) {
    const slug = model.artificialAnalysis?.slug;
    if (!slug) continue;
    const hit = bySlug.get(slug.toLowerCase());
    if (hit) aaByModelKey.set(model.key, hit);
    else unmatched.push(model);
  }

  if (unmatched.length) {
    console.log(`\n  ! No AA entry for: ${unmatched.map((m) => m.key).join(', ')}`);
    for (const model of unmatched) {
      const wanted = model.artificialAnalysis!.slug.toLowerCase();
      const token = wanted.split(/[-_]/)[0] ?? wanted;
      const near = all
        .filter((m) => m.slug.toLowerCase().includes(token))
        .slice(0, 5)
        .map((m) => m.slug);
      console.log(`    ${model.key}: tried "${wanted}", nearby: ${near.join(', ') || '(none)'}`);
    }
  }

  console.log(heading('Published scores'));
  console.log(
    table(
      ['Model', 'Intel', 'MMLU-Pro', 'GPQA', 'MATH-500', 'AIME', 'tok/s', 'TTFT s'],
      models.map((m) => {
        const a = aaByModelKey.get(m.key);
        return [
          m.label,
          fmt(a?.intelligenceIndex),
          fmt(a?.mmluPro),
          fmt(a?.gpqa),
          fmt(a?.math500),
          fmt(a?.aime),
          fmt(a?.outputTokensPerSecond),
          fmt(a?.timeToFirstTokenSeconds, 2),
        ];
      }),
    ),
  );

  return { aaByModelKey, fetchedAt, fromCache, models };
}
