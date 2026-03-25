const express = require('express');
const { db } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/overview', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  try {
    const { data_da, data_a } = req.query;
    let dateFilter = '';
    let params = [];

    if (data_da && data_a) {
      dateFilter = ' AND created_at BETWEEN ? AND ?';
      params = [data_da, data_a + ' 23:59:59'];
    }

    const quoteCounts = {};
    ['PRESENTATA', 'ASSEGNATA', 'IN LAVORAZIONE', 'STANDBY', 'ELABORATA'].forEach(s => {
      quoteCounts[s] = db.prepare(`SELECT COUNT(*) as c FROM quotes WHERE stato = ?${dateFilter}`).get(s, ...params).c;
    });

    const policyCounts = {};
    ['RICHIESTA PRESENTATA', 'IN VERIFICA', 'DOCUMENTAZIONE MANCANTE', 'PRONTA PER EMISSIONE', 'EMESSA'].forEach(s => {
      policyCounts[s] = db.prepare(`SELECT COUNT(*) as c FROM policies WHERE stato = ?${dateFilter}`).get(s, ...params).c;
    });

    const totalQuotes = Object.values(quoteCounts).reduce((a, b) => a + b, 0);
    const totalPolicies = Object.values(policyCounts).reduce((a, b) => a + b, 0);
    const conversionRate = totalQuotes > 0 ? ((totalPolicies / totalQuotes) * 100).toFixed(1) : 0;

    res.json({ quoteCounts, policyCounts, totalQuotes, totalPolicies, conversionRate });
  } catch (err) {
    console.error('Error fetching overview:', err);
    res.status(500).json({ error: 'Errore nel recupero report' });
  }
});

router.get('/by-type', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  try {
    const { data_da, data_a } = req.query;
    let dateFilter = '';
    let params = [];
    if (data_da && data_a) {
      dateFilter = ' AND q.created_at BETWEEN ? AND ?';
      params = [data_da, data_a + ' 23:59:59'];
    }

    const byType = db.prepare(`
      SELECT it.nome, it.codice,
        COUNT(q.id) as preventivi,
        SUM(CASE WHEN q.has_policy = 1 THEN 1 ELSE 0 END) as polizze
      FROM insurance_types it
      LEFT JOIN quotes q ON q.tipo_assicurazione_id = it.id${dateFilter.replace('AND', 'AND')}
      GROUP BY it.id
      ORDER BY preventivi DESC
    `).all(...params);

    res.json(byType);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.get('/by-structure', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  try {
    const { data_da, data_a } = req.query;
    let dateFilter = '';
    let params = [];
    if (data_da && data_a) {
      dateFilter = ' AND q.created_at BETWEEN ? AND ?';
      params = [data_da, data_a + ' 23:59:59'];
    }

    const byStructure = db.prepare(`
      SELECT u.denominazione,
        COUNT(q.id) as preventivi,
        SUM(CASE WHEN q.stato = 'ELABORATA' THEN 1 ELSE 0 END) as elaborati,
        SUM(CASE WHEN q.has_policy = 1 THEN 1 ELSE 0 END) as polizze
      FROM users u
      LEFT JOIN quotes q ON q.struttura_id = u.id${dateFilter}
      WHERE u.role = 'struttura'
      GROUP BY u.id
      ORDER BY preventivi DESC
    `).all(...params);

    res.json(byStructure);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.get('/by-operator', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  try {
    const { data_da, data_a } = req.query;
    let dateFilter = '';
    let params = [];
    if (data_da && data_a) {
      dateFilter = ' AND q.created_at BETWEEN ? AND ?';
      params = [data_da, data_a + ' 23:59:59'];
    }

    const byOperator = db.prepare(`
      SELECT u.nome || ' ' || u.cognome as operatore,
        COUNT(q.id) as totali,
        SUM(CASE WHEN q.stato = 'IN LAVORAZIONE' THEN 1 ELSE 0 END) as in_lavorazione,
        SUM(CASE WHEN q.stato = 'ELABORATA' THEN 1 ELSE 0 END) as elaborati,
        SUM(CASE WHEN q.stato = 'STANDBY' THEN 1 ELSE 0 END) as standby
      FROM users u
      LEFT JOIN quotes q ON q.operatore_id = u.id${dateFilter}
      WHERE u.role = 'operatore'
      GROUP BY u.id
      ORDER BY totali DESC
    `).all(...params);

    res.json(byOperator);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.get('/timeline', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  try {
    const { periodo = '30' } = req.query;

    const quoteTimeline = db.prepare(`
      SELECT date(created_at) as data, COUNT(*) as conteggio
      FROM quotes
      WHERE created_at >= date('now', '-${parseInt(periodo)} days')
      GROUP BY date(created_at)
      ORDER BY data
    `).all();

    const policyTimeline = db.prepare(`
      SELECT date(created_at) as data, COUNT(*) as conteggio
      FROM policies
      WHERE created_at >= date('now', '-${parseInt(periodo)} days')
      GROUP BY date(created_at)
      ORDER BY data
    `).all();

    res.json({ quoteTimeline, policyTimeline });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.get('/alerts', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  try {
    const unassigned = db.prepare("SELECT COUNT(*) as c FROM quotes WHERE stato = 'PRESENTATA' AND operatore_id IS NULL").get().c;
    const standbyLong = db.prepare("SELECT COUNT(*) as c FROM quotes WHERE stato = 'STANDBY' AND updated_at <= datetime('now', '-3 days')").get().c;
    const stalePolicies = db.prepare("SELECT COUNT(*) as c FROM policies WHERE stato IN ('RICHIESTA PRESENTATA','IN VERIFICA') AND updated_at <= datetime('now', '-5 days')").get().c;
    const staleQuotes = db.prepare("SELECT COUNT(*) as c FROM quotes WHERE stato IN ('ASSEGNATA','IN LAVORAZIONE') AND updated_at <= datetime('now', '-7 days')").get().c;

    res.json({
      pratiche_non_assegnate: unassigned,
      standby_prolungato: standbyLong,
      polizze_senza_avanzamento: stalePolicies,
      pratiche_ferme: staleQuotes
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
