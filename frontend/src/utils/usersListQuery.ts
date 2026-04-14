import type { User } from '../types';
import type { SortDirection } from '../hooks/useListTableSort';
import { TABLE_PAGE_SIZE } from '../constants/tablePagination';

export type UsersListRoleFilter = '' | User['role'];

export const USERS_ROLE_TAB_KEYS = ['admin', 'supervisore', 'struttura', 'operatore', 'fornitore'] as const satisfies readonly User['role'][];

export type UsersRoleCountKey = 'tutti' | User['role'];

export type RoleTabCounts = Record<UsersRoleCountKey, number | null>;

export function emptyRoleTabCounts(): RoleTabCounts {
  return {
    tutti: null,
    admin: null,
    supervisore: null,
    struttura: null,
    operatore: null,
    fornitore: null,
  };
}

export interface UsersListQueryParams {
  page: number;
  limit?: number;
  role: UsersListRoleFilter;
  search: string;
  sortBy?: string | null;
  sortDir?: SortDirection | null;
}

/**
 * Builds the `/users` list API query string. Shared by the table fetch and optional aggregate requests (e.g. counts).
 */
export function buildUsersListQueryString(params: UsersListQueryParams): string {
  const { page, limit = TABLE_PAGE_SIZE, role, search, sortBy, sortDir } = params;
  const urlParams = new URLSearchParams();
  urlParams.set('page', String(page));
  urlParams.set('limit', String(limit));
  if (role) urlParams.set('role', role);
  const q = search.trim();
  if (q) urlParams.set('search', q);
  if (sortBy) {
    urlParams.set('sort_by', sortBy);
    urlParams.set('sort_dir', sortDir ?? 'asc');
  }
  return `/users?${urlParams.toString()}`;
}
