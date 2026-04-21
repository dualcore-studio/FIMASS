'use strict';

/**
 * Separazione permessi preventivi:
 * - Assegnazione / riassegnazione: solo admin e supervisore.
 * - Assegnatario ammesso: solo operatore o fornitore (mutuamente esclusivi su DB).
 * - Lavorazione (stati operativi, download, ecc.): operatore e fornitore assegnati.
 */

function canAssignPreventivi(role) {
  return role === 'admin' || role === 'supervisore';
}

function canBeAssigneePreventivi(role) {
  return role === 'operatore' || role === 'fornitore';
}

function canWorkPreventivi(role) {
  return role === 'operatore' || role === 'fornitore';
}

module.exports = {
  canAssignPreventivi,
  canBeAssigneePreventivi,
  canWorkPreventivi,
};
