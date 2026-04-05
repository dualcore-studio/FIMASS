import type { SortDirection } from '../hooks/useListTableSort';

export function sortDirectionMultiplier(dir: SortDirection): 1 | -1 {
  return dir === 'asc' ? 1 : -1;
}

export function compareStringsCaseInsensitive(a: string, b: string, mult: 1 | -1): number {
  const sa = a.toLowerCase();
  const sb = b.toLowerCase();
  if (sa < sb) return -1 * mult;
  if (sa > sb) return 1 * mult;
  return 0;
}

export function compareNullableStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  mult: 1 | -1,
): number {
  return compareStringsCaseInsensitive(a ?? '', b ?? '', mult);
}

export function compareNumbers(a: number, b: number, mult: 1 | -1): number {
  return (a - b) * mult;
}

export function compareBooleans(a: boolean, b: boolean, mult: 1 | -1): number {
  return (Number(a) - Number(b)) * mult;
}
