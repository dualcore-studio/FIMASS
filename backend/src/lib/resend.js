const { Resend } = require('resend');

function getMailEnv() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const appUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
  return { apiKey, from, appUrl };
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

function buildMessagesConversationUrl(conversationId) {
  const { appUrl } = getMailEnv();
  if (!appUrl || conversationId == null) return null;
  return `${appUrl}/messaggi/${conversationId}`;
}

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
              <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">Portale FIMASS</div>
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

async function sendHtmlEmail({ to, subject, html, text }) {
  const { apiKey, from } = getMailEnv();
  if (!apiKey || !from) {
    console.warn('[FIMASS email] RESEND_API_KEY o RESEND_FROM_EMAIL mancanti: invio saltato.');
    return;
  }
  const addr = to && String(to).trim();
  if (!addr) {
    console.warn('[FIMASS email] Destinatario mancante: invio saltato.');
    return;
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
    return;
  }
  if (data?.id) {
    console.log(`[FIMASS email] Inviata correttamente (Resend id: ${data.id}, destinatario: ${addr})`);
  } else {
    console.warn('[FIMASS email] Risposta Resend senza id email; controlla la dashboard Resend → Logs.');
  }
  return data;
}

/**
 * Notifica operatore: pratica assegnata o riassegnata.
 */
async function sendQuoteAssignedToOperatorMail({
  to,
  operatorName,
  quoteId,
  quoteNumero,
  assistitoLabel,
  tipoNome,
  strutturaNome,
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
      <p style="margin:0 0 16px;">ti è stata assegnata una pratica preventivo su FIMASS. Di seguito il riepilogo.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('ID pratica', `#${quoteId} (${quoteNumero})`)}
        ${row('Assistito', assistitoLabel)}
        ${row('Tipologia', tipoNome)}
        ${row('Struttura', strutturaNome)}
        ${row('Stato attuale', statoCorrente)}
        ${row('Data assegnazione', dataAssegnazione)}
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
  strutturaNome,
  assistitoLabel,
  tipoNome,
  dataRichiesta,
  noteStruttura,
}) {
  try {
    const policyUrl = buildPolicyUrl(policyId);
    const practiceUrl = buildPracticeUrl(quoteId);
    const linkPolicy = policyUrl
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(policyUrl)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri la richiesta polizza</a></p>`
      : '';
    const linkPractice = practiceUrl
      ? `<p style="margin:8px 0 0;"><a href="${escapeHtml(practiceUrl)}" style="color:#0f172a;font-weight:600;">Preventivo collegato</a></p>`
      : '';
    const noteBlock =
      noteStruttura && String(noteStruttura).trim()
        ? row('Note dalla struttura', String(noteStruttura).trim())
        : '';
    const inner = `
      <p style="margin:0 0 16px;">Gentile <strong>${escapeHtml(operatorName)}</strong>,</p>
      <p style="margin:0 0 16px;">è stata presentata una <strong>richiesta di emissione polizza</strong> collegata a un preventivo elaborato. Di seguito il riepilogo.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Polizza (richiesta)', `${policyNumero} (ID ${policyId})`)}
        ${row('Preventivo di origine', `${quoteNumero} (ID ${quoteId})`)}
        ${row('Struttura richiedente', strutturaNome)}
        ${row('Assistito', assistitoLabel)}
        ${row('Tipologia', tipoNome)}
        ${row('Data richiesta', dataRichiesta)}
        ${noteBlock}
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
  assistitoLabel,
  tipoNome,
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
      <p style="margin:0 0 16px;">lo stato di una pratica preventivo è stato aggiornato.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('ID pratica', `#${quoteId} (${quoteNumero})`)}
        ${row('Assistito', assistitoLabel)}
        ${row('Tipologia', tipoNome)}
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
  practiceKindIt,
  practiceNumero,
  practiceId,
  entityType,
  conversationId,
  preview,
}) {
  try {
    const convUrl = buildMessagesConversationUrl(conversationId);
    const practiceUrl =
      entityType === 'policy' ? buildPolicyUrl(practiceId) : buildPracticeUrl(practiceId);
    const linkBlock = convUrl
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(convUrl)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri la conversazione nel portale</a></p>`
      : '';
    const practiceLink = practiceUrl
      ? `<p style="margin:8px 0 0;"><a href="${escapeHtml(practiceUrl)}" style="color:#0f172a;font-weight:600;">Apri la pratica</a></p>`
      : '';
    const previewBlock =
      preview && String(preview).trim()
        ? `<p style="margin:16px 0 0;padding:12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;"><strong>Anteprima</strong><br/><span style="white-space:pre-wrap;">${escapeHtml(String(preview).trim())}</span></p>`
        : '';
    const inner = `
      <p style="margin:0 0 16px;">Gentile <strong>${escapeHtml(recipientName)}</strong>,</p>
      <p style="margin:0 0 16px;">hai ricevuto un <strong>nuovo messaggio</strong> su FIMASS da <strong>${escapeHtml(senderName)}</strong>.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('Tipo pratica', practiceKindIt)}
        ${row('Numero pratica', practiceNumero)}
        ${row('Riferimento ID', String(practiceId))}
      </table>
      ${previewBlock}
      ${linkBlock}
      ${practiceLink}
    `;
    const html = emailShell('Nuovo messaggio nel portale', inner);
    await sendHtmlEmail({
      to,
      subject: `Nuovo messaggio — ${practiceKindIt} ${practiceNumero} — FIMASS`,
      html,
    });
  } catch (err) {
    console.error('[FIMASS email] sendPortalMessageNotificationMail:', err);
  }
}

async function sendQuotePresentedByStructureToAdminMail({
  to,
  adminName,
  quoteId,
  quoteNumero,
  assistitoLabel,
  tipoNome,
  strutturaNome,
  dataPresentazione,
}) {
  try {
    const practiceUrl = buildPracticeUrl(quoteId);
    const linkBlock = practiceUrl
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(practiceUrl)}" style="display:inline-block;background:#0f172a;color:#f8fafc;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Apri la pratica nel portale</a></p>`
      : '';
    const inner = `
      <p style="margin:0 0 16px;">Gentile <strong>${escapeHtml(adminName)}</strong>,</p>
      <p style="margin:0 0 16px;">è stata presentata una <strong>nuova pratica preventivo</strong> da una struttura. Di seguito il riepilogo.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row('ID pratica', `#${quoteId} (${quoteNumero})`)}
        ${row('Assistito', assistitoLabel)}
        ${row('Tipologia', tipoNome)}
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
  buildPracticeUrl,
  buildPolicyUrl,
  buildMessagesConversationUrl,
  sendQuoteAssignedToOperatorMail,
  sendQuoteStatusChangeToStructureMail,
  sendPolicyEmissionRequestedToOperatorMail,
  sendQuotePresentedByStructureToAdminMail,
  sendPortalMessageNotificationMail,
};
