import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Euro, FileDown, FilterX, Pencil, Plus, RefreshCw, Trash2, CheckCircle } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Commission, CommissionValorizationStatus, CommissionsListResponse, StructureOption } from '../../types';
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

const COMMISSION_STATUS_FILTER_OPTIONS: CommissionValorizationStatus[] = [
  'DA_VALORIZZARE',
  'VALORIZZATA',
  'LIQUIDATA',
];

function allowedCommissionStatusTargets(
  current: CommissionValorizationStatus | undefined,
): CommissionValorizationStatus[] {
  switch (current) {
    case 'VALORIZZATA':
      return ['LIQUIDATA', 'DA_VALORIZZARE'];
    case 'LIQUIDATA':
      return ['VALORIZZATA', 'DA_VALORIZZARE'];
    default:
      return [];
  }
}

function buildQuery(params: {
  page: number;
  search: string;
  structureId: string;
  company: string;
  portal: string;
  dataDa: string;
  dataAl: string;
  commissionStatus: string;
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
  if (params.commissionStatus) qs.set('commission_status', params.commissionStatus);
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
  commissionStatus: string;
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
  if (params.commissionStatus) qs.set('commission_status', params.commissionStatus);
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
  onMarkLiquidata,
  onOpenStatus,
  showMarkLiquidata,
  showAdminStatus,
}: {
  row: Commission;
  onAmounts: () => void;
  onDelete: () => void;
  onMarkLiquidata: () => void;
  onOpenStatus: () => void;
  showMarkLiquidata: boolean;
  showAdminStatus: boolean;
}) {
  const isDaValorizzare = row.commission_status === 'DA_VALORIZZARE';
  const amountsTitle = isDaValorizzare ? 'Inserisci importi' : 'Modifica importi';
  const btnIcon =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200/90 text-gray-700 transition hover:border-blue-300 hover:bg-blue-50/70 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
  const btnDanger =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200/75 text-red-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35';
  const btnLiquid =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-200/90 text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35';
  return (
    <div className="flex items-center justify-center gap-1.5">
      <button type="button" onClick={onAmounts} title={amountsTitle} aria-label={amountsTitle} className={btnIcon}>
        <Euro className="h-4 w-4 shrink-0" strokeWidth={2} />
      </button>
      <Link
        to={`/provvigioni/${row.id}/modifica`}
        title="Modifica provvigione"
        aria-label="Modifica provvigione"
        className={btnIcon}
      >
        <Pencil className="h-4 w-4 shrink-0" strokeWidth={2} />
      </Link>
      {showAdminStatus ? (
        <button
          type="button"
          onClick={onOpenStatus}
          title="Cambia stato"
          aria-label="Cambia stato"
          className={btnIcon}
        >
          <RefreshCw className="h-4 w-4 shrink-0" strokeWidth={2} />
        </button>
      ) : null}
      {showMarkLiquidata ? (
        <button
          type="button"
          onClick={onMarkLiquidata}
          title="Segna come liquidata"
          aria-label="Segna come liquidata"
          className={btnLiquid}
        >
          <CheckCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
        </button>
      ) : null}
      <button type="button" onClick={onDelete} title="Elimina" aria-label="Elimina" className={btnDanger}>
        <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2} />
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
  const [statusFilter, setStatusFilter] = useState('');
  const [dataDa, setDataDa] = useState('');
  const [dataAl, setDataAl] = useState('');

  const [result, setResult] = useState<CommissionsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [structures, setStructures] = useState<StructureOption[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [liquidateId, setLiquidateId] = useState<number | null>(null);
  const [liquidateSubmitting, setLiquidateSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string | null>(null);
  const [amountsModalRow, setAmountsModalRow] = useState<Commission | null>(null);
  const [statusEditRow, setStatusEditRow] = useState<Commission | null>(null);
  const [statusEditTarget, setStatusEditTarget] = useState<CommissionValorizationStatus | ''>('');
  const [statusEditSubmitting, setStatusEditSubmitting] = useState(false);
  const [statusEditError, setStatusEditError] = useState<string | null>(null);

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
  }, [
    debouncedSearch,
    structureFilter,
    companyFilter,
    portalFilter,
    statusFilter,
    dataDa,
    dataAl,
    tableSort.sortBy,
    tableSort.sortDir,
  ]);

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
        commissionStatus: statusFilter,
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
    statusFilter,
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
        commissionStatus: statusFilter,
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

  const handleMarkLiquidata = async () => {
    if (liquidateId == null) return;
    setLiquidateSubmitting(true);
    setActionError(null);
    try {
      await api.patch<Commission>(`/commissions/${liquidateId}/liquidate`, {});
      setLiquidateId(null);
      await fetchList();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Aggiornamento liquidazione non riuscito.');
    } finally {
      setLiquidateSubmitting(false);
    }
  };

  const openStatusEditor = (row: Commission) => {
    const allowed = allowedCommissionStatusTargets(row.commission_status);
    if (!allowed.length) return;
    setStatusEditError(null);
    setStatusEditTarget(allowed[0]);
    setStatusEditRow(row);
  };

  const handleStatusEditSave = async () => {
    if (statusEditRow == null || !statusEditTarget) return;
    setStatusEditSubmitting(true);
    setStatusEditError(null);
    try {
      await api.patch<Commission>(`/commissions/${statusEditRow.id}/status`, {
        commission_status: statusEditTarget,
      });
      setStatusEditRow(null);
      setStatusEditTarget('');
      await fetchList();
    } catch (e) {
      setStatusEditError(e instanceof ApiError ? e.message : 'Aggiornamento stato non riuscito.');
    } finally {
      setStatusEditSubmitting(false);
    }
  };

  const hasActiveFilters =
    Boolean(searchInput.trim()) ||
    Boolean(isFullAccess && structureFilter) ||
    Boolean(companyFilter.trim()) ||
    Boolean(portalFilter.trim()) ||
    Boolean(statusFilter) ||
    Boolean(dataDa) ||
    Boolean(dataAl);

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setStructureFilter('');
    setCompanyFilter('');
    setPortalFilter('');
    setStatusFilter('');
    setDataDa('');
    setDataAl('');
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
        isAdmin ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <SummaryCard title="Totale premi" value={formatEuro(summary.totale_premi)} accent="blue" />
            <SummaryCard
              title="Totale provvigioni broker"
              value={formatEuro(summary.totale_provigioni_broker)}
              accent="slate"
            />
            <SummaryCard
              title="Quota Sportello Amico"
              value={formatEuro(summary.totale_sportello_amico)}
              accent="amber"
            />
            <SummaryCard
              title="Totale provvigioni strutture liquidate"
              value={formatEuro(summary.totale_provigioni_strutture_liquidate ?? 0)}
              accent="emerald"
            />
            <SummaryCard
              title="Totale provvigioni strutture da liquidare"
              value={formatEuro(summary.totale_provigioni_strutture_da_liquidare ?? 0)}
              accent="emerald"
            />
          </div>
        ) : isFullAccess ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <SummaryCard title="Totale polizze" value={String(summary.totale_polizze)} accent="slate" />
            <SummaryCard title="Totale premi" value={formatEuro(summary.totale_premi)} accent="blue" />
            <SummaryCard
              title="Totale provvigioni broker"
              value={formatEuro(summary.totale_provigioni_broker)}
              accent="slate"
            />
            <SummaryCard
              title="Quota Sportello Amico"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard title="Totale polizze" value={String(summary.totale_polizze)} accent="slate" />
            <SummaryCard title="Totale premi" value={formatEuro(summary.totale_premi)} accent="blue" />
            <SummaryCard
              title="Totale provvigioni da liquidare"
              value={formatEuro(summary.totale_provigioni_strutture_da_liquidare ?? 0)}
              accent="emerald"
            />
            <SummaryCard
              title="Totale provvigioni liquidate"
              value={formatEuro(summary.totale_provigioni_strutture_liquidate ?? 0)}
              accent="emerald"
            />
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
            <label htmlFor="comm-stato" className="whitespace-nowrap text-[11px] font-normal text-gray-600">
              Stato
            </label>
            <select
              id="comm-stato"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={tf}
            >
              <option value="">Tutti</option>
              {COMMISSION_STATUS_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {getCommissionValorizationLabel(s)}
                </option>
              ))}
            </select>
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
          <div className="flex w-full shrink-0 flex-col gap-2 pt-2 sm:flex-row sm:items-end sm:justify-end lg:w-auto lg:pt-0">
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="btn-secondary inline-flex h-9 w-full items-center justify-center gap-2 whitespace-nowrap px-3 text-sm sm:w-auto disabled:opacity-50"
            >
              <FilterX className="h-4 w-4 shrink-0" />
              Azzera filtri
            </button>
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
                          {isFullAccess ? (
                            <>
                              <div className="flex gap-2">
                                <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Provv. broker</dt>
                                <dd className="tabular-nums text-gray-900">
                                  {formatEuro(r.provvigioni_broker ?? r.broker_commission ?? null)}
                                </dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Quota S.A.</dt>
                                <dd className="tabular-nums text-gray-900">{formatEuro(r.sportello_amico_commission)}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Provv. struttura</dt>
                                <dd className="tabular-nums font-semibold text-gray-900">
                                  {formatEuro(r.structure_commission_amount)}
                                </dd>
                              </div>
                            </>
                          ) : (
                            <div className="flex gap-2">
                              <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Provvigione</dt>
                              <dd className="tabular-nums font-semibold text-gray-900">
                                {formatCommissionEuro(r.structure_commission_amount)}
                              </dd>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <dt className="w-28 shrink-0 text-xs font-medium text-gray-500">Tipo</dt>
                            <dd className="min-w-0 flex-1">
                              <span className={`badge ${getCommissionTypeBadgeClass(r.structure_commission_type)}`}>
                                {getCommissionTypeLabel(r.structure_commission_type)}
                              </span>
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
                          <div className="mt-4 flex justify-center border-t border-slate-100 pt-3">
                            <CommissionRowActions
                              row={r}
                              onAmounts={() => setAmountsModalRow(r)}
                              onDelete={() => setDeleteId(r.id)}
                              onMarkLiquidata={() => setLiquidateId(r.id)}
                              onOpenStatus={() => openStatusEditor(r)}
                              showMarkLiquidata={
                                isFullAccess && !isAdmin && r.commission_status === 'VALORIZZATA'
                              }
                              showAdminStatus={
                                isAdmin &&
                                allowedCommissionStatusTargets(r.commission_status).length > 0
                              }
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
                className={`portal-table w-full ${isFullAccess ? 'min-w-[1396px] text-center' : 'min-w-[1370px] text-left'} table-fixed border-collapse text-sm`}
              >
                <thead>
                  <tr>
                    {isFullAccess ? (
                      <>
                        <SortableTh
                          sortKey="date"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          align="center"
                          hideSortIcons
                          className="!px-2 !py-3 w-[100px] min-w-[100px] max-w-[100px] align-middle"
                        >
                          Data
                        </SortableTh>
                        <SortableTh
                          sortKey="customer_name"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          align="center"
                          hideSortIcons
                          className="!px-2 !py-3 w-[180px] min-w-[180px] max-w-[180px] align-middle"
                        >
                          Cliente / Polizza
                        </SortableTh>
                        <SortableTh
                          sortKey="structure_name"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          align="center"
                          hideSortIcons
                          className="!px-2 !py-3 w-[140px] min-w-[140px] max-w-[140px] align-middle"
                        >
                          Struttura
                        </SortableTh>
                        <SortableTh
                          sortKey="portal"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          align="center"
                          hideSortIcons
                          className="!px-2 !py-3 w-[160px] min-w-[160px] max-w-[160px] align-middle"
                        >
                          Portale / Compagnia
                        </SortableTh>
                        <SortableTh
                          sortKey="policy_premium"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          align="center"
                          hideSortIcons
                          className="!px-2 !py-3 w-[95px] min-w-[95px] max-w-[95px] align-middle"
                        >
                          Premio
                        </SortableTh>
                        <SortableTh
                          sortKey="broker_commission"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          align="center"
                          hideSortIcons
                          className="!px-2 !py-3 w-[90px] min-w-[90px] max-w-[90px] align-middle"
                        >
                          Broker
                        </SortableTh>
                        <SortableTh
                          sortKey="sportello_amico_commission"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          align="center"
                          hideSortIcons
                          className="!px-2 !py-3 w-[85px] min-w-[85px] max-w-[85px] align-middle"
                        >
                          Quota S.A.
                        </SortableTh>
                        <SortableTh
                          sortKey="structure_commission_amount"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          align="center"
                          hideSortIcons
                          className="!px-2 !py-3 w-[95px] min-w-[95px] max-w-[95px] align-middle"
                        >
                          Struttura
                        </SortableTh>
                        <th
                          scope="col"
                          className="w-[115px] min-w-[115px] max-w-[115px] px-2 py-3 text-center align-middle text-sm font-semibold text-gray-700"
                        >
                          Tipo
                        </th>
                        <SortableTh
                          sortKey="commission_status"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          align="center"
                          hideSortIcons
                          className="!px-2 !py-3 w-[120px] min-w-[120px] max-w-[120px] align-middle"
                        >
                          Stato
                        </SortableTh>
                        <th
                          scope="col"
                          className="sticky right-0 z-30 w-[165px] min-w-[165px] max-w-[165px] bg-[var(--portal-table-header-bg)] px-2 py-3 text-center align-middle text-sm font-semibold text-gray-700"
                        >
                          Azioni
                        </th>
                      </>
                    ) : (
                      <>
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
                          className="!px-3 !py-3 w-[220px] min-w-[220px] max-w-[240px] align-top"
                        >
                          Cliente
                        </SortableTh>
                        <SortableTh
                          sortKey="policy_number"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          className="!px-3 !py-3 w-[150px] min-w-[150px] max-w-[150px] align-top"
                        >
                          N. Polizza
                        </SortableTh>
                        <SortableTh
                          sortKey="portal"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          className="!px-3 !py-3 w-[160px] min-w-[160px] max-w-[160px] align-top"
                        >
                          Portale
                        </SortableTh>
                        <SortableTh
                          sortKey="company"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          className="!px-3 !py-3 w-[150px] min-w-[150px] max-w-[150px] align-top"
                        >
                          Compagnia
                        </SortableTh>
                        <SortableTh
                          sortKey="policy_premium"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          className="!px-3 !py-3 w-[110px] min-w-[110px] max-w-[110px] align-top"
                        >
                          Premio
                        </SortableTh>
                        <SortableTh
                          sortKey="structure_commission_amount"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          className="!px-3 !py-3 w-[130px] min-w-[130px] max-w-[130px] align-top"
                        >
                          Provvigione
                        </SortableTh>
                        <SortableTh
                          sortKey="structure_commission_type"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          className="!px-3 !py-3 w-[140px] min-w-[140px] max-w-[140px] align-top"
                        >
                          Tipo
                        </SortableTh>
                        <SortableTh
                          sortKey="commission_status"
                          activeKey={tableSort.sortBy}
                          direction={tableSort.sortDir}
                          onRequestSort={tableSort.requestSort}
                          className="!px-3 !py-3 w-[130px] min-w-[130px] max-w-[130px] align-top"
                        >
                          Stato
                        </SortableTh>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={isFullAccess ? 11 : 9} className="px-3 py-12 text-center text-gray-500">
                        Nessuna provvigione con i filtri selezionati.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r: Commission) => {
                      const highlight = r.commission_status === 'DA_VALORIZZARE';
                      const rowBg = highlight ? 'group/commrow bg-amber-50/40' : 'group/commrow bg-white';
                      if (isFullAccess) {
                        return (
                          <tr key={r.id} className={rowBg}>
                            <td className="w-[100px] min-w-[100px] max-w-[100px] whitespace-nowrap px-2 py-3 text-center align-middle text-gray-700">
                              {formatDate(r.date)}
                            </td>
                            <td className="w-[180px] min-w-[180px] max-w-[180px] px-2 py-3 align-middle">
                              <div className="flex flex-col items-center justify-center text-center">
                                <p className="line-clamp-2 max-w-full font-semibold leading-snug text-gray-900">
                                  {r.customer_name}
                                </p>
                                <p className="mt-0.5 max-w-full truncate font-mono text-sm text-gray-500">{r.policy_number}</p>
                              </div>
                            </td>
                            <td className="w-[140px] min-w-[140px] max-w-[140px] px-2 py-3 align-middle">
                              <div className="flex flex-col items-center justify-center text-center">
                                <p className="line-clamp-2 max-w-full text-gray-800">{r.structure_name ?? '—'}</p>
                              </div>
                            </td>
                            <td className="w-[160px] min-w-[160px] max-w-[160px] px-2 py-3 align-middle">
                              <div className="flex flex-col items-center justify-center text-center">
                                <p className="line-clamp-2 max-w-full text-gray-900">{r.portal ?? '—'}</p>
                                <p className="mt-0.5 line-clamp-2 max-w-full text-sm text-gray-500">{r.company ?? '—'}</p>
                              </div>
                            </td>
                            <td className="w-[95px] min-w-[95px] max-w-[95px] whitespace-nowrap px-2 py-3 text-center align-middle font-medium tabular-nums text-gray-800">
                              {formatEuro(r.policy_premium)}
                            </td>
                            <td className="w-[90px] min-w-[90px] max-w-[90px] whitespace-nowrap px-2 py-3 text-center align-middle font-medium tabular-nums text-gray-900">
                              {formatEuro(r.provvigioni_broker ?? r.broker_commission ?? null)}
                            </td>
                            <td className="w-[85px] min-w-[85px] max-w-[85px] whitespace-nowrap px-2 py-3 text-center align-middle font-medium tabular-nums text-gray-900">
                              {formatEuro(r.sportello_amico_commission)}
                            </td>
                            <td className="w-[95px] min-w-[95px] max-w-[95px] whitespace-nowrap px-2 py-3 text-center align-middle font-semibold tabular-nums text-gray-900">
                              {formatEuro(r.structure_commission_amount)}
                            </td>
                            <td className="w-[115px] min-w-[115px] max-w-[115px] px-2 py-3 align-middle">
                              <div className="flex justify-center">
                                <span
                                  className={`badge inline-flex max-w-full justify-center whitespace-normal break-words text-center leading-tight ${getCommissionTypeBadgeClass(r.structure_commission_type)}`}
                                >
                                  {getCommissionTypeLabel(r.structure_commission_type)}
                                </span>
                              </div>
                            </td>
                            <td className="w-[120px] min-w-[120px] max-w-[120px] px-2 py-3 align-middle">
                              <div className="flex justify-center">
                                <span
                                  className={`badge inline-flex max-w-full justify-center whitespace-normal break-words text-center leading-tight ${getCommissionValorizationBadgeClass(r.commission_status)}`}
                                >
                                  {getCommissionValorizationLabel(r.commission_status)}
                                </span>
                              </div>
                            </td>
                            <td className="sticky right-0 z-10 w-[165px] min-w-[165px] max-w-[165px] bg-inherit px-2 py-3 align-middle">
                              <div className="flex justify-center items-center gap-2">
                                <CommissionRowActions
                                  row={r}
                                  onAmounts={() => setAmountsModalRow(r)}
                                  onDelete={() => setDeleteId(r.id)}
                                  onMarkLiquidata={() => setLiquidateId(r.id)}
                                  onOpenStatus={() => openStatusEditor(r)}
                                  showMarkLiquidata={
                                    isFullAccess && !isAdmin && r.commission_status === 'VALORIZZATA'
                                  }
                                  showAdminStatus={
                                    isAdmin &&
                                    allowedCommissionStatusTargets(r.commission_status).length > 0
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={r.id} className={rowBg}>
                          <td className="w-[110px] min-w-[110px] max-w-[110px] whitespace-nowrap px-3 py-3 text-gray-700">
                            {formatDate(r.date)}
                          </td>
                          <td className="w-[220px] min-w-[220px] max-w-[240px] overflow-hidden px-3 py-3 align-top">
                            <p className="truncate font-semibold text-gray-900" title={r.customer_name}>
                              {r.customer_name}
                            </p>
                          </td>
                          <td className="w-[150px] min-w-[150px] max-w-[150px] overflow-hidden px-3 py-3 align-top">
                            <p className="truncate font-mono text-gray-800" title={r.policy_number}>
                              {r.policy_number}
                            </p>
                          </td>
                          <td className="w-[160px] min-w-[160px] max-w-[160px] overflow-hidden px-3 py-3 align-top">
                            <p className="truncate text-gray-900" title={r.portal ?? undefined}>
                              {r.portal ?? '—'}
                            </p>
                          </td>
                          <td className="w-[150px] min-w-[150px] max-w-[150px] overflow-hidden px-3 py-3 align-top">
                            <p className="truncate text-gray-800" title={r.company ?? undefined}>
                              {r.company ?? '—'}
                            </p>
                          </td>
                          <td className="w-[110px] min-w-[110px] max-w-[110px] whitespace-nowrap px-3 py-3 tabular-nums text-gray-800">
                            {formatEuro(r.policy_premium)}
                          </td>
                          <td className="w-[130px] min-w-[130px] max-w-[130px] whitespace-nowrap px-3 py-3 font-semibold tabular-nums text-gray-900">
                            {formatCommissionEuro(r.structure_commission_amount)}
                          </td>
                          <td className="w-[140px] min-w-[140px] max-w-[140px] overflow-hidden px-3 py-3 align-top">
                            <span
                              className={`badge inline-flex max-w-full min-w-0 items-center px-2 py-0.5 text-left leading-tight ${getCommissionTypeBadgeClass(r.structure_commission_type)}`}
                              title={getCommissionTypeLabel(r.structure_commission_type)}
                            >
                              <span className="min-w-0 truncate">{getCommissionTypeLabel(r.structure_commission_type)}</span>
                            </span>
                          </td>
                          <td className="w-[130px] min-w-[130px] max-w-[130px] overflow-hidden px-3 py-3 align-top">
                            <span
                              className={`badge inline-flex max-w-full min-w-0 items-center leading-tight ${getCommissionValorizationBadgeClass(r.commission_status)}`}
                              title={getCommissionValorizationLabel(r.commission_status)}
                            >
                              <span className="min-w-0 truncate">{getCommissionValorizationLabel(r.commission_status)}</span>
                            </span>
                          </td>
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

      <Modal
        isOpen={liquidateId != null}
        onClose={() => {
          if (!liquidateSubmitting) setLiquidateId(null);
        }}
        title="Segna come liquidata"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Confermi di segnare questa provvigione come liquidata? Lo stato verrà impostato su Liquidata.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={liquidateSubmitting}
              onClick={() => setLiquidateId(null)}
              className="btn-secondary"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={liquidateSubmitting}
              onClick={() => void handleMarkLiquidata()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle className="h-4 w-4" />
              {liquidateSubmitting ? 'Salvataggio…' : 'Conferma'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={statusEditRow != null}
        onClose={() => {
          if (!statusEditSubmitting) {
            setStatusEditRow(null);
            setStatusEditTarget('');
            setStatusEditError(null);
          }
        }}
        title="Cambia stato provvigione"
        size="sm"
      >
        {statusEditRow ? (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900">{statusEditRow.customer_name}</p>
              <p className="font-mono text-xs text-gray-500">{statusEditRow.policy_number}</p>
              <p className="mt-2">
                Stato attuale:{' '}
                <span className={`badge ${getCommissionValorizationBadgeClass(statusEditRow.commission_status)}`}>
                  {getCommissionValorizationLabel(statusEditRow.commission_status)}
                </span>
              </p>
            </div>
            <div>
              <label htmlFor="comm-status-new" className="mb-1 block text-xs font-medium text-gray-600">
                Nuovo stato
              </label>
              <select
                id="comm-status-new"
                value={statusEditTarget}
                onChange={(e) => setStatusEditTarget(e.target.value as CommissionValorizationStatus)}
                disabled={statusEditSubmitting}
                className="input-field h-9 w-full py-1.5 text-sm"
              >
                {allowedCommissionStatusTargets(statusEditRow.commission_status).map((s) => (
                  <option key={s} value={s}>
                    {getCommissionValorizationLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            {statusEditTarget === 'DA_VALORIZZARE' ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
                Verranno rimossi tutti gli importi provvigionali (broker, quota S.A. e struttura). La riga tornerà in
                «Da valorizzare».
              </p>
            ) : null}
            {statusEditTarget === 'LIQUIDATA' ? (
              <p className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-900">
                La provvigione verrà segnata come liquidata.
              </p>
            ) : null}
            {statusEditTarget === 'VALORIZZATA' &&
            statusEditRow.commission_status === 'LIQUIDATA' ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Verrà rimosso il flag di liquidazione; importi restano invariati.
              </p>
            ) : null}
            {statusEditError ? <p className="text-sm text-red-700">{statusEditError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={statusEditSubmitting}
                onClick={() => {
                  if (!statusEditSubmitting) {
                    setStatusEditRow(null);
                    setStatusEditTarget('');
                    setStatusEditError(null);
                  }
                }}
                className="btn-secondary"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={statusEditSubmitting || !statusEditTarget}
                onClick={() => void handleStatusEditSave()}
                className="btn-primary"
              >
                {statusEditSubmitting ? 'Salvataggio…' : 'Salva stato'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <CommissionAmountsModal
        isOpen={amountsModalRow != null}
        commission={amountsModalRow}
        onClose={() => setAmountsModalRow(null)}
        onSaved={fetchList}
      />
    </div>
  );
}
