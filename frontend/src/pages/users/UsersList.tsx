import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Pencil,
  ToggleLeft,
  KeyRound,
  Trash2,
  Plus,
  Filter,
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
import TablePagination from '../../components/common/TablePagination';
import Modal from '../../components/ui/Modal';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import {
  buildUsersListQueryString,
  emptyRoleTabCounts,
  USERS_ROLE_TAB_KEYS,
  type RoleTabCounts,
  type UsersListRoleFilter,
} from '../../utils/usersListQuery';
import UsersRoleFilterTabs from '../../components/users/UsersRoleFilterTabs';
import { useListTableSort } from '../../hooks/useListTableSort';
import SortableTh from '../../components/common/SortableTh';

export default function UsersList() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<UsersListRoleFilter>('');
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
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [roleTabCounts, setRoleTabCounts] = useState<RoleTabCounts>(() => emptyRoleTabCounts());
  const roleCountsSeq = useRef(0);
  const [roleCountsBump, setRoleCountsBump] = useState(0);

  const tableSort = useListTableSort();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, debouncedSearch, tableSort.sortBy, tableSort.sortDir]);

  useEffect(() => {
    const seq = ++roleCountsSeq.current;
    let cancelled = false;

    async function fetchCounts() {
      try {
        const base = { page: 1, limit: 1, search: debouncedSearch };
        const allPromise = api.get<PaginatedResponse<User>>(
          buildUsersListQueryString({ ...base, role: '' }),
        );
        const byRolePromises = USERS_ROLE_TAB_KEYS.map((role) =>
          api.get<PaginatedResponse<User>>(buildUsersListQueryString({ ...base, role })),
        );
        const [allRes, ...roleResponses] = await Promise.all([allPromise, ...byRolePromises]);
        if (cancelled || seq !== roleCountsSeq.current) return;
        setRoleTabCounts({
          tutti: allRes.total,
          admin: roleResponses[0].total,
          supervisore: roleResponses[1].total,
          struttura: roleResponses[2].total,
          operatore: roleResponses[3].total,
        });
      } catch {
        if (cancelled || seq !== roleCountsSeq.current) return;
        setRoleTabCounts(emptyRoleTabCounts());
      }
    }

    fetchCounts();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, roleCountsBump]);

  const fetchUsers = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await api.get<PaginatedResponse<User>>(
        buildUsersListQueryString({
          page,
          role: roleFilter,
          search: debouncedSearch,
          sortBy: tableSort.sortBy,
          sortDir: tableSort.sortDir,
        }),
      );
      setResult(data);
    } catch (e) {
      setResult(null);
      setListError(e instanceof ApiError ? e.message : 'Impossibile caricare gli utenti.');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, debouncedSearch, tableSort.sortBy, tableSort.sortDir]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const totalPages = result?.totalPages ?? 1;
  useSyncPageToTotalPages(page, result?.totalPages, setPage);

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
      setRoleCountsBump((n) => n + 1);
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

  const closeDeleteModal = () => {
    setDeleteUserId(null);
  };

  const handleDeleteUser = async () => {
    if (deleteUserId == null) return;
    setActionError(null);
    setDeleteSubmitting(true);
    try {
      await api.delete(`/users/${deleteUserId}`);
      closeDeleteModal();
      await fetchUsers();
      setRoleCountsBump((n) => n + 1);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Eliminazione utente non riuscita.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

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
            . Cerca, filtra per ruolo e aggiorna gli utenti del portale.
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

      <div className="card px-2.5 py-2 sm:px-3 sm:py-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          <input
            id="users-search"
            type="search"
            placeholder="Cerca nome, email o username…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-field h-9 min-w-0 max-w-xl flex-1 py-1.5 pl-3 text-sm"
            aria-label="Cerca utenti"
          />
        </div>
      </div>

      <div className="card px-2.5 py-2 sm:px-3 sm:py-2.5">
        <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Filter className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          Ruoli
        </div>
        <UsersRoleFilterTabs
          activeRole={roleFilter}
          onRoleChange={setRoleFilter}
          counts={roleTabCounts}
        />
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
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <SortableTh
                    sortKey="nome"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Nome / Denominazione
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
                    sortKey="email"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Email
                  </SortableTh>
                  <SortableTh
                    sortKey="username"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Username
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
                    sortKey="ultimo_accesso"
                    activeKey={tableSort.sortBy}
                    direction={tableSort.sortDir}
                    onRequestSort={tableSort.requestSort}
                  >
                    Ultimo accesso
                  </SortableTh>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody>
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
                      <tr key={u.id}>
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
                            <button
                              type="button"
                              disabled={isSelf || deleteSubmitting}
                              onClick={() => setDeleteUserId(u.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                              title={isSelf ? 'Non disponibile sul proprio account' : 'Elimina utente'}
                            >
                              <Trash2 className="h-4 w-4" />
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
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={result.total}
            onPageChange={setPage}
            entityLabel="utenti"
          />
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

      <Modal
        isOpen={deleteUserId != null}
        onClose={closeDeleteModal}
        title="Elimina utente"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Questa operazione è irreversibile. L&apos;utente selezionato verrà eliminato definitivamente.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeDeleteModal} className="btn-secondary" disabled={deleteSubmitting}>
              Annulla
            </button>
            <button
              type="button"
              onClick={handleDeleteUser}
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
