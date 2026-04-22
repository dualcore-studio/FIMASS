/**
 * Protezione endpoint invocati da Vercel Cron (header Authorization: Bearer CRON_SECRET).
 */
function verifyCronSecret(req, res, next) {
  const expected = process.env.CRON_SECRET;
  if (!expected || !String(expected).trim()) {
    console.error('[cron] CRON_SECRET non configurato');
    return res.status(503).json({ error: 'Cron non configurato' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token !== String(expected).trim()) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }
  next();
}

module.exports = { verifyCronSecret };
