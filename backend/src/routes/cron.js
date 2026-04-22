const express = require('express');
const { verifyCronSecret } = require('../middleware/cronAuth');
const { runScadenzeRemindersJob } = require('../lib/scadenzeReminders');

const router = express.Router();

/** Vercel Cron (GET) — giorni 1 e 15 (Europe/Rome) con invio mese successivo. */
router.get('/scadenze-reminders', verifyCronSecret, (req, res) => {
  (async () => {
    try {
      const out = await runScadenzeRemindersJob({ mode: 'auto', now: new Date() });
      res.json(out);
    } catch (err) {
      console.error('[cron] scadenze-reminders', err);
      res.status(500).json({ ok: false, error: 'Errore esecuzione job' });
    }
  })();
});

module.exports = router;
