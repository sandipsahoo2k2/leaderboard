/**
 * One number, plus where it came from.
 *
 * The dot is the provenance marker — cyan for our own measurements, amber for
 * Artificial Analysis. Hovering gives the capture time and trial count, so no
 * value on this page is ever anonymous.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Metric } from '@shared/leaderboard-types';
import { EMPTY, formatNumber, formatTimestamp } from '../core/format';
import { sourceMeta } from '../core/sources';

@Component({
  selector: 'app-metric-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (metric(); as m) {
      <span class="inline-flex items-center gap-1.5" [title]="tooltip()">
        <span class="h-1.5 w-1.5 shrink-0 rounded-full" [class]="dotClass()"></span>
        <span class="tabular-nums">{{ text() }}</span>
      </span>
    } @else {
      <span class="text-neutral-600">{{ empty }}</span>
    }
  `,
})
export class MetricCell {
  readonly metric = input.required<Metric | null>();
  readonly digits = input(1);
  readonly unit = input<string | undefined>(undefined);

  readonly empty = EMPTY;

  protected readonly text = computed(() => {
    const m = this.metric();
    if (!m || m.value === null) return EMPTY;
    const unit = this.unit();
    return formatNumber(m.value, this.digits()) + (unit ? ` ${unit}` : '');
  });

  protected readonly dotClass = computed(() => {
    const m = this.metric();
    return m ? sourceMeta(m.source).dotClass : 'bg-neutral-700';
  });

  protected readonly tooltip = computed(() => {
    const m = this.metric();
    if (!m) return '';
    const meta = sourceMeta(m.source);
    const trials = m.sampleSize ? `, median of ${m.sampleSize} trials` : '';
    return `${meta.label}${trials} — captured ${formatTimestamp(m.capturedAt)}`;
  });
}
