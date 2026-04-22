/** Placeholder when a date is missing or not displayable (coerente con formatEuro e altre UI). */
export const EMPTY_DATE_PLACEHOLDER = '—';

const DATE_ONLY_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Interpreta stringhe/numeri per la sola visualizzazione in UI.
 * - `YYYY-MM-DD` senza ora: calendario locale a mezzogiorno (evita shift UTC su `new Date('YYYY-MM-DD')`).
 * - `YYYY-MM-DD HH:mm:ss` (stile SQL): componenti locali.
 * - Timestamp numerico (ms) e ISO complete: `Date` nativo.
 */
export function parseForDisplay(value: string | number | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (!s) return null;

  if (DATE_ONLY_YMD.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0, 0);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  const sql = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/,
  );
  if (sql) {
    const date = new Date(
      Number(sql[1]),
      Number(sql[2]) - 1,
      Number(sql[3]),
      Number(sql[4]),
      Number(sql[5]),
      sql[6] != null ? Number(sql[6]) : 0,
      0,
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t;
}

const dateOpts: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

const fmtDate = new Intl.DateTimeFormat('it-IT', dateOpts);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Data in formato GG/MM/AAAA. */
export function formatDate(value: string | number | null | undefined): string {
  const d = parseForDisplay(value);
  if (!d) return EMPTY_DATE_PLACEHOLDER;
  return fmtDate.format(d);
}

/**
 * Data e ora: GG/MM/AAAA HH:mm (24h).
 * Se il valore è solo `YYYY-MM-DD`, mostra la data senza orario (campi “giorno” puri).
 */
export function formatDateTime(value: string | number | null | undefined): string {
  if (value == null || value === '') return EMPTY_DATE_PLACEHOLDER;
  if (typeof value === 'string' && DATE_ONLY_YMD.test(value.trim())) {
    return formatDate(value);
  }
  const d = parseForDisplay(value);
  if (!d) return EMPTY_DATE_PLACEHOLDER;
  // Formato richiesto portale: GG/MM/AAAA HH:mm (24h, senza virgola tra data e ora)
  return `${fmtDate.format(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Intestazione dashboard: es. "mercoledì 22 aprile 2026" (locale it-IT). */
export function formatDateWeekdayLongIt(d: Date = new Date()): string {
  return d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const YMD_WITH_TIME_PREFIX = /^\d{4}-\d{2}-\d{2}[T ]\d/;

/**
 * Formattazione per valori mostrati da JSON/record generici (es. `dati_specifici`, output elaborazioni):
 * date `YYYY-MM-DD` e datetime ISO/SQL → italiano; boolean → Sì/No; array → elementi formattati e separati da "; ".
 */
export function formatUnknownValueForDisplay(value: unknown): string {
  if (value === null || value === undefined) return EMPTY_DATE_PLACEHOLDER;
  if (typeof value === 'boolean') return value ? 'Sì' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return EMPTY_DATE_PLACEHOLDER;
    return value.map((v) => formatUnknownValueForDisplay(v)).join('; ');
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return formatDateTime(value.getTime());
    }
    return String(value);
  }
  if (typeof value === 'number') return String(value);
  const s = String(value).trim();
  if (!s) return EMPTY_DATE_PLACEHOLDER;
  if (DATE_ONLY_YMD.test(s)) return formatDate(s);
  if (YMD_WITH_TIME_PREFIX.test(s)) return formatDateTime(s);
  return s;
}
