const path = require('path');
const PDFDocument = require('pdfkit');

// eslint-disable-next-line import/no-dynamic-require, global-require
const RC_AUTO_GUARANTEE_FIELDS = require(path.join(__dirname, '..', '..', '..', 'shared', 'rcAutoGuaranteeFields.json'));
const RC_AUTO_GUARANTEE_KEY_SET = new Set(Object.keys(RC_AUTO_GUARANTEE_FIELDS));

const COL = {
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  rule: '#d1d5db',
  totalBg: '#f1f5f9',
};

const PRIVACY =
  'Il presente documento ha finalità informativa e riepilogativa dei dati trasmessi e delle garanzie selezionate. Il trattamento dei dati personali avviene nel rispetto della normativa vigente in materia di protezione dei dati personali.';

const INTERMEDIATION =
  "Il servizio di intermediazione assicurativa di FIMASS by Sportello Amico è gestito da Tuo Broker srls, Broker Assicurativo regolamentato dall'IVASS ed iscritto al RUI in data 16/02/2021 con numero B000677151 consultabile sul Registro Unico Intermediari • P.IVA 16028461008 • PEC pectuobroker@pec.it";

const VEICOLO_KEYS = [
  'targa',
  'tipo_veicolo',
  'marca',
  'modello',
  'alimentazione',
  'kw',
  'anno_immatricolazione',
  'valore_veicolo',
  'tipo_guida',
  'classe_cu',
  'attestato_rischio',
  'massimale_rc',
  'tipologia_preventivo_rc',
  'proprietario_diverso',
];

function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Sì' : 'No';
  if (Array.isArray(val)) return val.map((v) => formatValue(v)).join(', ');
  return String(val);
}

function formatEuro(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(x);
}

function formatDateTimeIt(val) {
  if (val == null || val === '') return '—';
  const d = new Date(val);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  }
  return String(val);
}

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelForCampo(typeRow, key) {
  const raw = typeRow?.campi_specifici;
  let campi = raw;
  if (typeof raw === 'string') {
    try {
      campi = JSON.parse(raw);
    } catch {
      campi = null;
    }
  }
  if (!Array.isArray(campi)) return humanizeKey(key);
  const found = campi.find((c) => c && c.nome === key);
  return (found && found.label) || humanizeKey(key);
}

function pageContentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function drawRule(doc) {
  const x0 = doc.page.margins.left;
  const x1 = doc.page.width - doc.page.margins.right;
  const y = doc.y;
  doc.save();
  doc.strokeColor(COL.rule).lineWidth(0.35).moveTo(x0, y).lineTo(x1, y).stroke();
  doc.restore();
  doc.moveDown(0.35);
}

function sectionTitle(doc, title) {
  doc.moveDown(0.35);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COL.ink).text(title, { align: 'left' });
  doc.moveDown(0.15);
  drawRule(doc);
  doc.font('Helvetica').fillColor(COL.body);
}

/**
 * Genera PDF riepilogo RC Auto (senza logo) su stream Writable o Buffer callback.
 * @param {object} params
 * @param {object} params.quote — enrichQuote
 * @param {object} params.typeRow — riga insurance_types da ctx
 * @param {{ pricingBreakdown: { nome: string; prezzo: number }[]; totalPrice: number; notes: string | null; elaboratedAt: string }} params.elaborazione
 * @param {import('stream').Writable | null} params.dest — se null, raccoglie in Buffer
 * @returns {Promise<Buffer | void>}
 */
function pipeRcAutoRiepilogoPdf({ quote, typeRow, elaborazione, dest }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 48,
      size: 'A4',
      info: {
        Title: `Preventivo RC Auto — ${quote.numero || quote.id}`,
        Author: 'Portale preventivi',
      },
    });

    const chunks = [];
    if (dest) {
      doc.pipe(dest);
    } else {
      doc.on('data', (c) => chunks.push(c));
    }

    doc.on('error', reject);
    doc.on('end', () => {
      if (!dest) resolve(Buffer.concat(chunks));
      else resolve();
    });

    const contentW = pageContentWidth(doc);

    doc.fontSize(18).font('Helvetica-Bold').fillColor(COL.ink).text('Preventivo RC Auto', { align: 'center' });
    doc.moveDown(0.25);
    doc.fontSize(12).font('Helvetica').fillColor(COL.muted).text(`Pratica / preventivo n. ${quote.numero || quote.id}`, {
      align: 'center',
    });
    doc.moveDown(0.15);
    doc
      .fontSize(9)
      .fillColor(COL.muted)
      .text(`Data elaborazione: ${formatDateTimeIt(elaborazione.elaboratedAt)}`, { align: 'center', width: contentW });
    doc.moveDown(0.6);

    sectionTitle(doc, 'Contraente / assistito');
    const nome = [quote.assistito_nome, quote.assistito_cognome].filter(Boolean).join(' ').trim() || '—';
    doc.fontSize(10).text(`Nome: ${nome}`, { lineGap: 4 });
    doc.text(`Codice fiscale: ${formatValue(quote.assistito_cf)}`, { lineGap: 4 });
    doc.text(`Data di nascita: ${formatValue(quote.assistito_data_nascita)}`, { lineGap: 4 });
    const indirizzo = [quote.assistito_indirizzo, quote.assistito_cap, quote.assistito_citta].filter(Boolean).join(' — ');
    if (indirizzo) doc.text(`Indirizzo: ${indirizzo}`, { lineGap: 4 });
    doc.text(`Cellulare: ${formatValue(quote.assistito_cellulare)}`, { lineGap: 4 });
    doc.text(`Email: ${formatValue(quote.assistito_email)}`, { lineGap: 4 });

    const ds = quote.dati_specifici && typeof quote.dati_specifici === 'object' ? quote.dati_specifici : {};
    const veicoloLines = [];
    for (const k of VEICOLO_KEYS) {
      if (k === 'garanzie_selezionate' || k === 'garanzie_richieste') continue;
      if (RC_AUTO_GUARANTEE_KEY_SET.has(k)) continue;
      if (ds[k] !== undefined && ds[k] !== null && String(ds[k]).trim() !== '') {
        veicoloLines.push({ k, v: ds[k] });
      }
    }
    if (veicoloLines.length > 0) {
      sectionTitle(doc, 'Dati veicolo e coperture richieste');
      for (const { k, v } of veicoloLines) {
        const lab = labelForCampo(typeRow, k);
        doc.fontSize(10).text(`${lab}: ${formatValue(v)}`, { lineGap: 3 });
      }
    }

    sectionTitle(doc, 'Garanzie e premi');
    const rows = Array.isArray(elaborazione.pricingBreakdown) ? elaborazione.pricingBreakdown : [];
    if (rows.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor(COL.muted).text('Nessuna garanzia selezionata nella richiesta.', {
        lineGap: 4,
      });
      doc.fillColor(COL.body).font('Helvetica');
    } else {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COL.muted);
      doc.text('Garanzia', doc.page.margins.left, doc.y, { width: contentW * 0.62, continued: true });
      doc.text('Premio', { align: 'right' });
      doc.font('Helvetica').fillColor(COL.body);
      doc.moveDown(0.2);
      for (const r of rows) {
        doc.fontSize(10).text(r.nome || '—', doc.page.margins.left, doc.y, { width: contentW * 0.62, continued: true });
        doc.text(formatEuro(r.prezzo), { align: 'right' });
        doc.moveDown(0.15);
      }
    }

    doc.moveDown(0.35);
    const totY = doc.y;
    doc.roundedRect(doc.page.margins.left, totY, contentW, 36, 4).fill(COL.totalBg);
    doc.fillColor(COL.ink);
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Totale', doc.page.margins.left + 12, totY + 11, { width: contentW - 24, continued: true });
    doc.text(formatEuro(elaborazione.totalPrice), { align: 'right' });
    doc.y = totY + 40;

    if (elaborazione.notes && String(elaborazione.notes).trim()) {
      sectionTitle(doc, 'Note');
      doc.font('Helvetica').fontSize(10).fillColor(COL.body).text(String(elaborazione.notes).trim(), {
        lineGap: 4,
      });
    }

    doc.moveDown(1.25);
    drawRule(doc);
    doc.moveDown(0.65);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COL.muted).text('Note informative', { align: 'left' });
    doc.moveDown(0.45);
    doc.fontSize(8).font('Helvetica').fillColor(COL.body).text(PRIVACY, {
      lineGap: 4,
      align: 'justify',
      width: contentW,
    });
    doc.moveDown(0.85);
    doc.fontSize(8).font('Helvetica').fillColor(COL.body).text(INTERMEDIATION, {
      lineGap: 4,
      align: 'justify',
      width: contentW,
    });
    doc.moveDown(0.5);

    doc.end();
  });
}

module.exports = { pipeRcAutoRiepilogoPdf, PRIVACY, INTERMEDIATION };
