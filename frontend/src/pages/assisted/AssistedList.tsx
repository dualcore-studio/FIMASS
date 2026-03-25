import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { AssistedPerson, PaginatedResponse } from '../../types';

const LIMIT = 25;

export default function AssistedList() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [result, setResult] = useState<PaginatedResponse<AssistedPerson> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchAssisted = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(LIMIT));
      if (debouncedSearch.trim()) qs.set('search', debouncedSearch.trim());
      const data = await api.get<PaginatedResponse<AssistedPerson>>(`/assisted?${qs.toString()}`);
      setResult(data);
    } catch (e) {
      setResult(null);
      setListError(e instanceof ApiError ? e.message : 'Impossibile caricare gli assistiti.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchAssisted();
  }, [fetchAssisted]);

  const totalPages = result?.totalPages ?? 1;
  const rows = result?.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Assistiti</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Anagrafica delle persone assistite e relative pratiche.
        </p>
      </header>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Cerca per nome, cognome, codice fiscale, email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              <p className="text-sm text-gray-500">Caricamento assistiti…</p>
            </div>
          </div>
        ) : listError ? (
          <div className="p-8 text-center text-sm text-red-700">{listError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Nome e Cognome</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Codice Fiscale</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Telefono</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center">N. Preventivi</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center">N. Polizze</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <UserCheck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                      Nessun assistito trovato.
                    </td>
                  </tr>
                ) : (
                  rows.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {a.nome} {a.cognome}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {a.codice_fiscale || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {a.cellulare || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {a.email || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 font-medium">
                        {a.num_preventivi ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 font-medium">
                        {a.num_polizze ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <Link
                            to={`/assistiti/${a.id}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            title="Visualizza"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Visualizza
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !listError && result && result.total > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Mostrando{' '}
              <span className="font-medium text-gray-900">
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, result.total)}
              </span>{' '}
              di <span className="font-medium text-gray-900">{result.total}</span> assistiti
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary py-1.5 pl-2 pr-3 text-xs disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Precedente
              </button>
              <span className="text-sm text-gray-600">
                Pagina <span className="font-semibold text-gray-900">{page}</span> di {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary py-1.5 pl-3 pr-2 text-xs disabled:opacity-40"
              >
                Successiva
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
