/**
 * The "who leads what" strip above the table, mirroring Artificial Analysis'
 * summary cards. Driven by HIGHLIGHT_KEYS in core/columns.ts.
 */

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { MetricSource, SourcedRow } from '@shared/leaderboard-types';
import { metricValue } from '@shared/compare';
import { HIGHLIGHT_KEYS, columnFor } from '../core/columns';
import { formatNumber } from '../core/format';
import { LeaderboardStore } from '../core/leaderboard.store';
import { sourceMeta } from '../core/sources';

interface Highlight {
  title: string;
  winner: string;
  value: string;
  unit: string;
}

@Component({
  selector: 'app-ranking-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      @for (h of highlights(); track h.title) {
        <!-- cards with no winner for this source are dropped, not shown as "--" -->
        <div class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <div class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-neutral-500">
            <span class="h-1.5 w-1.5 rounded-full" [class]="dotClass()"></span>
            {{ h.title }}
          </div>
          <div class="mt-2 truncate text-lg font-semibold text-neutral-100">{{ h.winner }}</div>
          <div class="text-sm tabular-nums text-neutral-400">{{ h.value }} {{ h.unit }}</div>
        </div>
      }
    </div>
  `,
})
export class RankingCards {
  readonly source = input.required<MetricSource>();

  private readonly store = inject(LeaderboardStore);

  protected readonly dotClass = computed(() => sourceMeta(this.source()).dotClass);

  protected readonly highlights = computed<Highlight[]>(() => {
    const source = this.source();
    const entries = this.store.entries();

    return HIGHLIGHT_KEYS.flatMap((key) => {
      const col = columnFor(key);
      const scored = entries
        .map((e) => ({ label: e.label, value: metricValue(e.bySource[source], key as keyof SourcedRow) }))
        .filter((x): x is { label: string; value: number } => x.value !== null);

      scored.sort((a, b) => (col.higherIsBetter ? b.value - a.value : a.value - b.value));
      const best = scored[0];
      // A source that does not report this metric gets no card at all, rather
      // than a card reading "--".
      if (!best) return [];

      return [
        {
          title: col.higherIsBetter ? `Highest ${col.label.toLowerCase()}` : `Lowest ${col.label.toLowerCase()}`,
          winner: best.label,
          value: formatNumber(best.value, col.digits),
          unit: col.unit ?? '',
        },
      ];
    });
  });
}
