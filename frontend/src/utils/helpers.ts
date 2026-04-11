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

export function getQuoteStatusColor(stato: string): string {
  const colors: Record<string, string> = {
    PRESENTATA: 'bg-[var(--badge-soft-slate-bg)] text-[var(--badge-soft-slate-text)]',
    ASSEGNATA: 'bg-[var(--badge-soft-blue-bg)] text-[var(--badge-soft-blue-text)]',
    'IN LAVORAZIONE': 'bg-[var(--badge-soft-orange-bg)] text-[var(--badge-soft-orange-text)]',
    STANDBY: 'bg-[var(--badge-soft-amber-bg)] text-[var(--badge-soft-amber-text)]',
    ELABORATA: 'bg-[var(--badge-soft-green-bg)] text-[var(--badge-soft-green-text)]',
  };
  return colors[stato] || 'bg-[var(--badge-soft-slate-bg)] text-[var(--badge-soft-slate-text)]';
}

export function getPolicyStatusColor(stato: string): string {
  const colors: Record<string, string> = {
    'RICHIESTA PRESENTATA': 'bg-[var(--badge-soft-slate-bg)] text-[var(--badge-soft-slate-text)]',
    'IN VERIFICA': 'bg-[var(--badge-soft-blue-bg)] text-[var(--badge-soft-blue-text)]',
    'DOCUMENTAZIONE MANCANTE': 'bg-[var(--badge-soft-red-bg)] text-[var(--badge-soft-red-text)]',
    'PRONTA PER EMISSIONE': 'bg-[var(--badge-soft-orange-bg)] text-[var(--badge-soft-orange-text)]',
    EMESSA: 'bg-[var(--badge-soft-green-bg)] text-[var(--badge-soft-green-text)]',
  };
  return colors[stato] || 'bg-[var(--badge-soft-slate-bg)] text-[var(--badge-soft-slate-text)]';
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
