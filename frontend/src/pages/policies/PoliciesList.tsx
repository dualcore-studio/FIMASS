import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Eye,
  Filter,
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
const STATI = [
  'RICHIESTA PRESENTATA',
  'IN VERIFICA',
  'DOCUMENTAZIONE MANCANTE',
  'PRONTA PER EMISSIONE',
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

export default function PoliciesList() {
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

  const [result, setResult] = useState<PaginatedResponse<Policy> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [structures, setStructures] = useState<User[]>([]);
  const [operators, setOperators] = useState<User[]>([]);

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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Polizze</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Gestione delle polizze assicurative emesse.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
          <Filter className="h-4 w-4" />
          Filtri
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div>
            <label htmlFor="filter-id-polizza" className="mb-1 block text-xs font-medium text-gray-500">
              ID Polizza
            </label>
            <input
              id="filter-id-polizza"
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder="Es. POL-2026-…"
              value={numeroInput}
              onChange={(e) => setNumeroInput(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="filter-assistito-pol" className="mb-1 block text-xs font-medium text-gray-500">
              Assistito
            </label>
            <input
              id="filter-assistito-pol"
              type="search"
              placeholder="Nome, cognome o CF…"
              value={assistitoInput}
              onChange={(e) => setAssistitoInput(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="filter-tipo-pol" className="mb-1 block text-xs font-medium text-gray-500">
              Tipologia
            </label>
            <select id="filter-tipo-pol" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className="input-field">
              <option value="">Tutte le tipologie</option>
              {insuranceTypes.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.nome}</option>
              ))}
            </select>
          </div>

          {canFilterStruttura && (
            <div>
              <label htmlFor="filter-struttura-pol" className="mb-1 block text-xs font-medium text-gray-500">
                Struttura
              </label>
              <select id="filter-struttura-pol" value={strutturaFilter} onChange={(e) => setStrutturaFilter(e.target.value)} className="input-field">
                <option value="">Tutte le strutture</option>
                {structures.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.denominazione || getUserDisplayName(s)}</option>
                ))}
              </select>
            </div>
          )}

          {canFilterStruttura && (
            <div>
              <label htmlFor="filter-operatore-pol" className="mb-1 block text-xs font-medium text-gray-500">
                Operatore
              </label>
              <select id="filter-operatore-pol" value={operatoreFilter} onChange={(e) => setOperatoreFilter(e.target.value)} className="input-field">
                <option value="">Tutti gli operatori</option>
                {operators.map((o) => (
                  <option key={o.id} value={String(o.id)}>{getUserDisplayName(o)}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="filter-stato-pol" className="mb-1 block text-xs font-medium text-gray-500">
              Stato
            </label>
            <select id="filter-stato-pol" value={statoFilter} onChange={(e) => setStatoFilter(e.target.value)} className="input-field">
              <option value="">Tutti gli stati</option>
              {STATI.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-data-dal-pol" className="mb-1 block text-xs font-medium text-gray-500">
              Data dal
            </label>
            <input
              id="filter-data-dal-pol"
              type="date"
              value={dataDal}
              onChange={(e) => setDataDal(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="filter-data-al-pol" className="mb-1 block text-xs font-medium text-gray-500">
              Data al
            </label>
            <input
              id="filter-data-al-pol"
              type="date"
              value={dataAl}
              onChange={(e) => setDataAl(e.target.value)}
              className="input-field"
            />
          </div>
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
                          <Link
                            to={`/polizze/${p.id}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            title="Apri"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Apri
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
