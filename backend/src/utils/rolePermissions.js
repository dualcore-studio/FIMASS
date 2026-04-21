'use strict';

/**
 * Separazione permessi preventivi:
 * - Assegnazione / riassegnazione: solo admin e supervisore (middleware `authorizeRoles` su PUT /quotes/:id/assign).
 * - Assegnatario ammesso: solo operatore o fornitore (mutuamente esclusivi su DB).
 * - Lavorazione: operatore e fornitore assegnati (controlli in `practiceAssignee.js` e route quotes).
 */

function canBeAssigneePreventivi(role) {
  return role === 'operatore' || role === 'fornitore';
}

module.exports = {
  canBeAssigneePreventivi,
};
