import type { Quote } from '../types';

/** Dati di elaborazione RC Auto persistiti in `dati_preventivo` (allineato al backend). */
export function hasSavedRcAutoElaborazione(datiPreventivo: unknown): boolean {
  if (!datiPreventivo || typeof datiPreventivo !== 'object') return false;
  const e = (datiPreventivo as Record<string, unknown>).elaborazione_rc_auto;
  if (!e || typeof e !== 'object') return false;
  const rows = (e as { pricingBreakdown?: unknown }).pricingBreakdown;
  return Array.isArray(rows) && rows.length > 0;
}

export function userCanRegenerateRcRiepilogoPdf(
  quote: Quote,
  role: string | undefined,
  userId: number | undefined,
): boolean {
  if (String(quote.tipo_codice || '').toLowerCase() !== 'rc_auto') return false;
  if (quote.stato !== 'ELABORATA') return false;
  if (!hasSavedRcAutoElaborazione(quote.dati_preventivo)) return false;
  if (role === 'admin' || role === 'supervisore') return true;
  if (role === 'operatore' && userId != null && Number(quote.operatore_id) === Number(userId)) return true;
  if (role === 'fornitore' && userId != null && Number(quote.fornitore_id) === Number(userId)) return true;
  return false;
}
