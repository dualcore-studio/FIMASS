import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Eye,
  UserCheck,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Quote, InsuranceType, PaginatedResponse, User } from '../../types';
import { formatDate, getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import TablePagination from '../../components/common/TablePagination';
import Modal from '../../components/ui/Modal';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import { useListTableSort } from '../../hooks/useListTableSort';
import SortableTh from '../../components/common/SortableTh';
const STATI = ['PRESENTATA', 'ASSEGNATA', 'IN LAVORAZIONE', 'STANDBY', 'ELABORATA'] as const;

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
  const [actionError] = useState<string | null>(null);

  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [structures, setStructures] = useState<User[]>([]);
  const [operators, setOperators] = useState<User[]>([]);

  const [assignQuoteId, setAssignQuoteId] = useState<number | null>(null);
  const [assignOperatorId, setAssignOperatorId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

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

  const rows = result?.data ?? [];
  const canCreate = role === 'struttura' || role === 'admin';
  const canAssign = role === 'admin' || role === 'supervisore';
  const canFilterStruttura = role === 'admin' || role === 'supervisore';

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
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:overflow-x-auto lg:pb-0.5 lg:[scrollbar-width:thin]">
          <span className="sr-only">Filtri elenco preventivi</span>
          <input
            id="filter-id-preventivo"
            type="text"
            inputMode="search"
            autoComplete="off"
            placeholder="ID preventivo…"
            value={numeroInput}
            onChange={(e) => setNumeroInput(e.target.value)}
            className={`${tf} w-[7.25rem]`}
            aria-label="ID Preventivo"
          />
          <input
            id="filter-assistito"
            type="search"
            placeholder="Assistito: nome, CF…"
            value={assistitoInput}
            onChange={(e) => setAssistitoInput(e.target.value)}
            className={`${tf} w-[12.5rem] min-w-[11rem] sm:w-[13.5rem]`}
            aria-label="Assistito"
          />
          <select
            id="filter-tipo"
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className={`${tf} w-[10.25rem]`}
            aria-label="Tipologia"
          >
            <option value="">Tutte le tipologie</option>
            {insuranceTypes.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.nome}</option>
            ))}
          </select>
          {canFilterStruttura ? (
            <>
              <select
                id="filter-struttura"
                value={strutturaFilter}
                onChange={(e) => setStrutturaFilter(e.target.value)}
                className={`${tf} w-[10.25rem]`}
                aria-label="Struttura"
              >
                <option value="">Tutte le strutture</option>
                {structures.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.denominazione || getUserDisplayName(s)}</option>
                ))}
              </select>
              <select
                id="filter-operatore"
                value={operatoreFilter}
                onChange={(e) => setOperatoreFilter(e.target.value)}
                className={`${tf} w-[10.25rem]`}
                aria-label="Operatore"
              >
                <option value="">Tutti gli operatori</option>
                {operators.map((o) => (
                  <option key={o.id} value={String(o.id)}>{getUserDisplayName(o)}</option>
                ))}
              </select>
            </>
          ) : null}
          <select
            id="filter-stato"
            value={statoFilter}
            onChange={(e) => setStatoFilter(e.target.value)}
            className={`${tf} w-[10.25rem]`}
            aria-label="Stato"
          >
            <option value="">Tutti gli stati</option>
            {STATI.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            id="filter-data-dal"
            type="date"
            value={dataDal}
            onChange={(e) => setDataDal(e.target.value)}
            className={`${tf} w-[9.5rem]`}
            aria-label="Data dal"
          />
          <input
            id="filter-data-al"
            type="date"
            value={dataAl}
            onChange={(e) => setDataAl(e.target.value)}
            className={`${tf} w-[9.5rem]`}
            aria-label="Data al"
          />
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
                    sortKey="stato"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Stato
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
                        <Link
                          to={`/preventivi/${q.id}`}
                          className="font-medium text-blue-700 hover:text-blue-800 hover:underline"
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
                      <td className="px-4 py-3">
                        <StatusBadge stato={q.stato} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(q.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Link
                            to={`/preventivi/${q.id}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            title="Apri"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Apri
                          </Link>

                          {canAssign && (
                            <button
                              type="button"
                              onClick={() => {
                                setAssignQuoteId(q.id);
                                setAssignOperatorId(q.operatore_id ? String(q.operatore_id) : '');
                                setAssignError(null);
                              }}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                              title="Assegna"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              Assegna
                            </button>
                          )}

                          {role === 'struttura' && q.stato === 'ELABORATA' && q.has_policy === 0 && (
                            <Link
                              to={`/polizze/nuova?quote_id=${q.id}`}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                              title="Richiedi emissione polizza"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Richiedi polizza
                            </Link>
                          )}

                          {role === 'struttura' && q.has_policy === 1 && q.policy && (
                            <Link
                              to={`/polizze/${q.policy.id}`}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                              title="Vai alla polizza"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Polizza
                            </Link>
                          )}
                        </div>
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

      {/* Assign Modal */}
      <Modal isOpen={assignQuoteId != null} onClose={closeAssignModal} title="Assegna Operatore" size="sm">
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
    </div>
  );
}
