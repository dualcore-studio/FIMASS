const { getById, list } = require('../data/store');
const { userIsAssignedToQuote, userIsAssignedToPolicy } = require('../utils/practiceAssignee');

/**
 * Verifica se l'utente può accedere all'allegato in base a entity_type / entity_id.
 */
async function userCanAccessAttachment(user, attachment) {
  if (!user || !attachment) return false;
  const role = user.role;
  if (role === 'admin' || role === 'supervisore') return true;

  const eid = Number(attachment.entity_id);
  const et = attachment.entity_type;

  if (et === 'quote') {
    const quote = await getById('quotes', eid);
    if (!quote) return false;
    if (role === 'struttura') return Number(quote.struttura_id) === Number(user.id);
    if (role === 'operatore' || role === 'fornitore') return userIsAssignedToQuote(user, quote);
    return false;
  }

  if (et === 'policy') {
    const policy = await getById('policies', eid);
    if (!policy) return false;
    if (role === 'struttura') return Number(policy.struttura_id) === Number(user.id);
    if (role === 'operatore' || role === 'fornitore') return userIsAssignedToPolicy(user, policy);
    return false;
  }

  if (et === 'assisted') {
    const person = await getById('assisted_people', eid);
    if (!person) return false;
    if (role === 'struttura') {
      const quotes = await list(
        'quotes',
        (q) => Number(q.assistito_id) === eid && Number(q.struttura_id) === Number(user.id),
      );
      return quotes.length > 0;
    }
    if (role === 'operatore') {
      const qOk = await list(
        'quotes',
        (q) => Number(q.assistito_id) === eid && Number(q.operatore_id) === Number(user.id),
      );
      const pOk = await list(
        'policies',
        (p) => Number(p.assistito_id) === eid && Number(p.operatore_id) === Number(user.id),
      );
      return qOk.length > 0 || pOk.length > 0;
    }
    if (role === 'fornitore') {
      const qOk = await list(
        'quotes',
        (q) => Number(q.assistito_id) === eid && Number(q.fornitore_id) === Number(user.id),
      );
      const pOk = await list(
        'policies',
        (p) => Number(p.assistito_id) === eid && Number(p.fornitore_id) === Number(user.id),
      );
      return qOk.length > 0 || pOk.length > 0;
    }
    return false;
  }

  return false;
}

module.exports = { userCanAccessAttachment };
