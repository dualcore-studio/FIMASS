/** Regole fascia «In presenza»: solo giovedì 10:00–12:30 con slot da 30 minuti (allineato al backend). */
export const APPUNTAMENTO_PRESENZA_SLOT_ORARI = [
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export function parseTimeToMinutes(ora: string): number | null {
  const s = ora.trim();
  if (!TIME_RE.test(s)) return null;
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function normalizeTimeHHMM(ora: string): string | null {
  const t = parseTimeToMinutes(ora);
  if (t == null) return null;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function dataIsoIsThursday(dataIso: string): boolean {
  const raw = dataIso.trim().slice(0, 10);
  if (!DATE_RE.test(raw)) return false;
  const [yy, mm, dd] = raw.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  return new Date(yy, mm - 1, dd, 12, 0, 0).getDay() === 4;
}

const SLOT_SET = new Set<string>(APPUNTAMENTO_PRESENZA_SLOT_ORARI);

/** @returns messaggio errore o null se ok / non è presenza */
export function validatePresenzaAppointmentClient(
  modalita: string,
  dataAppuntamento: string,
  oraInizio: string,
  durataMinuti: number,
): string | null {
  if (modalita !== 'presenza') return null;
  const d = String(dataAppuntamento || '').trim().slice(0, 10);
  if (!DATE_RE.test(d)) return 'Data non valida per la modalità in presenza';
  if (!dataIsoIsThursday(d)) return 'Per gli appuntamenti in presenza è possibile selezionare solo il giovedì';
  if (durataMinuti !== 30) return 'Per la modalità in presenza la durata deve essere di 30 minuti';
  const oi = String(oraInizio || '').trim();
  if (!TIME_RE.test(oi)) return 'Orario non valido';
  const hhmm = normalizeTimeHHMM(oi);
  if (!hhmm || !SLOT_SET.has(hhmm)) {
    return 'Scegliere uno degli orari: 10:00, 10:30, 11:00, 11:30, 12:00, 12:30';
  }
  return null;
}

export function filterInsuranceTypesForStructure(
  types: { codice?: string | null }[],
  enabledTypes: string[] | null | undefined,
): { codice?: string | null }[] {
  if (!enabledTypes || enabledTypes.length === 0) return types;
  const raw = enabledTypes.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean);
  if (raw.length === 0 || raw.includes('all')) return types;
  const set = new Set(raw);
  return types.filter((t) => set.has(String(t.codice || '').trim().toLowerCase()));
}
