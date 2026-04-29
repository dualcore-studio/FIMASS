const { Resend } = require('resend');

/** Nome visualizzato mittente per tutte le email automatiche (l'indirizzo resta RESEND_FROM_EMAIL). */
const AUTOMATIC_MAIL_FROM_DISPLAY_NAME = 'FIMASS Gestionale Assicurativo';

function getMailEnv() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const appUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
  return { apiKey, from, appUrl };
}

/** Costruisce `Nome <email>` per Resend usando solo l'indirizzo da env (nome sempre quello assicurativo). */
function buildResendFromHeader(rawFromEnv) {
  const s = String(rawFromEnv || '').trim();
  if (!s) return '';
  const m = s.match(/^(.+?)\s*<([^>]+)>\s*$/);
  const addr = m ? String(m[2]).trim() : s;
  return `${AUTOMATIC_MAIL_FROM_DISPLAY_NAME} <${addr}>`;
}

/** Nome e cognome assistito in ordine lettura (nome prima, poi cognome). */
function formatAssistitoNomeCognome(nome, cognome) {
  const s = [nome, cognome]
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x).trim())
    .join(' ');
  return s || '—';
}

function escapeHtml(value) {
  if (value == null || value === '') return '—';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPracticeUrl(quoteId) {
  const { appUrl } = getMailEnv();
  if (!appUrl || quoteId == null) return null;
  return `${appUrl}/preventivi/${quoteId}`;
}

function buildPolicyUrl(policyId) {
  const { appUrl } = getMailEnv();
  if (!appUrl || policyId == null) return null;
  return `${appUrl}/polizze/${policyId}`;
}

function buildScadenzeUrl() {
  const { appUrl } = getMailEnv();
  if (!appUrl) return null;
  return `${appUrl.replace(/\/$/, '')}/scadenze`;
}

function buildMessagesConversationUrl(conversationId) {
  const { appUrl } = getMailEnv();
  if (!appUrl || conversationId == null) return null;
  return `${appUrl}/messaggi/${conversationId}`;
}

function buildAppointmentUrl(appointmentId) {
  const { appUrl } = getMailEnv();
  if (!appUrl || appointmentId == null) return null;
  return `${appUrl}/appuntamenti/${appointmentId}`;
}

/** Login portale strutture (fisso, non da variabili d’ambiente). */
const STRUTTURA_PORTALE_LOGIN_URL = 'https://sportelloamicofimass.info/login';

function emailShell(title, innerHtml) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <tr>
            <td style="padding:20px 24px;background:#0f172a;color:#f8fafc;">
              <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">PORTALE FIMASS ASSICURATIVO</div>
              <div style="font-size:18px;font-weight:600;margin-top:6px;">${escapeHtml(title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 20px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">
              Messaggio automatico: non rispondere a questa email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function row(label, value) {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:500;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

/** Versione testuale minimale per client che privilegiano text/plain. */
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
}

function logResendError(error) {
  try {
    console.error('[FIMASS email] Errore API Resend:', typeof error === 'string' ? error : JSON.stringify(error));
  } catch {
    console.error('[FIMASS email] Errore API Resend (oggetto non serializzabile):', error);
  }
  if (error && typeof error === 'object' && error.name === 'invalid_from_address') {
    console.error(
      '[FIMASS email] Il mittente RESEND_FROM_EMAIL non è autorizzato: verifica un dominio su https://resend.com/domains e usa un indirizzo di quel dominio (es. Notifiche <noreply@tuo-dominio.it>).',
    );
  }
}

/**
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string }>}
 */
async function sendHtmlEmailResult({ to, subject, html, text }) {
  const { apiKey, from: fromRaw } = getMailEnv();
  if (!apiKey || !String(fromRaw || '').trim()) {
    const msg = 'RESEND_API_KEY o RESEND_FROM_EMAIL mancanti';
    console.warn(`[FIMASS email] ${msg}: invio saltato.`);
    return { ok: false, error: msg };
  }
  const from = buildResendFromHeader(fromRaw);
  const addr = to && String(to).trim();
  if (!addr) {
    const msg = 'Destinatario mancante';
    console.warn(`[FIMASS email] ${msg}: invio saltato.`);
    return { ok: false, error: msg };
  }
  const resend = new Resend(apiKey);
  const plain = text || htmlToText(html);
  const { data, error } = await resend.emails.send({
    from,
    to: [addr],
    subject,
    html,
    text: plain,
  });
  if (error) {
    logResendError(error);
    const errStr = typeof error === 'string' ? error : JSON.stringify(error);
    return { ok: false, error: errStr };
  }
  if (data?.id) {
    console.log(`[FIMASS email] Inviata correttamente (Resend id: ${data.id}, destinatario: ${addr})`);
  } else {
    console.warn('[FIMASS email] Risposta Resend senza id email; controlla la dashboard Resend → Logs.');
  }
  return { ok: true, data: data || {} };
}

async function sendHtmlEmail({ to, subject, html, text }) {
  const r = await sendHtmlEmailResult({ to, subject, html, text });
  if (r.ok) return r.data;
}

function formatScadenzaItDate(iso) {
  const ymd = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return escapeHtml(String(iso || '—'));
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Riepilogo scadenze per struttura (job automatico 1° / 15 del mese).
 * @param {object} params
 * @param {'first_notice'|'second_notice'} params.reminderType
 */
async function sendScadenzeReminderMail({ to, strutturaNome, reminderType, monthLabel, rows }) {
  try {
    const scadenzeUrl = buildScadenzeUrl();
    const isFirst = reminderType === 'first_notice';
    const shellTitle = isFirst ? 'Avviso scadenze polizze' : 'Promemoria scadenze polizze';
    const subject = `${isFirst ? 'Avviso' : 'Promemoria'} scadenze polizze – ${monthLabel}`;

    const headerCells = ['Assistito', 'N. preventivo', 'Tipologia', 'Scadenza', 'Compagnia']
      .map(
        (h) =>
          `<th align="left" style="padding:10px 8px;border-bottom:2px solid #e2e8f0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(h)}</th>`,
      )
      .join('');
    const bodyRows = (rows || [])
      .map((r) => {
        const comp = r.compagnia != null && String(r.compagnia).trim() !== '' ? String(r.compagnia).trim() : '—';
        const prevLabel =
          r.preventivo_label != null && String(r.preventivo_label).trim() !== ''
            ? String(r.preventivo_label).trim()
            : '—';
        return `<tr>
  <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${escapeHtml(r.contraente)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;white-space:nowrap;">${escapeHtml(prevLabel)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${escapeHtml(r.tipologia)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;white-space:nowrap;">${formatScadenzaItDate(r.data_scadenza)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${escapeHtml(comp)}</td>
</tr>`;
      })
      .join('');

    const tableBlock = `
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:16px 0 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;min-width:520px;">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;

    const linkBlock = scadenzeUrl
      ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(scadenzeUrl)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Vai allo scadenzario</a></p>
         <p style="margin:10px 0 0;font-size:13px;color:#64748b;">Oppure apri la sezione <strong>Scadenze</strong> dal menu del portale.</p>`
      : '';

    const intro = isFirst
      ? `nel mese di <strong>${escapeHtml(monthLabel)}</strong> risultano in scadenza le polizze elencate di seguito. Ti invitiamo a consultare lo scadenzario per le azioni di rinnovo.`
      : `questo è un promemoria: nel mese di <strong>${escapeHtml(monthLabel)}</strong> sono ancora in scadenza le polizze nell’elenco. Accedi al portale per completare le pratiche necessarie.`;

    const inner = `
      <p style="margin:0 0 16px;">Spett.le <strong>${escapeHtml(strutturaNome)}</strong>,</p>
      <p style="margin:0 0 16px;">${intro}</p>
      ${tableBlock}
      ${linkBlock}
      <p style="margin:24px 0 0;font-size:14px;color:#334155;">Cordiali saluti,<br><strong>FIMASS — Sportello Amico</strong></p>
    `;

    const html = emailShell(shellTitle, inner);

    const plainItDate = (iso) => {
      const ymd = String(iso || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return String(iso || '—');
      const [y, m, d] = ymd.split('-');
      return `${d}/${m}/${y}`;
    };
    const textLines = (rows || []).map((r) => {
      const comp = r.compagnia != null && String(r.compagnia).trim() !== '' ? String(r.compagnia).trim() : '—';
      const prevLabel =
        r.preventivo_label != null && String(r.preventivo_label).trim() !== ''
          ? String(r.preventivo_label).trim()
          : '—';
      return `- ${r.contraente} | ${prevLabel} | ${r.tipologia} | ${plainItDate(r.data_scadenza)} | ${comp}`;
    });
    const text = [
      `Spett.le ${strutturaNome},`,
      '',
      isFirst
        ? `Nel mese di ${monthLabel} risultano in scadenza le polizze elencate.`
        : `Promemoria: nel mese di ${monthLabel} risultano le polizze elencate.`,
      '',
      ...textLines,
      '',
      scadenzeUrl ? `Scadenzario: ${scadenzeUrl}` : '',
      '',
      'Cordiali saluti,',
      'FIMASS — Sportello Amico',
    ]
      .filter(Boolean)
      .join('\n');

    return await sendHtmlEmailResult({ to, subject, html, text });
  } catch (err) {
    console.error('[FIMASS email] sendScadenzeReminderMail:', err);
    return { ok: false, error: String(err?.message || err) };
  }
}

/**
 * Notifica operatore: pratica assegnata o riassegnata.
 */
async function sendQuoteAssignedToOperatorMail({
  to,
  operatorName,
  quoteId,
  quoteNumero,
  assistitoNomeCognome,
  statoCorrente,
  dataAssegnazione,
}) {
  try {
    const practiceUrl = buildPracticeUrl(quoteId);
    const linkBlock = practiceUrl
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(practiceUrl)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri la pratica nel portale</a></p>`
      : '';
    const inner = `
      <p style="margin:0 0 16px;">Gentile <strong>${escapeHtml(operatorName)}</strong>,</p>
      <p style="margin:0 0 16px;">ti è stata assegnata una <strong>nuova richiesta di preventivo</strong> su FIMASS. Accedi al portale per consultare i dettagli della pratica.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Riferimento pratica', `#${quoteId} (${quoteNumero})`)}
        ${row('Assistito', assistitoNomeCognome || '—')}
        ${statoCorrente ? row('Stato', statoCorrente) : ''}
        ${dataAssegnazione ? row('Data aggiornamento', dataAssegnazione) : ''}
      </table>
      ${linkBlock}
    `;
    const html = emailShell('Nuova pratica assegnata', inner);
    await sendHtmlEmail({
      to,
      subject: 'Nuova pratica assegnata - FIMASS',
      html,
    });
  } catch (err) {
    console.error('[FIMASS email] sendQuoteAssignedToOperatorMail:', err);
  }
}

/**
 * Notifica struttura: aggiornamento stato pratica preventivo.
 */
/**
 * Notifica operatore: richiesta emissione polizza da struttura.
 */
async function sendPolicyEmissionRequestedToOperatorMail({
  to,
  operatorName,
  policyId,
  policyNumero,
  quoteId,
  quoteNumero,
  assistitoNomeCognome,
  dataRichiesta,
}) {
  try {
    const policyUrl = buildPolicyUrl(policyId);
    const practiceUrl = buildPracticeUrl(quoteId);
    const linkPolicy = policyUrl
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(policyUrl)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri la richiesta nel portale</a></p>`
      : '';
    const linkPractice = practiceUrl
      ? `<p style="margin:8px 0 0;"><a href="${escapeHtml(practiceUrl)}" style="color:#0f172a;font-weight:600;">Apri il preventivo collegato</a></p>`
      : '';
    const inner = `
      <p style="margin:0 0 16px;">Gentile <strong>${escapeHtml(operatorName)}</strong>,</p>
      <p style="margin:0 0 16px;">è stata presentata una <strong>richiesta di emissione polizza</strong> su FIMASS. Accedi al portale per i dettagli operativi e gli allegati.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Richiesta polizza', `${policyNumero} (ID ${policyId})`)}
        ${row('Preventivo di origine', `${quoteNumero} (ID ${quoteId})`)}
        ${row('Assistito', assistitoNomeCognome || '—')}
        ${row('Data richiesta', dataRichiesta)}
      </table>
      ${linkPolicy}
      ${linkPractice}
    `;
    const html = emailShell('Richiesta emissione polizza', inner);
    await sendHtmlEmail({
      to,
      subject: 'Richiesta emissione polizza - FIMASS',
      html,
    });
  } catch (err) {
    console.error('[FIMASS email] sendPolicyEmissionRequestedToOperatorMail:', err);
  }
}

async function sendQuoteStatusChangeToStructureMail({
  to,
  strutturaNome,
  quoteId,
  quoteNumero,
  assistitoNomeCognome,
  statoPrecedente,
  statoNuovo,
  dataAggiornamento,
  motivoStandby,
}) {
  try {
    const practiceUrl = buildPracticeUrl(quoteId);
    const linkBlock = practiceUrl
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(practiceUrl)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri la pratica nel portale</a></p>`
      : '';
    const motivoRow =
      statoNuovo === 'STANDBY' && motivoStandby
        ? row('Motivo standby', motivoStandby)
        : '';
    const inner = `
      <p style="margin:0 0 16px;">Spett.le <strong>${escapeHtml(strutturaNome)}</strong>,</p>
      <p style="margin:0 0 16px;">lo <strong>stato di una pratica preventivo</strong> è stato aggiornato su FIMASS. Accedi al portale per i dettagli.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Riferimento pratica', `#${quoteId} (${quoteNumero})`)}
        ${row('Assistito', assistitoNomeCognome || '—')}
        ${row('Stato precedente', statoPrecedente)}
        ${row('Nuovo stato', statoNuovo)}
        ${row('Data aggiornamento', dataAggiornamento)}
        ${motivoRow}
      </table>
      ${linkBlock}
    `;
    const html = emailShell('Aggiornamento stato pratica', inner);
    await sendHtmlEmail({
      to,
      subject: 'Aggiornamento stato pratica - FIMASS',
      html,
    });
  } catch (err) {
    console.error('[FIMASS email] sendQuoteStatusChangeToStructureMail:', err);
  }
}

/**
 * Notifica admin: nuova pratica preventivo presentata da una struttura.
 */
/**
 * Notifica nuovo messaggio in-app (sezione Messaggi).
 */
async function sendPortalMessageNotificationMail({
  to,
  recipientName,
  senderName,
  conversationId,
  practiceRef = null,
  assistitoNomeCognome = null,
}) {
  try {
    const convUrl = buildMessagesConversationUrl(conversationId);
    const linkBlock = convUrl
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(convUrl)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri la conversazione nel portale</a></p>`
      : '';
    const practiceTable =
      practiceRef != null && String(practiceRef).trim() !== ''
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:16px 0 0;">
        ${row('Riferimento pratica', String(practiceRef).trim())}
        ${row('Assistito', assistitoNomeCognome && String(assistitoNomeCognome).trim() ? String(assistitoNomeCognome).trim() : '—')}
      </table>`
        : '';
    const inner = `
      <p style="margin:0 0 16px;">Gentile <strong>${escapeHtml(recipientName)}</strong>,</p>
      <p style="margin:0 0 16px;">hai ricevuto un <strong>nuovo messaggio</strong> collegato a una pratica su FIMASS. Il contenuto è disponibile solo nell’area riservata del portale.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Mittente: ${escapeHtml(senderName)}</p>
      ${practiceTable}
      ${linkBlock}
    `;
    const html = emailShell('Nuovo messaggio nel portale', inner);
    await sendHtmlEmail({
      to,
      subject: 'Nuovo messaggio nel portale — FIMASS',
      html,
    });
  } catch (err) {
    console.error('[FIMASS email] sendPortalMessageNotificationMail:', err);
  }
}

function modalitaLabel(m) {
  const x = String(m || '').toLowerCase();
  if (x === 'presenza') return 'In presenza';
  if (x === 'videocall') return 'Videocall';
  if (x === 'telefonata') return 'Telefonata';
  return String(m || '—');
}

/**
 * @param {object} p
 * @param {string} p.to
 * @param {string} p.fornitoreName
 * @param {number} p.appointmentId
 * @param {string} p.oggetto
 * @param {string} p.strutturaNome
 * @param {string} p.assistitoNome
 * @param {string} p.modalita
 * @param {string} p.dataOra
 * @param {string} [p.luogo]
 * @param {string} [p.telefonoAssistito] telefono assistito (modalità telefonata)
 * @param {string} [p.linkVideocall] link (modalità videocall, raro in fase di richiesta)
 * @param {string} [p.note]
 */
async function sendAppointmentCreatedToFornitoreMail(p) {
  try {
    const url = buildAppointmentUrl(p.appointmentId);
    const linkBlock = url
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri l&apos;appuntamento nel portale</a></p>`
      : '';
    const modeRow =
      p.modalita === 'presenza' && p.luogo
        ? row('Luogo', p.luogo)
        : p.modalita === 'telefonata' && p.telefonoAssistito
          ? row('Telefono assistito', p.telefonoAssistito)
          : p.modalita === 'videocall' && p.linkVideocall
            ? row('Link videocall', p.linkVideocall)
            : '';
    const inner = `
      <p style="margin:0 0 16px;">Gentile <strong>${escapeHtml(p.fornitoreName)}</strong>,</p>
      <p style="margin:0 0 16px;">la struttura <strong>${escapeHtml(p.strutturaNome)}</strong> ha richiesto un <strong>nuovo appuntamento di consulenza</strong>.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Assistito', `${p.assistitoNome || '—'}`)}
        ${row('Modalità', modalitaLabel(p.modalita))}
        ${row('Data e ora', p.dataOra || '—')}
        ${row('Oggetto', p.oggetto || '—')}
        ${row('Fornitore assegnato', p.fornitoreName)}
        ${p.note ? row('Note', p.note) : ''}
        ${modeRow}
      </table>
      ${linkBlock}
    `;
    const html = emailShell('Nuova richiesta appuntamento', inner);
    await sendHtmlEmail({
      to: p.to,
      subject: 'Nuova richiesta appuntamento — FIMASS',
      html,
    });
  } catch (err) {
    console.error('[FIMASS email] sendAppointmentCreatedToFornitoreMail:', err);
  }
}

/**
 * @param {'confermato'|'riprogrammato'|'annullato'} p.kind
 */
async function sendAppointmentUpdateToStrutturaMail(p) {
  try {
    const {
      kind,
      to,
      strutturaNome,
      appointmentId,
      oggetto,
      fornitoreName,
      assistitoNome,
      modalita,
      dataOra,
      luogo,
      linkVideocall,
      telefonoAssistito,
      note,
      extraMotivo,
    } = p;
    const url = buildAppointmentUrl(appointmentId);
    const linkBlock = url
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri l&apos;appuntamento</a></p>`
      : '';
    const title =
      kind === 'confermato'
        ? 'Appuntamento confermato'
        : kind === 'riprogrammato'
          ? 'Appuntamento da riprogrammare'
          : 'Appuntamento annullato';
    const subject =
      kind === 'confermato'
        ? 'Appuntamento confermato — FIMASS'
        : kind === 'riprogrammato'
          ? 'Appuntamento: nuova proposta data — FIMASS'
          : 'Appuntamento annullato — FIMASS';
    const intro =
      kind === 'confermato'
        ? 'Il fornitore ha <strong>confermato</strong> l&apos;appuntamento.'
        : kind === 'riprogrammato'
          ? 'Il fornitore ha proposto una <strong>nuova data/ora</strong> (stato: da riprogrammare).'
          : 'L&apos;appuntamento è stato <strong>annullato</strong>.';
    const inner = `
      <p style="margin:0 0 16px;">Spett.le <strong>${escapeHtml(strutturaNome || 'struttura')}</strong>,</p>
      <p style="margin:0 0 16px;">${intro}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Assistito', assistitoNome || '—')}
        ${row('Modalità', modalitaLabel(modalita))}
        ${row('Data e ora', dataOra || '—')}
        ${row('Fornitore', fornitoreName || '—')}
        ${row('Oggetto', oggetto || '—')}
        ${luogo && modalita === 'presenza' ? row('Luogo', luogo) : ''}
        ${linkVideocall && modalita === 'videocall' ? row('Link videocall', linkVideocall) : ''}
        ${telefonoAssistito && modalita === 'telefonata' ? row('Telefono assistito', telefonoAssistito) : ''}
        ${note ? row('Note', note) : ''}
        ${extraMotivo ? row(kind === 'riprogrammato' ? 'Motivo riprogrammazione' : 'Motivo', extraMotivo) : ''}
      </table>
      ${linkBlock}
    `;
    const html = emailShell(title, inner);
    await sendHtmlEmail({ to, subject, html });
  } catch (err) {
    console.error('[FIMASS email] sendAppointmentUpdateToStrutturaMail:', err);
  }
}

/**
 * Conferma appuntamento in videocall: notifica all'assistito con link riunione.
 */
async function sendAppointmentVideocallConfirmedToAssistitoMail(p) {
  try {
    const { to, assistitoNome, fornitoreName, oggetto, dataOra, linkVideocall } = p;
    const safeLink = String(linkVideocall || '').trim();
    const linkRow = safeLink
      ? `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;width:38%;vertical-align:top;">${escapeHtml('Link per la videocall')}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:500;vertical-align:top;word-break:break-all;"><a href="${escapeHtml(safeLink)}" style="color:#1d4ed8;">${escapeHtml(safeLink)}</a></td>
    </tr>`
      : '';
    const inner = `
      <p style="margin:0 0 16px;">Gentile <strong>${escapeHtml(assistitoNome || 'assistito')}</strong>,</p>
      <p style="margin:0 0 16px;">Le comunichiamo che il suo <strong>appuntamento in videocall</strong> è stato <strong>confermato</strong>.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Data e ora', dataOra || '—')}
        ${row('Professionista / fornitore', fornitoreName || '—')}
        ${row('Oggetto', oggetto || '—')}
        ${linkRow}
      </table>
      <p style="margin:20px 0 0;font-size:14px;color:#475569;">Per partecipare, utilizzi il link indicato sopra all&apos;orario concordato. Se non dovesse aprirsi, copi l&apos;indirizzo nel browser.</p>
    `;
    const html = emailShell('Appuntamento videocall confermato', inner);
    await sendHtmlEmail({
      to,
      subject: 'Appuntamento videocall confermato — FIMASS',
      html,
    });
  } catch (err) {
    console.error('[FIMASS email] sendAppointmentVideocallConfirmedToAssistitoMail:', err);
  }
}

/** Annullamento da struttura o notifica fornitore (controparte). */
async function sendAppointmentAnnullatoToFornitoreMail(p) {
  try {
    const {
      to,
      fornitoreName,
      appointmentId,
      oggetto,
      strutturaNome,
      assistitoNome,
      modalita,
      dataOra,
      luogo,
      linkVideocall,
      telefonoAssistito,
      note,
      extraMotivo,
    } = p;
    const url = buildAppointmentUrl(appointmentId);
    const linkBlock = url
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri l&apos;appuntamento</a></p>`
      : '';
    const inner = `
      <p style="margin:0 0 16px;">Gentile <strong>${escapeHtml(fornitoreName || 'fornitore')}</strong>,</p>
      <p style="margin:0 0 16px;">La struttura <strong>${escapeHtml(strutturaNome || '—')}</strong> ha <strong>annullato</strong> l&apos;appuntamento.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Assistito', assistitoNome || '—')}
        ${row('Modalità', modalitaLabel(modalita))}
        ${row('Data e ora', dataOra || '—')}
        ${row('Oggetto', oggetto || '—')}
        ${luogo && modalita === 'presenza' ? row('Luogo', luogo) : ''}
        ${linkVideocall && modalita === 'videocall' ? row('Link videocall', linkVideocall) : ''}
        ${telefonoAssistito && modalita === 'telefonata' ? row('Telefono assistito', telefonoAssistito) : ''}
        ${note ? row('Note', note) : ''}
        ${extraMotivo ? row('Motivo', extraMotivo) : ''}
      </table>
      ${linkBlock}
    `;
    const html = emailShell('Appuntamento annullato dalla struttura', inner);
    await sendHtmlEmail({ to, subject: 'Appuntamento annullato — FIMASS', html });
  } catch (err) {
    console.error('[FIMASS email] sendAppointmentAnnullatoToFornitoreMail:', err);
  }
}

/**
 * Credenziali accesso portale per nuova utenza “struttura” (solo invio SMTP; password solo in chiaro in memoria per il corpo email).
 * @returns {Promise<{ ok: boolean, error?: string, data?: object }>}
 */
async function sendStrutturaPortalCredentialsMail({ to, username, plaintextPassword }) {
  try {
    const safeUser = String(username ?? '').trim();
    const safePass =
      plaintextPassword === undefined || plaintextPassword === null
        ? ''
        : String(plaintextPassword);
    const portalUrl = STRUTTURA_PORTALE_LOGIN_URL;
    const subject = 'Accesso al Portale FIMASS Assicurativo';
    const inner = `
      <p style="margin:0 0 16px;">Gentile Struttura,</p>
      <p style="margin:0 0 16px;">ti informiamo che è stato creato il tuo account per l&apos;accesso al Portale FIMASS Assicurativo.</p>
      <p style="margin:0 0 8px;">Di seguito le credenziali di accesso:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Username', safeUser)}
        ${row('Password', safePass)}
      </table>
      <p style="margin:20px 0 8px;">Puoi accedere al portale dal seguente link:</p>
      <p style="margin:0 0 16px;"><a href="${escapeHtml(portalUrl)}" style="color:#1d4ed8;font-weight:600;">${escapeHtml(portalUrl)}</a></p>
      <p style="margin:0 0 16px;">Il portale ti permetterà di inserire e monitorare le richieste di preventivo, gestire le polizze e comunicare con gli operatori incaricati.</p>
      <p style="margin:24px 0 0;font-size:14px;color:#334155;">Cordiali saluti<br><strong>${escapeHtml('FIMASS Gestionale Assicurativo')}</strong></p>
    `;
    const html = emailShell('Accesso al Portale FIMASS Assicurativo', inner);
    const text = [
      'Gentile Struttura,',
      '',
      'ti informiamo che è stato creato il tuo account per l\'accesso al Portale FIMASS Assicurativo.',
      '',
      'Di seguito le credenziali di accesso:',
      '',
      `Username: ${safeUser}`,
      `Password: ${safePass}`,
      '',
      'Puoi accedere al portale dal seguente link:',
      portalUrl,
      '',
      'Il portale ti permetterà di inserire e monitorare le richieste di preventivo, gestire le polizze e comunicare con gli operatori incaricati.',
      '',
      'Cordiali saluti',
      'FIMASS Gestionale Assicurativo',
    ].join('\n');

    return await sendHtmlEmailResult({ to, subject, html, text });
  } catch (err) {
    console.error('[FIMASS email] sendStrutturaPortalCredentialsMail:', err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
}

async function sendQuotePresentedByStructureToAdminMail({
  to,
  adminName,
  quoteId,
  quoteNumero,
  strutturaNome,
  assistitoNomeCognome,
  dataPresentazione,
}) {
  try {
    const practiceUrl = buildPracticeUrl(quoteId);
    const linkBlock = practiceUrl
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(practiceUrl)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri la pratica nel portale</a></p>`
      : '';
    const inner = `
      <p style="margin:0 0 16px;">Gentile <strong>${escapeHtml(adminName)}</strong>,</p>
      <p style="margin:0 0 16px;">è stata presentata una <strong>nuova richiesta di preventivo</strong> su FIMASS. Accedi al portale per consultare dati e allegati.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Riferimento pratica', `#${quoteId} (${quoteNumero})`)}
        ${row('Assistito', assistitoNomeCognome || '—')}
        ${row('Struttura', strutturaNome)}
        ${row('Stato', 'PRESENTATA')}
        ${row('Data presentazione', dataPresentazione)}
      </table>
      ${linkBlock}
    `;
    const html = emailShell('Nuova pratica presentata', inner);
    await sendHtmlEmail({
      to,
      subject: 'Nuova pratica presentata - FIMASS',
      html,
    });
  } catch (err) {
    console.error('[FIMASS email] sendQuotePresentedByStructureToAdminMail:', err);
  }
}

module.exports = {
  getMailEnv,
  formatAssistitoNomeCognome,
  buildPracticeUrl,
  buildPolicyUrl,
  buildScadenzeUrl,
  buildMessagesConversationUrl,
  buildAppointmentUrl,
  sendHtmlEmailResult,
  sendScadenzeReminderMail,
  sendQuoteAssignedToOperatorMail,
  sendQuoteStatusChangeToStructureMail,
  sendPolicyEmissionRequestedToOperatorMail,
  sendQuotePresentedByStructureToAdminMail,
  sendPortalMessageNotificationMail,
  sendAppointmentCreatedToFornitoreMail,
  sendAppointmentUpdateToStrutturaMail,
  sendAppointmentVideocallConfirmedToAssistitoMail,
  sendAppointmentAnnullatoToFornitoreMail,
  sendStrutturaPortalCredentialsMail,
};
