const { isInstantConfigured } = require('../lib/instantdb');
const { findOne, upsertById, insert } = require('../data/store');
const { loadContext } = require('../data/views');
const { normalizePolicyStato } = require('../utils/policyStato');
const { ensurePolicyExpirationForEmessaPolicy } = require('../lib/policyRenewal');

const FLAG_KEY = 'policy_renewals_bootstrap_v1';

/**
 * Crea record policy_expirations per ogni polizza EMESSA (InstantDB).
 */
async function migratePolicyRenewalsBootstrapIfNeeded() {
  if (!isInstantConfigured()) return;
  const done = await findOne('settings', (s) => s.chiave === FLAG_KEY);
  if (done) return;

  const ctx = await loadContext();
  for (const raw of ctx.policies) {
    const p = { ...raw };
    if (normalizePolicyStato(p.stato) !== 'EMESSA') continue;
    const existing = await findOne('policy_expirations', (e) => Number(e.policy_id) === Number(p.id));
    if (existing) continue;
    await ensurePolicyExpirationForEmessaPolicy(p.id);
  }

  await insert('settings', { chiave: FLAG_KEY, valore: '1' });
  console.log('Bootstrap policy_expirations (InstantDB) completato.');
}

module.exports = { migratePolicyRenewalsBootstrapIfNeeded };
