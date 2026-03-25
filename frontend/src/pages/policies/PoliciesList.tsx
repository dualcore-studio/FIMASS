import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  Shield,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Policy, InsuranceType, PaginatedResponse, User } from '../../types';
import { formatDate, getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';

const LIMIT = 25;
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
  search: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('limit', String(LIMIT));
  if (params.stato) qs.set('stato', params.stato);
  if (params.tipo) qs.set('tipo_assicurazione_id', params.tipo);
  if (params.struttura) qs.set('struttura_id', params.struttura);
  if (params.operatore) qs.set('operatore_id', params.operatore);
  if (params.search.trim()) qs.set('search', params.search.trim());
  return `/policies?${qs.toString()}`;
}

export default function PoliciesList() {
  const { user: currentUser } = useAuth();
  const role = currentUser?.role;

  const [page, setPage] = useState(1);
  const [statoFilter, setStatoFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [strutturaFilter, setStrutturaFilter] = useState('');
  const [operatoreFilter, setOperatoreFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [result, setResult] = useState<PaginatedResponse<Policy> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [structures, setStructures] = useState<User[]>([]);
  const [operators, setOperators] = useState<User[]>([]);

  useEffect(() => {
    api.get<InsuranceType[]>('/settings/insurance-types/active').then(setInsuranceTypes).catch(() => {});
    if (role === 'admin' || role === 'supervisore') {
      api.get<User[]>('/users/structures').then(setStructures).catch(() => {});
      api.get<User[]>('/users/operators').then(setOperators).catch(() => {});
    }
  }, [role]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statoFilter, tipoFilter, strutturaFilter, operatoreFilter, debouncedSearch]);

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
          search: debouncedSearch,
        }),
      );
      setResult(data);
    } catch (e) {
      setResult(null);
      setListError(e instanceof ApiError ? e.message : 'Impossibile caricare le polizze.');
    } finally {
      setLoading(false);
    }
  }, [page, statoFilter, tipoFilter, strutturaFilter, operatoreFilter, debouncedSearch]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const totalPages = result?.totalPages ?? 1;
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
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Cerca per nome assistito, CF, numero polizza…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="filter-stato" className="mb-1 block text-xs font-medium text-gray-500">Stato</label>
            <select id="filter-stato" value={statoFilter} onChange={(e) => setStatoFilter(e.target.value)} className="input-field">
              <option value="">Tutti gli stati</option>
              {STATI.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-tipo" className="mb-1 block text-xs font-medium text-gray-500">Tipologia</label>
            <select id="filter-tipo" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className="input-field">
              <option value="">Tutte le tipologie</option>
              {insuranceTypes.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.nome}</option>
              ))}
            </select>
          </div>

          {canFilterStruttura && (
            <div>
              <label htmlFor="filter-struttura" className="mb-1 block text-xs font-medium text-gray-500">Struttura</label>
              <select id="filter-struttura" value={strutturaFilter} onChange={(e) => setStrutturaFilter(e.target.value)} className="input-field">
                <option value="">Tutte le strutture</option>
                {structures.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.denominazione || getUserDisplayName(s)}</option>
                ))}
              </select>
            </div>
          )}

          {canFilterStruttura && (
            <div>
              <label htmlFor="filter-operatore" className="mb-1 block text-xs font-medium text-gray-500">Operatore</label>
              <select id="filter-operatore" value={operatoreFilter} onChange={(e) => setOperatoreFilter(e.target.value)} className="input-field">
                <option value="">Tutti gli operatori</option>
                {operators.map((o) => (
                  <option key={o.id} value={String(o.id)}>{getUserDisplayName(o)}</option>
                ))}
              </select>
            </div>
          )}
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
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Numero Polizza</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Preventivo</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Assistito</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Tipologia</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Struttura</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Stato</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Data creazione</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <Shield className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                      Nessuna polizza trovata con i filtri selezionati.
                    </td>
                  </tr>
                ) : (
                  rows.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/80">
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

        {/* Pagination */}
        {!loading && !listError && result && result.total > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Mostrando{' '}
              <span className="font-medium text-gray-900">
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, result.total)}
              </span>{' '}
              di <span className="font-medium text-gray-900">{result.total}</span> polizze
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
