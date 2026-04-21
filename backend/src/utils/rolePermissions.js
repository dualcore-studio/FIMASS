'use strict';

/**
 * Separazione permessi preventivi / polizze:
 * - Assegnazione: solo admin e supervisore (`authorizeRoles` su PUT /quotes/:id/assign).
 * - Assegnatario ammesso: operatore o fornitore (DB: `operatore_id` XOR `fornitore_id`).
 * - Visibilità elenco globale: admin (e supervisore dove previsto dalla route).
 * - Visibilità incaricato: operatore e fornitore solo pratiche assegnate a loro.
 * - Lavorazione: operatore e fornitore solo se assegnati (`practiceAssignee.js`).
 */

function canAssignPreventivi(role) {
  return role === 'admin' || role === 'supervisore';
}

function canBeAssigneePreventivi(role) {
  return role === 'operatore' || role === 'fornitore';
}

function canViewAllPreventivi(role) {
  return role === 'admin' || role === 'supervisore';
}

function canViewOwnAssignedPreventivi(role) {
  return role === 'operatore' || role === 'fornitore';
}

function canWorkPreventivi(role) {
  return role === 'operatore' || role === 'fornitore';
}

function canManageProvvigioni(role) {
  return role === 'admin' || role === 'fornitore' || role === 'struttura';
}

module.exports = {
  canAssignPreventivi,
  canBeAssigneePreventivi,
  canViewAllPreventivi,
  canViewOwnAssignedPreventivi,
  canWorkPreventivi,
  canManageProvvigioni,
};
