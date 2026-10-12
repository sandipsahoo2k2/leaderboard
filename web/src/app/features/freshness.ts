/**
 * When the data was last refreshed, and by which job.
 *
 * The page is static — a GitHub Action produces data/latest.json and the build
 * bakes it in, so a visitor's browser never calls an API. That makes "how old
 * is this?" the first thing a reader needs to know, not a footnote.
 *
 * The two timestamps differ on purpose: the hourly job refetches Artificial
 * Analysis while carrying the previous measured rows over untouched.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { formatRelative, formatTimestamp } from '../core/format';
import { LeaderboardStore } from '../core/leaderboard.store';

@Component({
  selector: 'app-freshness',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
      <span class="inline-flex items-center gap-1.5">
        <span class="h-1.5 w-1.5 rounded-full" [class]="staleClass()"></span>
        <span class="text-neutral-300">Updated {{ relative() }}</span>
        <span class="text-neutral-600">({{ absolute() }})</span>
      </span>

      @if (referenceAge(); as ref) {
        <span class="inline-flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 rounded-full bg-reference"></span>
          Artificial Analysis pulled {{ ref }}
        </span>
      }

      @if (measuredAge(); as own) {
        <span class="inline-flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 rounded-full bg-measured"></span>
          measured {{ own }}
        </span>
      }

      <span class="text-neutral-600">Refreshes hourly via GitHub Actions</span>
    </div>
  `,
})
export class Freshness {
  private readonly store = inject(LeaderboardStore);

  /** Re-read on each change detection so "x minutes ago" does not freeze. */
  private readonly now = signal(Date.now());

  protected readonly relative = computed(() => {
    this.now();
    return formatRelative(this.store.generatedAt());
  });

  protected readonly absolute = computed(() => formatTimestamp(this.store.generatedAt()));
  protected readonly referenceAge = computed(() => rel(this.store.referenceCapturedAt()));
  protected readonly measuredAge = computed(() => rel(this.store.measuredCapturedAt()));

  /** Amber past two hours, red past a day — the hourly job has stopped. */
  protected readonly staleClass = computed(() => {
    const at = this.store.generatedAt();
    if (!at) return 'bg-neutral-600';
    const hours = (Date.now() - new Date(at).getTime()) / 3_600_000;
    if (hours > 24) return 'bg-red-500';
    if (hours > 2) return 'bg-amber-500';
    return 'bg-emerald-500';
  });

  constructor() {
    // Keep the relative label honest on a page left open.
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}

function rel(iso: string | null): string | null {
  return iso ? formatRelative(iso) : null;
}
