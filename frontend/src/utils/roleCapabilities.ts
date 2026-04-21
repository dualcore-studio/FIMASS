import type { User } from '../types';

/** Chi può assegnare o riassegnare preventivi (API + UI). */
export function canAssignPreventivi(role: User['role'] | undefined): boolean {
  return role === 'admin' || role === 'supervisore';
}

/** Elenco completo preventivi (admin / supervisore; dettaglio in base alla route). */
export function canViewAllPreventivi(role: User['role'] | undefined): boolean {
  return role === 'admin' || role === 'supervisore';
}

/** Incaricato: solo le pratiche assegnate a lui. */
export function canViewOwnAssignedPreventivi(role: User['role'] | undefined): boolean {
  return role === 'operatore' || role === 'fornitore';
}

export function canWorkPreventivi(role: User['role'] | undefined): boolean {
  return role === 'operatore' || role === 'fornitore';
}

export function canManageProvvigioni(role: User['role'] | undefined): boolean {
  return role === 'admin' || role === 'fornitore' || role === 'struttura';
}
