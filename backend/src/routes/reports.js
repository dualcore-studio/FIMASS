const express = require('express');
const { list } = require('../data/store');
const { loadContext, enrichPolicy } = require('../data/views');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const {
  parseReportFilters,
  filterByCreatedRange,
  filterQuotesByStructureOperator,
  filterPoliciesByStructureOperator,
  quoteStatoNorm,
  countQuotesByStato,
  countPoliciesByStato,
  structureLabel,
  staffDisplayName,
  roleLabelIt,
  dominantStrutturaId,
} = require('../utils/reportQuery');

const router = express.Router();

function baseFilteredSets(ctx, filters) {
  let quotes = filterByCreatedRange(ctx.quotes, filters.data_da, filters.data_a);
  let policies = filterByCreatedRange(ctx.policies, filters.data_da, filters.data_a);
  quotes = filterQuotesByStructureOperator(quotes, filters.struttura_id, filters.operatore_id);
  policies = filterPoliciesByStructureOperator(policies, filters.struttura_id, filters.operatore_id);
  return { quotes, policies };
}

router.get('/overview', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const filters = parseReportFilters(req.query);
      const ctx = await loadContext();
      const { quotes, policies } = baseFilteredSets(ctx, filters);
      const quoteCounts = countQuotesByStato(quotes);
      const enrichedPolicies = policies.map((p) => enrichPolicy(p, ctx));
      const policyCounts = countPoliciesByStato(enrichedPolicies);
      const totalQuotes = quotes.length;
      const totalPolicies = policies.length;
      const conversionRate = totalQuotes > 0 ? ((totalPolicies / totalQuotes) * 100).toFixed(1) : '0.0';
      res.json({
        quoteCounts,
        policyCounts,
        totalQuotes,
        totalPolicies,
        conversionRate,
      });
    } catch (err) {
      console.error('Error fetching overview:', err);
      res.status(500).json({ error: 'Errore nel recupero report' });
    }
  })();
});

router.get('/by-type', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const filters = parseReportFilters(req.query);
      const ctx = await loadContext();
      const { quotes } = baseFilteredSets(ctx, filters);
      const byType = ctx.insurance_types
        .map((it) => {
          const q = quotes.filter((row) => Number(row.tipo_assicurazione_id) === Number(it.id));
          return {
            tipologia: it.nome,
            nome: it.nome,
            codice: it.codice,
            preventivi: q.length,
            polizze: q.filter((x) => Number(x.has_policy) === 1).length,
          };
        })
        .sort((a, b) => b.preventivi - a.preventivi);
      res.json(byType);
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

router.get('/preventivi-by-structure', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const filters = parseReportFilters(req.query);
      const ctx = await loadContext();
      const { quotes: allQ } = baseFilteredSets(ctx, filters);
      const strutture = ctx.users.filter((u) => u.role === 'struttura');
      const rows = strutture
        .map((u) => {
          const q = allQ.filter((x) => Number(x.struttura_id) === Number(u.id));
          const by = countQuotesByStato(q);
          const totale = q.length;
          return {
            struttura_id: u.id,
            struttura: structureLabel(u),
            presentati: by.PRESENTATA,
            assegnati: by.ASSEGNATA,
            in_lavorazione: by['IN LAVORAZIONE'],
            standby: by.STANDBY,
            elaborati: by.ELABORATA,
            totale,
          };
        })
        .sort((a, b) => b.totale - a.totale);
      res.json(rows);
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

router.get('/polizze-by-structure', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const filters = parseReportFilters(req.query);
      const ctx = await loadContext();
      const { policies: allP } = baseFilteredSets(ctx, filters);
      const strutture = ctx.users.filter((u) => u.role === 'struttura');
      const rows = strutture
        .map((u) => {
          const pol = allP.filter((x) => Number(x.struttura_id) === Number(u.id)).map((p) => enrichPolicy(p, ctx));
          const by = countPoliciesByStato(pol);
          const totale = pol.length;
          return {
            struttura_id: u.id,
            struttura: structureLabel(u),
            richieste_presentate: by['RICHIESTA PRESENTATA'],
            in_emissione: by['IN EMISSIONE'],
            emesse: by.EMESSA,
            totale,
          };
        })
        .sort((a, b) => b.totale - a.totale);
      res.json(rows);
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

router.get('/user-activity', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const filters = parseReportFilters(req.query);
      const ctx = await loadContext();
      const { quotes, policies } = baseFilteredSets(ctx, filters);
      const policiesEnr = policies.map((p) => enrichPolicy(p, ctx));

      let staff = ctx.users.filter((u) => ['admin', 'supervisore', 'operatore'].includes(u.role));
      if (filters.operatore_id != null) {
        staff = staff.filter((u) => Number(u.id) === Number(filters.operatore_id));
      }

      const rows = staff
        .map((u) => {
          const qUser = quotes.filter((x) => Number(x.operatore_id) === Number(u.id));
          const presiInCarico = qUser.filter((x) => {
            const s = quoteStatoNorm(x);
            return s && s !== 'PRESENTATA';
          }).length;
          const elaborati = qUser.filter((x) => quoteStatoNorm(x) === 'ELABORATA').length;
          const polUser = policiesEnr.filter((x) => Number(x.operatore_id) === Number(u.id));
          const polizzeGestite = polUser.length;
          const strutturaId = dominantStrutturaId([...qUser, ...polUser]);
          const strutturaNome = strutturaId != null ? structureLabel(ctx.usersById.get(Number(strutturaId)) || {}) : null;
          const totaleAttivita = qUser.length + polUser.length;
          let statoAttivita = 'Nessuna attività nel periodo';
          if (totaleAttivita > 0) statoAttivita = 'Attivo nel periodo';
          return {
            user_id: u.id,
            nome_utente: staffDisplayName(u),
            ruolo: roleLabelIt(u.role),
            struttura_associata: strutturaNome || '—',
            preventivi_presi_in_carico: presiInCarico,
            preventivi_elaborati: elaborati,
            polizze_gestite: polizzeGestite,
            stato_attivita: statoAttivita,
            totale_attivita: totaleAttivita,
          };
        })
        .sort((a, b) => b.totale_attivita - a.totale_attivita);
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
      const filters = parseReportFilters(req.query);
      const ctx = await loadContext();
      const { quotes, policies } = baseFilteredSets(ctx, filters);

      const group = (rows) => {
        const m = new Map();
        rows.forEach((r) => {
          const d = String(r.created_at || '').slice(0, 10);
          if (!d) return;
          m.set(d, (m.get(d) || 0) + 1);
        });
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, conteggio]) => ({ data, conteggio }));
      };

      if (filters.data_da && filters.data_a) {
        const quoteTimeline = group(quotes);
        const policyTimeline = group(policies);
        res.json({ quoteTimeline, policyTimeline });
        return;
      }

      const days = Number(req.query.periodo) || 30;
      const minDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const groupSince = (rows) => {
        const m = new Map();
        rows.forEach((r) => {
          const d = String(r.created_at || '').slice(0, 10);
          if (!d || d < minDate) return;
          m.set(d, (m.get(d) || 0) + 1);
        });
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, conteggio]) => ({ data, conteggio }));
      };
      const quoteTimeline = groupSince(await list('quotes'));
      const policyTimeline = groupSince(await list('policies'));
      res.json({ quoteTimeline, policyTimeline });
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

router.get('/export', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const filters = parseReportFilters(req.query);
      const ctx = await loadContext();
      const { quotes, policies } = baseFilteredSets(ctx, filters);
      const quoteCounts = countQuotesByStato(quotes);
      const enrichedPolicies = policies.map((p) => enrichPolicy(p, ctx));
      const policyCounts = countPoliciesByStato(enrichedPolicies);

      const strutture = ctx.users.filter((u) => u.role === 'struttura');
      const prevRows = strutture
        .map((u) => {
          const q = quotes.filter((x) => Number(x.struttura_id) === Number(u.id));
          const by = countQuotesByStato(q);
          return [
            structureLabel(u),
            by.PRESENTATA,
            by.ASSEGNATA,
            by['IN LAVORAZIONE'],
            by.STANDBY,
            by.ELABORATA,
            q.length,
          ];
        })
        .filter((r) => r[6] > 0);

      const polRows = strutture
        .map((u) => {
          const pol = policies.filter((x) => Number(x.struttura_id) === Number(u.id)).map((p) => enrichPolicy(p, ctx));
          const by = countPoliciesByStato(pol);
          return [structureLabel(u), by['RICHIESTA PRESENTATA'], by['IN EMISSIONE'], by.EMESSA, pol.length];
        })
        .filter((r) => r[4] > 0);

      let staff = ctx.users.filter((u) => ['admin', 'supervisore', 'operatore'].includes(u.role));
      if (filters.operatore_id != null) {
        staff = staff.filter((u) => Number(u.id) === Number(filters.operatore_id));
      }
      const userRows = staff
        .map((u) => {
          const qUser = quotes.filter((x) => Number(x.operatore_id) === Number(u.id));
          const presiInCarico = qUser.filter((x) => {
            const s = quoteStatoNorm(x);
            return s && s !== 'PRESENTATA';
          }).length;
          const elaborati = qUser.filter((x) => quoteStatoNorm(x) === 'ELABORATA').length;
          const polUser = enrichedPolicies.filter((x) => Number(x.operatore_id) === Number(u.id));
          const strutturaId = dominantStrutturaId([...qUser, ...polUser]);
          const strutturaNome = strutturaId != null ? structureLabel(ctx.usersById.get(Number(strutturaId)) || {}) : '—';
          return [
            staffDisplayName(u),
            roleLabelIt(u.role),
            strutturaNome,
            presiInCarico,
            elaborati,
            polUser.length,
            qUser.length + polUser.length,
          ];
        })
        .filter((r) => r[6] > 0);

      const esc = (v) => {
        const s = String(v ?? '');
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const line = (cells) => cells.map(esc).join(',');

      const lines = [
        '\uFEFF',
        'FIMASS — Export report',
        line(['Periodo da', filters.data_da || '(tutto)', 'a', filters.data_a || '(tutto)']),
        line(['Filtro struttura id', filters.struttura_id ?? '', 'Filtro operatore id', filters.operatore_id ?? '']),
        '',
        'KPI preventivi',
        line(['Stato', 'Conteggio']),
        ...Object.entries(quoteCounts).map(([k, v]) => line([k, v])),
        '',
        'KPI polizze',
        line(['Stato', 'Conteggio']),
        ...Object.entries(policyCounts).map(([k, v]) => line([k, v])),
        '',
        'Preventivi per struttura',
        line(['Struttura', 'Presentati', 'Assegnati', 'In lavorazione', 'Stand-by', 'Elaborati', 'Totale']),
        ...prevRows.map((r) => line(r)),
        '',
        'Polizze per struttura',
        line(['Struttura', 'Richieste presentate', 'In emissione', 'Emesse', 'Totale']),
        ...polRows.map((r) => line(r)),
        '',
        'Attività utenti',
        line([
          'Nome utente',
          'Ruolo',
          'Struttura associata',
          'Preventivi presi in carico',
          'Preventivi elaborati',
          'Polizze gestite',
          'Totale attività',
        ]),
        ...userRows.map((r) => line(r)),
      ];

      const body = lines.join('\n');
      const filename = `report_fimass_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(body);
    } catch (err) {
      console.error('Export error:', err);
      res.status(500).json({ error: 'Errore export' });
    }
  })();
});

/** @deprecated Risposta ridotta per client legacy; preferire /preventivi-by-structure */
router.get('/by-structure', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const filters = parseReportFilters(req.query);
      const ctx = await loadContext();
      const { quotes } = baseFilteredSets(ctx, filters);
      const rows = ctx.users
        .filter((u) => u.role === 'struttura')
        .map((u) => {
          const q = quotes.filter((x) => Number(x.struttura_id) === Number(u.id));
          return {
            denominazione: structureLabel(u),
            preventivi: q.length,
            elaborati: q.filter((x) => quoteStatoNorm(x) === 'ELABORATA').length,
            polizze: q.filter((x) => Number(x.has_policy) === 1).length,
          };
        })
        .sort((a, b) => b.preventivi - a.preventivi);
      res.json(rows);
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

/** @deprecated Usare /user-activity */
router.get('/by-operator', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    try {
      const filters = parseReportFilters(req.query);
      const ctx = await loadContext();
      const { quotes } = baseFilteredSets(ctx, filters);
      const rows = ctx.users
        .filter((u) => u.role === 'operatore')
        .map((u) => {
          const q = quotes.filter((x) => Number(x.operatore_id) === Number(u.id));
          return {
            operatore: `${u.nome || ''} ${u.cognome || ''}`.trim(),
            totali: q.length,
            in_lavorazione: q.filter((x) => quoteStatoNorm(x) === 'IN LAVORAZIONE').length,
            elaborati: q.filter((x) => quoteStatoNorm(x) === 'ELABORATA').length,
            standby: q.filter((x) => quoteStatoNorm(x) === 'STANDBY').length,
          };
        })
        .sort((a, b) => b.totali - a.totali);
      res.json(rows);
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
      const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      const unassigned = quotes.filter((q) => quoteStatoNorm(q) === 'PRESENTATA' && q.operatore_id == null).length;
      const standbyLong = quotes.filter((q) => quoteStatoNorm(q) === 'STANDBY' && String(q.updated_at || '') <= daysAgo(7)).length;
      const ctx = await loadContext();
      const enriched = ctx.policies.map((p) => enrichPolicy(p, ctx));
      const stalePolicies = enriched.filter(
        (p) => ['RICHIESTA PRESENTATA', 'IN EMISSIONE'].includes(p.stato) && String(p.updated_at || '') <= daysAgo(5),
      ).length;
      const staleQuotes = quotes.filter(
        (q) => ['ASSEGNATA', 'IN LAVORAZIONE'].includes(quoteStatoNorm(q)) && String(q.updated_at || '') <= daysAgo(7),
      ).length;
      res.json({
        pratiche_non_assegnate: unassigned,
        standby_prolungato: standbyLong,
        polizze_senza_avanzamento: stalePolicies,
        pratiche_ferme: staleQuotes,
      });
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Errore' });
    }
  })();
});

module.exports = router;
