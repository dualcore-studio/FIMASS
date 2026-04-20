function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0].trim();
    return first || null;
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).trim() || null;
  }
  const raw = req.socket?.remoteAddress || req.ip;
  if (!raw) return null;
  return String(raw).replace(/^::ffff:/, '');
}

module.exports = { getClientIp };
