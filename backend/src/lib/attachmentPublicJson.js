/**
 * Rimuove URL di storage esposti pubblicamente dalla risposta API (download solo via endpoint autenticato).
 */
function sanitizeAttachmentForClient(att) {
  if (!att || typeof att !== 'object') return att;
  const { url: _drop, ...rest } = att;
  return rest;
}

function sanitizeAttachmentsList(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(sanitizeAttachmentForClient);
}

module.exports = { sanitizeAttachmentForClient, sanitizeAttachmentsList };
