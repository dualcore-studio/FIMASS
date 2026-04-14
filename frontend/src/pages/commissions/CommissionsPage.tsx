import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, FileDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Commission, CommissionsListResponse, StructureOption } from '../../types';
import {
  formatDate,
  formatEuro,
  getCommissionTypeBadgeClass,
  getCommissionTypeLabel,
} from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import TablePagination from '../../components/common/TablePagination';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import { useListTableSort } from '../../hooks/useListTableSort';
import SortableTh from '../../components/common/SortableTh';
import Modal from '../../components/ui/Modal';

function buildQuery(params: {
  page: number;
  search: string;
  structureId: string;
  company: string;
  portal: string;
  dataDa: string;
  dataAl: string;
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
}): string {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('limit', String(TABLE_PAGE_SIZE));
  if (params.search.trim()) qs.set('search', params.search.trim());
  if (params.structureId) qs.set('structure_id', params.structureId);
  if (params.company.trim()) qs.set('company', params.company.trim());
  if (params.portal.trim()) qs.set('portal', params.portal.trim());
  if (params.dataDa) qs.set('data_da', params.dataDa);
  if (params.dataAl) qs.set('data_a', params.dataAl);
  if (params.sortBy) {
    qs.set('sort_by', params.sortBy);
    qs.set('sort_dir', params.sortDir);
  }
  return `/commissions?${qs.toString()}`;
}

function buildExportPdfQuery(params: {
  search: string;
  structureId: string;
  company: string;
  portal: string;
  dataDa: string;
  dataAl: string;
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
}): string {
  const qs = new URLSearchParams();
  if (params.search.trim()) qs.set('search', params.search.trim());
  if (params.structureId) qs.set('structure_id', params.structureId);
  if (params.company.trim()) qs.set('company', params.company.trim());
  if (params.portal.trim()) qs.set('portal', params.portal.trim());
  if (params.dataDa) qs.set('data_da', params.dataDa);
  if (params.dataAl) qs.set('data_a', params.dataAl);
  if (params.sortBy) {
    qs.set('sort_by', params.sortBy);
    qs.set('sort_dir', params.sortDir);
  }
  return `/commissions/export-pdf?${qs.toString()}`;
}

function SummaryCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: 'slate' | 'blue' | 'amber' | 'emerald';
}) {
  const ring =
    accent === 'blue'
      ? 'ring-blue-100'
      : accent === 'amber'
        ? 'ring-amber-100'
        : accent === 'emerald'
          ? 'ring-emerald-100'
          : 'ring-slate-100';
  return (
    <div className={`card p-4 ring-1 ${ring}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-gray-900">{value}</p>
    </div>
  );
}

export default function CommissionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStruttura = user?.role === 'struttura';

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [structureFilter, setStructureFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [portalFilter, setPortalFilter] = useState('');
  const [dataDa, setDataDa] = useState('');
  const [dataAl, setDataAl] = useState('');

  const [result, setResult] = useState<CommissionsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [structures, setStructures] = useState<StructureOption[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string | null>(null);

  const tableSort = useListTableSort();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get<StructureOption[]>('/users/structures')
      .then(setStructures)
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, structureFilter, companyFilter, portalFilter, dataDa, dataAl, tableSort.sortBy, tableSort.sortDir]);

  const fetchList = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const qs = buildQuery({
        page,
        search: debouncedSearch,
        structureId: isAdmin ? structureFilter : '',
        company: companyFilter,
        portal: portalFilter,
        dataDa,
        dataAl,
        sortBy: tableSort.sortBy,
        sortDir: tableSort.sortDir,
      });
      const data = await api.get<CommissionsListResponse>(qs);
      setResult(data);
    } catch (e) {
      setResult(null);
      setListError(e instanceof ApiError ? e.message : 'Impossibile caricare le provvigioni.');
    } finally {
      setLoading(false);
    }
  }, [
    page,
    debouncedSearch,
    structureFilter,
    companyFilter,
    portalFilter,
    dataDa,
    dataAl,
    tableSort.sortBy,
    tableSort.sortDir,
    isAdmin,
  ]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const totalPages = result?.totalPages ?? 1;
  useSyncPageToTotalPages(page, result?.totalPages, setPage);

  const rows = result?.data ?? [];
  const summary = result?.summary;

  const handleExportPdf = async () => {
    setExportPdfError(null);
    setExportingPdf(true);
    try {
      const endpoint = buildExportPdfQuery({
        search: debouncedSearch,
        structureId: isAdmin ? structureFilter : '',
        company: companyFilter,
        portal: portalFilter,
        dataDa,
        dataAl,
        sortBy: tableSort.sortBy,
        sortDir: tableSort.sortDir,
      });
      const fname = `provvigioni-${new Date().toISOString().slice(0, 10)}.pdf`;
      await api.download(endpoint, fname);
    } catch (e) {
      setExportPdfError(e instanceof ApiError ? e.message : 'Esportazione PDF non riuscita.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    setDeleteSubmitting(true);
    setActionError(null);
    try {
      await api.delete(`/commissions/${deleteId}`);
      setDeleteId(null);
      await fetchList();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Eliminazione non riuscita.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const tf = 'input-field h-9 w-full min-w-0 py-1.5 text-sm';

  if (!isAdmin && !isStruttura) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {isAdmin ? 'Provvigioni' : 'Le tue provvigioni'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {isAdmin
              ? 'Registrazione manuale delle polizze emesse con dati economici e calcolo automatico delle quote struttura.'
              : 'Elenco delle provvigioni registrate per la tua struttura.'}
          </p>
        </div>
        {isAdmin ? (
          <Link to="/provvigioni/nuovo" className="btn-primary inline-flex items-center gap-2 self-start">
            <Plus className="h-4 w-4" />
            Nuova provvigione
          </Link>
        ) : null}
      </header>

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>
      ) : null}

      {summary ? (
        isAdmin ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard title="Totale polizze" value={String(summary.totale_polizze)} accent="slate" />
            <SummaryCard title="Totale premi" value={formatEuro(summary.totale_premi)} accent="blue" />
            <SummaryCard
              title="Totale provvigioni Sportello Amico"
              value={formatEuro(summary.totale_sportello_amico)}
              accent="amber"
            />
            <SummaryCard
              title="Totale provvigioni strutture"
              value={formatEuro(summary.totale_provigioni_strutture)}
              accent="emerald"
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard title="Totale polizze" value={String(summary.totale_polizze)} accent="slate" />
            <SummaryCard title="Totale premi" value={formatEuro(summary.totale_premi)} accent="blue" />
            <SummaryCard title="Totale provvigioni" value={formatEuro(summary.totale_provigioni_strutture)} accent="emerald" />
          </div>
        )
      ) : null}

      <div className="card px-2.5 py-2 sm:px-3 sm:py-2">
        <div className="flex w-full flex-col flex-wrap items-end gap-2 lg:flex-row lg:flex-nowrap">
          <div className="flex min-w-[9rem] w-full flex-1 flex-col gap-px lg:min-w-0">
            <label htmlFor="comm-search" className="text-[11px] font-normal text-gray-600">
              Ricerca
            </label>
            <input
              id="comm-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cliente, polizza, note…"
              className={tf}
            />
          </div>
          {isAdmin ? (
            <div className="flex min-w-[9rem] w-full flex-1 flex-col gap-px lg:min-w-0">
              <label htmlFor="comm-struttura" className="whitespace-nowrap text-[11px] font-normal text-gray-600">
                Struttura
              </label>
              <select
                id="comm-struttura"
                value={structureFilter}
                onChange={(e) => setStructureFilter(e.target.value)}
                className={tf}
              >
                <option value="">Tutte</option>
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.denominazione || `Struttura #${s.id}`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex min-w-[9rem] w-full flex-1 flex-col gap-px lg:min-w-0">
            <label htmlFor="comm-company" className="whitespace-nowrap text-[11px] font-normal text-gray-600">
              Compagnia
            </label>
            <input
              id="comm-company"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className={tf}
            />
          </div>
          <div className="flex min-w-[9rem] w-full flex-1 flex-col gap-px lg:min-w-0">
            <label htmlFor="comm-portal" className="whitespace-nowrap text-[11px] font-normal text-gray-600">
              Portale
            </label>
            <input id="comm-portal" value={portalFilter} onChange={(e) => setPortalFilter(e.target.value)} className={tf} />
          </div>
          <div className="flex min-w-[9rem] w-full flex-1 flex-col gap-px lg:min-w-0">
            <label htmlFor="comm-da" className="whitespace-nowrap text-[11px] font-normal text-gray-600">
              Data da
            </label>
            <input id="comm-da" type="date" value={dataDa} onChange={(e) => setDataDa(e.target.value)} className={tf} />
          </div>
          <div className="flex min-w-[9rem] w-full flex-1 flex-col gap-px lg:min-w-0">
            <label htmlFor="comm-a" className="whitespace-nowrap text-[11px] font-normal text-gray-600">
              Data a
            </label>
            <input id="comm-a" type="date" value={dataAl} onChange={(e) => setDataAl(e.target.value)} className={tf} />
          </div>
          <div className="flex w-full shrink-0 justify-end pt-2 lg:w-auto lg:pt-0">
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={exportingPdf}
              className="btn-secondary inline-flex h-9 w-full items-center justify-center gap-2 whitespace-nowrap px-3 text-sm sm:w-auto disabled:opacity-60"
            >
              <FileDown className="h-4 w-4 shrink-0" />
              {exportingPdf ? 'PDF…' : 'Esporta PDF'}
            </button>
          </div>
        </div>
        {exportPdfError ? (
          <p className="mt-2 text-sm text-red-700">{exportPdfError}</p>
        ) : null}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              <p className="text-sm text-gray-500">Caricamento…</p>
            </div>
          </div>
        ) : listError ? (
          <div className="p-8 text-center text-sm text-red-700">{listError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <SortableTh sortKey="date" activeKey={tableSort.sortBy} direction={tableSort.sortDir} onRequestSort={tableSort.requestSort}>
                    Data
                  </SortableTh>
                  <SortableTh
                    sortKey="customer_name"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Cliente
                  </SortableTh>
                  <SortableTh
                    sortKey="policy_number"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    N. Polizza
                  </SortableTh>
                  {isAdmin ? (
                    <SortableTh
                      sortKey="structure_name"
                      activeKey={tableSort.sortBy}
                      direction={tableSort.sortDir}
                      onRequestSort={tableSort.requestSort}
                    >
                      Struttura
                    </SortableTh>
                  ) : null}
                  <SortableTh sortKey="portal" activeKey={tableSort.sortBy} direction={tableSort.sortDir} onRequestSort={tableSort.requestSort}>
                    Portale
                  </SortableTh>
                  <SortableTh sortKey="company" activeKey={tableSort.sortBy} direction={tableSort.sortDir} onRequestSort={tableSort.requestSort}>
                    Compagnia
                  </SortableTh>
                  <SortableTh
                    sortKey="policy_premium"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Premio
                  </SortableTh>
                  {isAdmin ? (
                    <SortableTh
                      sortKey="client_invoice"
                      activeKey={tableSort.sortBy}
                      direction={tableSort.sortDir}
                      onRequestSort={tableSort.requestSort}
                    >
                      Fattura cliente
                    </SortableTh>
                  ) : null}
                  {isAdmin ? (
                    <SortableTh
                      sortKey="sportello_amico_commission"
                      activeKey={tableSort.sortBy}
                      direction={tableSort.sortDir}
                      onRequestSort={tableSort.requestSort}
                    >
                      Prov. S.A.
                    </SortableTh>
                  ) : null}
                  <th className="px-4 py-3 font-semibold text-gray-700">Tipo</th>
                  {isAdmin ? <th className="px-4 py-3 font-semibold text-gray-700">%</th> : null}
                  <SortableTh
                    sortKey="structure_commission_amount"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    {isAdmin ? 'Prov. struttura' : 'La tua provvigione'}
                  </SortableTh>
                  {isAdmin ? <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 13 : 8} className="px-4 py-12 text-center text-gray-500">
                      Nessuna provvigione con i filtri selezionati.
                    </td>
                  </tr>
                ) : (
                  rows.map((r: Commission) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDate(r.date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.customer_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-800">{r.policy_number}</td>
                      {isAdmin ? (
                        <td className="px-4 py-3 text-gray-700">{r.structure_name ?? '—'}</td>
                      ) : null}
                      <td className="px-4 py-3 text-gray-700">{r.portal ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{r.company ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-800">{formatEuro(r.policy_premium)}</td>
                      {isAdmin ? (
                        <td className="whitespace-nowrap px-4 py-3 text-gray-800">{formatEuro(r.client_invoice)}</td>
                      ) : null}
                      {isAdmin ? (
                        <td className="whitespace-nowrap px-4 py-3 text-gray-800">{formatEuro(r.sportello_amico_commission)}</td>
                      ) : null}
                      <td className="px-4 py-3">
                        <span className={`badge ${getCommissionTypeBadgeClass(r.structure_commission_type)}`}>
                          {getCommissionTypeLabel(r.structure_commission_type)}
                        </span>
                      </td>
                      {isAdmin ? (
                        <td className="whitespace-nowrap px-4 py-3 text-gray-800">{r.structure_commission_percentage}%</td>
                      ) : null}
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">
                        {formatEuro(r.structure_commission_amount)}
                      </td>
                      {isAdmin ? (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Link
                              to={`/provvigioni/${r.id}/modifica`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              title="Modifica"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setDeleteId(r.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                              title="Elimina"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !listError && result && result.total > 0 ? (
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={result.total}
            onPageChange={setPage}
            entityLabel="provvigioni"
          />
        ) : null}
      </div>

      <Modal
        isOpen={deleteId != null}
        onClose={() => {
          if (!deleteSubmitting) setDeleteId(null);
        }}
        title="Elimina provvigione"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Confermi l&apos;eliminazione di questa provvigione? L&apos;operazione non è reversibile.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" disabled={deleteSubmitting} onClick={() => setDeleteId(null)} className="btn-secondary">
              Annulla
            </button>
            <button
              type="button"
              disabled={deleteSubmitting}
              onClick={handleDelete}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {deleteSubmitting ? 'Eliminazione…' : 'Elimina'}
            </button>
          </div>
        </div>
      </Modal>

      {isStruttura ? (
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <Banknote className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
          Qui vedi solo le provvigioni registrate a nome della tua struttura e l&apos;importo che ti spetta (non gli importi
          Sportello Amico).
        </p>
      ) : null}
    </div>
  );
}
