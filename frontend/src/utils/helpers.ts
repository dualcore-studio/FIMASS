export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

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
    struttura: 'bg-[var(--badge-soft-green-bg)] text-[var(--badge-soft-green-text)]',
  };
  return colors[role] || 'bg-[var(--badge-soft-slate-bg)] text-[var(--badge-soft-slate-text)]';
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    'admin': 'Admin',
    'supervisore': 'Supervisore',
    'operatore': 'Operatore',
    'struttura': 'Struttura',
  };
  return labels[role] || role;
}
