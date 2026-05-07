/** Stessa logica per «Videocall» e «Telefonata»: lun–ven, slot fissi, durata 30 min. */
export const APPUNTAMENTO_VIDEOCALL_TELEFONATA_SLOT_ORARI = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

const SLOT_SET = new Set<string>(APPUNTAMENTO_VIDEOCALL_TELEFONATA_SLOT_ORARI);

/** Lun–ven (lunedì=1 … venerdì=5) su stringa ISO locale YYYY-MM-DD a mezzogiorno. */
export function dataIsoIsWeekdayMonFri(dataIso: string): boolean {
  const raw = dataIso.trim().slice(0, 10);
  if (!DATE_RE.test(raw)) return false;
  const [yy, mm, dd] = raw.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  const d = new Date(yy, mm - 1, dd, 12, 0, 0).getDay();
  return d >= 1 && d <= 5;
}

export function normalizeTimeHHMMVideocallTel(ora: string): string | null {
  const s = ora.trim();
  if (!TIME_RE.test(s)) return null;
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * @returns messaggio errore o null se ok / non è videocall né telefonata
 */
export function validateVideocallTelefonataAppointmentClient(
  modalita: string,
  dataAppuntamento: string,
  oraInizio: string,
  durataMinuti: number,
): string | null {
  const m = String(modalita || '').toLowerCase();
  if (m !== 'videocall' && m !== 'telefonata') return null;
  const d = String(dataAppuntamento || '').trim().slice(0, 10);
  if (!DATE_RE.test(d)) return 'Data non valida per questa modalità';
  if (!dataIsoIsWeekdayMonFri(d)) {
    return 'Per videocall e telefonata sono disponibili solo giorni feriali (lunedì–venerdì)';
  }
  if (durataMinuti !== 30) return 'Per videocall e telefonata la durata deve essere di 30 minuti';
  const oi = String(oraInizio || '').trim();
  if (!TIME_RE.test(oi)) return 'Orario non valido';
  const hhmm = normalizeTimeHHMMVideocallTel(oi);
  if (!hhmm || !SLOT_SET.has(hhmm)) {
    return 'Scegliere uno degli orari disponibili per videocall / telefonata';
  }
  return null;
}
