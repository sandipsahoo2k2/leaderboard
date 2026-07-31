/**
 * Artificial Analysis = the thing we VALIDATE against. Their published scores
 * are the reference; our OpenRouter runs are the measurement.
 *
 * The free tier is 100 requests/day, so this client is built to almost never
 * call out: every response is cached to disk, and a daily budget counter makes
 * overspending impossible rather than merely unlikely.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { REPO_ROOT } from '../config.ts';

const ENDPOINT = 'https://artificialanalysis.ai/api/v2/data/llms/models';
const CACHE_PATH = resolve(REPO_ROOT, 'data/cache/aa-models.json');
const BUDGET_PATH = resolve(REPO_ROOT, 'data/cache/aa-budget.json');

/** Deliberately tiny. Raise only when you mean to. */
const DEFAULT_DAILY_BUDGET = 3;
const DEFAULT_CACHE_TTL_HOURS = 24;

/** Normalised view of one AA model. Pricing fields are dropped on purpose. */
export interface AaModel {
  slug: string;
  name: string;
  creator: string | null;
  intelligenceIndex: number | null;
  codingIndex: number | null;
  mathIndex: number | null;
  mmluPro: number | null;
  gpqa: number | null;
  math500: number | null;
  aime: number | null;
  livecodebench: number | null;
  hle: number | null;
  outputTokensPerSecond: number | null;
  timeToFirstTokenSeconds: number | null;
}

interface CacheFile {
  fetchedAt: string;
  models: AaModel[];
}

interface BudgetFile {
  date: string;
  count: number;
}

export interface FetchResult {
  models: AaModel[];
  fetchedAt: string;
  /** True when served from disk, i.e. this call cost zero API requests. */
  fromCache: boolean;
}

export class ArtificialAnalysisClient {
  readonly #apiKey: string | undefined;
  readonly #dailyBudget: number;

  constructor(apiKey: string | undefined, dailyBudget?: number) {
    this.#apiKey = apiKey;
    this.#dailyBudget = dailyBudget ?? Number(process.env.AA_DAILY_BUDGET ?? DEFAULT_DAILY_BUDGET);
  }

  get configured(): boolean {
    return Boolean(this.#apiKey);
  }

  /**
   * Returns every LLM AA knows about. Hits the network only when the cache is
   * missing, stale, or `force` is set — and never when that would exceed the
   * daily budget.
   */
  async fetchModels(opts: { force?: boolean; ttlHours?: number } = {}): Promise<FetchResult> {
    const ttlHours = opts.ttlHours ?? DEFAULT_CACHE_TTL_HOURS;
    const cached = readCache();

    if (cached && !opts.force && ageHours(cached.fetchedAt) < ttlHours) {
      return { models: cached.models, fetchedAt: cached.fetchedAt, fromCache: true };
    }
    if (!this.#apiKey) {
      if (cached) return { models: cached.models, fetchedAt: cached.fetchedAt, fromCache: true };
      throw new Error('ARTIFICIALANALYSIS_API_KEY is not set and no cache exists');
    }

    const budget = readBudget();
    if (budget.count >= this.#dailyBudget) {
      if (cached) {
        console.warn(
          `! AA daily budget spent (${budget.count}/${this.#dailyBudget}); serving stale cache from ${cached.fetchedAt}`,
        );
        return { models: cached.models, fetchedAt: cached.fetchedAt, fromCache: true };
      }
      throw new Error(
        `AA daily budget spent (${budget.count}/${this.#dailyBudget}) and no cache to fall back on. ` +
          `Raise AA_DAILY_BUDGET only if you mean to.`,
      );
    }

    const res = await fetch(ENDPOINT, { headers: { 'x-api-key': this.#apiKey } });
    writeBudget({ date: budget.date, count: budget.count + 1 });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AA API ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`);
    }

    const payload = (await res.json()) as { data?: unknown[] };
    const models = (payload.data ?? []).map(toAaModel);
    const fetchedAt = new Date().toISOString();
    writeCache({ fetchedAt, models });

    console.log(
      `  AA request ${budget.count + 1}/${this.#dailyBudget} today — ${models.length} models cached`,
    );
    return { models, fetchedAt, fromCache: false };
  }

  /** How many requests we have already spent today. */
  static requestsUsedToday(): number {
    return readBudget().count;
  }
}

// ---------------------------------------------------------------------------
// Response mapping — defensive, because AA nests some fields and not others
// ---------------------------------------------------------------------------

function toAaModel(raw: unknown): AaModel {
  const r = raw as Record<string, unknown>;
  const evals = (r['evaluations'] ?? {}) as Record<string, unknown>;

  /** Look in `evaluations` first, then the item root. */
  const pick = (key: string): number | null => num(evals[key] ?? r[key]);

  /** AA reports some accuracies as 0-1 and others as 0-100. Land everything on 0-100. */
  const pct = (key: string): number | null => {
    const v = pick(key);
    if (v === null) return null;
    return v <= 1 ? v * 100 : v;
  };

  const creator = r['model_creator'] as Record<string, unknown> | undefined;

  return {
    slug: String(r['slug'] ?? r['id'] ?? ''),
    name: String(r['name'] ?? r['slug'] ?? ''),
    creator: creator ? String(creator['name'] ?? '') || null : null,
    intelligenceIndex: pick('artificial_analysis_intelligence_index'),
    codingIndex: pick('artificial_analysis_coding_index'),
    mathIndex: pick('artificial_analysis_math_index'),
    mmluPro: pct('mmlu_pro'),
    gpqa: pct('gpqa'),
    math500: pct('math_500'),
    aime: pct('aime'),
    livecodebench: pct('livecodebench'),
    hle: pct('hle'),
    outputTokensPerSecond: num(r['median_output_tokens_per_second']),
    timeToFirstTokenSeconds: num(r['median_time_to_first_token_seconds']),
  };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------
// Disk state
// ---------------------------------------------------------------------------

function readCache(): CacheFile | null {
  if (!existsSync(CACHE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as CacheFile;
  } catch {
    return null;
  }
}

function writeCache(file: CacheFile): void {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(file, null, 2));
}

/** Budget resets when the calendar day changes. */
function readBudget(): BudgetFile {
  const today = new Date().toISOString().slice(0, 10);
  if (!existsSync(BUDGET_PATH)) return { date: today, count: 0 };
  try {
    const parsed = JSON.parse(readFileSync(BUDGET_PATH, 'utf8')) as BudgetFile;
    return parsed.date === today ? parsed : { date: today, count: 0 };
  } catch {
    return { date: today, count: 0 };
  }
}

function writeBudget(file: BudgetFile): void {
  mkdirSync(dirname(BUDGET_PATH), { recursive: true });
  writeFileSync(BUDGET_PATH, JSON.stringify(file, null, 2));
}

function ageHours(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}
