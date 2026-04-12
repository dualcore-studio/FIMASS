import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Eye, ExternalLink, Trash2, ArrowRight, Clock } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Quote, InsuranceType, PaginatedResponse, User, StatusHistory } from '../../types';
import { formatDate, formatDateTime, getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import TablePagination from '../../components/common/TablePagination';
import Modal from '../../components/ui/Modal';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import { useListTableSort } from '../../hooks/useListTableSort';
import SortableTh from '../../components/common/SortableTh';
import QuoteRowActions from '../../components/quotes/QuoteRowActions';
import {
  OperatorStandbyModal,
  OperatorElaborataModal,
  OperatorInLavorazioneConfirmModal,
} from '../../components/quotes/OperatorQuoteWorkflowModals';
import { getLatestStandbyTransition } from '../../utils/quoteStandby';
const STATI = ['PRESENTATA', 'ASSEGNATA', 'IN LAVORAZIONE', 'STANDBY', 'ELABORATA'] as const;

function quoteHistoryActorLabel(h: StatusHistory): string {
  if (h.role === 'struttura' && h.denominazione) return h.denominazione;
  const name = [h.nome, h.cognome].filter(Boolean).join(' ').trim();
  if (name) return name;
  return h.utente_id ? `Utente #${h.utente_id}` : '—';
}

function StandbyMotivationBody({ quote }: { quote: Quote }) {
  const tr = getLatestStandbyTransition(quote.history);
  return (
    <div className="space-y-4">
      {tr ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="font-medium text-gray-800">{quoteHistoryActorLabel(tr)}</span>
            <span aria-hidden>·</span>
            <time className="tabular-nums" dateTime={tr.created_at}>
              {formatDateTime(tr.created_at)}
            </time>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-4 py-3">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">
              {tr.motivo?.trim() || 'Nessuna motivazione registrata per il passaggio in standby.'}
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-600">
          Non è stata trovata una registrazione del passaggio in standby per questa pratica.
        </p>
      )}
    </div>
  );
}

function QuoteHistoryTimeline({ entries }: { entries: StatusHistory[] }) {
  const sorted = [...entries].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  if (sorted.length === 0) {
    return <p className="text-sm text-gray-500">Nessun cambiamento di stato registrato.</p>;
  }
  return (
    <div className="relative pl-1">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" aria-hidden />
      <ul className="space-y-5">
        {sorted.map((h) => (
          <li key={h.id} className="relative pl-9">
            <div className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-500 shadow-sm ring-1 ring-gray-200" />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {h.stato_precedente ? (
                <>
                  <StatusBadge stato={h.stato_precedente} />
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                </>
              ) : null}
              <StatusBadge stato={h.stato_nuovo} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{quoteHistoryActorLabel(h)}</span>
              <span aria-hidden>·</span>
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              <time dateTime={h.created_at}>{formatDateTime(h.created_at)}</time>
            </div>
            {h.motivo ? (
              <p className="mt-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">{h.motivo}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildQuery(params: {
  page: number;
  stato: string;
  tipo: string;
  struttura: string;
  operatore: string;
  numero: string;
  assistito: string;
  dataDa: string;
  dataAl: string;
  alert: string;
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
}): string {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('limit', String(TABLE_PAGE_SIZE));
  if (params.stato) qs.set('stato', params.stato);
  if (params.tipo) qs.set('tipo_assicurazione_id', params.tipo);
  if (params.struttura) qs.set('struttura_id', params.struttura);
  if (params.operatore) qs.set('operatore_id', params.operatore);
  if (params.numero.trim()) qs.set('numero', params.numero.trim());
  if (params.assistito.trim()) qs.set('assistito', params.assistito.trim());
  if (params.dataDa) qs.set('data_da', params.dataDa);
  if (params.dataAl) qs.set('data_a', params.dataAl);
  if (params.alert) qs.set('alert', params.alert);
  if (params.sortBy) {
    qs.set('sort_by', params.sortBy);
    qs.set('sort_dir', params.sortDir);
  }
  return `/quotes?${qs.toString()}`;
}

function FilterCell({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-px">
      <label htmlFor={id} className="whitespace-nowrap text-[11px] font-normal leading-tight text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function QuotesList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const role = currentUser?.role;
  const alertFilter = searchParams.get('alert') ?? '';

  const [page, setPage] = useState(1);
  const [statoFilter, setStatoFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [strutturaFilter, setStrutturaFilter] = useState('');
  const [operatoreFilter, setOperatoreFilter] = useState('');
  const [dataDal, setDataDal] = useState('');
  const [dataAl, setDataAl] = useState('');
  const [numeroInput, setNumeroInput] = useState('');
  const [assistitoInput, setAssistitoInput] = useState('');
  const [debouncedNumero, setDebouncedNumero] = useState('');
  const [debouncedAssistito, setDebouncedAssistito] = useState('');

  const [result, setResult] = useState<PaginatedResponse<Quote> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [deleteQuoteId, setDeleteQuoteId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [structures, setStructures] = useState<User[]>([]);
  const [operators, setOperators] = useState<User[]>([]);

  const [assignQuoteId, setAssignQuoteId] = useState<number | null>(null);
  const [assignOperatorId, setAssignOperatorId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [historyQuoteId, setHistoryQuoteId] = useState<number | null>(null);
  const [historyDetail, setHistoryDetail] = useState<Quote | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [standbyQuoteId, setStandbyQuoteId] = useState<number | null>(null);
  const [standbyDetail, setStandbyDetail] = useState<Quote | null>(null);
  const [standbyLoading, setStandbyLoading] = useState(false);

  const [operatorStandbyQuoteId, setOperatorStandbyQuoteId] = useState<number | null>(null);
  const [operatorElaborataQuoteId, setOperatorElaborataQuoteId] = useState<number | null>(null);
  const [operatorInLavQuoteId, setOperatorInLavQuoteId] = useState<number | null>(null);

  const tableSort = useListTableSort();

  useEffect(() => {
    api.get<InsuranceType[]>('/settings/insurance-types/active').then(setInsuranceTypes).catch(() => {});
    if (role === 'admin' || role === 'supervisore') {
      api.get<User[]>('/users/structures').then(setStructures).catch(() => {});
      api.get<User[]>('/users/operators').then(setOperators).catch(() => {});
    }
  }, [role]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedNumero(numeroInput), 350);
    return () => window.clearTimeout(t);
  }, [numeroInput]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedAssistito(assistitoInput), 350);
    return () => window.clearTimeout(t);
  }, [assistitoInput]);

  useEffect(() => {
    setPage(1);
  }, [
    statoFilter,
    tipoFilter,
    strutturaFilter,
    operatoreFilter,
    dataDal,
    dataAl,
    debouncedNumero,
    debouncedAssistito,
    tableSort.sortBy,
    tableSort.sortDir,
  ]);

  const fetchQuotes = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await api.get<PaginatedResponse<Quote>>(
        buildQuery({
          page,
          stato: statoFilter,
          tipo: tipoFilter,
          struttura: strutturaFilter,
          operatore: operatoreFilter,
          numero: debouncedNumero,
          assistito: debouncedAssistito,
          dataDa: dataDal,
          dataAl: dataAl,
          alert: alertFilter,
          sortBy: tableSort.sortBy,
          sortDir: tableSort.sortDir,
        }),
      );
      setResult(data);
    } catch (e) {
      setResult(null);
      setListError(e instanceof ApiError ? e.message : 'Impossibile caricare i preventivi.');
    } finally {
      setLoading(false);
    }
  }, [
    page,
    statoFilter,
    tipoFilter,
    strutturaFilter,
    operatoreFilter,
    dataDal,
    dataAl,
    alertFilter,
    debouncedNumero,
    debouncedAssistito,
    tableSort.sortBy,
    tableSort.sortDir,
  ]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    if (historyQuoteId == null) {
      setHistoryDetail(null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryDetail(null);
    api
      .get<Quote>(`/quotes/${historyQuoteId}`)
      .then((data) => {
        if (!cancelled) setHistoryDetail(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setActionError(e instanceof ApiError ? e.message : 'Impossibile caricare lo storico.');
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [historyQuoteId]);

  useEffect(() => {
    if (standbyQuoteId == null) {
      setStandbyDetail(null);
      return;
    }
    let cancelled = false;
    setStandbyLoading(true);
    setStandbyDetail(null);
    api
      .get<Quote>(`/quotes/${standbyQuoteId}`)
      .then((data) => {
        if (!cancelled) setStandbyDetail(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setActionError(e instanceof ApiError ? e.message : 'Impossibile caricare i dati dello standby.');
        }
      })
      .finally(() => {
        if (!cancelled) setStandbyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [standbyQuoteId]);

  const totalPages = result?.totalPages ?? 1;
  useSyncPageToTotalPages(page, result?.totalPages, setPage);

  const closeAssignModal = () => {
    setAssignQuoteId(null);
    setAssignOperatorId('');
    setAssignError(null);
  };

  const handleAssign = async () => {
    if (assignQuoteId == null || !assignOperatorId) {
      setAssignError('Seleziona un operatore.');
      return;
    }
    setAssignError(null);
    setAssignSubmitting(true);
    try {
      await api.put(`/quotes/${assignQuoteId}/assign`, { operatore_id: Number(assignOperatorId) });
      closeAssignModal();
      await fetchQuotes();
    } catch (e) {
      setAssignError(e instanceof ApiError ? e.message : 'Assegnazione non riuscita.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const closeDeleteModal = () => {
    setDeleteQuoteId(null);
  };

  const handleDeleteQuote = async () => {
    if (deleteQuoteId == null) return;
    setActionError(null);
    setDeleteSubmitting(true);
    try {
      await api.delete(`/quotes/${deleteQuoteId}`);
      closeDeleteModal();
      await fetchQuotes();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Eliminazione preventivo non riuscita.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const rows = result?.data ?? [];
  const canCreate = role === 'struttura';
  const canDeleteQuote = role === 'admin';
  const useQuoteActionsMenu =
    role === 'admin' || role === 'supervisore' || role === 'struttura' || role === 'operatore';
  const canFilterStruttura = role === 'admin' || role === 'supervisore';

  const assignTargetRow = assignQuoteId != null ? rows.find((r) => r.id === assignQuoteId) : undefined;
  const assignModalTitle = assignTargetRow?.stato === 'ASSEGNATA' ? 'Riassegna operatore' : 'Assegna operatore';

  const tf = 'input-field h-9 max-w-none shrink-0 py-1.5 text-sm';

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Preventivi</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Gestione richieste di preventivo assicurativo.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => navigate('/preventivi/nuovo')}
            className="btn-primary shrink-0 self-start"
          >
            <Plus className="h-4 w-4" />
            Nuova Richiesta
          </button>
        )}
      </header>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </div>
      )}

      {/* Filters — toolbar compatta (una riga su desktop) */}
      <div className="card px-2.5 py-2 sm:px-3 sm:py-2">
        <div className="flex flex-wrap items-end gap-2 lg:flex-nowrap lg:overflow-x-auto lg:pb-0.5 lg:[scrollbar-width:thin]">
          <span className="sr-only">Filtri elenco preventivi</span>
          <FilterCell id="filter-id-preventivo" label="ID Preventivo">
            <input
              id="filter-id-preventivo"
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder="ID preventivo…"
              value={numeroInput}
              onChange={(e) => setNumeroInput(e.target.value)}
              className={`${tf} w-[7.25rem]`}
            />
          </FilterCell>
          <FilterCell id="filter-assistito" label="Assistito">
            <input
              id="filter-assistito"
              type="search"
              placeholder="Assistito: nome, CF…"
              value={assistitoInput}
              onChange={(e) => setAssistitoInput(e.target.value)}
              className={`${tf} w-[12.5rem] min-w-[11rem] sm:w-[13.5rem]`}
            />
          </FilterCell>
          <FilterCell id="filter-tipo" label="Tipologia">
            <select
              id="filter-tipo"
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className={`${tf} w-[10.25rem]`}
            >
              <option value="">Tutte le tipologie</option>
              {insuranceTypes.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.nome}</option>
              ))}
            </select>
          </FilterCell>
          {canFilterStruttura ? (
            <>
              <FilterCell id="filter-struttura" label="Struttura">
                <select
                  id="filter-struttura"
                  value={strutturaFilter}
                  onChange={(e) => setStrutturaFilter(e.target.value)}
                  className={`${tf} w-[10.25rem]`}
                >
                  <option value="">Tutte le strutture</option>
                  {structures.map((s) => (
                    <option key={s.id} value={String(s.id)}>{s.denominazione || getUserDisplayName(s)}</option>
                  ))}
                </select>
              </FilterCell>
              <FilterCell id="filter-operatore" label="Operatore">
                <select
                  id="filter-operatore"
                  value={operatoreFilter}
                  onChange={(e) => setOperatoreFilter(e.target.value)}
                  className={`${tf} w-[10.25rem]`}
                >
                  <option value="">Tutti gli operatori</option>
                  {operators.map((o) => (
                    <option key={o.id} value={String(o.id)}>{getUserDisplayName(o)}</option>
                  ))}
                </select>
              </FilterCell>
            </>
          ) : null}
          <FilterCell id="filter-stato" label="Stato">
            <select
              id="filter-stato"
              value={statoFilter}
              onChange={(e) => setStatoFilter(e.target.value)}
              className={`${tf} w-[10.25rem]`}
            >
              <option value="">Tutti gli stati</option>
              {STATI.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FilterCell>
          <FilterCell id="filter-data-dal" label="Data dal">
            <input
              id="filter-data-dal"
              type="date"
              value={dataDal}
              onChange={(e) => setDataDal(e.target.value)}
              className={`${tf} w-[9.5rem]`}
            />
          </FilterCell>
          <FilterCell id="filter-data-al" label="Data al">
            <input
              id="filter-data-al"
              type="date"
              value={dataAl}
              onChange={(e) => setDataAl(e.target.value)}
              className={`${tf} w-[9.5rem]`}
            />
          </FilterCell>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              <p className="text-sm text-gray-500">Caricamento preventivi…</p>
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
                    sortKey="stato"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Stato
                  </SortableTh>
                  <SortableTh
                    sortKey="numero"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    ID Preventivo
                  </SortableTh>
                  <SortableTh
                    sortKey="assistito"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Assistito
                  </SortableTh>
                  <SortableTh
                    sortKey="tipo"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Tipologia
                  </SortableTh>
                  <SortableTh
                    sortKey="struttura"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Struttura
                  </SortableTh>
                  <SortableTh
                    sortKey="operatore"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Operatore
                  </SortableTh>
                  <SortableTh
                    sortKey="created_at"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Data creazione
                  </SortableTh>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      Nessun preventivo trovato con i filtri selezionati.
                    </td>
                  </tr>
                ) : (
                  rows.map((q) => (
                    <tr key={q.id}>
                      <td className="px-4 py-3">
                        <StatusBadge stato={q.stato} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/preventivi/${q.id}`}
                          className="cursor-pointer font-medium text-blue-700 hover:text-blue-800 hover:underline"
                        >
                          {q.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {q.assistito_nome} {q.assistito_cognome}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{q.tipo_nome || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{q.struttura_nome || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {q.operatore_id
                          ? [q.operatore_nome, q.operatore_cognome].filter(Boolean).join(' ')
                          : <span className="text-gray-400 italic">Non assegnato</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(q.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {useQuoteActionsMenu ? (
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <QuoteRowActions
                              variant={
                                role === 'struttura'
                                  ? 'struttura'
                                  : role === 'operatore'
                                    ? 'operatore'
                                    : 'admin'
                              }
                              quote={q}
                              onNavigateDetail={(id) => navigate(`/preventivi/${id}`)}
                              onOpenHistory={setHistoryQuoteId}
                              onActionError={setActionError}
                              {...(role === 'struttura'
                                ? {
                                    onOpenStandbyReason: (row) => setStandbyQuoteId(row.id),
                                    onRichiediPolizza: (row) =>
                                      navigate(`/polizze/nuova?quote_id=${row.id}`),
                                  }
                                : role === 'operatore'
                                  ? {
                                      onOpenOperatorStandby: (row) => setOperatorStandbyQuoteId(row.id),
                                      onOpenOperatorElaborata: (row) => setOperatorElaborataQuoteId(row.id),
                                      onOpenOperatorInLavorazione: (row) => setOperatorInLavQuoteId(row.id),
                                    }
                                  : {
                                      onOpenAssign: (row) => {
                                        setAssignQuoteId(row.id);
                                        setAssignOperatorId('');
                                        setAssignError(null);
                                      },
                                      onOpenReassign: (row) => {
                                        setAssignQuoteId(row.id);
                                        setAssignOperatorId(row.operatore_id ? String(row.operatore_id) : '');
                                        setAssignError(null);
                                      },
                                      ...(canDeleteQuote ? { onOpenDelete: setDeleteQuoteId } : {}),
                                    })}
                            />
                            {role === 'struttura' && q.has_policy === 1 && q.policy && (
                              <Link
                                to={`/polizze/${q.policy.id}`}
                                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                title="Vai alla polizza"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Polizza
                              </Link>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Link
                              to={`/preventivi/${q.id}`}
                              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              title="Apri"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Apri
                            </Link>

                            {canDeleteQuote && (
                              <button
                                type="button"
                                disabled={deleteSubmitting}
                                onClick={() => setDeleteQuoteId(q.id)}
                                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Elimina preventivo (solo amministratore)"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
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
            entityLabel="preventivi"
          />
        )}
      </div>

      <Modal
        isOpen={standbyQuoteId != null}
        onClose={() => setStandbyQuoteId(null)}
        title="Motivazione standby"
        size="md"
      >
        <div className="max-h-[min(75vh,520px)] overflow-y-auto pr-1">
          {standbyLoading ? (
            <p className="py-8 text-center text-sm text-gray-500">Caricamento…</p>
          ) : !standbyDetail ? (
            <p className="py-6 text-center text-sm text-gray-500">Nessun dato.</p>
          ) : (
            <StandbyMotivationBody quote={standbyDetail} />
          )}
        </div>
      </Modal>

      <Modal
        isOpen={historyQuoteId != null}
        onClose={() => setHistoryQuoteId(null)}
        title="Storico stati"
        size="md"
      >
        <div className="max-h-[min(70vh,480px)] overflow-y-auto pr-1">
          {historyLoading ? (
            <p className="py-8 text-center text-sm text-gray-500">Caricamento…</p>
          ) : !historyDetail ? (
            <p className="py-6 text-center text-sm text-gray-500">Nessun dato.</p>
          ) : (
            <QuoteHistoryTimeline entries={historyDetail.history || []} />
          )}
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={assignQuoteId != null} onClose={closeAssignModal} title={assignModalTitle} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Seleziona l&apos;operatore a cui assegnare il preventivo.
          </p>
          <div>
            <label htmlFor="assign-operator" className="mb-1 block text-sm font-medium text-gray-700">
              Operatore
            </label>
            <select
              id="assign-operator"
              value={assignOperatorId}
              onChange={(e) => setAssignOperatorId(e.target.value)}
              className="input-field"
            >
              <option value="">Seleziona operatore…</option>
              {operators.map((o) => (
                <option key={o.id} value={String(o.id)}>{getUserDisplayName(o)}</option>
              ))}
            </select>
          </div>
          {assignError && <p className="text-sm text-red-600">{assignError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeAssignModal} className="btn-secondary">Annulla</button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={assignSubmitting}
              className="btn-primary"
            >
              {assignSubmitting ? 'Assegnazione…' : 'Conferma'}
            </button>
          </div>
        </div>
      </Modal>

      <OperatorStandbyModal
        isOpen={operatorStandbyQuoteId != null}
        onClose={() => setOperatorStandbyQuoteId(null)}
        quoteId={operatorStandbyQuoteId ?? 0}
        onCompleted={fetchQuotes}
        onError={setActionError}
      />
      <OperatorElaborataModal
        isOpen={operatorElaborataQuoteId != null}
        onClose={() => setOperatorElaborataQuoteId(null)}
        quoteId={operatorElaborataQuoteId ?? 0}
        onCompleted={fetchQuotes}
        onError={setActionError}
      />
      <OperatorInLavorazioneConfirmModal
        isOpen={operatorInLavQuoteId != null}
        onClose={() => setOperatorInLavQuoteId(null)}
        quoteId={operatorInLavQuoteId ?? 0}
        onCompleted={fetchQuotes}
        onError={setActionError}
      />

      <Modal
        isOpen={deleteQuoteId != null}
        onClose={closeDeleteModal}
        title="Elimina preventivo"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Questa operazione è irreversibile. Verranno eliminati anche storico, note, allegati e, se presente, la
            polizza collegata.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeDeleteModal}
              className="btn-secondary"
              disabled={deleteSubmitting}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleDeleteQuote}
              disabled={deleteSubmitting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {deleteSubmitting ? 'Eliminazione…' : 'Elimina'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
