/**
 * Garanzie RC Auto / Moto / Autocarri (tipologia `rc_auto`): booleani e/o `garanzie_selezionate`.
 * Mappa chiavi → etichette: shared/rcAutoGuaranteeFields.json
 */
import RC_AUTO_GUARANTEE_FIELDS_JSON from '../../../shared/rcAutoGuaranteeFields.json';

export const RC_AUTO_GUARANTEE_FIELDS = RC_AUTO_GUARANTEE_FIELDS_JSON as Readonly<Record<string, string>>;

const NEST_KEYS = ['formData', 'form', 'values', 'fields', 'campi'] as const;

/** Chiavi da non mostrare come campi singoli nel dettaglio (sostituite da «Garanzie richieste»). */
export const RC_DATI_SPEC_KEYS_TO_HIDE = new Set<string>([
  ...Object.keys(RC_AUTO_GUARANTEE_FIELDS),
  'garanzie_selezionate',
]);

const MULTI_OPTION_TO_LABEL: Readonly<Record<string, string>> = {
  'rc auto': 'RC',
  'furto e incendio': 'Furto e Incendio',
  'atti vandalici': 'Atti Vandalici',
  'cristalli': 'Cristalli',
  'eventi naturali': 'Eventi Naturali',
  'assistenza stradale': 'Assistenza Stradale',
  'tutela legale': 'Tutela Legale',
  'altre garanzie': 'Altre garanzie',
};

const LABEL_ORDER: string[] = [
  ...Object.values(RC_AUTO_GUARANTEE_FIELDS),
  'Altre garanzie',
];

function labelOrderIndex(label: string): number {
  const i = LABEL_ORDER.indexOf(label);
  return i >= 0 ? i : 1000;
}

function sortGaranzieLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const d = labelOrderIndex(a) - labelOrderIndex(b);
    if (d !== 0) return d;
    return a.localeCompare(b, 'it');
  });
}

function mapMultiselectOption(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (!k) return '';
  return MULTI_OPTION_TO_LABEL[k] ?? raw.trim();
}

function findGaranzieSelezionateArray(
  datiSpecifici: Record<string, unknown>,
): unknown[] | null {
  const direct = datiSpecifici.garanzie_selezionate;
  if (Array.isArray(direct)) return direct;
  for (const nk of NEST_KEYS) {
    const v = datiSpecifici[nk];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = (v as Record<string, unknown>).garanzie_selezionate;
      if (Array.isArray(inner)) return inner;
    }
  }
  return null;
}

/** RC Auto / Moto / Autocarri: unica tipologia veicoli nel portale (`rc_auto`). */
export function isRcVeicoliTipo(codice: string | null | undefined): boolean {
  return String(codice ?? '').trim().toLowerCase() === 'rc_auto';
}

/** Una garanzia boolean è selezionata solo se il valore è strettamente `true`. */
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

function getRcGaranzieFromBooleans(
  datiSpecifici: Record<string, unknown>,
): string[] {
  const src = resolveRcAutoGuaranteeSource(datiSpecifici);
  const out: string[] = [];
  for (const [key, label] of Object.entries(RC_AUTO_GUARANTEE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(src, key) && isRcAutoGuaranteeFieldTrue(src[key])) {
      out.push(label);
    }
  }
  return out;
}

function getRcGaranzieFromMultiselect(datiSpecifici: Record<string, unknown>): string[] {
  const arr = findGaranzieSelezionateArray(datiSpecifici);
  if (!arr || arr.length === 0) return [];
  const labels = arr
    .map((x) => (typeof x === 'string' ? mapMultiselectOption(x) : mapMultiselectOption(String(x))))
    .filter((s) => s.length > 0);
  return sortGaranzieLabels([...new Set(labels)]);
}

/**
 * Etichette garanzia richieste, in ordine definito: prima mappa boolean; se nessun true, usa
 * `garanzie_selezionate` (multiselect) con etichette normalizzate.
 */
export function getRcGaranzieSelezionate(
  datiSpecifici: Record<string, unknown> | null | undefined,
): string[] {
  if (!datiSpecifici || typeof datiSpecifici !== 'object') return [];

  const fromBools = getRcGaranzieFromBooleans(datiSpecifici);
  if (fromBools.length > 0) return fromBools;

  return getRcGaranzieFromMultiselect(datiSpecifici);
}

/** Testo unico per il campo «Garanzie richieste» in dettaglio/riepilogo. */
export function formatGaranzieRichiesteRcLine(
  datiSpecifici: Record<string, unknown> | null | undefined,
): string {
  const list = getRcGaranzieSelezionate(datiSpecifici);
  return list.length > 0 ? list.join(', ') : '—';
}
