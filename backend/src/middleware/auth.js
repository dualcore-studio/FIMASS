const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../config/database');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('WARNING: JWT_SECRET not set. Using auto-generated secret (tokens will not survive restarts).');
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token di autenticazione richiesto' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, role, nome, cognome, denominazione, email, stato FROM users WHERE id = ?').get(decoded.id);

    if (!user || user.stato !== 'attivo') {
      return res.status(401).json({ error: 'Account non valido o disattivato' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token non valido o scaduto' });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accesso non autorizzato per questo ruolo' });
    }
    next();
  };
}

module.exports = { generateToken, authenticateToken, authorizeRoles, JWT_SECRET };
