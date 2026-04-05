import { useEffect } from 'react';

/**
 * Se il totale pagine si riduce (es. dopo un filtro), riporta la pagina corrente all’ultima valida.
 */
export function useSyncPageToTotalPages(
  page: number,
  totalPages: number | undefined,
  setPage: (page: number) => void,
): void {
  useEffect(() => {
    if (totalPages == null || totalPages < 1) return;
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);
}
