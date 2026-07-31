/** Display helpers. No logic, just how numbers become strings. */

export const EMPTY = '--';

export function formatNumber(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? EMPTY
    : value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 131072 -> "128k". Context windows are unreadable in full. */
export function formatContextWindow(tokens: number | null): string {
  if (tokens === null) return EMPTY;
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_024)}k`;
  return String(tokens);
}

export function formatDelta(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) return EMPTY;
  return `${percent > 0 ? '+' : ''}${percent.toFixed(0)}%`;
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
