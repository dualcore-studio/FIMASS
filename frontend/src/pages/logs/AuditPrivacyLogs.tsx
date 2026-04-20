import { useCallback, useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { AuditLogEntry, PaginatedResponse } from '../../types';
import { formatDateTime } from '../../utils/helpers';
import TablePagination from '../../components/common/TablePagination';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';

export default function AuditPrivacyLogs() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponse<AuditLogEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSyncPageToTotalPages(page, result?.totalPages, setPage);

  const fetchLogs = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(TABLE_PAGE_SIZE));
      const data = await api.get<PaginatedResponse<AuditLogEntry>>(`/audit-logs?${qs.toString()}`);
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare l’audit.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <Shield className="h-7 w-7 text-[#0B4EA2]" strokeWidth={1.75} />
            Audit privacy
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Registro sintetico degli accessi e delle azioni sensibili (sola lettura).
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          </div>
        ) : !result?.data.length ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Nessun evento registrato.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Data/ora</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Utente</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Azione</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Entità</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">IP</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Dettaglio</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{row.user_id ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.action}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {row.entity_type || '—'}
                      {row.entity_id != null ? ` #${row.entity_id}` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.ip_address || '—'}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-600" title={row.metadata_json || ''}>
                      {row.metadata_json || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && result.totalPages > 1 ? (
          <div className="border-t border-gray-100 px-4 py-3">
            <TablePagination
              page={page}
              totalPages={result.totalPages}
              total={result.total}
              onPageChange={setPage}
              entityLabel="eventi"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
