const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { list, sortBy: sortRows, paginate, like } = require('../data/store');

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const { page = 1, limit = 50, action, search } = req.query;
    try {
      let rows = await list('audit_logs');
      rows = rows.filter((row) => {
        if (action && row.action !== action) return false;
        if (search) {
          const s = String(search);
          if (
            !like(row.action, s)
            && !like(row.entity_type, s)
            && !like(row.metadata_json, s)
            && !like(String(row.user_id || ''), s)
            && !like(String(row.entity_id || ''), s)
          ) {
            return false;
          }
        }
        return true;
      });
      rows = sortRows(rows, 'created_at', 'desc');
      res.json(paginate(rows, page, limit));
    } catch (err) {
      console.error('audit logs list:', err);
      res.status(500).json({ error: 'Errore nel recupero audit' });
    }
  })();
});

module.exports = router;
