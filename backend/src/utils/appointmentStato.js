const APPOINTMENT_STATI = new Set(['RICHIESTO', 'CONFERMATO', 'DA RIPROGRAMMARE', 'COMPLETATO', 'ANNULLATO']);
const APPOINTMENT_MODALITA = new Set(['presenza', 'videocall', 'telefonata']);
const DURATE_AMMESSE = new Set([30, 60]);

function normalizeStato(s) {
  return String(s || '').trim().toUpperCase();
}

function isStatoChiuso(stato) {
  const s = normalizeStato(stato);
  return s === 'COMPLETATO' || s === 'ANNULLATO';
}

function strutturaPuoModificare(stato) {
  const s = normalizeStato(stato);
  return s === 'RICHIESTO' || s === 'DA RIPROGRAMMARE';
}

module.exports = {
  APPOINTMENT_STATI,
  APPOINTMENT_MODALITA,
  DURATE_AMMESSE,
  normalizeStato,
  isStatoChiuso,
  strutturaPuoModificare,
};
