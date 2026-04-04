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
    PRESENTATA: 'bg-slate-500/20 text-slate-200',
    ASSEGNATA: 'bg-blue-500/20 text-blue-200',
    'IN LAVORAZIONE': 'bg-amber-500/20 text-amber-200',
    STANDBY: 'bg-red-500/20 text-red-200',
    ELABORATA: 'bg-emerald-500/20 text-emerald-200',
  };
  return colors[stato] || 'bg-slate-500/20 text-slate-200';
}

export function getPolicyStatusColor(stato: string): string {
  const colors: Record<string, string> = {
    'RICHIESTA PRESENTATA': 'bg-slate-500/20 text-slate-200',
    'IN VERIFICA': 'bg-blue-500/20 text-blue-200',
    'DOCUMENTAZIONE MANCANTE': 'bg-red-500/20 text-red-200',
    'PRONTA PER EMISSIONE': 'bg-amber-500/20 text-amber-200',
    EMESSA: 'bg-emerald-500/20 text-emerald-200',
  };
  return colors[stato] || 'bg-slate-500/20 text-slate-200';
}

export function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    admin: 'bg-purple-500/20 text-purple-200',
    supervisore: 'bg-blue-500/20 text-blue-200',
    operatore: 'bg-amber-500/20 text-amber-200',
    struttura: 'bg-emerald-500/20 text-emerald-200',
  };
  return colors[role] || 'bg-slate-500/20 text-slate-200';
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
