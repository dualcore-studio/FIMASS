/** Normalizza stato preventivo (allineato al frontend: STAND BY, COMPLETATA → ELABORATA). */
function normalizeQuoteStato(stato) {
  if (stato == null || typeof stato !== 'string') return '';
  const s = stato.trim().replace(/\s+/g, ' ').toUpperCase();
  if (s === 'STAND BY') return 'STANDBY';
  if (s === 'COMPLETATA') return 'ELABORATA';
  return s;
}

/** True se la pratica preventivo non può più essere assegnata/riassegnata. */
function isQuoteClosedForAssignment(stato) {
  return normalizeQuoteStato(stato) === 'ELABORATA';
}

module.exports = { normalizeQuoteStato, isQuoteClosedForAssignment };
