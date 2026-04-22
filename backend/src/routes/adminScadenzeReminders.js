const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { runScadenzeRemindersJob, REMINDER_TYPE } = require('../lib/scadenzeReminders');

const router = express.Router();

/**
 * POST body JSON (solo admin):
 * - targetYear, targetMonth (1-12) obbligatori
 * - reminderType: "first_notice" | "second_notice" (default first_notice)
 * - dryRun: boolean
 */
router.post('/run', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    try {
      const { targetYear, targetMonth, reminderType, dryRun } = req.body || {};
      const rt =
        reminderType === REMINDER_TYPE.SECOND_NOTICE ? REMINDER_TYPE.SECOND_NOTICE : REMINDER_TYPE.FIRST_NOTICE;
      const out = await runScadenzeRemindersJob({
        mode: 'manual',
        manualTargetYear: targetYear,
        manualTargetMonth: targetMonth,
        manualReminderType: rt,
        dryRun: Boolean(dryRun),
      });
      if (!out.ok) {
        return res.status(400).json(out);
      }
      res.json(out);
    } catch (err) {
      console.error('[admin] scadenze-reminders/run', err);
      res.status(500).json({ ok: false, error: 'Errore esecuzione' });
    }
  })();
});

module.exports = router;
