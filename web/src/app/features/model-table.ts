/**
 * The leaderboard table for one source. Columns come from core/columns.ts and
 * every cell renders through MetricCell, so provenance never gets lost between
 * the JSON and the screen.
 */

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { LeaderboardEntry, MetricSource, SourcedRow } from '@shared/leaderboard-types';
import { ALL_COLUMNS, type ColumnDef, type MetricKey } from '../core/columns';
import { formatContextWindow } from '../core/format';
import { LeaderboardStore } from '../core/leaderboard.store';
import { MetricCell } from './metric-cell';

@Component({
  selector: 'app-model-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MetricCell],
  template: `
    <div class="overflow-x-auto rounded-lg border border-neutral-800">
      <table class="w-full min-w-max text-sm">
        <thead class="bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-400">
          <tr>
            <th class="sticky left-0 z-10 bg-neutral-900 px-4 py-3 text-left font-medium">
              <button type="button" class="hover:text-neutral-100" (click)="store.toggleSort('label')">
                Model{{ sortMark('label') }}
              </button>
            </th>
            <th class="px-4 py-3 text-left font-medium">Creator</th>
            <th class="px-4 py-3 text-right font-medium">Context</th>
            @for (col of columns; track col.key) {
              <th class="px-4 py-3 text-right font-medium whitespace-nowrap">
                <button
                  type="button"
                  class="hover:text-neutral-100"
                  [title]="col.label"
                  (click)="store.toggleSort(col.key, col.higherIsBetter)"
                >
                  {{ col.short }}{{ sortMark(col.key) }}
                </button>
              </th>
            }
          </tr>
        </thead>

        <tbody class="divide-y divide-neutral-800/70">
          @for (entry of store.sortedEntries(); track entry.modelKey) {
            <tr class="transition-colors hover:bg-neutral-900/40" [class.opacity-40]="!hasData(entry)">
              <th scope="row" class="sticky left-0 z-10 bg-neutral-950 px-4 py-3 text-left font-medium text-neutral-100">
                <span class="flex items-center gap-2 whitespace-nowrap">
                  {{ entry.label }}
                  @if (entry.openWeights) {
                    <span
                      class="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-400"
                      title="Open weights"
                    >
                      OSS
                    </span>
                  }
                </span>
                @if (!hasData(entry)) {
                  <span class="block text-xs font-normal text-neutral-500">no data from this source</span>
                }
              </th>
              <td class="px-4 py-3 whitespace-nowrap text-neutral-400">{{ entry.creator }}</td>
              <td class="px-4 py-3 text-right tabular-nums text-neutral-400">
                {{ context(entry) }}
              </td>
              @for (col of columns; track col.key) {
                <td class="px-4 py-3 text-right">
                  <app-metric-cell
                    [metric]="cell(entry, col.key)"
                    [digits]="col.digits"
                    [unit]="col.unit"
                  />
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ModelTable {
  readonly source = input.required<MetricSource>();

  protected readonly store = inject(LeaderboardStore);
  protected readonly columns: readonly ColumnDef[] = ALL_COLUMNS;

  protected cell(entry: LeaderboardEntry, key: MetricKey) {
    const row = entry.bySource[this.source()];
    return (row?.[key as keyof SourcedRow] as never) ?? null;
  }

  protected hasData(entry: LeaderboardEntry): boolean {
    return Boolean(entry.bySource[this.source()]);
  }

  protected context(entry: LeaderboardEntry): string {
    return formatContextWindow(entry.contextWindow);
  }

  protected sortMark(key: MetricKey | 'label'): string {
    const sort = this.store.sort();
    if (sort.key !== key) return '';
    return sort.direction === 'asc' ? ' ↑' : ' ↓';
  }
}
