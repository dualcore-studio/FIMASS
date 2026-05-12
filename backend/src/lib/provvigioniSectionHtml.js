/**
 * Sezione HTML “Provvigioni” per export PDF (html2pdf.js, Puppeteer, wkhtmltopdf).
 *
 * Integrazione nel backend FIMASS
 * ---------------------------------
 * 1) Costruire il payload con `buildProvvigioniSectionPayload({ rows, summary, role })`
 *    oppure passare un oggetto nel formato documentato sotto.
 * 2) Incapsulare l’HTML in un documento minimo per il motore PDF:
 *    `generateProvvigioniPdfDocumentHtml(payload)` oppure, se il template principale
 *    ha già `<section id="provvigioni">…</section>`, sostituire solo l’interno con
 *    `generateProvvigioniSection(payload)` (mantenendo il tag section esterno del template
 *    solo se evita doppi id; in alternativa usare solo il frammento generato qui che
 *    include già `<section id="provvigioni">`).
 * 3) Stili: nessun file esterno; regole nel `<style>` interno alla section con
 *    selettori prefissati `#provvigioni.fimass-provvigioni-pdf` per ridurre conflitti.
 *
 * Formato payload (JSON)
 * -----------------------
 * {
 *   variant?: 'struttura' | 'admin',
 *   title?: string,
 *   timestamp?: string,          // opzionale (non più mostrato nel PDF HTML); es. audit/export JSON
 *   structureName?: string,      // nome struttura (header a destra), opzionale
 *   totals: { polizze, premi, provvigioni },
 *   adminMeta?: { totaleProvvigioniBroker?, totaleSportelloAmico? },
 *   provvigioni: [
 *     { data, cliente, numPolizza, premio, provvigione, stato, ...campi admin }
 *   ]
 * }
 */

/** @typedef {'struttura'|'admin'} ProvvigioniVariant */

/**
 * @param {unknown} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {number|null|undefined} n
 * @returns {string}
 */
function formatEuroIt(n) {
  if (n === null || n === undefined || n === '') return '—';
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(x);
}

/** Importi provvigionali: null → “Da inserire” (allineato alle liste legacy). */
function formatProvvigioneCell(n) {
  if (n === null || n === undefined || n === '') return 'Da inserire';
  const x = Number(n);
  if (!Number.isFinite(x)) return 'Da inserire';
  return formatEuroIt(x);
}

function fmtDateExport(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, day] = s.split('-');
    return `${day}/${m}/${y}`;
  }
  return String(d);
}

function commissionTypeLabel(t) {
  if (t === 'PARTNER') return 'Collaboratore IVASS';
  if (t === 'SPORTELLO_AMICO') return 'Sportello Amico';
  return 'Segnalatore';
}

function commissionListStatusLabel(status) {
  if (status === 'LIQUIDATA') return 'Liquidata';
  if (status === 'VALORIZZATA') return 'Valorizzata';
  return 'Da valorizzare';
}

/**
 * Validazione leggera (non blocca: normalizza dove possibile).
 * @param {object} data
 * @returns {{ ok: boolean; errors: string[] }}
 */
function validateProvvigioniSectionData(data) {
  const errors = [];
  if (!data || typeof data !== 'object') errors.push('Payload mancante o non oggetto.');
  if (data && data.totals == null) errors.push('totals richiesto.');
  if (data && data.totals && typeof data.totals !== 'object') errors.push('totals deve essere un oggetto.');
  if (data && !Array.isArray(data.provvigioni)) errors.push('provvigioni deve essere un array.');
  return { ok: errors.length === 0, errors };
}

/**
 * @param {object} opts
 * @param {object[]} opts.rows              righe già arricchite (enrichCommissionRow)
 * @param {object} opts.summary             output summarize()
 * @param {'admin'|'struttura'} opts.role
 * @param {string} [opts.structureName]
 */
function buildProvvigioniSectionPayload(opts) {
  const { rows, summary, role } = opts;
  const isAdmin = role === 'admin';
  const variant = /** @type {ProvvigioniVariant} */ (isAdmin ? 'admin' : 'struttura');
  const timestamp =
    typeof opts.timestamp === 'string' && opts.timestamp.trim() !== ''
      ? opts.timestamp.trim()
      : new Date().toLocaleString('it-IT');

  /** @type {object[]} */
  const provvigioni = rows.map((r) => {
    const base = {
      data: fmtDateExport(r.date),
      cliente: r.customer_name || '—',
      numPolizza: r.policy_number || '—',
      premio: Number(r.policy_premium) || 0,
      provvigione:
        r.structure_commission_amount === null || r.structure_commission_amount === undefined
          ? null
          : Number(r.structure_commission_amount),
      stato: commissionListStatusLabel(r.commission_status),
      _rawStatus: r.commission_status,
    };
    if (!isAdmin) return base;
    return {
      ...base,
      struttura: r.structure_name || '—',
      portale: r.portal || '—',
      compagnia: r.company || '—',
      fattCliente: r.client_invoice,
      provBroker: r.provvigioni_broker ?? r.broker_commission,
      quotaSa: r.sportello_amico_commission,
      tipo: commissionTypeLabel(r.structure_commission_type),
    };
  });

  const totals = {
    polizze: Number(summary.totale_polizze) || 0,
    premi: Number(summary.totale_premi) || 0,
    provvigioni: Number(summary.totale_provigioni_strutture) || 0,
  };

  const structureName =
    typeof opts.structureName === 'string' && opts.structureName.trim() !== ''
      ? opts.structureName.trim()
      : '';

  return {
    variant,
    title: isAdmin ? 'Provvigioni' : 'Le tue provvigioni',
    timestamp,
    structureName,
    totals,
    adminMeta:
      isAdmin
        ? {
            totaleProvvigioniBroker: summary.totale_provigioni_broker,
            totaleSportelloAmico: summary.totale_sportello_amico,
          }
        : null,
    provvigioni,
  };
}

/**
 * Documento HTML minimo per motori PDF (charset, reset margini body).
 * @param {string} provvigioniSectionHtml — output di `generateProvvigioniSection`
 */
function generateProvvigioniPdfDocumentHtml(provvigioniSectionHtml) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Provvigioni</title>
  <style>
    html, body { margin: 0; padding: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 landscape; }
  </style>
</head>
<body>
${provvigioniSectionHtml}
</body>
</html>`;
}

/**
 * Solo la sezione (frammento innestabile nel template PDF del portale).
 * Include `<section id="provvigioni">` con stili scoped nel blocco `<style>`.
 *
 * Campi opzionali: `options.dark` attiva variabili per tema scuro (sperimentale per engine PDF).
 *
 * @param {object} data
 * @param {{ dark?: boolean }} [options]
 * @returns {string}
 */
function generateProvvigioniSection(data, options = {}) {
  const validation = validateProvvigioniSectionData(data);
  if (!validation.ok) {
    // Fallback sicuro: evita crash in produzione
    data = {
      variant: 'struttura',
      title: 'Le tue provvigioni',
      timestamp: new Date().toLocaleString('it-IT'),
      structureName: '',
      totals: { polizze: 0, premi: 0, provvigioni: 0 },
      provvigioni: [],
      _validationErrors: validation.errors,
    };
  }

  const variant = data.variant === 'admin' ? 'admin' : 'struttura';
  const title = typeof data.title === 'string' && data.title ? data.title : variant === 'admin' ? 'Provvigioni' : 'Le tue provvigioni';
  const structureName =
    typeof data.structureName === 'string' && data.structureName.trim() !== ''
      ? escapeHtml(data.structureName.trim())
      : '';

  const totals = data.totals || { polizze: 0, premi: 0, provvigioni: 0 };
  const polizzeN = Number(totals.polizze) || 0;
  const premiN = Number(totals.premi) || 0;
  const provN = Number(totals.provvigioni) || 0;

  const rows = Array.isArray(data.provvigioni) ? data.provvigioni : [];
  const rowCount = rows.length;
  const dark = options.dark === true;

  /** Righe tabella — struttura */
  const strutturaRows = rows
    .map((r, idx) => {
      const zebra = idx % 2 === 1 ? 'background:#fafaf8;' : 'background:#ffffff;';
      return `<tr style="page-break-inside:avoid;${zebra}">
  <td style="padding:10px 12px;border-bottom:1px solid #e5e5e0;">${escapeHtml(r.data)}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e5e0;">${escapeHtml(r.cliente)}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e5e0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;">${escapeHtml(r.numPolizza)}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e5e0;text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(formatEuroIt(r.premio))}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e5e0;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;color:#854f0b;">${escapeHtml(formatProvvigioneCell(r.provvigione))}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e5e0;font-size:12px;color:#334155;">${escapeHtml(r.stato || '—')}</td>
</tr>`;
    })
    .join('');

  /** Righe tabella — admin */
  const adminRows = rows
    .map((r, idx) => {
      const zebra = idx % 2 === 1 ? 'background:#fafaf8;' : 'background:#ffffff;';
      return `<tr style="page-break-inside:avoid;${zebra}">
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:10px;">${escapeHtml(r.data)}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(r.cliente)}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:9px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${escapeHtml(r.numPolizza)}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:9px;">${escapeHtml(r.struttura || '—')}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:9px;">${escapeHtml(r.portale || '—')}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:9px;">${escapeHtml(r.compagnia || '—')}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:10px;text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(formatEuroIt(r.premio))}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:10px;text-align:right;">${escapeHtml(formatEuroIt(r.fattCliente))}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:10px;text-align:right;">${escapeHtml(formatProvvigioneCell(r.provBroker))}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:10px;text-align:right;">${escapeHtml(formatProvvigioneCell(r.quotaSa))}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:9px;">${escapeHtml(r.tipo || '—')}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:10px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;color:#854f0b;">${escapeHtml(formatProvvigioneCell(r.provvigione))}</td>
  <td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;font-size:9px;">${escapeHtml(r.stato || '—')}</td>
</tr>`;
    })
    .join('');

  const emptyMessage =
    rowCount === 0
      ? `<div style="margin-top:4px;padding:20px 24px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:14px;">
  Nessuna provvigione con i filtri selezionati.
</div>`
      : '';

  const adminMetaHtml =
    variant === 'admin' && data.adminMeta
      ? `<p style="margin:0 0 16px;font-size:11px;color:#64748b;line-height:1.5;">
  <span style="font-weight:600;color:#334155;">Dettaglio sommario:</span>
  Tot. provv. broker: ${escapeHtml(formatEuroIt(data.adminMeta.totaleProvvigioniBroker))}
  &nbsp;·&nbsp; Quota S.A.: ${escapeHtml(formatEuroIt(data.adminMeta.totaleSportelloAmico))}
</p>`
      : '';

  const tableStruttura = `<table style="width:100%;border-collapse:collapse;font-size:13px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <thead>
    <tr style="background:#f1f5f9;color:#0f172a;">
      <th style="text-align:left;padding:12px 12px 10px;border-bottom:2px solid #cbd5e1;font-weight:700;">Data</th>
      <th style="text-align:left;padding:12px 12px 10px;border-bottom:2px solid #cbd5e1;font-weight:700;">Cliente</th>
      <th style="text-align:left;padding:12px 12px 10px;border-bottom:2px solid #cbd5e1;font-weight:700;">N. polizza</th>
      <th style="text-align:right;padding:12px 12px 10px;border-bottom:2px solid #cbd5e1;font-weight:700;">Premio</th>
      <th style="text-align:right;padding:12px 12px 10px;border-bottom:2px solid #cbd5e1;font-weight:700;">Provvigione</th>
      <th style="text-align:left;padding:12px 12px 10px;border-bottom:2px solid #cbd5e1;font-weight:700;">Stato</th>
    </tr>
  </thead>
  <tbody>${strutturaRows}</tbody>
</table>`;

  const tableAdmin = `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
  <table style="width:100%;border-collapse:collapse;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <thead>
      <tr style="background:#f1f5f9;color:#0f172a;">
        <th style="text-align:left;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Data</th>
        <th style="text-align:left;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Cliente</th>
        <th style="text-align:left;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">N. polizza</th>
        <th style="text-align:left;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Struttura</th>
        <th style="text-align:left;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Portale</th>
        <th style="text-align:left;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Compagnia</th>
        <th style="text-align:right;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Premio</th>
        <th style="text-align:right;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Fatt. cliente</th>
        <th style="text-align:right;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Prov. broker</th>
        <th style="text-align:right;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Quota S.A.</th>
        <th style="text-align:left;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Tipo</th>
        <th style="text-align:right;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Prov. struttura</th>
        <th style="text-align:left;padding:8px 8px 6px;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:9px;">Stato</th>
      </tr>
    </thead>
    <tbody>${adminRows}</tbody>
  </table>
</div>`;

  const validationNote =
    Array.isArray(data._validationErrors) && data._validationErrors.length
      ? `<!-- validazione: ${escapeHtml(data._validationErrors.join('; '))} -->`
      : '';

  const themeVars = dark
    ? `--fimass-pv-bg:#0f172a;--fimass-pv-text:#e2e8f0;--fimass-pv-muted:#94a3b8;`
    : `--fimass-pv-bg:#ffffff;--fimass-pv-text:#0f172a;--fimass-pv-muted:#64748b;`;

  return `${validationNote}
<section id="provvigioni" class="fimass-provvigioni-pdf" data-fimass-role="${variant}" data-row-count="${rowCount}" style="--pv-blue-bg:#e6f1fb;--pv-blue-border:#85b7eb;--pv-blue-text:#185fa5;--pv-green-bg:#eaf3de;--pv-green-border:#97c459;--pv-green-text:#3b6d11;--pv-amber-bg:#faeeda;--pv-amber-border:#ef9f27;--pv-amber-text:#854f0b;${themeVars}box-sizing:border-box;padding:20px 8px 24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--fimass-pv-text,#0f172a);background:var(--fimass-pv-bg,#ffffff);">
  <style>
    #provvigioni.fimass-provvigioni-pdf, #provvigioni.fimass-provvigioni-pdf * { box-sizing: border-box; }
    #provvigioni.fimass-provvigioni-pdf .pv-kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 6px;
    }
    #provvigioni.fimass-provvigioni-pdf .pv-card {
      border-radius: 6px;
      padding: 8px 12px;
      border-width: 1px;
      border-style: solid;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 0;
    }
    #provvigioni.fimass-provvigioni-pdf .pv-card-title {
      margin: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.2;
      flex: 1;
      min-width: 0;
    }
    #provvigioni.fimass-provvigioni-pdf .pv-card-value {
      margin: 0;
      font-size: 14px;
      font-weight: 800;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #provvigioni.fimass-provvigioni-pdf .pv-head-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: nowrap;
      margin-bottom: 8px;
    }
    #provvigioni.fimass-provvigioni-pdf .pv-head-left {
      display: block;
      min-width: 0;
      flex: 1;
      line-height: 1.15;
    }
    #provvigioni.fimass-provvigioni-pdf .pv-head-title {
      display: inline;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      color: ${dark ? '#e2e8f0' : '#0f172a'};
    }
    #provvigioni.fimass-provvigioni-pdf .pv-head-structure {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      text-align: right;
      flex-shrink: 0;
      max-width: 42%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: ${dark ? '#e2e8f0' : '#0f172a'};
    }
  </style>

  <header style="margin-bottom:20px;">
    <div class="pv-head-row">
      <div class="pv-head-left">
        <span class="pv-head-title">${escapeHtml(title)}</span>
      </div>
      ${structureName ? `<p class="pv-head-structure">${structureName}</p>` : ''}
    </div>
    <div style="margin-top:6px;height:3px;width:56px;border-radius:2px;background:linear-gradient(90deg,#185fa5 0%,#3b6d11 50%,#ef9f27 100%);"></div>
  </header>

  <div class="pv-kpi-grid">
    <div class="pv-card" style="background:#e6f1fb;border-color:#85b7eb;">
      <p class="pv-card-title" style="color:#185fa5;">Polizze Totali</p>
      <p class="pv-card-value" style="color:#185fa5;">${escapeHtml(String(polizzeN))}</p>
    </div>
    <div class="pv-card" style="background:#eaf3de;border-color:#97c459;">
      <p class="pv-card-title" style="color:#3b6d11;">Premi Totali</p>
      <p class="pv-card-value" style="color:#3b6d11;">${escapeHtml(formatEuroIt(premiN))}</p>
    </div>
    <div class="pv-card" style="background:#faeeda;border-color:#ef9f27;">
      <p class="pv-card-title" style="color:#854f0b;">Provvigioni Totali</p>
      <p class="pv-card-value" style="color:#854f0b;">${escapeHtml(formatEuroIt(provN))}</p>
    </div>
  </div>

  ${adminMetaHtml}

  ${rowCount === 0 ? emptyMessage : variant === 'admin' ? tableAdmin : tableStruttura}
</section>`;
}

module.exports = {
  escapeHtml,
  formatEuroIt,
  validateProvvigioniSectionData,
  buildProvvigioniSectionPayload,
  generateProvvigioniSection,
  generateProvvigioniPdfDocumentHtml,
};
