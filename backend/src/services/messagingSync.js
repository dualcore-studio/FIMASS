'use strict';

const { list, upsertById } = require('../data/store');
const { quoteAssigneeUserId, quoteAssigneeRole } = require('../utils/practiceAssignee');

async function findConversationByEntity(entityType, entityId) {
  const rows = await list('conversations');
  return rows.find((c) => c.entity_type === entityType && Number(c.entity_id) === Number(entityId)) || null;
}

/** Thread generico struttura ↔ incaricato (senza pratica collegata). */
async function findInfoConversation(strutturaId, assigneeId) {
  const rows = await list('conversations');
  return (
    rows.find(
      (c) =>
        c.entity_type === 'info' &&
        Number(c.struttura_id) === Number(strutturaId) &&
        Number(c.assignee_id) === Number(assigneeId),
    ) || null
  );
}

/** Dopo assegnazione preventivo: allinea destinatario conversazione esistente. */
async function syncConversationsForQuoteAssignment(quote) {
  if (!quote?.id) return;
  const conv = await findConversationByEntity('quote', quote.id);
  if (!conv) return;
  const aid = quoteAssigneeUserId(quote);
  const arole = quoteAssigneeRole(quote);
  if (!aid || !arole) return;
  await upsertById('conversations', conv.id, {
    assignee_id: aid,
    assignee_role: arole,
    struttura_id: Number(quote.struttura_id),
  });
}

/** Dopo aggiornamento polizza (es. allineamento da preventivo). */
async function syncConversationsForPolicyAssignment(policy) {
  if (!policy?.id) return;
  const conv = await findConversationByEntity('policy', policy.id);
  if (!conv) return;
  const aid = quoteAssigneeUserId(policy);
  const arole = quoteAssigneeRole(policy);
  if (!aid || !arole) return;
  await upsertById('conversations', conv.id, {
    assignee_id: aid,
    assignee_role: arole,
    struttura_id: Number(policy.struttura_id),
  });
}

module.exports = {
  findConversationByEntity,
  findInfoConversation,
  syncConversationsForQuoteAssignment,
  syncConversationsForPolicyAssignment,
};
