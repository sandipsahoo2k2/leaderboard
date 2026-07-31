#!/usr/bin/env node
/**
 * bench — the leaderboard harness.
 *
 *   bench probe      1 streamed call per model. Validates slugs + timing maths.
 *   bench sync-aa    <=1 Artificial Analysis request. Cached, budget-capped.
 *   bench validate   probe + sync-aa + delta table + writes data/latest.json.
 *   bench run        full trial count from config, then the same.
 *
 * `validate` is the cheap loop: 3 OpenRouter calls + at most 1 AA call.
 */

import { parseArgs } from 'node:util';
import { ArtificialAnalysisClient } from './clients/artificial-analysis.ts';
import { loadConfig } from './config.ts';
import { buildBoard } from './commands/build-board.ts';
import { probe } from './commands/probe.ts';
import { syncAa } from './commands/sync-aa.ts';

const USAGE = `
bench <command> [options]

Commands
  probe       One streamed call per model. Validates slugs, auth, timing maths.
  sync-aa     Pull published scores from Artificial Analysis (cached).
  validate    probe + sync-aa + measured-vs-reference delta. Writes latest.json.
  run         Same as validate but with the full trial count from config.

Options
  --models <a,b>   Restrict to these model keys (default: all enabled)
  --trials <n>     Override trial count
  --refresh        Force a live Artificial Analysis request (spends budget)
  -h, --help       This text

Environment
  OPENROUTER_API_KEY           required for probe / validate / run
  ARTIFICIALANALYSIS_API_KEY   optional; without it the AA tab stays empty
  AA_DAILY_BUDGET              max AA requests per day (default 3)
`.trim();

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      models: { type: 'string' },
      trials: { type: 'string' },
      refresh: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  const command = positionals[0];
  if (values.help || !command) {
    console.log(USAGE);
    return;
  }

  const models = values.models?.split(',').map((s) => s.trim()).filter(Boolean);
  const trials = values.trials ? Number(values.trials) : undefined;
  if (trials !== undefined && (!Number.isInteger(trials) || trials < 1)) {
    throw new Error(`--trials must be a positive integer, got "${values.trials}"`);
  }

  switch (command) {
    case 'probe':
      await probe({ models, trials: trials ?? 1 });
      break;

    case 'sync-aa':
      await syncAa({ models, refresh: values.refresh });
      break;

    case 'validate':
      await buildBoard({ models, trials: trials ?? 1, warmup: false, refresh: values.refresh, compare: true });
      break;

    case 'run': {
      const defaults = loadConfig().defaults;
      await buildBoard({
        models,
        trials: trials ?? defaults.trials,
        warmup: true,
        refresh: values.refresh,
        compare: true,
      });
      break;
    }

    default:
      console.error(`Unknown command "${command}"\n`);
      console.log(USAGE);
      process.exitCode = 1;
      return;
  }

  const used = ArtificialAnalysisClient.requestsUsedToday();
  if (used > 0) console.log(`\n  AA requests used today: ${used}`);
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
