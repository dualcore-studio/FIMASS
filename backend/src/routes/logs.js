const express = require('express');
const { insert, list, like, sortBy: sortRows, paginate } = require('../data/store');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

async function logActivity({ utente_id, utente_nome, ruolo, azione, modulo, riferimento_id, riferimento_tipo, dettaglio }) {
  try {
    await insert('activity_logs', {
      utente_id,
      utente_nome,
      ruolo,
      azione,
      modulo,
      riferimento_id: riferimento_id || null,
      riferimento_tipo: riferimento_tipo || null,
      dettaglio: dettaglio || null,
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

router.get('/', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
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
    try {
      let rows = await list('activity_logs');
      rows = rows.filter((row) => {
        if (utente_id && Number(row.utente_id) !== Number(utente_id)) return false;
        if (azione && row.azione !== azione) return false;
        if (modulo && row.modulo !== modulo) return false;
        if (data_da && String(row.created_at || '') < String(data_da)) return false;
        if (data_a && String(row.created_at || '') > `${data_a} 23:59:59`) return false;
        if (search && !(like(row.utente_nome, search) || like(row.dettaglio, search) || like(row.azione, search))) return false;
        return true;
      });

      const sortFieldMap = {
        created_at: 'created_at',
        utente: 'utente_nome',
        ruolo: 'ruolo',
        azione: 'azione',
        modulo: 'modulo',
        dettaglio: 'dettaglio',
      };
      const field = sortFieldMap[sortBy] || 'created_at';
      rows = sortRows(rows, field, sortDir || 'desc');
      const payload = paginate(rows, page, limit);
      res.json(payload);
    } catch (err) {
      console.error('Error fetching logs:', err);
      res.status(500).json({ error: 'Errore nel recupero dei log' });
    }
  })();
});

router.get('/actions', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const rows = await list('activity_logs');
    const actions = [...new Set(rows.map((r) => r.azione).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'it'));
    res.json(actions);
  })();
});

router.get('/modules', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const rows = await list('activity_logs');
    const modules = [...new Set(rows.map((r) => r.modulo).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'it'));
    res.json(modules);
  })();
});

module.exports = router;
module.exports.logActivity = logActivity;
