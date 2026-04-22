/**
 * Ruoli autorizzati alla sezione Scadenze (lista, dettaglio e azioni consentite al ruolo).
 * Operatore e fornitore: 403 a livello di route.
 */
const SCADENZE_ACCESS_ROLES = Object.freeze(['admin', 'supervisore', 'struttura']);

function userCanAccessScadenzePolicy(user, policy) {
  if (!user || !policy) return false;
  if (user.role === 'admin' || user.role === 'supervisore') return true;
  if (user.role === 'struttura') return Number(policy.struttura_id) === Number(user.id);
  return false;
}

module.exports = { SCADENZE_ACCESS_ROLES, userCanAccessScadenzePolicy };
