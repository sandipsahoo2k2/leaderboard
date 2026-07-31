/**
 * The tab bar. Answers "which numbers am I looking at?" before anything else
 * on the page. Rendered from core/sources.ts, so a new source adds a tab here
 * with no edits to this file.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LeaderboardStore } from '../core/leaderboard.store';
import { COMPARE_TAB, SOURCES, type TabId } from '../core/sources';

@Component({
  selector: 'app-source-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-1 border-b border-neutral-800">
      @for (tab of tabs; track tab.id) {
        <button
          type="button"
          (click)="store.setTab(tab.id)"
          [class]="buttonClass(tab.id)"
          class="relative -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
        >
          @if (tab.dotClass) {
            <span class="h-2 w-2 rounded-full" [class]="tab.dotClass"></span>
          }
          {{ tab.label }}
          @if (tab.id === 'compare' && store.divergedCount() > 0) {
            <span class="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-red-400">
              {{ store.divergedCount() }}
            </span>
          }
        </button>
      }
    </div>

    <p class="mt-3 text-sm text-neutral-400">{{ activeBlurb() }}</p>
  `,
})
export class SourceTabs {
  protected readonly store = inject(LeaderboardStore);

  protected readonly tabs = [
    ...SOURCES.map((s) => ({ id: s.id as TabId, label: s.label, blurb: s.blurb, dotClass: s.dotClass })),
    { id: COMPARE_TAB.id as TabId, label: COMPARE_TAB.label, blurb: COMPARE_TAB.blurb, dotClass: '' },
  ];

  protected readonly activeBlurb = computed(
    () => this.tabs.find((t) => t.id === this.store.activeTab())?.blurb ?? '',
  );

  protected buttonClass(id: TabId): string {
    return this.store.activeTab() === id
      ? 'border-neutral-100 text-neutral-100'
      : 'border-transparent text-neutral-500 hover:text-neutral-300';
  }
}
