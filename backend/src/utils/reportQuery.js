'use strict';

const { normalizeQuoteStato } = require('./quoteStato');
const { normalizePolicyStato } = require('./policyStato');

function parseOptionalId(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseReportFilters(query) {
  const data_da = query.data_da != null ? String(query.data_da).trim() : '';
  const data_a = query.data_a != null ? String(query.data_a).trim() : '';
  return {
    data_da,
    data_a,
    struttura_id: parseOptionalId(query.struttura_id),
    operatore_id: parseOptionalId(query.operatore_id),
    fornitore_id: parseOptionalId(query.fornitore_id),
  };
}

function filterByCreatedRange(rows, dataDa, dataA) {
  if (!dataDa || !dataA) return [...rows];
  const end = `${dataA} 23:59:59`;
  return rows.filter((r) => {
    const t = String(r.created_at || '');
    return t >= dataDa && t <= end;
  });
}

function filterQuotesByStructureOperator(quotes, strutturaId, operatoreId, fornitoreId) {
  let out = quotes;
  if (strutturaId != null) out = out.filter((q) => Number(q.struttura_id) === Number(strutturaId));
  if (operatoreId != null) out = out.filter((q) => Number(q.operatore_id) === Number(operatoreId));
  if (fornitoreId != null) out = out.filter((q) => Number(q.fornitore_id) === Number(fornitoreId));
  return out;
}

function filterPoliciesByStructureOperator(policies, strutturaId, operatoreId, fornitoreId) {
  let out = policies;
  if (strutturaId != null) out = out.filter((p) => Number(p.struttura_id) === Number(strutturaId));
  if (operatoreId != null) out = out.filter((p) => Number(p.operatore_id) === Number(operatoreId));
  if (fornitoreId != null) out = out.filter((p) => Number(p.fornitore_id) === Number(fornitoreId));
  return out;
}

function quoteStatoNorm(q) {
  return normalizeQuoteStato(q.stato);
}

const QUOTE_BUCKET_KEYS = ['PRESENTATA', 'ASSEGNATA', 'IN LAVORAZIONE', 'STANDBY', 'ELABORATA'];
const POLICY_BUCKET_KEYS = ['RICHIESTA PRESENTATA', 'IN EMISSIONE', 'EMESSA'];

function countQuotesByStato(quotes) {
  const counts = Object.fromEntries(QUOTE_BUCKET_KEYS.map((k) => [k, 0]));
  quotes.forEach((q) => {
    const s = quoteStatoNorm(q);
    if (counts[s] !== undefined) counts[s] += 1;
  });
  return counts;
}

function countPoliciesByStato(policies) {
  const counts = Object.fromEntries(POLICY_BUCKET_KEYS.map((k) => [k, 0]));
  policies.forEach((p) => {
    const s = normalizePolicyStato(p.stato);
    if (counts[s] !== undefined) counts[s] += 1;
  });
  return counts;
}

function structureLabel(u) {
  if (!u || u.id == null) return '—';
  return u.denominazione || u.email || `Struttura #${u.id}`;
}

function staffDisplayName(u) {
  if (u.role === 'struttura') return structureLabel(u);
  const n = `${u.nome || ''} ${u.cognome || ''}`.trim();
  return n || u.username || `Utente #${u.id}`;
}

function roleLabelIt(role) {
  const m = {
    admin: 'Amministratore',
    supervisore: 'Supervisore',
    operatore: 'Operatore',
    fornitore: 'Fornitore',
    struttura: 'Struttura',
  };
  return m[role] || role;
}

/** Moda struttura_id da righe con campo struttura_id */
function dominantStrutturaId(rows) {
  const m = new Map();
  rows.forEach((r) => {
    const id = Number(r.struttura_id);
    if (!Number.isFinite(id)) return;
    m.set(id, (m.get(id) || 0) + 1);
  });
  let best = null;
  let bestN = 0;
  m.forEach((n, id) => {
    if (n > bestN) {
      bestN = n;
      best = id;
    }
  });
  return best;
}

module.exports = {
  parseReportFilters,
  filterByCreatedRange,
  filterQuotesByStructureOperator,
  filterPoliciesByStructureOperator,
  quoteStatoNorm,
  countQuotesByStato,
  countPoliciesByStato,
  QUOTE_BUCKET_KEYS,
  POLICY_BUCKET_KEYS,
  structureLabel,
  staffDisplayName,
  roleLabelIt,
  dominantStrutturaId,
};
