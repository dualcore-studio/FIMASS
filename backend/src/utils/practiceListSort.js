'use strict';

const { sortBy: sortRecords } = require('../data/store');

/** @param {string|null|undefined} stato */
function normalizeQuoteStato(stato) {
  if (stato == null) return '';
  const s = String(stato).trim().replace(/\s+/g, ' ').toUpperCase();
  if (s === 'STAND BY') return 'STANDBY';
  if (s === 'COMPLETATA') return 'ELABORATA';
  return s;
}

const QUOTE_STATO_RANK = {
  PRESENTATA: 1,
  STANDBY: 2,
  'IN LAVORAZIONE': 3,
  ASSEGNATA: 4,
  ELABORATA: 5,
};

/** @param {string|null|undefined} stato */
function quoteStatoSortRank(stato) {
  const key = normalizeQuoteStato(stato);
  return QUOTE_STATO_RANK[key] ?? 99;
}

/** @param {string|null|undefined} stato */
function normalizePolicyStato(stato) {
  if (stato == null) return '';
  const s = String(stato).trim();
  if (/^COMPLETATA$/i.test(s)) return 'EMESSA';
  return s;
}

/** Allineato al flusso richiesto per le pratiche: presentata → standby → in lavorazione → assegnata → elaborata. */
const POLICY_STATO_RANK = {
  'RICHIESTA PRESENTATA': 1,
  'DOCUMENTAZIONE MANCANTE': 2,
  'IN VERIFICA': 3,
  'PRONTA PER EMISSIONE': 4,
  EMESSA: 5,
};

/** @param {string|null|undefined} stato */
function policyStatoSortRank(stato) {
  const key = normalizePolicyStato(stato);
  return POLICY_STATO_RANK[key] ?? 99;
}

function compareIsoDesc(a, b) {
  return String(b || '').localeCompare(String(a || ''));
}

/**
 * Ordinamento liste preventivi: priorità stato custom, poi data creazione (più recente prima).
 * @param {object[]} quotes
 * @param {string|undefined} sortByParam
 * @param {string|undefined} sortDir
 * @param {Record<string, string>} sortMap
 */
function sortQuotesForList(quotes, sortByParam, sortDir, sortMap) {
  const dir = String(sortDir).toLowerCase() === 'desc' ? -1 : 1;

  if (!sortByParam) {
    return [...quotes].sort((a, b) => {
      const ra = quoteStatoSortRank(a.stato);
      const rb = quoteStatoSortRank(b.stato);
      if (ra !== rb) return ra - rb;
      return compareIsoDesc(a.created_at, b.created_at);
    });
  }

  if (sortByParam === 'stato') {
    return [...quotes].sort((a, b) => {
      const ra = quoteStatoSortRank(a.stato);
      const rb = quoteStatoSortRank(b.stato);
      if (ra !== rb) return (ra - rb) * dir;
      return compareIsoDesc(a.created_at, b.created_at);
    });
  }

  const field = sortMap[sortByParam] || 'created_at';
  return sortRecords(quotes, field, sortDir || 'desc');
}

/**
 * @param {object[]} policies
 * @param {string|undefined} sortByParam
 * @param {string|undefined} sortDir
 * @param {Record<string, string>} sortMap
 */
function sortPoliciesForList(policies, sortByParam, sortDir, sortMap) {
  const dir = String(sortDir).toLowerCase() === 'desc' ? -1 : 1;

  if (!sortByParam) {
    return [...policies].sort((a, b) => {
      const ra = policyStatoSortRank(a.stato);
      const rb = policyStatoSortRank(b.stato);
      if (ra !== rb) return ra - rb;
      return compareIsoDesc(a.created_at, b.created_at);
    });
  }

  if (sortByParam === 'stato') {
    return [...policies].sort((a, b) => {
      const ra = policyStatoSortRank(a.stato);
      const rb = policyStatoSortRank(b.stato);
      if (ra !== rb) return (ra - rb) * dir;
      return compareIsoDesc(a.created_at, b.created_at);
    });
  }

  const field = sortMap[sortByParam] || 'created_at';
  return sortRecords(policies, field, sortDir || 'desc');
}

module.exports = {
  normalizeQuoteStato,
  quoteStatoSortRank,
  normalizePolicyStato,
  policyStatoSortRank,
  sortQuotesForList,
  sortPoliciesForList,
};
