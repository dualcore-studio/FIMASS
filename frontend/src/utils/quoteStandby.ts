import type { StatusHistory } from '../types';

/** Ultimo passaggio in STANDBY nella cronologia (per modale motivazione). */
export function getLatestStandbyTransition(
  history: StatusHistory[] | undefined | null,
): StatusHistory | null {
  if (!history?.length) return null;
  const standby = history.filter((h) => h.stato_nuovo === 'STANDBY');
  if (!standby.length) return null;
  return [...standby].sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || '')),
  )[0];
}
