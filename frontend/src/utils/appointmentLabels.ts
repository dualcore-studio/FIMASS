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

/** Badge stato appuntamento — allineato a calendario e tabella. */
export function appointmentStatusBadgeClasses(stato: string): string {
  const key = String(stato || '').trim().toUpperCase();
  const map: Record<string, string> = {
    /** Azzurro chiaro: distinto dal blu pieno di CONFERMATO */
    RICHIESTO: 'bg-sky-50 text-sky-950 border border-sky-200/95',
    /** Blu più saturo e riconoscibile, testo ancora leggibile */
    CONFERMATO: 'bg-blue-200 text-blue-950 border border-blue-400/85',
    'DA RIPROGRAMMARE': 'bg-orange-100 text-orange-950 border border-orange-200/90',
    ANNULLATO: 'bg-red-100 text-red-950 border border-red-200/90',
    COMPLETATO: 'bg-green-100 text-green-950 border border-green-200/90',
  };
  return map[key] || 'bg-slate-100 text-slate-800 border border-slate-200/90';
}

/** Chip evento calendario (fondo + bordo sinistro). */
export function appointmentCalendarChipClass(stato: AppointmentStato): string {
  switch (stato) {
    case 'RICHIESTO':
      return 'border-l-sky-400 bg-sky-50/95';
    case 'CONFERMATO':
      return 'border-l-blue-700 bg-blue-200/92';
    case 'DA RIPROGRAMMARE':
      return 'border-l-orange-500 bg-orange-100/85';
    case 'ANNULLATO':
      return 'border-l-red-500 bg-red-100/85';
    case 'COMPLETATO':
      return 'border-l-green-600 bg-green-100/85';
    default:
      return 'border-l-slate-400 bg-slate-100/80';
  }
}

export function appointmentCalendarDotClass(stato: AppointmentStato): string {
  switch (stato) {
    case 'RICHIESTO':
      return 'bg-sky-400';
    case 'CONFERMATO':
      return 'bg-blue-700';
    case 'DA RIPROGRAMMARE':
      return 'bg-orange-500';
    case 'ANNULLATO':
      return 'bg-red-500';
    case 'COMPLETATO':
      return 'bg-green-600';
    default:
      return 'bg-slate-400';
  }
}
