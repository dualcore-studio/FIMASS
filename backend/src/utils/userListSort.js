'use strict';

const { sortBy: sortRecords } = require('../data/store');

const ROLE_RANK = {
  admin: 1,
  supervisore: 2,
  struttura: 3,
  operatore: 4,
};

/** @param {string|null|undefined} role */
function roleSortRank(role) {
  const r = String(role || '')
    .trim()
    .toLowerCase();
  return ROLE_RANK[r] ?? 99;
}

/** Etichetta coerente con getUserDisplayName (nome cognome; struttura = denominazione). */
function userSecondaryCompareLabel(u) {
  const role = String(u.role || '').toLowerCase();
  if (role === 'struttura') return String(u.denominazione || '');
  const label = [u.nome, u.cognome].filter(Boolean).join(' ').trim();
  if (label) return label;
  return String(u.username || u.email || '');
}

function compareUsersSecondary(a, b) {
  return userSecondaryCompareLabel(a).localeCompare(userSecondaryCompareLabel(b), 'it', { sensitivity: 'base' });
}

/**
 * @param {object[]} users
 * @param {string|undefined} sortBy
 * @param {string|undefined} sortDir
 * @param {Record<string, string>} sortMap
 */
function sortUsersForList(users, sortBy, sortDir, sortMap) {
  const dir = String(sortDir).toLowerCase() === 'desc' ? -1 : 1;

  if (!sortBy) {
    return [...users].sort((a, b) => {
      const ra = roleSortRank(a.role);
      const rb = roleSortRank(b.role);
      if (ra !== rb) return ra - rb;
      return compareUsersSecondary(a, b);
    });
  }

  if (sortBy === 'ruolo') {
    return [...users].sort((a, b) => {
      const ra = roleSortRank(a.role);
      const rb = roleSortRank(b.role);
      if (ra !== rb) return (ra - rb) * dir;
      return compareUsersSecondary(a, b);
    });
  }

  const field = sortMap[sortBy] || 'created_at';
  return sortRecords(users, field, sortDir || 'desc');
}

module.exports = {
  roleSortRank,
  sortUsersForList,
};
