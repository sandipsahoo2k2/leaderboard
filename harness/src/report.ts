/** Terminal formatting. Kept apart from logic so commands stay readable. */

export function fmt(value: number | null | undefined, digits = 1, dash = '--'): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? dash
    : value.toFixed(digits);
}

/** Left-aligns the first column, right-aligns the rest. */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!)))
      .join('  ');

  return [line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

export function heading(text: string): string {
  return `\n${text}\n${'='.repeat(text.length)}`;
}
