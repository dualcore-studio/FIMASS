/**
 * Garanzie RC Auto dai flag booleani nei dati specifici della pratica (allineato al backend).
 * Mappa chiavi → etichette: shared/rcAutoGuaranteeFields.json
 */
import RC_AUTO_GUARANTEE_FIELDS_JSON from '../../../shared/rcAutoGuaranteeFields.json';

export const RC_AUTO_GUARANTEE_FIELDS = RC_AUTO_GUARANTEE_FIELDS_JSON as Readonly<Record<string, string>>;

const NEST_KEYS = ['formData', 'form', 'values', 'fields', 'campi'] as const;

/** Una garanzia è selezionata solo se il valore nel form è strettamente `true`. */
export function isRcAutoGuaranteeFieldTrue(val: unknown): boolean {
  return val === true;
}

/**
 * Individua l'oggetto che contiene i booleani garanzia (stesso livello per tutte le chiavi).
 * Priorità: primo tra root e oggetti annidati che dichiara almeno una chiave garanzia nota.
 */
export function resolveRcAutoGuaranteeSource(
  datiSpecifici: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!datiSpecifici || typeof datiSpecifici !== 'object') return {};
  const guaranteeKeys = Object.keys(RC_AUTO_GUARANTEE_FIELDS);
  const candidates: Record<string, unknown>[] = [datiSpecifici];
  for (const k of NEST_KEYS) {
    const v = datiSpecifici[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      candidates.push(v as Record<string, unknown>);
    }
  }
  for (const o of candidates) {
    if (guaranteeKeys.some((key) => Object.prototype.hasOwnProperty.call(o, key))) {
      return o;
    }
  }
  return datiSpecifici;
}

/** Etichette garanzia selezionate (boolean true), nell'ordine definito dalla mappa. */
export function getRcGaranzieSelezionate(datiSpecifici: Record<string, unknown> | null | undefined): string[] {
  if (!datiSpecifici || typeof datiSpecifici !== 'object') return [];

  const src = resolveRcAutoGuaranteeSource(datiSpecifici);
  const out: string[] = [];
  for (const [key, label] of Object.entries(RC_AUTO_GUARANTEE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(src, key) && isRcAutoGuaranteeFieldTrue(src[key])) {
      out.push(label);
    }
  }
  return out;
}
