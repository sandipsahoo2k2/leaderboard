/**
 * Measured against the Artificial Analysis reference, field by field.
 *
 * This is the validation view: if our tokens/sec is far off theirs, the harness
 * is probably wrong. TTFT gaps are expected — different network vantage point,
 * different provider routing — so read them with that in mind.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIVERGENCE_THRESHOLD_PERCENT } from '@shared/compare';
import { columnFor, type MetricKey } from '../core/columns';
import { formatDelta, formatNumber } from '../core/format';
import { LeaderboardStore } from '../core/leaderboard.store';

@Component({
  selector: 'app-compare-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto rounded-lg border border-neutral-800">
      <table class="w-full min-w-max text-sm">
        <thead class="bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-400">
          <tr>
            <th class="px-4 py-3 text-left font-medium">Model</th>
            <th class="px-4 py-3 text-left font-medium">Metric</th>
            <th class="px-4 py-3 text-right font-medium">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-1.5 w-1.5 rounded-full bg-measured"></span>Measured
              </span>
            </th>
            <th class="px-4 py-3 text-right font-medium">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-1.5 w-1.5 rounded-full bg-reference"></span>Artificial Analysis
              </span>
            </th>
            <th class="px-4 py-3 text-right font-medium">Delta</th>
            <th class="px-4 py-3 text-left font-medium">Status</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-neutral-800/70">
          @for (d of store.divergences(); track d.modelKey + d.field) {
            <tr class="hover:bg-neutral-900/40">
              <td class="px-4 py-3 font-medium whitespace-nowrap text-neutral-100">{{ d.label }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-neutral-400">{{ metricLabel(d.field) }}</td>
              <td class="px-4 py-3 text-right tabular-nums">{{ num(d.measured, d.field) }}</td>
              <td class="px-4 py-3 text-right tabular-nums">{{ num(d.reference, d.field) }}</td>
              <td class="px-4 py-3 text-right tabular-nums" [class]="deltaClass(d.status)">
                {{ delta(d.deltaPercent) }}
              </td>
              <td class="px-4 py-3">
                <span class="rounded px-2 py-0.5 text-xs font-medium" [class]="badgeClass(d.status)">
                  {{ d.status }}
                </span>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="px-4 py-8 text-center text-neutral-500">
                Nothing to compare yet — run the harness with an Artificial Analysis key.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <p class="mt-3 text-xs text-neutral-500">
      <strong class="text-neutral-400">ok</strong> = within {{ threshold }}% of the reference.
      <strong class="text-neutral-400">diverged</strong> = further apart than that.
      <strong class="text-neutral-400">missing</strong> = one side had no number.
    </p>
  `,
})
export class CompareTable {
  protected readonly store = inject(LeaderboardStore);
  protected readonly threshold = DIVERGENCE_THRESHOLD_PERCENT;

  protected metricLabel(field: string): string {
    return columnFor(field as MetricKey).label;
  }

  protected num(value: number | null, field: string): string {
    return formatNumber(value, columnFor(field as MetricKey).digits);
  }

  protected delta(percent: number | null): string {
    return formatDelta(percent);
  }

  protected deltaClass(status: string): string {
    return status === 'diverged' ? 'text-red-400' : 'text-neutral-300';
  }

  protected badgeClass(status: string): string {
    switch (status) {
      case 'ok':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'diverged':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-neutral-700/40 text-neutral-400';
    }
  }
}
