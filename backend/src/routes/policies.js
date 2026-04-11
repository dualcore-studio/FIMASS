const express = require('express');
const { list, getById, insert, upsertById, like, paginate } = require('../data/store');
const { loadContext, enrichPolicy } = require('../data/views');
const { sortPoliciesForList } = require('../utils/practiceListSort');
const { normalizeQuoteStato } = require('../utils/quoteStato');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { logActivity } = require('./logs');

const router = express.Router();

function getUserDisplayName(user) {
  return user.role === 'struttura' ? user.denominazione : `${user.nome} ${user.cognome}`;
}

function generatePolicyNumber() {
  return (async () => {
    const year = new Date().getFullYear();
    const policies = await list('policies');
    const prefix = `POL-${year}-`;
    const seq = policies
      .map((p) => String(p.numero || ''))
      .filter((n) => n.startsWith(prefix))
      .map((n) => Number(n.split('-')[2]) || 0)
      .reduce((a, b) => Math.max(a, b), 0) + 1;
    return `POL-${year}-${String(seq).padStart(5, '0')}`;
  })();
}

router.get('/', authenticateToken, (req, res) => {
  (async () => {
    const {
      page = 1,
      limit = 25,
      stato,
      tipo_assicurazione_id,
      struttura_id,
      operatore_id,
      search,
      numero,
      assistito,
      data_da,
      data_a,
      alert,
      sort_by: sortByParam,
      sort_dir: sortDir,
    } = req.query;
    try {
      const ctx = await loadContext();
      let policies = ctx.policies.map((p) => enrichPolicy(p, ctx));
      if (req.user.role === 'struttura') policies = policies.filter((p) => Number(p.struttura_id) === Number(req.user.id));
      else if (req.user.role === 'operatore') policies = policies.filter((p) => Number(p.operatore_id) === Number(req.user.id));
      if (stato) policies = policies.filter((p) => p.stato === stato);
      if (tipo_assicurazione_id) policies = policies.filter((p) => Number(p.tipo_assicurazione_id) === Number(tipo_assicurazione_id));
      if (struttura_id) policies = policies.filter((p) => Number(p.struttura_id) === Number(struttura_id));
      if (operatore_id) policies = policies.filter((p) => Number(p.operatore_id) === Number(operatore_id));
      if (data_da) policies = policies.filter((p) => String(p.created_at || '') >= String(data_da));
      if (data_a) policies = policies.filter((p) => String(p.created_at || '') <= `${data_a} 23:59:59`);
      if (numero) policies = policies.filter((p) => like(p.numero, numero));
      if (assistito) {
        policies = policies.filter(
          (p) =>
            like(p.assistito_nome, assistito) ||
            like(p.assistito_cognome, assistito) ||
            like(p.assistito_cf, assistito),
        );
      }
      if (alert === 'stale_policies') {
        const threshold = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
        policies = policies.filter((p) => ['RICHIESTA PRESENTATA', 'IN VERIFICA'].includes(p.stato) && String(p.updated_at || '') <= threshold);
      }
      if (search) policies = policies.filter((p) => like(p.numero, search) || like(p.assistito_nome, search) || like(p.assistito_cognome, search));
      const sortMap = {
        numero: 'numero',
        preventivo: 'preventivo_numero',
        assistito: 'assistito_cognome',
        tipo: 'tipo_nome',
        struttura: 'struttura_nome',
        operatore: 'operatore_cognome',
        stato: 'stato',
        created_at: 'created_at',
      };
      policies = sortPoliciesForList(policies, sortByParam, sortDir || 'desc', sortMap);
      res.json(paginate(policies, page, limit));
    } catch (err) {
      console.error('Error fetching policies:', err);
      res.status(500).json({ error: 'Errore nel recupero polizze' });
    }
  })();
});

router.get('/stats', authenticateToken, (req, res) => {
  (async () => {
    try {
      let policies = await list('policies');
      if (req.user.role === 'struttura') policies = policies.filter((p) => Number(p.struttura_id) === Number(req.user.id));
      else if (req.user.role === 'operatore') policies = policies.filter((p) => Number(p.operatore_id) === Number(req.user.id));
      const stats = {};
      const stati = ['RICHIESTA PRESENTATA', 'IN VERIFICA', 'DOCUMENTAZIONE MANCANTE', 'PRONTA PER EMISSIONE', 'EMESSA'];
      stati.forEach((s) => { stats[s] = policies.filter((p) => p.stato === s).length; });
      stats.totale = Object.values(stats).reduce((a, b) => a + b, 0);
      res.json(stats);
    } catch (err) {
      console.error('Error fetching policy stats:', err);
      res.status(500).json({ error: 'Errore nel recupero statistiche polizze' });
    }
  })();
});

router.get('/:id', authenticateToken, (req, res) => {
  (async () => {
    try {
      const ctx = await loadContext();
      const row = await getById('policies', req.params.id);
      if (!row) return res.status(404).json({ error: 'Polizza non trovata' });
      const policy = enrichPolicy(row, ctx);
      if (req.user.role === 'struttura' && Number(policy.struttura_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      const history = ctx.policy_status_history
        .filter((h) => Number(h.policy_id) === Number(req.params.id))
        .map((h) => ({ ...h, ...ctx.usersById.get(Number(h.utente_id)) }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const attachments = ctx.attachments
        .filter((a) => a.entity_type === 'policy' && Number(a.entity_id) === Number(req.params.id))
        .map((a) => ({ ...a, caricato_nome: ctx.usersById.get(Number(a.caricato_da))?.nome, caricato_cognome: ctx.usersById.get(Number(a.caricato_da))?.cognome, caricato_denominazione: ctx.usersById.get(Number(a.caricato_da))?.denominazione }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      res.json({ ...policy, history, attachments });
    } catch (err) {
      console.error('Error fetching policy:', err);
      res.status(500).json({ error: 'Errore nel recupero polizza' });
    }
  })();
});

router.post('/', authenticateToken, authorizeRoles('struttura'), (req, res) => {
  (async () => {
    const { quote_id, note_struttura } = req.body;

    if (!quote_id) return res.status(400).json({ error: 'Preventivo di origine richiesto' });

    const quote = await getById('quotes', quote_id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });
    if (normalizeQuoteStato(quote.stato) !== 'ELABORATA') {
      return res.status(400).json({ error: 'Il preventivo deve essere in stato ELABORATA' });
    }
    if (quote.has_policy) return res.status(409).json({ error: 'Polizza già richiesta per questo preventivo' });

    if (Number(quote.struttura_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }

    const numero = await generatePolicyNumber();
    const result = await insert('policies', {
      numero,
      quote_id: Number(quote_id),
      assistito_id: quote.assistito_id,
      tipo_assicurazione_id: quote.tipo_assicurazione_id,
      struttura_id: quote.struttura_id,
      operatore_id: quote.operatore_id,
      stato: 'RICHIESTA PRESENTATA',
      dati_specifici: quote.dati_specifici,
      note_struttura: note_struttura || null,
    });
    const policyId = result.id;
    await upsertById('quotes', quote_id, { has_policy: 1 });
    await insert('policy_status_history', { policy_id: policyId, stato_nuovo: 'RICHIESTA PRESENTATA', utente_id: req.user.id });
    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'CREAZIONE_POLIZZA',
      modulo: 'polizze',
      riferimento_id: policyId,
      riferimento_tipo: 'policy',
      dettaglio: `Creata richiesta polizza ${numero} da preventivo ${quote.numero}`
    });

    res.status(201).json({ id: policyId, numero, message: 'Richiesta emissione polizza creata con successo' });
  })().catch((err) => {
    console.error('Error creating policy:', err);
    res.status(500).json({ error: 'Errore nella creazione polizza' });
  });
});

router.put('/:id/status', authenticateToken, authorizeRoles('admin', 'supervisore', 'operatore'), (req, res) => {
  (async () => {
    const { stato, motivo } = req.body;
    if (!stato) return res.status(400).json({ error: 'Stato richiesto' });

    const policy = await getById('policies', req.params.id);
    if (!policy) return res.status(404).json({ error: 'Polizza non trovata' });

    await upsertById('policies', req.params.id, { stato });
    await insert('policy_status_history', { policy_id: Number(req.params.id), stato_precedente: policy.stato, stato_nuovo: stato, motivo: motivo || null, utente_id: req.user.id });
    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'CAMBIO_STATO_POLIZZA',
      modulo: 'polizze',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'policy',
      dettaglio: `Polizza ${policy.numero}: ${policy.stato} → ${stato}`
    });

    res.json({ message: 'Stato polizza aggiornato' });
  })().catch((err) => {
    console.error('Error updating policy status:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento stato polizza' });
  });
});

module.exports = router;
