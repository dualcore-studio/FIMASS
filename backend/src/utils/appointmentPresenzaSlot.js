'use strict';

const { TIME_RE, parseTimeToMinutes } = require('./appointmentsTime');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Slot di inizio ammessi per appuntamenti in presenza (giovedì, fasce da 30 min). */
const PRESENZA_ORARI_AMMESSI = new Set(['10:00', '10:30', '11:00', '11:30', '12:00', '12:30']);

/**
 * Verifica giorno della settimana per stringa ISO locale YYYY-MM-DD (mezzogiorno fuso locale).
 * @returns {boolean} true se giovedì (getDay === 4)
 */
function dataIsThursdayIt(dataStr) {
  const raw = String(dataStr || '').trim().slice(0, 10);
  if (!DATE_RE.test(raw)) return false;
  const [yy, mm, dd] = raw.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  const dt = new Date(yy, mm - 1, dd, 12, 0, 0);
  return dt.getDay() === 4;
}

function normalizeOraHHMM(ora) {
  const t = parseTimeToMinutes(String(ora || '').trim());
  if (t == null) return null;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Validazione fascia presenza Struttura: solo giovedì, durata 30 min, ora inizio negli slot fissi.
 * @returns {string|null} messaggio errore o null se ok / non applicabile
 */
function validatePresenzaAppointmentSlot(modalita, dataAppuntamento, oraInizio, durataMinuti) {
  const m = String(modalita || '').toLowerCase();
  if (m !== 'presenza') return null;
  if (!DATE_RE.test(String(dataAppuntamento || '').trim())) {
    return 'Data appuntamento non valida per la modalità in presenza';
  }
  if (!dataIsThursdayIt(dataAppuntamento)) {
    return 'Per gli appuntamenti in presenza è possibile selezionare solo il giovedì';
  }
  const dm = Number(durataMinuti);
  if (dm !== 30) {
    return 'Per la modalità in presenza la durata deve essere di 30 minuti';
  }
  if (!TIME_RE.test(String(oraInizio || '').trim())) {
    return 'Orario non valido (formato HH:MM)';
  }
  const hhmm = normalizeOraHHMM(oraInizio);
  if (!hhmm || !PRESENZA_ORARI_AMMESSI.has(hhmm)) {
    return 'Per la modalità in presenza scegliere uno degli orari disponibili: 10:00, 10:30, 11:00, 11:30, 12:00, 12:30';
  }
  return null;
}

module.exports = {
  PRESENZA_ORARI_AMMESSI_LIST: [...PRESENZA_ORARI_AMMESSI],
  dataIsThursdayIt,
  normalizeOraHHMM,
  validatePresenzaAppointmentSlot,
};
