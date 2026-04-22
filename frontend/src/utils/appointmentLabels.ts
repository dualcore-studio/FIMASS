import type { AppointmentModalita, AppointmentStato } from '../types';

export function modalitaLabel(m: AppointmentModalita | string): string {
  const x = String(m || '').toLowerCase();
  if (x === 'presenza') return 'In presenza';
  if (x === 'videocall') return 'Videocall';
  if (x === 'telefonata') return 'Telefonata';
  return String(m || '—');
}

export function modalitaBadgeClass(m: AppointmentModalita | string): string {
  const x = String(m || '').toLowerCase();
  if (x === 'presenza') return 'bg-slate-100 text-slate-800';
  if (x === 'videocall') return 'bg-indigo-50 text-indigo-900';
  if (x === 'telefonata') return 'bg-amber-50 text-amber-900';
  return 'bg-slate-50 text-slate-700';
}

export function isAppointmentClosed(stato: AppointmentStato | string): boolean {
  const s = String(stato || '').toUpperCase();
  return s === 'COMPLETATO' || s === 'ANNULLATO';
}

export function strutturaCanEditTable(stato: AppointmentStato | string): boolean {
  const s = String(stato || '').toUpperCase();
  return s === 'RICHIESTO' || s === 'DA RIPROGRAMMARE';
}
