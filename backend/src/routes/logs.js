const express = require('express');
const { db } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { resolveListOrder } = require('../utils/listSort');

const LOG_SORT_MAP = {
  created_at: 'created_at',
  utente: 'LOWER(utente_nome)',
  ruolo: 'LOWER(ruolo)',
  azione: 'LOWER(azione)',
  modulo: `LOWER(COALESCE(modulo, ''))`,
  dettaglio: `LOWER(COALESCE(dettaglio, ''))`,
};
const DEFAULT_LOG_ORDER = 'ORDER BY created_at DESC';

const router = express.Router();

function logActivity({ utente_id, utente_nome, ruolo, azione, modulo, riferimento_id, riferimento_tipo, dettaglio }) {
  try {
    db.prepare(`
      INSERT INTO activity_logs (utente_id, utente_nome, ruolo, azione, modulo, riferimento_id, riferimento_tipo, dettaglio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(utente_id, utente_nome, ruolo, azione, modulo, riferimento_id || null, riferimento_tipo || null, dettaglio || null);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

router.get('/', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      utente_id,
      azione,
      modulo,
      data_da,
      data_a,
      search,
      sort_by: sortBy,
      sort_dir: sortDir,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['1=1'];
    let params = [];

    if (utente_id) { where.push('utente_id = ?'); params.push(utente_id); }
    if (azione) { where.push('azione = ?'); params.push(azione); }
    if (modulo) { where.push('modulo = ?'); params.push(modulo); }
    if (data_da) { where.push('created_at >= ?'); params.push(data_da); }
    if (data_a) { where.push('created_at <= ?'); params.push(data_a + ' 23:59:59'); }
    if (search) { where.push('(utente_nome LIKE ? OR dettaglio LIKE ? OR azione LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const whereClause = where.join(' AND ');
    const orderClause = resolveListOrder(LOG_SORT_MAP, sortBy, sortDir, DEFAULT_LOG_ORDER);

    const total = db.prepare(`SELECT COUNT(*) as count FROM activity_logs WHERE ${whereClause}`).get(...params).count;
    const logs = db.prepare(`SELECT * FROM activity_logs WHERE ${whereClause} ${orderClause} LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

    res.json({ data: logs, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Errore nel recupero dei log' });
  }
});

router.get('/actions', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  const actions = db.prepare('SELECT DISTINCT azione FROM activity_logs ORDER BY azione').all();
  res.json(actions.map(a => a.azione));
});

router.get('/modules', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  const modules = db.prepare('SELECT DISTINCT modulo FROM activity_logs WHERE modulo IS NOT NULL ORDER BY modulo').all();
  res.json(modules.map(m => m.modulo));
});

module.exports = router;
module.exports.logActivity = logActivity;
