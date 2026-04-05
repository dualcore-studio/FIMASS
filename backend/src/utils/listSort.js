'use strict';

/**
 * Whitelist-based ORDER BY for list endpoints. Never interpolate user input as SQL identifiers.
 */
function normalizeSortDir(dir) {
  const d = String(dir || '').toLowerCase();
  return d === 'asc' ? 'ASC' : 'DESC';
}

/**
 * @param {Record<string, string>} sortMap - API sort_by key -> SQL ORDER BY expression (can include multiple cols)
 * @param {string|undefined} sortBy
 * @param {string|undefined} sortDir
 * @param {string} defaultOrder - full "ORDER BY ..." clause
 * @returns {string}
 */
function resolveListOrder(sortMap, sortBy, sortDir, defaultOrder) {
  const expr = sortBy && sortMap[sortBy];
  if (!expr) return defaultOrder;
  return `ORDER BY ${expr} ${normalizeSortDir(sortDir)}`;
}

module.exports = { resolveListOrder, normalizeSortDir };
