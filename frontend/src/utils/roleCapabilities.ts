import type { User } from '../types';

/** Chi può assegnare o riassegnare preventivi (API + UI). */
export function canAssignPreventivi(role: User['role'] | undefined): boolean {
  return role === 'admin' || role === 'supervisore';
}
