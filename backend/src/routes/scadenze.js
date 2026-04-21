const express = require('express');
const { loadContext, enrichPolicy } = require('../data/views');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { normalizePolicyStato } = require('../utils/policyStato');
const { datePartYmd, isDateBeforeTodayYmd } = require('../utils/policyDates');
const { policyAssigneeUserId } = require('../utils/practiceAssignee');

const router = express.Router();

function parseMonthParam(month) {
  const m = String(month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const [y, mo] = m.split('-').map(Number);
  if (mo < 1 || mo > 12) return null;
  return { y, m: mo, key: m };
}

function monthRangeIso({ y, m }) {
  const start = `${y}-${String(m).padStart(2, '0')}-01 00:00:00`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;
  return { start, end };
}

function compagniaFromQuote(quote) {
  const raw = quote?.dati_preventivo;
  let dp = raw;
  if (typeof raw === 'string') {
    try {
      dp = JSON.parse(raw);
    } catch {
      dp = null;
    }
  }
  if (!dp || typeof dp !== 'object') return null;
  const v =
    dp.compagnia ??
    dp.Compagnia ??
    dp.company ??
    dp.nome_compagnia ??
    dp.compagnia_assicuratrice;
  const s = v != null ? String(v).trim() : '';
  return s || null;
}

function buildStatoScadenza(policy, ymdScadenza) {
  if (policy.rinnovata === 1 || policy.rinnovata === true) return 'Rinnovata';
  if (isDateBeforeTodayYmd(ymdScadenza)) return 'Scaduta';
  return 'Da rinnovare';
}

function sortScadenzeRecords(rows) {
  const rank = { Scaduta: 0, 'Da rinnovare': 1, Rinnovata: 2 };
  return [...rows].sort((a, b) => {
    const dr = (rank[a.stato_scadenza] ?? 9) - (rank[b.stato_scadenza] ?? 9);
    if (dr !== 0) return dr;
    return String(a.data_scadenza || '').localeCompare(String(b.data_scadenza || ''), 'it');
  });
}

function operatoreLabel(p) {
  const parts = [p.operatore_nome, p.operatore_cognome].filter(Boolean);
  if (parts.length) return parts.join(' ');
  const fp = [p.fornitore_nome, p.fornitore_cognome].filter(Boolean);
  if (fp.length) return fp.join(' ');
  return '—';
}

router.get('/', authenticateToken, authorizeRoles('admin', 'supervisore', 'operatore', 'struttura'), (req, res) => {
  (async () => {
    const parsedMonth = parseMonthParam(req.query.month);
    if (!parsedMonth) {
      return res.status(400).json({ error: 'Parametro month=YYYY-MM richiesto' });
    }
    const { start, end } = monthRangeIso(parsedMonth);
    try {
      const ctx = await loadContext();
      let policies = ctx.policies
        .map((p) => enrichPolicy(p, ctx))
        .filter((p) => normalizePolicyStato(p.stato) === 'EMESSA');

      if (req.user.role === 'struttura') {
        policies = policies.filter((p) => Number(p.struttura_id) === Number(req.user.id));
      } else if (req.user.role === 'operatore') {
        policies = policies.filter((p) => Number(p.operatore_id) === Number(req.user.id));
      }

      policies = policies.filter((p) => {
        if (!p.data_scadenza) return false;
        const ds = String(p.data_scadenza);
        return ds >= start && ds <= end;
      });

      const items = policies.map((p) => {
        const quote = ctx.quotesById.get(Number(p.quote_id)) || {};
        const ymd = datePartYmd(p.data_scadenza);
        const stato_scadenza = buildStatoScadenza(p, ymd);
        return {
          id: p.id,
          struttura_id: p.struttura_id,
          incaricato_user_id: policyAssigneeUserId(p),
          contraente: [p.assistito_cognome, p.assistito_nome].filter(Boolean).join(' ') || '—',
          tipologia: p.tipo_nome || '—',
          compagnia: compagniaFromQuote(quote),
          struttura: p.struttura_nome || '—',
          operatore: operatoreLabel(p),
          data_emissione: p.data_emissione || null,
          data_scadenza: p.data_scadenza || null,
          rinnovata: p.rinnovata === 1 || p.rinnovata === true,
          stato_scadenza,
        };
      });

      const sorted = sortScadenzeRecords(items);
      const summary = {
        totale: sorted.length,
        daRinnovare: sorted.filter((r) => r.stato_scadenza === 'Da rinnovare').length,
        scadute: sorted.filter((r) => r.stato_scadenza === 'Scaduta').length,
        rinnovate: sorted.filter((r) => r.stato_scadenza === 'Rinnovata').length,
      };
      res.json({ month: parsedMonth.key, items: sorted, summary });
    } catch (err) {
      console.error('scadenze list:', err);
      res.status(500).json({ error: 'Errore nel recupero scadenze' });
    }
  })();
});

module.exports = router;
