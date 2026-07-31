/**
 * Page shell: header, tabs, then whichever view the active tab selects.
 * All state lives in LeaderboardStore; this component only routes between views.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { MetricSource } from '@shared/leaderboard-types';
import { formatTimestamp } from './core/format';
import { LeaderboardStore } from './core/leaderboard.store';
import { CompareTable } from './features/compare-table';
import { ModelTable } from './features/model-table';
import { RankingCards } from './features/ranking-cards';
import { ScatterPlot } from './features/scatter-chart';
import { SourceTabs } from './features/source-tabs';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SourceTabs, ModelTable, CompareTable, RankingCards, ScatterPlot],
  template: `
    <main class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header class="mb-8">
        <h1 class="text-2xl font-semibold tracking-tight text-neutral-100">Model Leaderboard</h1>
        <p class="mt-1 max-w-2xl text-sm text-neutral-400">
          A small, explicitly configured set of models. Every number carries its source —
          nothing here is blended.
        </p>
        <p class="mt-2 text-xs text-neutral-500">
          Snapshot generated {{ generatedAt() }}
        </p>
      </header>

      <app-source-tabs />

      @if (store.snapshot.isLoading()) {
        <p class="mt-10 text-sm text-neutral-500">Loading…</p>
      } @else if (store.snapshot.error()) {
        <div class="mt-10 rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
          Could not load <code>data/latest.json</code>.
          Run <code class="text-red-200">npm run bench -- validate</code> in <code>harness/</code> first.
        </div>
      } @else if (store.isEmpty()) {
        <div class="mt-10 rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-400">
          No runs yet. Run <code class="text-neutral-200">npm run bench -- validate</code> in
          <code>harness/</code>, then rebuild.
        </div>
      } @else if (activeSource(); as source) {
        <section class="mt-8 space-y-6">
          <app-ranking-cards [source]="source" />
          <app-model-table [source]="source" />
          <app-scatter-chart [source]="source" />
        </section>
      } @else {
        <section class="mt-8">
          <app-compare-table />
        </section>
      }

      <footer class="mt-12 border-t border-neutral-800 pt-6 text-xs text-neutral-500">
        Measured values come from streamed OpenRouter requests made by this repo's harness.
        Reference values come from the Artificial Analysis API. No pricing data is collected.
      </footer>
    </main>
  `,
})
export class App {
  protected readonly store = inject(LeaderboardStore);

  /** null on the Compare tab, which is not tied to a single source. */
  protected readonly activeSource = computed<MetricSource | null>(() => {
    const tab = this.store.activeTab();
    return tab === 'compare' ? null : tab;
  });

  protected readonly generatedAt = computed(() => formatTimestamp(this.store.generatedAt()));
}
