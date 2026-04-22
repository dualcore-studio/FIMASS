import type { DetailFieldColSpan } from './DetailField';

/** Human-readable label from a snake_case or API key. */
export function formatDetailRecordKey(key: string): string {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Pick grid span for long or multiline values in a multi-column detail grid. */
export function detailColSpanFromDisplayString(display: string): DetailFieldColSpan {
  const t = display.trim();
  if (!t) return 1;
  if (t.includes('\n') || t.length > 140) return 'full';
  if (t.length > 72) return 2;
  return 1;
}
