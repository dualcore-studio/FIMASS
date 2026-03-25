const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { logActivity } = require('./logs');

const router = express.Router();

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password richiesti' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    if (user.stato !== 'attivo') {
      return res.status(401).json({ error: 'Account disattivato. Contattare l\'amministratore.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);

    const token = generateToken(user);

    const displayName = user.role === 'struttura' ? user.denominazione : `${user.nome} ${user.cognome}`;

    logActivity({
      utente_id: user.id,
      utente_nome: displayName,
      ruolo: user.role,
      azione: 'LOGIN',
      modulo: 'auth',
      dettaglio: `Login effettuato da ${user.username}`
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        nome: user.nome,
        cognome: user.cognome,
        denominazione: user.denominazione,
        email: user.email,
        telefono: user.telefono,
        enabled_types: user.enabled_types ? JSON.parse(user.enabled_types) : null
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, role, nome, cognome, denominazione, email, telefono, enabled_types, stato, last_login FROM users WHERE id = ?').get(req.user.id);

  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  res.json({
    ...user,
    enabled_types: user.enabled_types ? JSON.parse(user.enabled_types) : null
  });
});

router.post('/logout', authenticateToken, (req, res) => {
  const displayName = req.user.role === 'struttura' ? req.user.denominazione : `${req.user.nome} ${req.user.cognome}`;
  logActivity({
    utente_id: req.user.id,
    utente_nome: displayName,
    ruolo: req.user.role,
    azione: 'LOGOUT',
    modulo: 'auth',
    dettaglio: `Logout effettuato da ${req.user.username}`
  });
  res.json({ message: 'Logout effettuato' });
});

module.exports = router;
