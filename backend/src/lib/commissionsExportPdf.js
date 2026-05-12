const puppeteer = require('puppeteer');
const {
  buildProvvigioniSectionPayload,
  generateProvvigioniSection,
  generateProvvigioniPdfDocumentHtml,
} = require('./provvigioniSectionHtml');

/**
 * Esporta il PDF elenco provvigioni tramite HTML + Puppeteer.
 * La sezione visiva è generata da `generateProvvigioniSection` (stile “moderno energico”),
 * così resta compatibile con altri renderer HTML→PDF (html2pdf.js, wkhtmltopdf, ecc.).
 *
 * @param {object} opts
 * @param {object[]} opts.rows
 * @param {object} opts.summary
 * @param {'admin'|'struttura'} opts.role
 * @param {import('http').ServerResponse} res
 * @returns {Promise<void>}
 */
async function pipeCommissionsListPdf(opts, res) {
  const { rows, summary, role } = opts;
  const filenameSlug = `provvigioni-${new Date().toISOString().slice(0, 10)}`;

  const payload = buildProvvigioniSectionPayload({
    rows,
    summary,
    role,
    timestamp: typeof opts.timestamp === 'string' ? opts.timestamp : undefined,
  });

  const sectionHtml = generateProvvigioniSection(payload);
  const fullHtml = generateProvvigioniPdfDocumentHtml(sectionHtml);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameSlug}.pdf"`);
    res.end(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { pipeCommissionsListPdf };
