import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, FileDown, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Commission, CommissionsListResponse, StructureOption } from '../../types';
import {
  formatDate,
  formatEuro,
  formatCommissionEuro,
  getCommissionTypeBadgeClass,
  getCommissionTypeLabel,
  getCommissionValorizationBadgeClass,
  getCommissionValorizationLabel,
} from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import TablePagination from '../../components/common/TablePagination';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import { useListTableSort } from '../../hooks/useListTableSort';
import SortableTh from '../../components/common/SortableTh';
import Modal from '../../components/ui/Modal';
import CommissionAmountsModal from './CommissionAmountsModal';

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

function CommissionRowActions({
  row,
  onAmounts,
  onDelete,
}: {
  row: Commission;
  onAmounts: () => void;
  onDelete: () => void;
}) {
  const isDaValorizzare = row.commission_status === 'DA_VALORIZZARE';
  const btnBase =
    'inline-flex shrink-0 items-center justify-center rounded-md border px-2 py-1 text-[11px] font-semibold leading-tight shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={onAmounts}
        className={`${btnBase} border-slate-200 bg-white text-gray-800 hover:border-blue-300 hover:bg-blue-50`}
      >
        {isDaValorizzare ? 'Inserisci importi' : 'Modifica'}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={`${btnBase} border-red-200/90 bg-white text-red-700 hover:border-red-300 hover:bg-red-50`}
      >
        Elimina
      </button>
    </div>
  );
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
  const isFullAccess = isAdmin || user?.role === 'fornitore';

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
  const [amountsModalRow, setAmountsModalRow] = useState<Commission | null>(null);

  const tableSort = useListTableSort();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!isFullAccess) return;
    api
      .get<StructureOption[]>('/users/structures')
      .then(setStructures)
      .catch(() => {});
  }, [isFullAccess]);

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
        structureId: isFullAccess ? structureFilter : '',
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
    isFullAccess,
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
        structureId: isFullAccess ? structureFilter : '',
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

  if (!isFullAccess && !isStruttura) return null;

  return (
    <div className="w-full max-w-full min-w-0 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {isFullAccess ? 'Provvigioni' : 'Le tue provvigioni'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {isFullAccess
              ? 'Registra le polizze con o senza importi; le righe senza provv. broker restano “Da valorizzare” fino al completamento economico.'
              : 'Elenco delle provvigioni registrate per la tua struttura.'}
          </p>
        </div>
        {isFullAccess ? (
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
        isFullAccess ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <SummaryCard title="Totale polizze" value={String(summary.totale_polizze)} accent="slate" />
            <SummaryCard title="Totale premi" value={formatEuro(summary.totale_premi)} accent="blue" />
            <SummaryCard
              title="Totale provvigioni broker"
              value={formatEuro(summary.totale_provigioni_broker)}
              accent="slate"
            />
            <SummaryCard
              title="Quota Sportello Amico (65%)"
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
          {isFullAccess ? (
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

      <div className="card w-full max-w-full min-w-0 overflow-hidden">
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
          <>
            <div className="border-b border-slate-200/80 p-4 md:hidden">
              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">Nessuna provvigione con i filtri selezionati.</p>
              ) : (
                <ul className="space-y-3">
                  {rows.map((r: Commission) => {
                    const highlight = r.commission_status === 'DA_VALORIZZARE';
                    return (
                      <li
                        key={r.id}
                        className={`rounded-xl border border-slate-200/90 p-4 shadow-sm ${highlight ? 'border-amber-200/80 bg-amber-50/35' : 'bg-white'}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold leading-snug text-gray-900">{r.customer_name}</p>
                            <p className="font-mono text-xs text-gray-500">{r.policy_number}</p>
                          </div>
                          <span className="shrink-0 text-xs text-gray-600">{formatDate(r.date)}</span>
                        </div>
                        <dl className="mt-3 space-y-2 text-sm">
                          {isFullAccess ? (
                            <div className="flex gap-2">
                              <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Struttura</dt>
                              <dd className="min-w-0 flex-1 text-gray-800">{r.structure_name ?? '—'}</dd>
                            </div>
                          ) : null}
                          <div className="flex gap-2">
                            <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Portale</dt>
                            <dd className="min-w-0 flex-1 truncate text-gray-800">{r.portal ?? '—'}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Compagnia</dt>
                            <dd className="min-w-0 flex-1 truncate text-gray-800">{r.company ?? '—'}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Premio</dt>
                            <dd className="tabular-nums text-gray-900">{formatEuro(r.policy_premium)}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Provvigioni</dt>
                            <dd className="min-w-0 flex-1 space-y-1 text-xs text-gray-800">
                              {isFullAccess ? (
                                <>
                                  <div>
                                    <span className="text-gray-500">Provv. broker: </span>
                                    <span className="tabular-nums">
                                      {formatCommissionEuro(r.provvigioni_broker ?? r.broker_commission ?? null)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Quota S.A.: </span>
                                    <span className="tabular-nums">{formatCommissionEuro(r.sportello_amico_commission)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Provv. struttura: </span>
                                    <span className="tabular-nums font-semibold">
                                      {formatCommissionEuro(r.structure_commission_amount)}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <span className="tabular-nums font-semibold">
                                  {formatCommissionEuro(r.structure_commission_amount)}
                                </span>
                              )}
                            </dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">
                              {isFullAccess ? 'Tipo / %' : 'Tipo'}
                            </dt>
                            <dd className="min-w-0 flex-1">
                              <span className={`badge ${getCommissionTypeBadgeClass(r.structure_commission_type)}`}>
                                {getCommissionTypeLabel(r.structure_commission_type)}
                              </span>
                              {isFullAccess ? (
                                <p className="mt-1 text-xs text-gray-600">{r.structure_commission_percentage}%</p>
                              ) : null}
                            </dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Stato</dt>
                            <dd>
                              <span className={`badge ${getCommissionValorizationBadgeClass(r.commission_status)}`}>
                                {getCommissionValorizationLabel(r.commission_status)}
                              </span>
                            </dd>
                          </div>
                        </dl>
                        {isFullAccess ? (
                          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                            <CommissionRowActions
                              row={r}
                              onAmounts={() => setAmountsModalRow(r)}
                              onDelete={() => setDeleteId(r.id)}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="hidden w-full min-w-0 overflow-x-auto md:block">
              <table
                className={`portal-table w-full table-fixed border-collapse text-left text-sm ${isFullAccess ? 'min-w-[1320px]' : 'min-w-[980px]'}`}
              >
                <thead>
                  <tr>
                    <SortableTh
                      sortKey="date"
                      activeKey={tableSort.sortBy}
                      direction={tableSort.sortDir}
                      onRequestSort={tableSort.requestSort}
                      className="!px-3 !py-3 w-[110px] min-w-[110px] max-w-[110px] align-top"
                    >
                      Data
                    </SortableTh>
                    <SortableTh
                      sortKey="customer_name"
                      activeKey={tableSort.sortBy}
                      direction={tableSort.sortDir}
                      onRequestSort={tableSort.requestSort}
                      className="!px-3 !py-3 min-w-[170px] align-top"
                    >
                      Cliente / Polizza
                    </SortableTh>
                    {isFullAccess ? (
                      <SortableTh
                        sortKey="structure_name"
                        activeKey={tableSort.sortBy}
                        direction={tableSort.sortDir}
                        onRequestSort={tableSort.requestSort}
                        className="!px-3 !py-3 min-w-[140px] align-top"
                      >
                        Struttura
                      </SortableTh>
                    ) : null}
                    <SortableTh
                      sortKey="portal"
                      activeKey={tableSort.sortBy}
                      direction={tableSort.sortDir}
                      onRequestSort={tableSort.requestSort}
                      className="!px-3 !py-3 min-w-[160px] align-top"
                    >
                      Portale / Compagnia
                    </SortableTh>
                    <SortableTh
                      sortKey="policy_premium"
                      activeKey={tableSort.sortBy}
                      direction={tableSort.sortDir}
                      onRequestSort={tableSort.requestSort}
                      className="!px-3 !py-3 w-[100px] min-w-[100px] max-w-[100px] align-top"
                    >
                      Premio
                    </SortableTh>
                    <SortableTh
                      sortKey="structure_commission_amount"
                      activeKey={tableSort.sortBy}
                      direction={tableSort.sortDir}
                      onRequestSort={tableSort.requestSort}
                      className="!px-3 !py-3 min-w-[190px] align-top"
                    >
                      Provvigioni
                    </SortableTh>
                    <th scope="col" className="w-[120px] min-w-[120px] max-w-[120px] px-3 py-3 align-top font-semibold text-gray-700">
                      {isFullAccess ? 'Tipo / %' : 'Tipo'}
                    </th>
                    <SortableTh
                      sortKey="commission_status"
                      activeKey={tableSort.sortBy}
                      direction={tableSort.sortDir}
                      onRequestSort={tableSort.requestSort}
                      className="!px-3 !py-3 w-[130px] min-w-[130px] max-w-[130px] align-top"
                    >
                      Stato
                    </SortableTh>
                    {isFullAccess ? (
                      <th
                        scope="col"
                        className="sticky right-0 z-30 min-w-[220px] w-[220px] border-l border-slate-200/90 bg-[var(--portal-table-header-bg)] px-3 py-3 text-right align-top font-semibold text-gray-700 shadow-[-12px_0_28px_-14px_rgba(15,23,42,0.35)]"
                      >
                        Azioni
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={isFullAccess ? 9 : 7} className="px-3 py-12 text-center text-gray-500">
                        Nessuna provvigione con i filtri selezionati.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r: Commission) => {
                      const highlight = r.commission_status === 'DA_VALORIZZARE';
                      const rowBg = highlight ? 'group/commrow bg-amber-50/40' : 'group/commrow';
                      const stickyBg = highlight
                        ? 'bg-amber-50/40 group-hover/commrow:bg-amber-50/55'
                        : 'bg-white group-hover/commrow:bg-[rgba(42,77,126,0.045)]';
                      return (
                        <tr key={r.id} className={rowBg}>
                          <td className="w-[110px] min-w-[110px] max-w-[110px] whitespace-nowrap px-3 py-3 text-gray-700">
                            {formatDate(r.date)}
                          </td>
                          <td className="min-w-[170px] px-3 py-3 align-top">
                            <p className="line-clamp-2 font-semibold leading-snug text-gray-900">{r.customer_name}</p>
                            <p className="mt-0.5 truncate font-mono text-sm text-gray-500">{r.policy_number}</p>
                          </td>
                          {isFullAccess ? (
                            <td className="min-w-[140px] px-3 py-3 align-top">
                              <p className="line-clamp-2 text-gray-800">{r.structure_name ?? '—'}</p>
                            </td>
                          ) : null}
                          <td className="min-w-[160px] px-3 py-3 align-top">
                            <p className="line-clamp-2 text-gray-900">{r.portal ?? '—'}</p>
                            <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{r.company ?? '—'}</p>
                          </td>
                          <td className="w-[100px] min-w-[100px] max-w-[100px] whitespace-nowrap px-3 py-3 tabular-nums text-gray-800">
                            {formatEuro(r.policy_premium)}
                          </td>
                          {isFullAccess ? (
                            <td className="min-w-[190px] px-3 py-3 align-top text-xs leading-snug text-gray-800">
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-x-1 gap-y-0">
                                  <span className="shrink-0 text-gray-500">Provv. broker:</span>
                                  <span className="min-w-0 truncate tabular-nums font-medium">
                                    {formatCommissionEuro(r.provvigioni_broker ?? r.broker_commission ?? null)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-x-1 gap-y-0">
                                  <span className="shrink-0 text-gray-500">Quota S.A.:</span>
                                  <span className="min-w-0 truncate tabular-nums font-medium">
                                    {formatCommissionEuro(r.sportello_amico_commission)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-x-1 gap-y-0">
                                  <span className="shrink-0 text-gray-500">Provv. struttura:</span>
                                  <span className="min-w-0 truncate tabular-nums font-semibold text-gray-900">
                                    {formatCommissionEuro(r.structure_commission_amount)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          ) : (
                            <td className="min-w-[190px] whitespace-nowrap px-3 py-3 font-semibold tabular-nums text-gray-900">
                              {formatCommissionEuro(r.structure_commission_amount)}
                            </td>
                          )}
                          <td className="w-[120px] min-w-[120px] max-w-[120px] px-3 py-3 align-top">
                            <span
                              className={`badge inline-flex max-w-full whitespace-normal break-words text-left leading-tight ${getCommissionTypeBadgeClass(r.structure_commission_type)}`}
                            >
                              {getCommissionTypeLabel(r.structure_commission_type)}
                            </span>
                            {isFullAccess ? (
                              <p className="mt-1 text-xs tabular-nums text-gray-600">{r.structure_commission_percentage}%</p>
                            ) : null}
                          </td>
                          <td className="w-[130px] min-w-[130px] max-w-[130px] px-3 py-3 align-top">
                            <span className={`badge inline-flex max-w-full whitespace-normal break-words leading-tight ${getCommissionValorizationBadgeClass(r.commission_status)}`}>
                              {getCommissionValorizationLabel(r.commission_status)}
                            </span>
                          </td>
                          {isFullAccess ? (
                            <td
                              className={`sticky right-0 z-10 min-w-[220px] w-[220px] border-l border-slate-200/90 px-3 py-3 text-right align-middle shadow-[-12px_0_28px_-14px_rgba(15,23,42,0.22)] ${stickyBg}`}
                            >
                              <CommissionRowActions
                                row={r}
                                onAmounts={() => setAmountsModalRow(r)}
                                onDelete={() => setDeleteId(r.id)}
                              />
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
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

      <CommissionAmountsModal
        isOpen={amountsModalRow != null}
        commission={amountsModalRow}
        onClose={() => setAmountsModalRow(null)}
        onSaved={fetchList}
      />

      {isStruttura ? (
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <Banknote className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
          Vedi le provvigioni della tua struttura e l&apos;importo che ti spetta; non sono mostrati provv. broker, quota
          Sportello Amico o altri importi riferiti al network.
        </p>
      ) : null}
    </div>
  );
}
