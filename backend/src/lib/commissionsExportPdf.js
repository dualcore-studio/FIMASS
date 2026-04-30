const PDFDocument = require('pdfkit');

function fmtEuro(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(x);
}

/** Importi provvigionali: null → testo UX (liste PDF). */
function fmtCommissionAmountEuro(n) {
  if (n === null || n === undefined || n === '') return 'Da inserire';
  const x = Number(n);
  if (!Number.isFinite(x)) return 'Da inserire';
  return fmtEuro(x);
}

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, day] = s.split('-');
    return `${day}/${m}/${y}`;
  }
  return String(d);
}

function ellipsize(s, max) {
  const t = s == null ? '' : String(s);
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function commissionTypeLabel(t) {
  if (t === 'PARTNER') return 'Partner';
  if (t === 'SPORTELLO_AMICO') return 'Sportello Amico';
  return 'Segnalatore';
}

function commissionListStatusLabel(status) {
  if (status === 'LIQUIDATA') return 'Liquidata';
  if (status === 'VALORIZZATA') return 'Valorizzata';
  return 'Da valorizzare';
}

/**
 * @param {object} opts
 * @param {object[]} opts.rows
 * @param {object} opts.summary
 * @param {'admin'|'struttura'} opts.role
 * @param {import('http').ServerResponse} res
 */
function pipeCommissionsListPdf(opts, res) {
  const { rows, summary, role } = opts;
  const isAdmin = role === 'admin';

  const doc = new PDFDocument({
    margin: 36,
    size: 'A4',
    layout: 'landscape',
    info: {
      Title: isAdmin ? 'Provvigioni' : 'Le tue provvigioni',
      Author: 'FIMASS',
    },
  });

  const stamp = new Date().toLocaleString('it-IT');
  const filenameSlug = `provvigioni-${new Date().toISOString().slice(0, 10)}`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameSlug}.pdf"`);
  doc.pipe(res);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = 36;
  const usableW = pageW - margin * 2;
  let y = margin;

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text(isAdmin ? 'Provvigioni' : 'Le tue provvigioni', margin, y);
  y += 22;
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Generato il ${stamp}`, margin, y);
  y += 28;

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155');
  const summParts = [
    `Polizze: ${summary.totale_polizze}`,
    `Totale premi: ${fmtEuro(summary.totale_premi)}`,
  ];
  if (isAdmin && summary.totale_provigioni_broker != null) {
    summParts.push(`Tot. provv. broker: ${fmtEuro(summary.totale_provigioni_broker)}`);
  }
  if (isAdmin && summary.totale_sportello_amico != null) {
    summParts.push(`Quota S.A. (65%): ${fmtEuro(summary.totale_sportello_amico)}`);
  }
  summParts.push(`Totale provvigioni strutture: ${fmtEuro(summary.totale_provigioni_strutture)}`);
  doc.text(summParts.join('   ·   '), margin, y, { width: usableW });
  y += 22;

  /** @type {{ header: string; w: number; cell: (r: object) => string }[]} */
  const cols = isAdmin
    ? [
        { header: 'Data', w: 0.065, cell: (r) => fmtDate(r.date) },
        { header: 'Cliente', w: 0.11, cell: (r) => ellipsize(r.customer_name, 26) },
        { header: 'N. polizza', w: 0.08, cell: (r) => ellipsize(r.policy_number, 16) },
        { header: 'Struttura', w: 0.1, cell: (r) => ellipsize(r.structure_name || '—', 20) },
        { header: 'Portale', w: 0.065, cell: (r) => ellipsize(r.portal || '—', 12) },
        { header: 'Compagnia', w: 0.07, cell: (r) => ellipsize(r.company || '—', 14) },
        { header: 'Premio', w: 0.08, cell: (r) => fmtEuro(r.policy_premium) },
        { header: 'Fatt. cliente', w: 0.07, cell: (r) => fmtEuro(r.client_invoice) },
        { header: 'Prov. broker', w: 0.07, cell: (r) => fmtCommissionAmountEuro(r.provvigioni_broker ?? r.broker_commission) },
        { header: 'Quota S.A.', w: 0.065, cell: (r) => fmtCommissionAmountEuro(r.sportello_amico_commission) },
        { header: 'Tipo', w: 0.055, cell: (r) => commissionTypeLabel(r.structure_commission_type) },
        { header: '%', w: 0.035, cell: (r) => `${r.structure_commission_percentage ?? '—'}%` },
        { header: 'Prov. struttura', w: 0.075, cell: (r) => fmtCommissionAmountEuro(r.structure_commission_amount) },
        { header: 'Stato', w: 0.065, cell: (r) => commissionListStatusLabel(r.commission_status) },
      ]
    : [
        { header: 'Data', w: 0.1, cell: (r) => fmtDate(r.date) },
        { header: 'Cliente', w: 0.2, cell: (r) => ellipsize(r.customer_name, 36) },
        { header: 'N. polizza', w: 0.12, cell: (r) => ellipsize(r.policy_number, 18) },
        { header: 'Portale', w: 0.1, cell: (r) => ellipsize(r.portal || '—', 14) },
        { header: 'Compagnia', w: 0.12, cell: (r) => ellipsize(r.company || '—', 18) },
        { header: 'Premio', w: 0.12, cell: (r) => fmtEuro(r.policy_premium) },
        { header: 'Tipo', w: 0.08, cell: (r) => commissionTypeLabel(r.structure_commission_type) },
        { header: 'La tua provvigione', w: 0.14, cell: (r) => fmtCommissionAmountEuro(r.structure_commission_amount) },
        { header: 'Stato', w: 0.07, cell: (r) => commissionListStatusLabel(r.commission_status) },
      ];

  const rawWs = cols.map((c) => c.w);
  const wSum = rawWs.reduce((a, b) => a + b, 0);
  const widths = rawWs.map((w) => Math.floor((usableW * w) / wSum));
  const widthSlack = usableW - widths.reduce((a, b) => a + b, 0);
  if (widths.length) widths[widths.length - 1] += widthSlack;
  const rowH = 14;
  const headerH = 16;
  const bottomLimit = pageH - margin;

  function ensureSpace(need) {
    if (y + need <= bottomLimit) return false;
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
    y = margin;
    return true;
  }

  function drawHeaderRow() {
    let x = margin;
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e293b');
    for (let i = 0; i < cols.length; i += 1) {
      doc.text(cols[i].header, x, y, { width: widths[i], lineBreak: false });
      x += widths[i];
    }
    y += headerH;
    doc
      .strokeColor('#cbd5e1')
      .lineWidth(0.5)
      .moveTo(margin, y - 4)
      .lineTo(margin + usableW, y - 4)
      .stroke();
  }

  if (!rows.length) {
    doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Nessuna provvigione con i filtri selezionati.', margin, y);
    doc.end();
    return;
  }

  ensureSpace(headerH + 6);
  drawHeaderRow();

  doc.font('Helvetica').fillColor('#334155');
  for (const r of rows) {
    if (ensureSpace(rowH + 2)) drawHeaderRow();
    let x = margin;
    doc.fontSize(6.5);
    for (let i = 0; i < cols.length; i += 1) {
      try {
        doc.text(String(cols[i].cell(r) ?? '—'), x, y, { width: widths[i], lineBreak: false });
      } catch {
        doc.text('—', x, y, { width: widths[i], lineBreak: false });
      }
      x += widths[i];
    }
    y += rowH;
  }

  doc.end();
}

module.exports = { pipeCommissionsListPdf };
