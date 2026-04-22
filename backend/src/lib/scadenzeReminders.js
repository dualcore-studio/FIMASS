'use strict';

const { list, insert } = require('../data/store');
const { loadContext, enrichPolicy } = require('../data/views');
const { normalizePolicyStato } = require('../utils/policyStato');
const {
  datePartYmd,
  calculatePolicyExpiryDate,
  toIsoDateTime,
  parseDbDateTime,
} = require('../utils/policyDates');
const {
  DISPLAY,
  computeScadenzaDisplayStato,
  ensurePolicyExpirationForEmessaPolicy,
  mergeExpirationsIntoContext,
  normalizeRenewalStatus,
  RENEWAL_STATUS,
} = require('./policyRenewal');
const { sendScadenzeReminderMail } = require('./resend');
const { isInstantConfigured } = require('./instantdb');

const REMINDER_TYPE = Object.freeze({
  FIRST_NOTICE: 'first_notice',
  SECOND_NOTICE: 'second_notice',
});

const LOG_STATUS = Object.freeze({
  SENT: 'sent',
  FAILED: 'failed',
  SKIPPED: 'skipped',
});

const CLOSED_DISPLAY_STATES = new Set([DISPLAY.RINNOVATA, DISPLAY.NON_RINNOVATA]);

function parseMonthKeyFromParts(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function monthRangeIso({ y, m }) {
  const start = `${y}-${String(m).padStart(2, '0')}-01 00:00:00`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;
  return { start, end };
}

function effectiveDataScadenza(policy) {
  if (policy.data_scadenza) return policy.data_scadenza;
  if (policy.data_emissione) {
    const exp = calculatePolicyExpiryDate(parseDbDateTime(policy.data_emissione));
    return exp ? toIsoDateTime(exp) : null;
  }
  return null;
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

function compagniaLabel(policy, quote) {
  const c =
    policy.compagnia != null && String(policy.compagnia).trim() !== ''
      ? String(policy.compagnia).trim()
      : null;
  return c || compagniaFromQuote(quote);
}

function policyContraenteSearchText(p) {
  return [p.assistito_cognome, p.assistito_nome].filter(Boolean).join(' ') || '—';
}

function buildRow(p, ctx) {
  const pe = ctx.policyExpirationsByPolicyId.get(Number(p.id)) || null;
  const quote = ctx.quotesById.get(Number(p.quote_id)) || {};
  const scadenzaEff = effectiveDataScadenza(p);
  const ymd = datePartYmd(scadenzaEff);
  const stato_scadenza = computeScadenzaDisplayStato({ pe, policy: p, ymdScadenza: ymd });
  return {
    policyId: p.id,
    struttura_id: p.struttura_id,
    contraente: policyContraenteSearchText(p),
    tipologia: p.tipo_nome || '—',
    compagnia: compagniaLabel(p, quote) || null,
    data_scadenza: scadenzaEff,
    ymd,
    stato_scadenza,
    renewal_status: pe ? normalizeRenewalStatus(pe.renewal_status) : RENEWAL_STATUS.DA_RINNOVARE,
  };
}

function sortReminderRows(rows) {
  return [...rows].sort((a, b) => {
    const c = String(a.ymd || '').localeCompare(String(b.ymd || ''), 'it');
    if (c !== 0) return c;
    return String(a.contraente || '').localeCompare(String(b.contraente || ''), 'it', { sensitivity: 'base' });
  });
}

/** @returns {{ year: number, month: number, day: number }} */
function getDatePartsInTimeZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || '0');
  return { year: get('year'), month: get('month'), day: get('day') };
}

function nextCalendarMonth(year, month) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function getReminderTypeForRomeDay(day) {
  if (day === 1) return REMINDER_TYPE.FIRST_NOTICE;
  if (day === 15) return REMINDER_TYPE.SECOND_NOTICE;
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlausibleEmail(s) {
  const t = String(s || '').trim();
  if (!t || t.length > 320) return false;
  return EMAIL_RE.test(t);
}

function formatItalianMonthTitle(year, month) {
  const d = new Date(year, month - 1, 1);
  const raw = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(d);
  if (!raw) return `${month}/${year}`;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

async function ensureExpirationsForPolicies(policies, ctx) {
  for (const p of policies) {
    if (!ctx.policyExpirationsByPolicyId.get(Number(p.id))) {
      await ensurePolicyExpirationForEmessaPolicy(p.id);
    }
  }
}

async function loadSentIdempotencySet() {
  const rows = await list('scadenze_reminder_logs');
  const sent = new Set();
  for (const r of rows) {
    if (String(r.status).toLowerCase() !== LOG_STATUS.SENT) continue;
    const key = `${r.reminder_type}|${Number(r.target_year)}|${Number(r.target_month)}|${Number(r.structure_id)}`;
    sent.add(key);
  }
  return {
    wasSent: (reminderType, ty, tm, sid) =>
      sent.has(`${reminderType}|${Number(ty)}|${Number(tm)}|${Number(sid)}`),
  };
}

async function collectScadenzeForTargetMonth(targetYear, targetMonth) {
  let ctx = await mergeExpirationsIntoContext(await loadContext());
  const { start, end } = monthRangeIso({ y: targetYear, m: targetMonth });

  let policies = ctx.policies
    .map((p) => enrichPolicy(p, ctx))
    .filter((p) => normalizePolicyStato(p.stato) === 'EMESSA');

  const policiesWithScadenza = policies.filter((p) => Boolean(effectiveDataScadenza(p)));
  const policiesInMonth = policiesWithScadenza.filter((p) => {
    const ds = effectiveDataScadenza(p);
    return String(ds) >= start && String(ds) <= end;
  });

  await ensureExpirationsForPolicies(policiesInMonth, ctx);
  ctx = await mergeExpirationsIntoContext(await loadContext());

  const rows = [];
  for (const p of policiesInMonth) {
    const row = buildRow(p, ctx);
    if (CLOSED_DISPLAY_STATES.has(row.stato_scadenza)) continue;
    rows.push(row);
  }

  return sortReminderRows(rows);
}

function groupByStruttura(rows) {
  const map = new Map();
  for (const r of rows) {
    const sid = Number(r.struttura_id);
    if (!Number.isFinite(sid)) continue;
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid).push(r);
  }
  return map;
}

async function persistLog(entry) {
  return insert('scadenze_reminder_logs', {
    reminder_type: entry.reminder_type,
    target_year: entry.target_year,
    target_month: entry.target_month,
    structure_id: entry.structure_id,
    recipient_email: entry.recipient_email || '',
    scadenze_count: entry.scadenze_count,
    status: entry.status,
    error_message: entry.error_message || null,
    resend_message_id: entry.resend_message_id || null,
  });
}

/**
 * @param {object} [opts]
 * @param {Date} [opts.now]
 * @param {'auto'|'manual'} [opts.mode]
 * @param {number} [opts.manualTargetYear]
 * @param {number} [opts.manualTargetMonth]
 * @param {string} [opts.manualReminderType]
 * @param {boolean} [opts.dryRun]
 */
async function runScadenzeRemindersJob(opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const mode = opts.mode === 'manual' ? 'manual' : 'auto';
  const dryRun = Boolean(opts.dryRun);

  if (!isInstantConfigured()) {
    return { ok: false, error: 'InstantDB non configurato', results: [], summary: {} };
  }

  let reminderType;
  let targetYear;
  let targetMonth;

  if (mode === 'auto') {
    const rome = getDatePartsInTimeZone(now, 'Europe/Rome');
    const rt = getReminderTypeForRomeDay(rome.day);
    if (!rt) {
      return {
        ok: true,
        skipped: true,
        skipReason: 'not_reminder_day',
        mode,
        rome,
        results: [],
        summary: { sent: 0, failed: 0, skipped: 0, structuresWithScadenze: 0, totalScadenzeRows: 0 },
      };
    }
    reminderType = rt;
    const n = nextCalendarMonth(rome.year, rome.month);
    targetYear = n.year;
    targetMonth = n.month;
  } else {
    reminderType =
      opts.manualReminderType === REMINDER_TYPE.SECOND_NOTICE
        ? REMINDER_TYPE.SECOND_NOTICE
        : REMINDER_TYPE.FIRST_NOTICE;
    targetYear = Number(opts.manualTargetYear);
    targetMonth = Number(opts.manualTargetMonth);
    if (!Number.isFinite(targetYear) || !Number.isFinite(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return {
        ok: false,
        error: 'targetYear e targetMonth (1-12) richiesti in modalità manuale',
        results: [],
        summary: {},
      };
    }
  }

  const allRows = await collectScadenzeForTargetMonth(targetYear, targetMonth);
  const byStructure = groupByStruttura(allRows);
  const ctx = await loadContext();
  const structures = ctx.users.filter((u) => u.role === 'struttura' && u.stato === 'attivo');

  let idempo = { wasSent: () => false };
  if (!dryRun) {
    idempo = await loadSentIdempotencySet();
  }

  const results = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const monthLabel = formatItalianMonthTitle(targetYear, targetMonth);

  for (const struttura of structures) {
    const sid = Number(struttura.id);
    const items = byStructure.get(sid) || [];
    if (items.length === 0) continue;

    const email = struttura.email;
    const strutturaNome = struttura.denominazione || struttura.username || `Struttura ${sid}`;

    if (!isPlausibleEmail(email)) {
      skipped += 1;
      results.push({
        structureId: sid,
        strutturaNome,
        email: email || null,
        outcome: 'skipped',
        reason: 'invalid_email',
        scadenzeCount: items.length,
        reminderType,
        targetYear,
        targetMonth,
      });
      if (!dryRun) {
        await persistLog({
          reminder_type: reminderType,
          target_year: targetYear,
          target_month: targetMonth,
          structure_id: sid,
          recipient_email: String(email || ''),
          scadenze_count: items.length,
          status: LOG_STATUS.SKIPPED,
          error_message: 'invalid_or_missing_email',
        });
      }
      continue;
    }

    if (!dryRun && idempo.wasSent(reminderType, targetYear, targetMonth, sid)) {
      skipped += 1;
      results.push({
        structureId: sid,
        strutturaNome,
        email,
        outcome: 'skipped',
        reason: 'already_sent',
        scadenzeCount: items.length,
        reminderType,
        targetYear,
        targetMonth,
      });
      continue;
    }

    if (dryRun) {
      results.push({
        structureId: sid,
        strutturaNome,
        email,
        outcome: 'dry_run',
        scadenzeCount: items.length,
        reminderType,
        targetYear,
        targetMonth,
        monthLabel,
      });
      continue;
    }

    const sendRes = await sendScadenzeReminderMail({
      to: email,
      strutturaNome,
      reminderType,
      monthLabel,
      rows: items,
    });

    if (sendRes.ok) {
      sent += 1;
      const resendId = sendRes.data?.id ? String(sendRes.data.id) : null;
      results.push({
        structureId: sid,
        strutturaNome,
        email,
        outcome: 'sent',
        scadenzeCount: items.length,
        reminderType,
        targetYear,
        targetMonth,
        resendId,
      });
      await persistLog({
        reminder_type: reminderType,
        target_year: targetYear,
        target_month: targetMonth,
        structure_id: sid,
        recipient_email: email,
        scadenze_count: items.length,
        status: LOG_STATUS.SENT,
        error_message: null,
        resend_message_id: resendId,
      });
    } else {
      failed += 1;
      const errMsg = sendRes.error || 'send_failed';
      results.push({
        structureId: sid,
        strutturaNome,
        email,
        outcome: 'failed',
        scadenzeCount: items.length,
        reminderType,
        targetYear,
        targetMonth,
        error: errMsg,
      });
      await persistLog({
        reminder_type: reminderType,
        target_year: targetYear,
        target_month: targetMonth,
        structure_id: sid,
        recipient_email: email,
        scadenze_count: items.length,
        status: LOG_STATUS.FAILED,
        error_message: errMsg,
        resend_message_id: null,
      });
    }
  }

  return {
    ok: true,
    mode,
    dryRun,
    targetYear,
    targetMonth,
    reminderType,
    monthKey: parseMonthKeyFromParts(targetYear, targetMonth),
    monthLabel,
    results,
    summary: {
      sent,
      failed,
      skipped,
      structuresWithScadenze: byStructure.size,
      totalScadenzeRows: allRows.length,
    },
  };
}

module.exports = {
  REMINDER_TYPE,
  LOG_STATUS,
  runScadenzeRemindersJob,
  getDatePartsInTimeZone,
  nextCalendarMonth,
  getReminderTypeForRomeDay,
  isPlausibleEmail,
  formatItalianMonthTitle,
  collectScadenzeForTargetMonth,
  groupByStruttura,
  monthRangeIso,
  effectiveDataScadenza,
};
