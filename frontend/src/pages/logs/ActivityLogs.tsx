import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Filter,
  ClipboardList,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { ActivityLog, PaginatedResponse } from '../../types';
import { formatDateTime, getRoleLabel } from '../../utils/helpers';
import TablePagination from '../../components/common/TablePagination';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import { useListTableSort } from '../../hooks/useListTableSort';
import SortableTh from '../../components/common/SortableTh';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-500',
  update: 'bg-blue-500',
  delete: 'bg-red-500',
  status_change: 'bg-amber-500',
  login: 'bg-purple-500',
  logout: 'bg-gray-400',
  upload: 'bg-cyan-500',
  assign: 'bg-indigo-500',
};

function getActionDotColor(azione: string): string {
  const key = azione.toLowerCase().replace(/\s+/g, '_');
  for (const [pattern, color] of Object.entries(ACTION_COLORS)) {
    if (key.includes(pattern)) return color;
  }
  return 'bg-gray-400';
}

export default function ActivityLogs() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [azioneFilter, setAzioneFilter] = useState('');
  const [moduloFilter, setModuloFilter] = useState('');
  const [dataDa, setDataDa] = useState('');
  const [dataA, setDataA] = useState('');

  const [result, setResult] = useState<PaginatedResponse<ActivityLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [actions, setActions] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);

  const tableSort = useListTableSort();

  useEffect(() => {
    api.get<string[]>('/logs/actions').then(setActions).catch(() => {});
    api.get<string[]>('/logs/modules').then(setModules).catch(() => {});
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, azioneFilter, moduloFilter, dataDa, dataA, tableSort.sortBy, tableSort.sortDir]);

  const fetchLogs = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(TABLE_PAGE_SIZE));
      if (debouncedSearch.trim()) qs.set('search', debouncedSearch.trim());
      if (azioneFilter) qs.set('azione', azioneFilter);
      if (moduloFilter) qs.set('modulo', moduloFilter);
      if (dataDa) qs.set('data_da', dataDa);
      if (dataA) qs.set('data_a', dataA);
      if (tableSort.sortBy) {
        qs.set('sort_by', tableSort.sortBy);
        qs.set('sort_dir', tableSort.sortDir);
      }

      const data = await api.get<PaginatedResponse<ActivityLog>>(`/logs?${qs.toString()}`);
      setResult(data);
    } catch (e) {
      setResult(null);
      setListError(e instanceof ApiError ? e.message : 'Impossibile caricare i log.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, azioneFilter, moduloFilter, dataDa, dataA, tableSort.sortBy, tableSort.sortDir]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = result?.totalPages ?? 1;
  useSyncPageToTotalPages(page, result?.totalPages, setPage);

  const rows = result?.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Log Attività</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Registro completo delle operazioni effettuate sul portale.
        </p>
      </header>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
          <Filter className="h-4 w-4" />
          Filtri
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end lg:gap-3">
          <div className="min-w-0 lg:min-w-[12rem] lg:flex-1">
            <label htmlFor="filter-search-log" className="mb-1 block text-xs font-medium text-gray-500">
              Cerca
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="filter-search-log"
                type="search"
                placeholder="Cerca utente, dettaglio…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-44">
            <label htmlFor="filter-azione" className="mb-1 block text-xs font-medium text-gray-500">Azione</label>
            <select id="filter-azione" value={azioneFilter} onChange={(e) => setAzioneFilter(e.target.value)} className="input-field w-full">
              <option value="">Tutte le azioni</option>
              {actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="w-full shrink-0 lg:w-44">
            <label htmlFor="filter-modulo" className="mb-1 block text-xs font-medium text-gray-500">Modulo</label>
            <select id="filter-modulo" value={moduloFilter} onChange={(e) => setModuloFilter(e.target.value)} className="input-field w-full">
              <option value="">Tutti i moduli</option>
              {modules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="w-full shrink-0 lg:w-40">
            <label htmlFor="filter-data-da" className="mb-1 block text-xs font-medium text-gray-500">Da</label>
            <input id="filter-data-da" type="date" value={dataDa} onChange={(e) => setDataDa(e.target.value)} className="input-field w-full" />
          </div>

          <div className="w-full shrink-0 lg:w-40">
            <label htmlFor="filter-data-a" className="mb-1 block text-xs font-medium text-gray-500">A</label>
            <input id="filter-data-a" type="date" value={dataA} onChange={(e) => setDataA(e.target.value)} className="input-field w-full" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              <p className="text-sm text-gray-500">Caricamento log…</p>
            </div>
          </div>
        ) : listError ? (
          <div className="p-8 text-center text-sm text-red-700">{listError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <SortableTh
                    sortKey="created_at"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Data/Ora
                  </SortableTh>
                  <SortableTh
                    sortKey="utente"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Utente
                  </SortableTh>
                  <SortableTh
                    sortKey="ruolo"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Ruolo
                  </SortableTh>
                  <SortableTh
                    sortKey="azione"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Azione
                  </SortableTh>
                  <SortableTh
                    sortKey="modulo"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Modulo
                  </SortableTh>
                  <SortableTh
                    sortKey="dettaglio"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Dettaglio
                  </SortableTh>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <ClipboardList className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                      Nessun log trovato con i filtri selezionati.
                    </td>
                  </tr>
                ) : (
                  rows.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {log.utente_nome}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge bg-gray-100 text-gray-700">
                          {getRoleLabel(log.ruolo)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${getActionDotColor(log.azione)}`} />
                          <span className="text-gray-700">{log.azione}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{log.modulo}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={log.dettaglio || undefined}>
                        {log.dettaglio || <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !listError && result && result.total > 0 && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={result.total}
            onPageChange={setPage}
            entityLabel="log"
          />
        )}
      </div>
    </div>
  );
}
