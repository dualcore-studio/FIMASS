'use strict';

/**
 * Assegnazione preventivo/polizza: un solo incaricato, operatore O fornitore.
 * `operatore_id` e `fornitore_id` sono mutuamente esclusivi (lato applicazione).
 */

function quoteAssigneeUserId(quote) {
  if (!quote) return null;
  if (quote.operatore_id != null && quote.operatore_id !== '') return Number(quote.operatore_id);
  if (quote.fornitore_id != null && quote.fornitore_id !== '') return Number(quote.fornitore_id);
  return null;
}

function quoteAssigneeRole(quote) {
  if (!quote) return null;
  if (quote.operatore_id != null && quote.operatore_id !== '') return 'operatore';
  if (quote.fornitore_id != null && quote.fornitore_id !== '') return 'fornitore';
  return null;
}

function policyAssigneeUserId(policy) {
  return quoteAssigneeUserId(policy);
}

function policyAssigneeRole(policy) {
  return quoteAssigneeRole(policy);
}

function practiceHasAssignee(row) {
  return quoteAssigneeUserId(row) != null;
}

function userIsAssignedToQuote(user, quote) {
  if (!user || !quote) return false;
  if (user.role === 'operatore' && Number(quote.operatore_id) === Number(user.id)) return true;
  if (user.role === 'fornitore' && Number(quote.fornitore_id) === Number(user.id)) return true;
  return false;
}

function userIsAssignedToPolicy(user, policy) {
  return userIsAssignedToQuote(user, policy);
}

module.exports = {
  quoteAssigneeUserId,
  quoteAssigneeRole,
  policyAssigneeUserId,
  policyAssigneeRole,
  practiceHasAssignee,
  userIsAssignedToQuote,
  userIsAssignedToPolicy,
};
