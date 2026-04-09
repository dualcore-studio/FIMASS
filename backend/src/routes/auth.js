const express = require('express');
const bcrypt = require('bcryptjs');
const { findOne, getById, upsertById } = require('../data/store');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { logActivity } = require('./logs');

const router = express.Router();

router.post('/login', (req, res) => {
  (async () => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password richiesti' });
    }

    const user = await findOne('users', (row) => row.username === username);

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

    await upsertById('users', user.id, { last_login: new Date().toISOString().slice(0, 19).replace('T', ' ') });

    const token = generateToken(user);

    const displayName = user.role === 'struttura' ? user.denominazione : `${user.nome} ${user.cognome}`;

    await logActivity({
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
        enabled_types: typeof user.enabled_types === 'string' ? JSON.parse(user.enabled_types) : (user.enabled_types || null)
      }
    });
  })().catch((err) => {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Errore del server' });
  });
});

router.get('/me', authenticateToken, (req, res) => {
  (async () => {
    const user = await getById('users', req.user.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    res.json({
      ...user,
      enabled_types: typeof user.enabled_types === 'string' ? JSON.parse(user.enabled_types) : (user.enabled_types || null),
    });
  })().catch((err) => {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Errore del server' });
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
