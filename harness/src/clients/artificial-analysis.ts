/**
 * Artificial Analysis = the thing we VALIDATE against. Their published scores
 * are the reference; our OpenRouter runs are the measurement.
 *
 * The free tier allows 100 requests/day, so this client is built to almost
 * never call out: every response is cached to disk, and two rolling counters
 * make overspending impossible rather than merely unlikely.
 *
 * The ceilings are 3/hour and 75/day. The hourly cap is the one that actually
 * binds — 3 x 24 = 72, so it keeps us under the daily figure on its own, and
 * stops a stuck loop from burning the whole allowance in one minute. The daily
 * cap is the backstop, set below 100 to leave headroom for manual poking.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { REPO_ROOT } from '../config.ts';

const ENDPOINT = 'https://artificialanalysis.ai/api/v2/data/llms/models';
const CACHE_PATH = resolve(REPO_ROOT, 'data/cache/aa-models.json');
const BUDGET_PATH = resolve(REPO_ROOT, 'data/cache/aa-budget.json');

/** Ceilings, not targets. Raise only when you mean to. */
const DEFAULT_HOURLY_BUDGET = 3;
const DEFAULT_DAILY_BUDGET = 75;
/**
 * One hour, matching the hourly refresh job: a scheduled run finds the cache
 * just expired and fetches, while anything run more often than that is served
 * from disk for free. Override with AA_CACHE_TTL_HOURS.
 */
const DEFAULT_CACHE_TTL_HOURS = 1;

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
  aime25: number | null;
  livecodebench: number | null;
  hle: number | null;
  scicode: number | null;
  ifbench: number | null;
  lcr: number | null;
  tau2: number | null;
  tauBanking: number | null;
  terminalbenchHard: number | null;
  terminalbenchV21: number | null;
  terminalbenchV40: number | null;
  outputTokensPerSecond: number | null;
  timeToFirstTokenSeconds: number | null;
  timeToFirstAnswerTokenSeconds: number | null;
}

/**
 * The cache holds AA's RAW response, not our mapped view of it. Mapping happens
 * on read, so correcting a field mapping costs zero API requests — which
 * matters when the daily allowance is small.
 */
interface CacheFile {
  fetchedAt: string;
  raw: unknown[];
}

/**
 * Two rolling windows. Each resets when its key changes, so no cleanup job is
 * needed — a new hour simply has a different `hour` string.
 */
interface BudgetFile {
  /** YYYY-MM-DD */
  day: string;
  dayCount: number;
  /** YYYY-MM-DDTHH */
  hour: string;
  hourCount: number;
}

export interface FetchResult {
  models: AaModel[];
  fetchedAt: string;
  /** True when served from disk, i.e. this call cost zero API requests. */
  fromCache: boolean;
}

export interface BudgetLimits {
  hourly?: number;
  daily?: number;
}

export class ArtificialAnalysisClient {
  readonly #apiKey: string | undefined;
  readonly #hourlyBudget: number;
  readonly #dailyBudget: number;

  constructor(apiKey: string | undefined, limits: BudgetLimits = {}) {
    this.#apiKey = apiKey;
    this.#hourlyBudget =
      limits.hourly ?? Number(process.env.AA_HOURLY_BUDGET ?? DEFAULT_HOURLY_BUDGET);
    this.#dailyBudget = limits.daily ?? Number(process.env.AA_DAILY_BUDGET ?? DEFAULT_DAILY_BUDGET);
  }

  get configured(): boolean {
    return Boolean(this.#apiKey);
  }

  /**
   * Returns every LLM AA knows about. Hits the network only when the cache is
   * missing, stale, or `force` is set — and never when that would breach the
   * hourly or daily ceiling. A breach serves stale cache rather than failing,
   * because out-of-date numbers beat no numbers.
   */
  async fetchModels(opts: { force?: boolean; ttlHours?: number } = {}): Promise<FetchResult> {
    const ttlHours =
      opts.ttlHours ?? Number(process.env.AA_CACHE_TTL_HOURS ?? DEFAULT_CACHE_TTL_HOURS);
    const cached = readCache();

    if (cached && !opts.force && ageHours(cached.fetchedAt) < ttlHours) {
      return { models: cached.raw.map(toAaModel), fetchedAt: cached.fetchedAt, fromCache: true };
    }
    if (!this.#apiKey) {
      if (cached) return { models: cached.raw.map(toAaModel), fetchedAt: cached.fetchedAt, fromCache: true };
      throw new Error('ARTIFICIALANALYSIS_API_KEY is not set and no cache exists');
    }

    const budget = readBudget();
    const breach =
      budget.hourCount >= this.#hourlyBudget
        ? `hourly ceiling reached (${budget.hourCount}/${this.#hourlyBudget} this hour)`
        : budget.dayCount >= this.#dailyBudget
          ? `daily ceiling reached (${budget.dayCount}/${this.#dailyBudget} today)`
          : null;

    if (breach) {
      if (cached) {
        console.warn(`! AA ${breach}; serving cache from ${cached.fetchedAt}`);
        return { models: cached.raw.map(toAaModel), fetchedAt: cached.fetchedAt, fromCache: true };
      }
      throw new Error(
        `AA ${breach} and no cache to fall back on. ` +
          `Wait for the window to roll over, or raise AA_HOURLY_BUDGET / AA_DAILY_BUDGET if you mean to.`,
      );
    }

    const res = await fetch(ENDPOINT, { headers: { 'x-api-key': this.#apiKey } });
    writeBudget({
      day: budget.day,
      dayCount: budget.dayCount + 1,
      hour: budget.hour,
      hourCount: budget.hourCount + 1,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AA API ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`);
    }

    const payload = (await res.json()) as { data?: unknown[] };
    const raw = payload.data ?? [];
    const models = raw.map(toAaModel);
    const fetchedAt = new Date().toISOString();
    writeCache({ fetchedAt, raw });

    console.log(
      `  AA request ${budget.hourCount + 1}/${this.#hourlyBudget} this hour, ` +
        `${budget.dayCount + 1}/${this.#dailyBudget} today — ${models.length} models cached`,
    );
    return { models, fetchedAt, fromCache: false };
  }

  /** What we have spent in each window so far. */
  static requestsUsed(): { hour: number; day: number } {
    const b = readBudget();
    return { hour: b.hourCount, day: b.dayCount };
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
    aime25: pct('aime_25'),
    livecodebench: pct('livecodebench'),
    hle: pct('hle'),
    scicode: pct('scicode'),
    ifbench: pct('ifbench'),
    lcr: pct('lcr'),
    tau2: pct('tau2'),
    tauBanking: pct('tau_banking'),
    terminalbenchHard: pct('terminalbench_hard'),
    terminalbenchV21: pct('terminalbench_v2_1'),
    terminalbenchV40: pct('terminalbench_v4_0'),
    outputTokensPerSecond: positive(r['median_output_tokens_per_second']),
    timeToFirstTokenSeconds: positive(r['median_time_to_first_token_seconds']),
    timeToFirstAnswerTokenSeconds: positive(r['median_time_to_first_answer_token']),
  };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * AA encodes "no perf data for this model" as a literal 0 — true for roughly
 * three quarters of their catalogue. Taken at face value a model with no data
 * wins every speed ranking, so zero and below become null.
 */
function positive(v: unknown): number | null {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// Disk state
// ---------------------------------------------------------------------------

function readCache(): CacheFile | null {
  if (!existsSync(CACHE_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Partial<CacheFile>;
    // A cache written before this file stored raw payloads has no `raw` array.
    // Treat it as absent rather than crashing on it.
    if (!Array.isArray(parsed.raw) || typeof parsed.fetchedAt !== 'string') return null;
    return { fetchedAt: parsed.fetchedAt, raw: parsed.raw };
  } catch {
    return null;
  }
}

function writeCache(file: CacheFile): void {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(file, null, 2));
}

/** Each counter resets when its own window key changes. UTC throughout. */
function readBudget(): BudgetFile {
  const now = new Date().toISOString();
  const day = now.slice(0, 10); // YYYY-MM-DD
  const hour = now.slice(0, 13); // YYYY-MM-DDTHH
  const fresh: BudgetFile = { day, dayCount: 0, hour, hourCount: 0 };

  if (!existsSync(BUDGET_PATH)) return fresh;
  try {
    const p = JSON.parse(readFileSync(BUDGET_PATH, 'utf8')) as Partial<BudgetFile>;
    return {
      day,
      dayCount: p.day === day ? (p.dayCount ?? 0) : 0,
      hour,
      hourCount: p.hour === hour ? (p.hourCount ?? 0) : 0,
    };
  } catch {
    return fresh;
  }
}

function writeBudget(file: BudgetFile): void {
  mkdirSync(dirname(BUDGET_PATH), { recursive: true });
  writeFileSync(BUDGET_PATH, JSON.stringify(file, null, 2));
}

function ageHours(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}
