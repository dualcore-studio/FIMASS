const PDFDocument = require('pdfkit');

const CASA_RIEPILOGO_PDF_VERSION = 1;

function formatPremioIt(euro) {
  const n = Number(euro);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

/**
 * PDF riepilogo per il cliente (nessun brokeraggio / compensi / provvigioni).
 * @param {{ nome: string, premio_finale_euro: number, righe: { label: string, valore: string }[] }} pkg
 * @returns {Promise<Buffer>}
 */
function buildCasaPolizzaRiepilogoPdfBuffer(pkg) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Riepilogo Pacchetto Polizza Casa' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const w = doc.page.width - 100;

    doc.fillColor('#0c2744').fontSize(16).text('FIMASS', { align: 'left' });
    doc.moveDown(0.4);
    doc.fillColor('#64748b').fontSize(9).text('Sportello Amico', { align: 'left' });
    doc.moveDown(1.2);

    doc.fillColor('#0f172a').fontSize(14).text('Riepilogo Pacchetto Polizza Casa', { align: 'center', width: w });
    doc.moveDown(1);

    doc.fontSize(12).fillColor('#1e3a5f').text(`Pacchetto: ${pkg.nome || '—'}`, { align: 'left' });
    doc.moveDown(0.8);

    const righe = Array.isArray(pkg.righe) ? pkg.righe : [];
    doc.fontSize(10).fillColor('#0f172a');
    righe.forEach((r) => {
      const label = r.label != null ? String(r.label) : '';
      const valore = r.valore != null ? String(r.valore) : '';
      doc.text(`${label}: ${valore}`);
      doc.moveDown(0.4);
    });

    doc.moveDown(0.6);
    doc.fillColor('#1e3a5f')
      .fontSize(12)
      .text(`Premio finale: ${formatPremioIt(pkg.premio_finale_euro)}`, { align: 'left' });

    doc.moveDown(2.2);
    doc.fontSize(9).fillColor('#64748b').text(
      'Documento riepilogativo per presa visione e sottoscrizione da parte del contraente.',
      { align: 'left', width: w },
    );

    doc.moveDown(2);
    doc.fillColor('#0f172a').fontSize(10).text('Firma cliente _________________________________', { align: 'left' });
    doc.moveDown(0.8);
    doc.text('Data __________________________________________', { align: 'left' });

    doc.end();
  });
}

module.exports = { buildCasaPolizzaRiepilogoPdfBuffer, CASA_RIEPILOGO_PDF_VERSION };
