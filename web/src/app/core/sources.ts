/**
 * Describes the data sources for the tab bar and the provenance badges.
 * Adding a third source later means adding an entry here plus a row builder
 * in the harness — the components read this, not a hardcoded list.
 */

import type { MetricSource } from '@shared/leaderboard-types';

export type TabId = MetricSource | 'compare';

export interface SourceMeta {
  id: MetricSource;
  label: string;
  /** One line explaining where the numbers come from. Shown under the tabs. */
  blurb: string;
  /** Tailwind classes for the badge. */
  badgeClass: string;
  dotClass: string;
}

export const SOURCES: readonly SourceMeta[] = [
  {
    id: 'measured',
    label: 'Measured',
    blurb: 'Measured by this project: streamed OpenRouter requests, median of N trials.',
    badgeClass: 'bg-measured/10 text-measured ring-1 ring-measured/30',
    dotClass: 'bg-measured',
  },
  {
    id: 'artificial-analysis',
    label: 'Artificial Analysis',
    blurb: 'Published by Artificial Analysis via their public API. Reference values, not ours.',
    badgeClass: 'bg-reference/10 text-reference ring-1 ring-reference/30',
    dotClass: 'bg-reference',
  },
] as const;

export const COMPARE_TAB = {
  id: 'compare' as const,
  label: 'Compare',
  blurb: 'Our measurements against the Artificial Analysis reference. Large gaps are worth a look.',
};

export function sourceMeta(id: MetricSource): SourceMeta {
  const found = SOURCES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown source "${id}"`);
  return found;
}
