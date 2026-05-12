/**
 * Export PDF elenco provvigioni: layout “moderno energico” (KPI a card, tabella zebrata,
 * provvigioni in badge ambra) implementato con **PDFKit** — nessun browser/Chromium richiesto.
 */

const PDFDocument = require('pdfkit');

const COLORS = {
  blue: { fill: '#e6f1fb', border: '#85b7eb', text: '#185fa5' },
  green: { fill: '#eaf3de', border: '#97c459', text: '#3b6d11' },
  amber: { fill: '#faeeda', border: '#ef9f27', text: '#854f0b' },
  headerBg: '#f1f5f9',
  zebra: '#fafaf8',
  white: '#ffffff',
  border: '#e5e5e0',
  muted: '#64748b',
  ink: '#334155',
  title: '#0f172a',
};

function fmtEuro(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(x);
}

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
  if (t === 'PARTNER') return 'Collaboratore IVASS';
  if (t === 'SPORTELLO_AMICO') return 'Sportello Amico';
  return 'Segnalatore';
}

function commissionListStatusLabel(status) {
  if (status === 'LIQUIDATA') return 'Liquidata';
  if (status === 'VALORIZZATA') return 'Valorizzata';
  return 'Da valorizzare';
}

/** Rettangolo con angoli arrotondati (path Bezier), compatibile PDFKit. */
function fillRoundedRect(doc, x, y, w, h, r, fillColor) {
  const rad = Math.min(r, w / 2, h / 2);
  doc.save();
  doc.moveTo(x + rad, y)
    .lineTo(x + w - rad, y)
    .quadraticCurveTo(x + w, y, x + w, y + rad)
    .lineTo(x + w, y + h - rad)
    .quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
    .lineTo(x + rad, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - rad)
    .lineTo(x, y + rad)
    .quadraticCurveTo(x, y, x + rad, y)
    .closePath();
  doc.fillColor(fillColor).fill();
  doc.restore();
}

function strokeRoundedRect(doc, x, y, w, h, r, strokeColor, lineWidth = 2) {
  const rad = Math.min(r, w / 2, h / 2);
  doc.save();
  doc.moveTo(x + rad, y)
    .lineTo(x + w - rad, y)
    .quadraticCurveTo(x + w, y, x + w, y + rad)
    .lineTo(x + w, y + h - rad)
    .quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
    .lineTo(x + rad, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - rad)
    .lineTo(x, y + rad)
    .quadraticCurveTo(x, y, x + rad, y)
    .closePath();
  doc.strokeColor(strokeColor).lineWidth(lineWidth).stroke();
  doc.restore();
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

  const stamp =
    typeof opts.timestamp === 'string' && opts.timestamp.trim() !== ''
      ? opts.timestamp.trim()
      : new Date().toLocaleString('it-IT');
  const filenameSlug = `provvigioni-${new Date().toISOString().slice(0, 10)}`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameSlug}.pdf"`);
  doc.pipe(res);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = 36;
  const usableW = pageW - margin * 2;
  let y = margin;

  const titleText = isAdmin ? 'Provvigioni' : 'Le tue provvigioni';

  doc.fontSize(20).font('Helvetica-Bold').fillColor(COLORS.title).text(titleText, margin, y);
  y += 24;

  const barY = y;
  const seg = 18;
  const segH = 3;
  doc.rect(margin, barY, seg, segH).fill('#185fa5');
  doc.rect(margin + seg, barY, seg, segH).fill('#3b6d11');
  doc.rect(margin + seg * 2, barY, seg, segH).fill('#ef9f27');
  y += segH + 18;

  /* KPI cards */
  const gap = 16;
  const cardH = 76;
  const cardW = (usableW - gap * 2) / 3;
  const cards = [
    {
      label: 'POLIZZE',
      value: String(summary.totale_polizze ?? 0),
      ...COLORS.blue,
      isMoney: false,
    },
    {
      label: 'PREMI TOTALI',
      value: fmtEuro(summary.totale_premi),
      ...COLORS.green,
      isMoney: true,
    },
    {
      label: 'PROVVIGIONI',
      value: fmtEuro(summary.totale_provigioni_strutture),
      ...COLORS.amber,
      isMoney: true,
    },
  ];

  for (let i = 0; i < 3; i += 1) {
    const cx = margin + i * (cardW + gap);
    const c = cards[i];
    fillRoundedRect(doc, cx, y, cardW, cardH, 8, c.fill);
    strokeRoundedRect(doc, cx, y, cardW, cardH, 8, c.border, 2);
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(c.text)
      .text(c.label, cx + 16, y + 16, { width: cardW - 32 });
    doc
      .fontSize(c.isMoney ? 16 : 20)
      .font('Helvetica-Bold')
      .fillColor(c.text)
      .text(c.value, cx + 16, y + 36, { width: cardW - 32 });
  }
  y += cardH + 14;

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(COLORS.muted)
    .text(`Generato il ${stamp}`, margin, y);
  y += 22;

  if (
    isAdmin &&
    (summary.totale_provigioni_broker != null || summary.totale_sportello_amico != null)
  ) {
    const parts = [
      `Tot. provv. broker: ${fmtEuro(summary.totale_provigioni_broker)}`,
      `Quota S.A.: ${fmtEuro(summary.totale_sportello_amico)}`,
    ];
    doc
      .fontSize(8.5)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(parts.join('   ·   '), margin, y, { width: usableW });
    y += 18;
  }

  /** @type {{ header: string; w: number; cell: (r: object) => string; align?: string; mono?: boolean; badge?: boolean }[]} */
  const cols = isAdmin
    ? [
        { header: 'Data', w: 0.065, cell: (r) => fmtDate(r.date) },
        { header: 'Cliente', w: 0.1, cell: (r) => ellipsize(r.customer_name, 22) },
        { header: 'N. polizza', w: 0.075, cell: (r) => ellipsize(r.policy_number, 14), mono: true },
        { header: 'Struttura', w: 0.09, cell: (r) => ellipsize(r.structure_name || '—', 18) },
        { header: 'Portale', w: 0.055, cell: (r) => ellipsize(r.portal || '—', 10) },
        { header: 'Compagnia', w: 0.065, cell: (r) => ellipsize(r.company || '—', 12) },
        { header: 'Premio', w: 0.075, cell: (r) => fmtEuro(r.policy_premium), align: 'right' },
        { header: 'Fatt.', w: 0.06, cell: (r) => fmtEuro(r.client_invoice), align: 'right' },
        {
          header: 'Pr.bro',
          w: 0.065,
          cell: (r) => fmtCommissionAmountEuro(r.provvigioni_broker ?? r.broker_commission),
          align: 'right',
        },
        {
          header: 'S.A.',
          w: 0.055,
          cell: (r) => fmtCommissionAmountEuro(r.sportello_amico_commission),
          align: 'right',
        },
        { header: 'Tipo', w: 0.085, cell: (r) => ellipsize(commissionTypeLabel(r.structure_commission_type), 16) },
        {
          header: 'Pr.str',
          w: 0.075,
          cell: (r) => fmtCommissionAmountEuro(r.structure_commission_amount),
          align: 'right',
          badge: true,
        },
        {
          header: 'Stato',
          w: 0.058,
          cell: (r) => commissionListStatusLabel(r.commission_status),
        },
      ]
    : [
        { header: 'Data', w: 0.065, cell: (r) => fmtDate(r.date) },
        { header: 'Cliente', w: 0.13, cell: (r) => ellipsize(r.customer_name, 28) },
        { header: 'N. polizza', w: 0.1, cell: (r) => ellipsize(r.policy_number, 16), mono: true },
        { header: 'Portale', w: 0.08, cell: (r) => ellipsize(r.portal || '—', 12) },
        { header: 'Compagnia', w: 0.095, cell: (r) => ellipsize(r.company || '—', 14) },
        { header: 'Premio', w: 0.085, cell: (r) => fmtEuro(r.policy_premium), align: 'right' },
        {
          header: 'Provvigione',
          w: 0.135,
          cell: (r) => fmtCommissionAmountEuro(r.structure_commission_amount),
          align: 'right',
          badge: true,
        },
        {
          header: 'Tipo',
          w: 0.11,
          cell: (r) => ellipsize(commissionTypeLabel(r.structure_commission_type), 22),
        },
        {
          header: 'Stato',
          w: 0.072,
          cell: (r) => commissionListStatusLabel(r.commission_status),
        },
      ];

  const rawWs = cols.map((c) => c.w);
  const wSum = rawWs.reduce((a, b) => a + b, 0);
  const widths = rawWs.map((w) => Math.floor((usableW * w) / wSum));
  const widthSlack = usableW - widths.reduce((a, b) => a + b, 0);
  if (widths.length) widths[widths.length - 1] += widthSlack;

  const headerH = isAdmin ? 18 : 22;
  const rowH = isAdmin ? 16 : 22;
  const bottomLimit = pageH - margin - 28;

  function ensureSpace(need) {
    if (y + need <= bottomLimit) return false;
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
    y = margin;
    return true;
  }

  function drawHeaderRow() {
    doc.save();
    doc.rect(margin, y, usableW, headerH).fill(COLORS.headerBg);
    let x = margin;
    doc.fontSize(isAdmin ? 6.5 : 8).font('Helvetica-Bold').fillColor('#0f172a');
    for (let i = 0; i < cols.length; i += 1) {
      const align = cols[i].align === 'right' ? 'right' : 'left';
      doc.text(cols[i].header, x + (align === 'right' ? 0 : 4), y + 5, {
        width: widths[i] - 8,
        align,
      });
      x += widths[i];
    }
    doc.restore();
    y += headerH;
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(margin, y)
      .lineTo(margin + usableW, y)
      .stroke();
  }

  function drawTableFooter() {
    ensureSpace(20);
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8');
    doc.text(`FIMASS · Sezione provvigioni · ${rows.length} righe in elenco`, margin, y, {
      width: usableW,
    });
    y += 12;
  }

  if (!rows.length) {
    ensureSpace(100);
    const boxH = 48;
    fillRoundedRect(doc, margin, y, usableW, boxH, 8, '#f8fafc');
    strokeRoundedRect(doc, margin, y, usableW, boxH, 8, '#e2e8f0', 1);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#64748b')
      .text('Nessuna provvigione con i filtri selezionati.', margin + 20, y + 16, { width: usableW - 40 });
    y += boxH;
    drawTableFooter();
    doc.end();
    return;
  }

  ensureSpace(headerH + rowH * 3);
  drawHeaderRow();

  for (let ri = 0; ri < rows.length; ri += 1) {
    const r = rows[ri];
    if (ensureSpace(rowH + 4)) drawHeaderRow();

    const zebra = ri % 2 === 1 ? COLORS.zebra : COLORS.white;
    doc.rect(margin, y, usableW, rowH).fill(zebra);

    let x = margin;
    const fs = isAdmin ? 7 : 9;
    const textMid = y + (rowH - fs) * 0.35 + fs * 0.85;

    for (let i = 0; i < cols.length; i += 1) {
      const col = cols[i];
      let txt;
      try {
        txt = String(col.cell(r) ?? '—');
      } catch {
        txt = '—';
      }

      doc.font(col.mono ? 'Courier' : 'Helvetica');
      if (col.badge) {
        doc.fontSize(fs).font('Helvetica-Bold');
        const tw = Math.min(doc.widthOfString(txt) + 14, widths[i] - 6);
        const bh = rowH - 6;
        const bx = x + Math.max(0, widths[i] - tw - 4);
        const by = y + 3;
        fillRoundedRect(doc, bx, by, tw, bh, 6, COLORS.amber.fill);
        strokeRoundedRect(doc, bx, by, tw, bh, 6, COLORS.amber.border, 1);
        const badgeBaseline = by + bh / 2 + fs * 0.28;
        doc
          .fillColor(COLORS.amber.text)
          .fontSize(fs)
          .font('Helvetica-Bold')
          .text(txt, bx + 7, badgeBaseline, { width: tw - 14, align: 'center', lineBreak: false });
      } else {
        doc.fontSize(fs).font(col.mono ? 'Courier' : 'Helvetica').fillColor(COLORS.ink);
        const align = col.align === 'right' ? 'right' : 'left';
        doc.text(txt, x + (align === 'right' ? 0 : 4), textMid, {
          width: widths[i] - 8,
          align,
        });
      }
      x += widths[i];
    }
    y += rowH;
  }

  drawTableFooter();
  doc.end();
}

module.exports = { pipeCommissionsListPdf };
