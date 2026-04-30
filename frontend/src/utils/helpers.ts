import type { CommissionStructureType } from '../types';
import { appointmentStatusBadgeClasses } from './appointmentLabels';

export {
  EMPTY_DATE_PLACEHOLDER,
  formatDate,
  formatDateTime,
  formatDateWeekdayLongIt,
  formatUnknownValueForDisplay,
  parseForDisplay,
} from './dateDisplay';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function getUserDisplayName(user: { role: string; nome?: string | null; cognome?: string | null; denominazione?: string | null }): string {
  if (user.role === 'struttura') return user.denominazione || 'Struttura';
  return [user.nome, user.cognome].filter(Boolean).join(' ') || 'Utente';
}

const STATUS_CLASS_PRESENTATA = 'bg-[var(--status-presentata-bg)] text-[var(--status-presentata-text)]';
const STATUS_CLASS_ASSEGNATA = 'bg-[var(--status-assegnata-bg)] text-[var(--status-assegnata-text)]';
const STATUS_CLASS_STANDBY = 'bg-[var(--status-standby-bg)] text-[var(--status-standby-text)]';
const STATUS_CLASS_LAVORAZIONE = 'bg-[var(--status-lavorazione-bg)] text-[var(--status-lavorazione-text)]';
const STATUS_CLASS_COMPLETATA = 'bg-[var(--status-completata-bg)] text-[var(--status-completata-text)]';

/** Normalizza chiavi stato preventivo (STAND BY = STANDBY, COMPLETATA = ELABORATA). */
function normalizeQuoteStatusKey(stato: string): string {
  const s = stato.trim().replace(/\s+/g, ' ').toUpperCase();
  if (s === 'STAND BY') return 'STANDBY';
  if (s === 'COMPLETATA') return 'ELABORATA';
  return s;
}

/** ELABORATA e alias COMPLETATA: nessuna assegnazione / riassegnazione. */
export function isQuoteClosedForAssignment(stato: string | null | undefined): boolean {
  if (stato == null) return false;
  const s = String(stato).trim();
  if (!s) return false;
  return normalizeQuoteStatusKey(s) === 'ELABORATA';
}

export function getQuoteStatusColor(stato: string): string {
  const key = normalizeQuoteStatusKey(stato);
  const colors: Record<string, string> = {
    PRESENTATA: STATUS_CLASS_PRESENTATA,
    ASSEGNATA: STATUS_CLASS_ASSEGNATA,
    'IN LAVORAZIONE': STATUS_CLASS_LAVORAZIONE,
    STANDBY: STATUS_CLASS_STANDBY,
    ELABORATA: STATUS_CLASS_COMPLETATA,
  };
  return colors[key] || 'bg-[var(--badge-soft-slate-bg)] text-[var(--badge-soft-slate-text)]';
}

/**
 * Polizze: stessa palette dei preventivi dove ha senso nel flusso
 * (presentata → celeste, in verifica → giallo, ecc.).
 */
/** Appuntamenti: palette condivisa con vista calendario (vedi appointmentLabels). */
export function getAppointmentStatusColor(stato: string): string {
  return appointmentStatusBadgeClasses(stato);
}

export function getPolicyStatusColor(stato: string): string {
  const key = stato.trim();
  const normalized = /^COMPLETATA$/i.test(key) ? 'COMPLETATA' : key;
  const colors: Record<string, string> = {
    'RICHIESTA PRESENTATA': STATUS_CLASS_PRESENTATA,
    'IN EMISSIONE': STATUS_CLASS_LAVORAZIONE,
    EMESSA: STATUS_CLASS_COMPLETATA,
    COMPLETATA: STATUS_CLASS_COMPLETATA,
    'IN VERIFICA': STATUS_CLASS_LAVORAZIONE,
    'DOCUMENTAZIONE MANCANTE': STATUS_CLASS_LAVORAZIONE,
    'PRONTA PER EMISSIONE': STATUS_CLASS_LAVORAZIONE,
  };
  return colors[normalized] || 'bg-[var(--badge-soft-slate-bg)] text-[var(--badge-soft-slate-text)]';
}

export function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    admin: 'bg-violet-100 text-violet-900',
    supervisore: 'bg-[var(--badge-soft-blue-bg)] text-[var(--badge-soft-blue-text)]',
    operatore: 'bg-[var(--badge-soft-orange-bg)] text-[var(--badge-soft-orange-text)]',
    fornitore: 'bg-sky-100 text-sky-900',
    struttura: 'bg-[var(--badge-soft-green-bg)] text-[var(--badge-soft-green-text)]',
  };
  return colors[role] || 'bg-[var(--badge-soft-slate-bg)] text-[var(--badge-soft-slate-text)]';
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    'admin': 'Admin',
    'supervisore': 'Supervisore',
    'operatore': 'Operatore',
    'fornitore': 'Broker',
    'struttura': 'Struttura',
  };
  return labels[role] || role;
}

export function formatEuro(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value));
}

/** Importi provvigionali: null/non numerico → “Da inserire” (non confusione con €0,00). */
export function formatCommissionEuro(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Da inserire';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value));
}

/** % provvigione struttura sulla provv. broker (colonna Tipo / % e importo struttura). */
export function commissionPercentForType(type: string): number {
  if (type === 'PARTNER') return 50;
  if (type === 'SPORTELLO_AMICO') return 50;
  return 30;
}

/** % quota S.A. sulla provvigione broker (colonna Quota S.A.). */
export function sportelloAmicoQuotaPercentForType(type: string): number {
  if (type === 'PARTNER') return 15;
  if (type === 'SPORTELLO_AMICO') return 50;
  return 35;
}

export function normalizeCommissionStructureType(type: string | null | undefined): CommissionStructureType {
  const u = String(type ?? '').toUpperCase();
  if (u === 'PARTNER' || u === 'SPORTELLO_AMICO') return u;
  return 'SEGNALATORE';
}

export function getCommissionTypeBadgeClass(type: string): string {
  if (type === 'PARTNER') return 'bg-emerald-100 text-emerald-900';
  if (type === 'SPORTELLO_AMICO') return 'bg-violet-100 text-violet-900';
  return 'bg-sky-100 text-sky-900';
}

export function getCommissionTypeLabel(type: string): string {
  if (type === 'PARTNER') return 'Collaboratore IVASS';
  if (type === 'SPORTELLO_AMICO') return 'Sportello Amico';
  return 'Segnalatore';
}

export function getCommissionValorizationBadgeClass(status: string | null | undefined): string {
  if (status === 'LIQUIDATA') return 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80';
  if (status === 'VALORIZZATA') return 'bg-slate-100 text-slate-800 ring-1 ring-slate-200/80';
  return 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/70';
}

export function getCommissionValorizationLabel(status: string | null | undefined): string {
  if (status === 'LIQUIDATA') return 'Liquidata';
  if (status === 'VALORIZZATA') return 'Valorizzata';
  return 'Da valorizzare';
}

const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidContactEmail(s: string): boolean {
  return CONTACT_EMAIL_RE.test(String(s || '').trim());
}

/** Almeno 5 cifre, ignorando simboli non numerici. */
export function isValidAssistitoPhone(s: string): boolean {
  const digits = String(s || '').replace(/\D/g, '');
  return digits.length >= 5;
}
