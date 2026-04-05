import { useCallback, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

/**
 * Server-driven list sorting: omit query params until the user picks a column (backend default order applies).
 */
export function useListTableSort() {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const requestSort = useCallback((key: string) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const appendSortParams = useCallback(
    (params: URLSearchParams) => {
      if (sortBy) {
        params.set('sort_by', sortBy);
        params.set('sort_dir', sortDir);
      }
    },
    [sortBy, sortDir],
  );

  return { sortBy, sortDir, requestSort, appendSortParams };
}
