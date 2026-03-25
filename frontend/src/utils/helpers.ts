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
    'PRESENTATA': 'bg-slate-100 text-slate-700',
    'ASSEGNATA': 'bg-blue-100 text-blue-700',
    'IN LAVORAZIONE': 'bg-amber-100 text-amber-700',
    'STANDBY': 'bg-red-100 text-red-700',
    'ELABORATA': 'bg-emerald-100 text-emerald-700',
  };
  return colors[stato] || 'bg-gray-100 text-gray-700';
}

export function getPolicyStatusColor(stato: string): string {
  const colors: Record<string, string> = {
    'RICHIESTA PRESENTATA': 'bg-slate-100 text-slate-700',
    'IN VERIFICA': 'bg-blue-100 text-blue-700',
    'DOCUMENTAZIONE MANCANTE': 'bg-red-100 text-red-700',
    'PRONTA PER EMISSIONE': 'bg-amber-100 text-amber-700',
    'EMESSA': 'bg-emerald-100 text-emerald-700',
  };
  return colors[stato] || 'bg-gray-100 text-gray-700';
}

export function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    'admin': 'bg-purple-100 text-purple-700',
    'supervisore': 'bg-blue-100 text-blue-700',
    'operatore': 'bg-amber-100 text-amber-700',
    'struttura': 'bg-emerald-100 text-emerald-700',
  };
  return colors[role] || 'bg-gray-100 text-gray-700';
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
