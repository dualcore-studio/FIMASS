import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Shield,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Policy, InsuranceType, PaginatedResponse, User } from '../../types';
import { formatDate, getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import TablePagination from '../../components/common/TablePagination';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import { useListTableSort } from '../../hooks/useListTableSort';
import SortableTh from '../../components/common/SortableTh';
import PolicyRowActions from '../../components/policies/PolicyRowActions';
const STATI = [
  'RICHIESTA PRESENTATA',
  'IN EMISSIONE',
  'EMESSA',
] as const;

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
  return `/policies?${qs.toString()}`;
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

export default function PoliciesList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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

  const [result, setResult] = useState<PaginatedResponse<Policy> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [structures, setStructures] = useState<User[]>([]);
  const [operators, setOperators] = useState<User[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const fetchPolicies = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await api.get<PaginatedResponse<Policy>>(
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
      setListError(e instanceof ApiError ? e.message : 'Impossibile caricare le polizze.');
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
    fetchPolicies();
  }, [fetchPolicies]);

  const totalPages = result?.totalPages ?? 1;
  useSyncPageToTotalPages(page, result?.totalPages, setPage);

  const rows = result?.data ?? [];
  const canFilterStruttura = role === 'admin' || role === 'supervisore';

  const tf = 'input-field h-9 max-w-none shrink-0 py-1.5 text-sm';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Polizze</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Gestione delle richieste di emissione e delle polizze emesse.
          </p>
        </div>
      </header>

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>
      ) : null}

      {/* Filters — toolbar compatta (una riga su desktop) */}
      <div className="card px-2.5 py-2 sm:px-3 sm:py-2">
        <div className="flex flex-wrap items-end gap-2 lg:flex-nowrap lg:overflow-x-auto lg:pb-0.5 lg:[scrollbar-width:thin]">
          <span className="sr-only">Filtri elenco polizze</span>
          <FilterCell id="filter-id-polizza" label="ID Polizza">
            <input
              id="filter-id-polizza"
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder="ID polizza…"
              value={numeroInput}
              onChange={(e) => setNumeroInput(e.target.value)}
              className={`${tf} w-[7.25rem]`}
            />
          </FilterCell>
          <FilterCell id="filter-assistito-pol" label="Assistito">
            <input
              id="filter-assistito-pol"
              type="search"
              placeholder="Assistito: nome, CF…"
              value={assistitoInput}
              onChange={(e) => setAssistitoInput(e.target.value)}
              className={`${tf} w-[12.5rem] min-w-[11rem] sm:w-[13.5rem]`}
            />
          </FilterCell>
          <FilterCell id="filter-tipo-pol" label="Tipologia">
            <select
              id="filter-tipo-pol"
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
              <FilterCell id="filter-struttura-pol" label="Struttura">
                <select
                  id="filter-struttura-pol"
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
              <FilterCell id="filter-operatore-pol" label="Operatore">
                <select
                  id="filter-operatore-pol"
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
          <FilterCell id="filter-stato-pol" label="Stato">
            <select
              id="filter-stato-pol"
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
          <FilterCell id="filter-data-dal-pol" label="Data dal">
            <input
              id="filter-data-dal-pol"
              type="date"
              value={dataDal}
              onChange={(e) => setDataDal(e.target.value)}
              className={`${tf} w-[9.5rem]`}
            />
          </FilterCell>
          <FilterCell id="filter-data-al-pol" label="Data al">
            <input
              id="filter-data-al-pol"
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
              <p className="text-sm text-gray-500">Caricamento polizze…</p>
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
                    ID Polizza
                  </SortableTh>
                  <SortableTh
                    sortKey="preventivo"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Preventivo
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
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      <Shield className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                      Nessuna polizza trovata con i filtri selezionati.
                    </td>
                  </tr>
                ) : (
                  rows.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <Link
                          to={`/polizze/${p.id}`}
                          className="font-medium text-blue-700 hover:text-blue-800 hover:underline"
                        >
                          {p.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {p.preventivo_numero ? (
                          <Link
                            to={`/preventivi/${p.preventivo_id || p.quote_id}`}
                            className="text-blue-600 hover:text-blue-700 hover:underline text-xs font-mono"
                          >
                            {p.preventivo_numero}
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {p.assistito_nome} {p.assistito_cognome}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.tipo_nome || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{p.struttura_nome || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.operatore_id
                          ? [p.operatore_nome, p.operatore_cognome].filter(Boolean).join(' ')
                          : <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge stato={p.stato} type="policy" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <PolicyRowActions
                            policy={p}
                            variant={
                              role === 'struttura'
                                ? 'struttura'
                                : 'backoffice'
                            }
                            onNavigateOpen={(id) => navigate(`/polizze/${id}`)}
                            onActionError={setActionError}
                            onRefresh={fetchPolicies}
                          />
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
            entityLabel="polizze"
          />
        )}
      </div>
    </div>
  );
}
