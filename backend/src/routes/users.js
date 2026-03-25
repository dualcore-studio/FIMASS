const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { logActivity } = require('./logs');

const router = express.Router();

function getUserDisplayName(user) {
  return user.role === 'struttura' ? user.denominazione : `${user.nome} ${user.cognome}`;
}

router.get('/', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  try {
    const { page = 1, limit = 25, role, stato, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['1=1'];
    let params = [];

    if (role) { where.push('role = ?'); params.push(role); }
    if (stato) { where.push('stato = ?'); params.push(stato); }
    if (search) {
      where.push('(username LIKE ? OR email LIKE ? OR nome LIKE ? OR cognome LIKE ? OR denominazione LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as count FROM users WHERE ${whereClause}`).get(...params).count;
    const users = db.prepare(`
      SELECT id, username, role, nome, cognome, denominazione, email, telefono, stato, enabled_types, last_login, created_at
      FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      data: users.map(u => ({ ...u, enabled_types: u.enabled_types ? JSON.parse(u.enabled_types) : null })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Errore nel recupero utenti' });
  }
});

router.get('/operators', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  const operators = db.prepare("SELECT id, nome, cognome, email FROM users WHERE role = 'operatore' AND stato = 'attivo' ORDER BY cognome, nome").all();
  res.json(operators);
});

router.get('/structures', authenticateToken, authorizeRoles('admin', 'supervisore', 'operatore'), (req, res) => {
  const structures = db.prepare("SELECT id, denominazione, email FROM users WHERE role = 'struttura' AND stato = 'attivo' ORDER BY denominazione").all();
  res.json(structures);
});

router.get('/:id', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  const user = db.prepare('SELECT id, username, role, nome, cognome, denominazione, email, telefono, stato, enabled_types, last_login, created_at, updated_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  user.enabled_types = user.enabled_types ? JSON.parse(user.enabled_types) : null;
  res.json(user);
});

router.post('/', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { username, password, role, nome, cognome, denominazione, email, telefono, stato, enabled_types } = req.body;

    if (!username || !password || !role || !email) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: 'Username già in uso' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const enabledTypesJson = enabled_types ? JSON.stringify(enabled_types) : null;

    const result = db.prepare(`
      INSERT INTO users (username, password, role, nome, cognome, denominazione, email, telefono, stato, enabled_types)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, hashedPassword, role, nome || null, cognome || null, denominazione || null, email, telefono || null, stato || 'attivo', enabledTypesJson);

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'CREAZIONE_UTENTE',
      modulo: 'utenti',
      riferimento_id: result.lastInsertRowid,
      riferimento_tipo: 'user',
      dettaglio: `Creato utente ${username} con ruolo ${role}`
    });

    res.status(201).json({ id: result.lastInsertRowid, message: 'Utente creato con successo' });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Errore nella creazione utente' });
  }
});

router.put('/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { nome, cognome, denominazione, email, telefono, stato, enabled_types, role } = req.body;
    const userId = req.params.id;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    const enabledTypesJson = enabled_types ? JSON.stringify(enabled_types) : null;

    db.prepare(`
      UPDATE users SET nome = ?, cognome = ?, denominazione = ?, email = ?, telefono = ?, stato = ?, enabled_types = ?, role = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nome || null, cognome || null, denominazione || null, email, telefono || null, stato || 'attivo', enabledTypesJson, role || user.role, userId);

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'MODIFICA_UTENTE',
      modulo: 'utenti',
      riferimento_id: parseInt(userId),
      riferimento_tipo: 'user',
      dettaglio: `Modificato utente ${user.username}`
    });

    res.json({ message: 'Utente aggiornato con successo' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento utente' });
  }
});

router.post('/:id/reset-password', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Nuova password richiesta' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hashedPassword, req.params.id);

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'RESET_PASSWORD',
      modulo: 'utenti',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'user',
      dettaglio: `Reset password per utente ${user.username}`
    });

    res.json({ message: 'Password reimpostata con successo' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Errore nel reset password' });
  }
});

router.post('/:id/toggle-status', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    const newStato = user.stato === 'attivo' ? 'disattivo' : 'attivo';
    db.prepare("UPDATE users SET stato = ?, updated_at = datetime('now') WHERE id = ?").run(newStato, req.params.id);

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: newStato === 'attivo' ? 'RIATTIVAZIONE_UTENTE' : 'DISATTIVAZIONE_UTENTE',
      modulo: 'utenti',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'user',
      dettaglio: `Utente ${user.username} ${newStato === 'attivo' ? 'riattivato' : 'disattivato'}`
    });

    res.json({ message: `Utente ${newStato === 'attivo' ? 'riattivato' : 'disattivato'} con successo`, stato: newStato });
  } catch (err) {
    console.error('Error toggling user status:', err);
    res.status(500).json({ error: 'Errore nel cambio stato utente' });
  }
});

module.exports = router;
