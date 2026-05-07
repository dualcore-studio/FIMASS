'use strict';

const { TIME_RE, parseTimeToMinutes } = require('./appointmentsTime');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const VIDEOCALL_TELEFONATA_ORARI_AMMESSI = new Set([
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
]);

function dataIsWeekdayMonFriIt(dataStr) {
  const raw = String(dataStr || '').trim().slice(0, 10);
  if (!DATE_RE.test(raw)) return false;
  const [yy, mm, dd] = raw.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  const day = new Date(yy, mm - 1, dd, 12, 0, 0).getDay();
  return day >= 1 && day <= 5;
}

function normalizeOraHHMM(ora) {
  const t = parseTimeToMinutes(String(ora || '').trim());
  if (t == null) return null;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Validazione Videocall / Telefonata: lun–ven, durata 30 min, ora negli slot fissi.
 * @returns {string|null} messaggio errore o null se ok / non applicabile
 */
function validateVideocallTelefonataAppointmentSlot(modalita, dataAppuntamento, oraInizio, durataMinuti) {
  const m = String(modalita || '').toLowerCase();
  if (m !== 'videocall' && m !== 'telefonata') return null;
  if (!DATE_RE.test(String(dataAppuntamento || '').trim())) {
    return 'Data appuntamento non valida per videocall o telefonata';
  }
  if (!dataIsWeekdayMonFriIt(dataAppuntamento)) {
    return 'Per videocall e telefonata sono disponibili solo giorni feriali (lunedì–venerdì)';
  }
  const dm = Number(durataMinuti);
  if (dm !== 30) {
    return 'Per videocall e telefonata la durata deve essere di 30 minuti';
  }
  if (!TIME_RE.test(String(oraInizio || '').trim())) {
    return 'Orario non valido (formato HH:MM)';
  }
  const hhmm = normalizeOraHHMM(oraInizio);
  if (!hhmm || !VIDEOCALL_TELEFONATA_ORARI_AMMESSI.has(hhmm)) {
    return 'Scegliere uno degli orari disponibili per videocall / telefonata';
  }
  return null;
}

module.exports = {
  VIDEOCALL_TELEFONATA_ORARI_AMMESSI_LIST: [...VIDEOCALL_TELEFONATA_ORARI_AMMESSI],
  dataIsWeekdayMonFriIt,
  validateVideocallTelefonataAppointmentSlot,
};
