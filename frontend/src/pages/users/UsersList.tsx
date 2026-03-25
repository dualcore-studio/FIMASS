import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Pencil,
  ToggleLeft,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { User, PaginatedResponse } from '../../types';
import {
  formatDateTime,
  getUserDisplayName,
  getRoleLabel,
  getRoleBadgeColor,
} from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';

const LIMIT = 25;

type RoleFilter = '' | User['role'];
type StatoFilter = '' | User['stato'];

function buildUsersQuery(page: number, role: RoleFilter, stato: StatoFilter, search: string): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(LIMIT));
  if (role) params.set('role', role);
  if (stato) params.set('stato', stato);
  if (search.trim()) params.set('search', search.trim());
  return `/users?${params.toString()}`;
}

export default function UsersList() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [statoFilter, setStatoFilter] = useState<StatoFilter>('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [result, setResult] = useState<PaginatedResponse<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, statoFilter, debouncedSearch]);

  const fetchUsers = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await api.get<PaginatedResponse<User>>(
        buildUsersQuery(page, roleFilter, statoFilter, debouncedSearch)
      );
      setResult(data);
    } catch (e) {
      setResult(null);
      setListError(e instanceof ApiError ? e.message : 'Impossibile caricare gli utenti.');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statoFilter, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const closeResetModal = () => {
    setResetUserId(null);
    setResetPassword('');
    setResetError(null);
  };

  const handleToggleStatus = async (id: number) => {
    setActionError(null);
    setTogglingId(id);
    try {
      await api.post(`/users/${id}/toggle-status`);
      await fetchUsers();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleResetPassword = async () => {
    if (resetUserId == null) return;
    if (!resetPassword.trim()) {
      setResetError('Inserisci una password.');
      return;
    }
    setResetError(null);
    setResetSubmitting(true);
    try {
      await api.post(`/users/${resetUserId}/reset-password`, { password: resetPassword });
      closeResetModal();
    } catch (e) {
      setResetError(e instanceof ApiError ? e.message : 'Reset password non riuscito.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const totalPages = result?.totalPages ?? 1;
  const rows = result?.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Utenti</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Gestisci gli account di <span className="font-medium text-gray-800">Fimass Sportello Amico</span>
            {currentUser ? (
              <span className="text-gray-500"> — accesso come {getUserDisplayName(currentUser)}</span>
            ) : null}
            . Cerca, filtra e aggiorna ruoli e stato degli utenti del portale.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/utenti/nuovo')}
          className="btn-primary shrink-0 self-start"
        >
          <Plus className="h-4 w-4" />
          Nuovo Utente
        </button>
      </header>

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </div>
      ) : null}

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Cerca per nome, email o username…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input-field pl-10"
              aria-label="Cerca utenti"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[160px] flex-1 sm:flex-none">
              <label htmlFor="filter-role" className="mb-1 block text-xs font-medium text-gray-500">
                Ruolo
              </label>
              <select
                id="filter-role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                className="input-field"
              >
                <option value="">Tutti i ruoli</option>
                <option value="admin">Admin</option>
                <option value="supervisore">Supervisore</option>
                <option value="operatore">Operatore</option>
                <option value="struttura">Struttura</option>
              </select>
            </div>
            <div className="min-w-[160px] flex-1 sm:flex-none">
              <label htmlFor="filter-stato" className="mb-1 block text-xs font-medium text-gray-500">
                Stato
              </label>
              <select
                id="filter-stato"
                value={statoFilter}
                onChange={(e) => setStatoFilter(e.target.value as StatoFilter)}
                className="input-field"
              >
                <option value="">Tutti gli stati</option>
                <option value="attivo">Attivo</option>
                <option value="disattivo">Disattivo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              <p className="text-sm text-gray-500">Caricamento elenco…</p>
            </div>
          </div>
        ) : listError ? (
          <div className="p-8 text-center text-sm text-red-700">{listError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Nome / Denominazione</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Ruolo</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Username</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Stato</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Ultimo accesso</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      Nessun utente trovato con i filtri selezionati.
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {getUserDisplayName(u)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge ${getRoleBadgeColor(u.role)}`}>
                            {getRoleLabel(u.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{u.username}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-gray-700">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                u.stato === 'attivo' ? 'bg-emerald-500' : 'bg-gray-300'
                              }`}
                              aria-hidden
                            />
                            {u.stato === 'attivo' ? 'Attivo' : 'Disattivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                          {formatDateTime(u.last_login)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Link
                              to={`/utenti/${u.id}/modifica`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              title="Modifica"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              disabled={isSelf || togglingId === u.id}
                              onClick={() => handleToggleStatus(u.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
                              title={isSelf ? 'Non puoi modificare il tuo stato da qui' : 'Attiva / disattiva'}
                            >
                              <ToggleLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => {
                                setResetUserId(u.id);
                                setResetPassword('');
                                setResetError(null);
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
                              title={isSelf ? 'Non disponibile sul proprio account' : 'Reimposta password'}
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !listError && result && result.total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Mostrando{' '}
              <span className="font-medium text-gray-900">
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, result.total)}
              </span>{' '}
              di <span className="font-medium text-gray-900">{result.total}</span> utenti
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
        ) : null}
      </div>

      <Modal
        isOpen={resetUserId != null}
        onClose={closeResetModal}
        title="Reimposta password"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Imposta una nuova password per l&apos;utente selezionato. L&apos;utente dovrà utilizzarla al
            prossimo accesso.
          </p>
          <div>
            <label htmlFor="reset-password" className="mb-1 block text-sm font-medium text-gray-700">
              Nuova password
            </label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="input-field"
            />
          </div>
          {resetError ? <p className="text-sm text-red-600">{resetError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeResetModal} className="btn-secondary">
              Annulla
            </button>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={resetSubmitting}
              className="btn-primary"
            >
              {resetSubmitting ? 'Salvataggio…' : 'Conferma'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
