const { isInstantConfigured } = require('../lib/instantdb');
const { findOne, upsertById, insert } = require('../data/store');
const { loadContext } = require('../data/views');
const { normalizePolicyStato } = require('../utils/policyStato');
const { calculatePolicyExpiryDate, parseDbDateTime, toIsoDateTime } = require('../utils/policyDates');

const FLAG_KEY = 'policies_scadenze_backfill_v1';

function earliestEmessaTimestamp(ctx, policyId) {
  const rows = ctx.policy_status_history.filter((h) => Number(h.policy_id) === Number(policyId));
  let best = null;
  for (const h of rows) {
    if (normalizePolicyStato(h.stato_nuovo) !== 'EMESSA') continue;
    const t = String(h.created_at || '');
    if (!t) continue;
    if (best == null || t < best) best = t;
  }
  return best;
}

/**
 * Backfill InstantDB: polizze EMESSA senza data_emissione / data_scadenza.
 *
 * Priorità data_emissione: prima occorrenza di passaggio a EMESSA in `policy_status_history`;
 * se assente: `updated_at` della polizza, poi `created_at` (stesso criterio documentato per SQLite).
 * Con `data_emissione` già presente ma `data_scadenza` mancante: si calcola solo la scadenza.
 */
async function migratePoliciesExpiryBackfillIfNeeded() {
  if (!isInstantConfigured()) return;
  const done = await findOne('settings', (s) => s.chiave === FLAG_KEY);
  if (done) return;

  const ctx = await loadContext();
  for (const raw of ctx.policies) {
    const p = { ...raw };
    const stato = normalizePolicyStato(p.stato);
    if (stato !== 'EMESSA') continue;

    const patch = {};
    if (!p.data_emissione) {
      const fromHist = earliestEmessaTimestamp(ctx, p.id);
      const emission = fromHist || p.updated_at || p.created_at;
      if (emission) {
        patch.data_emissione = String(emission).slice(0, 19).replace('T', ' ');
        const exp = calculatePolicyExpiryDate(parseDbDateTime(patch.data_emissione));
        if (exp) patch.data_scadenza = toIsoDateTime(exp);
      }
    } else if (!p.data_scadenza) {
      const exp = calculatePolicyExpiryDate(parseDbDateTime(p.data_emissione));
      if (exp) patch.data_scadenza = toIsoDateTime(exp);
    }

    if (Object.keys(patch).length > 0) {
      await upsertById('policies', p.id, patch);
    }
  }

  await insert('settings', { chiave: FLAG_KEY, valore: '1' });
  console.log('Backfill scadenze polizze (InstantDB) completato.');
}

module.exports = { migratePoliciesExpiryBackfillIfNeeded };
