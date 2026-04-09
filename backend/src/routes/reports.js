const express = require('express');
const { list } = require('../data/store');
const { loadContext } = require('../data/views');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/overview', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const { data_da, data_a } = req.query;
    try {
      let quotes = await list('quotes');
      let policies = await list('policies');
      if (data_da && data_a) {
        const end = `${data_a} 23:59:59`;
        quotes = quotes.filter((q) => String(q.created_at || '') >= data_da && String(q.created_at || '') <= end);
        policies = policies.filter((p) => String(p.created_at || '') >= data_da && String(p.created_at || '') <= end);
      }
      const quoteCounts = {};
      ['PRESENTATA', 'ASSEGNATA', 'IN LAVORAZIONE', 'STANDBY', 'ELABORATA'].forEach((s) => { quoteCounts[s] = quotes.filter((q) => q.stato === s).length; });
      const policyCounts = {};
      ['RICHIESTA PRESENTATA', 'IN VERIFICA', 'DOCUMENTAZIONE MANCANTE', 'PRONTA PER EMISSIONE', 'EMESSA'].forEach((s) => { policyCounts[s] = policies.filter((p) => p.stato === s).length; });
      const totalQuotes = Object.values(quoteCounts).reduce((a, b) => a + b, 0);
      const totalPolicies = Object.values(policyCounts).reduce((a, b) => a + b, 0);
      const conversionRate = totalQuotes > 0 ? ((totalPolicies / totalQuotes) * 100).toFixed(1) : 0;
      res.json({ quoteCounts, policyCounts, totalQuotes, totalPolicies, conversionRate });
    } catch (err) {
      console.error('Error fetching overview:', err);
      res.status(500).json({ error: 'Errore nel recupero report' });
    }
  })();
});

router.get('/by-type', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const { data_da, data_a } = req.query;
      const ctx = await loadContext();
      let quotes = [...ctx.quotes];
      if (data_da && data_a) {
        const end = `${data_a} 23:59:59`;
        quotes = quotes.filter((q) => String(q.created_at || '') >= data_da && String(q.created_at || '') <= end);
      }
      const byType = ctx.insurance_types.map((it) => {
        const q = quotes.filter((row) => Number(row.tipo_assicurazione_id) === Number(it.id));
        return { nome: it.nome, codice: it.codice, preventivi: q.length, polizze: q.filter((x) => Number(x.has_policy) === 1).length };
      }).sort((a, b) => b.preventivi - a.preventivi);
      res.json(byType);
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

router.get('/by-structure', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const { data_da, data_a } = req.query;
      const ctx = await loadContext();
      let quotes = [...ctx.quotes];
      if (data_da && data_a) {
        const end = `${data_a} 23:59:59`;
        quotes = quotes.filter((q) => String(q.created_at || '') >= data_da && String(q.created_at || '') <= end);
      }
      const rows = ctx.users
        .filter((u) => u.role === 'struttura')
        .map((u) => {
          const q = quotes.filter((x) => Number(x.struttura_id) === Number(u.id));
          return { denominazione: u.denominazione, preventivi: q.length, elaborati: q.filter((x) => x.stato === 'ELABORATA').length, polizze: q.filter((x) => Number(x.has_policy) === 1).length };
        })
        .sort((a, b) => b.preventivi - a.preventivi);
      res.json(rows);
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

router.get('/by-operator', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const { data_da, data_a } = req.query;
      const ctx = await loadContext();
      let quotes = [...ctx.quotes];
      if (data_da && data_a) {
        const end = `${data_a} 23:59:59`;
        quotes = quotes.filter((q) => String(q.created_at || '') >= data_da && String(q.created_at || '') <= end);
      }
      const rows = ctx.users
        .filter((u) => u.role === 'operatore')
        .map((u) => {
          const q = quotes.filter((x) => Number(x.operatore_id) === Number(u.id));
          return { operatore: `${u.nome || ''} ${u.cognome || ''}`.trim(), totali: q.length, in_lavorazione: q.filter((x) => x.stato === 'IN LAVORAZIONE').length, elaborati: q.filter((x) => x.stato === 'ELABORATA').length, standby: q.filter((x) => x.stato === 'STANDBY').length };
        })
        .sort((a, b) => b.totali - a.totali);
      res.json(rows);
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

router.get('/timeline', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const { periodo = '30' } = req.query;
      const days = Number(periodo) || 30;
      const minDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const group = (rows) => {
        const m = new Map();
        rows.forEach((r) => {
          const d = String(r.created_at || '').slice(0, 10);
          if (!d || d < minDate) return;
          m.set(d, (m.get(d) || 0) + 1);
        });
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, conteggio]) => ({ data, conteggio }));
      };
      const quoteTimeline = group(await list('quotes'));
      const policyTimeline = group(await list('policies'));
      res.json({ quoteTimeline, policyTimeline });
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

router.get('/alerts', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const quotes = await list('quotes');
      const policies = await list('policies');
      const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      const unassigned = quotes.filter((q) => q.stato === 'PRESENTATA' && (q.operatore_id == null)).length;
      const standbyLong = quotes.filter((q) => q.stato === 'STANDBY' && String(q.updated_at || '') <= daysAgo(7)).length;
      const stalePolicies = policies.filter((p) => ['RICHIESTA PRESENTATA', 'IN VERIFICA'].includes(p.stato) && String(p.updated_at || '') <= daysAgo(5)).length;
      const staleQuotes = quotes.filter((q) => ['ASSEGNATA', 'IN LAVORAZIONE'].includes(q.stato) && String(q.updated_at || '') <= daysAgo(7)).length;
      res.json({ pratiche_non_assegnate: unassigned, standby_prolungato: standbyLong, polizze_senza_avanzamento: stalePolicies, pratiche_ferme: staleQuotes });
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

module.exports = router;
