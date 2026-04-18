/**
 * Garanzie RC Auto dai soli flag nei dati specifici (allineato al backend).
 * Fonte unica: shared/rcAutoGuaranteeFields.json
 */
import RC_AUTO_GUARANTEE_FIELDS_JSON from '../../../shared/rcAutoGuaranteeFields.json';

export const RC_AUTO_GUARANTEE_FIELDS = RC_AUTO_GUARANTEE_FIELDS_JSON as Readonly<Record<string, string>>;

export function isRcAutoGuaranteeSi(val: unknown): boolean {
  const t = String(val ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  return t === 'si';
}

/** Etichette garanzia selezionate (valore "Si"), nell'ordine definito dalla mappa. */
export function getRcGaranzieSelezionate(datiSpecifici: Record<string, unknown> | null | undefined): string[] {
  if (!datiSpecifici || typeof datiSpecifici !== 'object') return [];

  const out: string[] = [];
  for (const [key, label] of Object.entries(RC_AUTO_GUARANTEE_FIELDS)) {
    if (isRcAutoGuaranteeSi(datiSpecifici[key])) {
      out.push(label);
    }
  }
  return out;
}
