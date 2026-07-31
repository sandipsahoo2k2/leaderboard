/**
 * Loads data/latest.json and holds the page's view state: which tab is active
 * and how the table is sorted. Components stay dumb and read signals off this.
 */

import { Injectable, computed, resource, signal } from '@angular/core';
import type { LeaderboardEntry, LeaderboardSnapshot, MetricSource, SourcedRow } from '@shared/leaderboard-types';
import { compareEntry, metricValue } from '@shared/compare';
import type { MetricKey } from './columns';
import type { TabId } from './sources';

export interface SortState {
  key: MetricKey | 'label';
  direction: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class LeaderboardStore {
  /** Relative to <base href> so it works at any GitHub Pages sub-path. */
  private readonly dataUrl = new URL('data/latest.json', document.baseURI).toString();

  readonly snapshot = resource<LeaderboardSnapshot, unknown>({
    loader: async ({ abortSignal }) => {
      const res = await fetch(this.dataUrl, { signal: abortSignal, cache: 'no-cache' });
      if (!res.ok) throw new Error(`Could not load ${this.dataUrl} (${res.status})`);
      return (await res.json()) as LeaderboardSnapshot;
    },
  });

  readonly activeTab = signal<TabId>('measured');
  readonly sort = signal<SortState>({ key: 'intelligenceIndex', direction: 'desc' });

  readonly entries = computed<LeaderboardEntry[]>(() => this.snapshot.value()?.entries ?? []);
  readonly generatedAt = computed(() => this.snapshot.value()?.generatedAt ?? null);
  readonly isEmpty = computed(() => !this.snapshot.isLoading() && this.entries().length === 0);

  /** Entries sorted for the currently active source tab. Nulls always sink. */
  readonly sortedEntries = computed<LeaderboardEntry[]>(() => {
    const tab = this.activeTab();
    const source: MetricSource = tab === 'compare' ? 'measured' : tab;
    const { key, direction } = this.sort();
    const sign = direction === 'asc' ? 1 : -1;

    return [...this.entries()].sort((a, b) => {
      if (key === 'label') return sign * a.label.localeCompare(b.label);
      const av = metricValue(a.bySource[source], key as keyof SourcedRow);
      const bv = metricValue(b.bySource[source], key as keyof SourcedRow);
      if (av === null && bv === null) return a.label.localeCompare(b.label);
      if (av === null) return 1;
      if (bv === null) return -1;
      return sign * (av - bv);
    });
  });

  /** Flat list of measured-vs-reference deltas, for the Compare tab. */
  readonly divergences = computed(() =>
    this.entries().flatMap((entry) =>
      compareEntry(entry).map((d) => ({ ...d, label: entry.label })),
    ),
  );

  readonly divergedCount = computed(
    () => this.divergences().filter((d) => d.status === 'diverged').length,
  );

  setTab(tab: TabId): void {
    this.activeTab.set(tab);
  }

  /** Clicking a header sorts by it; clicking again flips direction. */
  toggleSort(key: MetricKey | 'label', higherIsBetter = true): void {
    const current = this.sort();
    if (current.key === key) {
      this.sort.set({ key, direction: current.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      this.sort.set({ key, direction: higherIsBetter ? 'desc' : 'asc' });
    }
  }

  reload(): void {
    this.snapshot.reload();
  }
}
