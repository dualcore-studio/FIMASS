'use strict';

/** Stati canonici polizza (allineati a DB e UI). */
const LEGACY_TO_CANONICAL = {
  'IN VERIFICA': 'IN EMISSIONE',
  'DOCUMENTAZIONE MANCANTE': 'IN EMISSIONE',
  'PRONTA PER EMISSIONE': 'IN EMISSIONE',
};

const ALLOWED_POLICY_STATI = new Set(['RICHIESTA PRESENTATA', 'IN EMISSIONE', 'EMESSA']);

/**
 * @param {string|null|undefined} stato
 * @returns {string}
 */
function normalizePolicyStato(stato) {
  if (stato == null) return '';
  const s = String(stato).trim();
  if (/^COMPLETATA$/i.test(s)) return 'EMESSA';
  return LEGACY_TO_CANONICAL[s] || s;
}

/**
 * @param {string} stato
 * @returns {boolean}
 */
function isAllowedPolicyStato(stato) {
  return ALLOWED_POLICY_STATI.has(String(stato || '').trim());
}

/**
 * @param {string|null|undefined} prevRaw
 * @param {string} nextStato
 * @returns {{ ok: boolean, error?: string }}
 */
function validatePolicyTransition(prevRaw, nextStato) {
  const prev = normalizePolicyStato(prevRaw);
  const next = String(nextStato || '').trim();
  if (!isAllowedPolicyStato(next)) {
    return { ok: false, error: 'Stato polizza non valido' };
  }
  if (prev === next) {
    return { ok: false, error: 'La polizza è già in questo stato' };
  }
  if (prev === 'EMESSA') {
    return { ok: false, error: 'Polizza già emessa' };
  }
  if (prev === 'RICHIESTA PRESENTATA' && next !== 'IN EMISSIONE') {
    return { ok: false, error: 'Transizione non consentita' };
  }
  if (prev === 'IN EMISSIONE' && next !== 'EMESSA') {
    return { ok: false, error: 'Transizione non consentita' };
  }
  if (prev === 'RICHIESTA PRESENTATA' && next === 'EMESSA') {
    return { ok: false, error: 'Transizione non consentita' };
  }
  if (!prev || !['RICHIESTA PRESENTATA', 'IN EMISSIONE'].includes(prev)) {
    return { ok: false, error: 'Stato corrente non valido per il cambio richiesto' };
  }
  return { ok: true };
}

module.exports = {
  ALLOWED_POLICY_STATI,
  normalizePolicyStato,
  isAllowedPolicyStato,
  validatePolicyTransition,
};
