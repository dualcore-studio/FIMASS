/** Ruoli che possono accedere alla sezione Scadenze (allineato al backend `/api/scadenze`). */
export const SCADENZE_ACCESS_ROLES = ['admin', 'supervisore', 'struttura'] as const;

export function userCanAccessScadenze(role: string | undefined): boolean {
  return role != null && (SCADENZE_ACCESS_ROLES as readonly string[]).includes(role);
}
