# Model Leaderboard

A leaderboard for open-source LLMs, in the style of Artificial Analysis, over a
small and explicitly configured set of models. Two data sources, never blended:

| Source | What it is | Where it comes from |
| --- | --- | --- |
| **Measured** | Numbers we produce ourselves | Streamed OpenRouter calls |
| **Artificial Analysis** | Published reference scores | AA API, one cached request |

Every value on the board carries its source, so the UI can tab between the two
and show where they disagree. No pricing or cost anywhere — removed by design.

## Layout

```
config/models.yaml       the registry. adding a model = adding one block
shared/                  types + compare logic used by BOTH halves
  leaderboard-types.ts   Metric<T>, provenance, row shapes
  compare.ts             the one definition of "diverged"
harness/src/
  types.ts               re-export of shared/, so imports stay short
  config.ts              loads + zod-validates models.yaml
  clients/
    openrouter.ts        streaming client; captures TTFT. + slug fuzzy-match
    artificial-analysis.ts  AA client; disk cache + hard daily request budget
  measure/
    perf.ts              median, tokens/sec, AA-compatible definitions
    collect.ts           runs N trials for one model
  merge.ts               measured + AA -> rows with provenance; divergence check
  store.ts               all disk paths for run output
  report.ts              terminal table formatting
  commands/
    probe.ts             slug validation + 1 call per model
    sync-aa.ts           <=1 AA request
    build-board.ts       shared body of validate/run
  cli.ts                 arg parsing, command dispatch
data/
  cache/                 AA response + daily budget counter
  runs/<runId>.json      append-only history
  latest.json            the only file the web app reads
web/src/app/
  core/
    columns.ts           what appears on the board. add a metric = one line
    sources.ts           tab definitions + provenance colours
    leaderboard.store.ts loads latest.json, holds tab + sort state
    format.ts            numbers -> strings
  features/
    source-tabs.ts       Measured | Artificial Analysis | Compare
    model-table.ts       sortable table for one source
    metric-cell.ts       a value + its provenance dot
    ranking-cards.ts     the "who leads what" strip
    compare-table.ts     measured vs reference, with deltas
    scatter-chart.ts     quality vs speed (ECharts)
  app.ts                 page shell, routes between views
```

## Setup

```bash
cp .env.example .env    # then paste your two keys in
```

```bash
cd harness && npm install
```

## Commands

Cheapest end-to-end check — 3 OpenRouter calls, at most 1 AA request:

```bash
cd harness && npm run bench -- validate
```

```bash
cd harness && npm run bench -- probe
```

```bash
cd harness && npm run bench -- sync-aa
```

Full run at the trial count in `config/models.yaml`:

```bash
cd harness && npm run bench -- run
```

Restrict to some models:

```bash
cd harness && npm run bench -- run --models gemma-4-31b,gpt-oss-120b
```

## The web app

Angular 21 standalone components with signals, Tailwind v4, ECharts for the
scatter. Three tabs — Measured, Artificial Analysis, Compare — and every value
carries a coloured dot naming its source, with capture time and trial count on
hover.

```bash
cd web && npm install && npm start
```

`prestart` and `prebuild` copy `data/latest.json` into `web/public/data/`, which
is the only thing the UI reads. With no run yet the page renders an empty state
rather than failing.

## Deploying to GitHub Pages

Two workflows:

- **`.github/workflows/pages.yml`** — on push to `main`, builds the app with
  `--base-href /<repo-name>/`, copies `index.html` to `404.html` so deep links
  survive, and publishes.
- **`.github/workflows/bench.yml`** — manual (`workflow_dispatch`, with a
  command/models/refresh form) plus a Monday cron. Commits `data/latest.json`,
  which in turn triggers the Pages deploy.

One-time setup on GitHub:

1. Settings → Pages → Source: **GitHub Actions**
2. Settings → Secrets and variables → Actions, add `OPENROUTER_API_KEY` and
   `ARTIFICIALANALYSIS_API_KEY`

## Guardrails

- The AA free tier is **100 requests/day**. `AA_DAILY_BUDGET` (default **3**) is a
  hard stop, and responses are cached to disk for 24h, so repeat commands cost
  zero requests. `--refresh` forces a live call and still respects the budget.
- `probe` checks every slug against OpenRouter's public model list before
  spending tokens, and suggests near-matches on a miss.

## Metrics

Measured, per AA's definitions so the comparison is fair:

- **Time to first token** — request sent to first token received
- **Output speed** — tokens/sec *after* the first token
- **Total response** — request sent to stream closed

Reported as medians over N trials, matching AA's `median_*` fields.

From the AA API: Intelligence / Coding / Math indices, MMLU-Pro, GPQA, MATH-500,
AIME, LiveCodeBench, HLE. All `price_*` fields are dropped on ingest.

## Status

- [x] Config, provenance model, OpenRouter client, perf measurement
- [x] AA client with cache + budget, merge, divergence check, CLI
- [x] Angular + Tailwind UI with Measured / AA / Compare tabs
- [x] GitHub Actions: bench on dispatch, Pages deploy on push
- [ ] Our own eval scorers (MMLU-Pro, GPQA, MATH-500, IFEval) -> our own
      Intelligence Index. Until then the Measured tab is perf-only and the
      score columns show `--`.

Not yet run against live APIs. Add the two keys as repository secrets, then run
the Benchmark workflow — that first run is the real test.
