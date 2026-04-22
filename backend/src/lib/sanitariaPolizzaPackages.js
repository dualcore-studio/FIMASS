const fs = require('fs');
const path = require('path');

const PACKAGES_PATH = path.join(__dirname, '..', '..', '..', 'shared', 'sanitariaPolizzaPackages.json');

let cached;

function loadPackages() {
  if (cached) return cached;
  const raw = fs.readFileSync(PACKAGES_PATH, 'utf8');
  cached = JSON.parse(raw);
  if (!Array.isArray(cached)) throw new Error('sanitariaPolizzaPackages: formato non valido');
  return cached;
}

function getSanitariaPackageByCodice(codice) {
  if (codice == null || codice === '') return null;
  const s = String(codice).trim();
  return loadPackages().find((p) => p && p.codice === s) || null;
}

function canonicalPacchettoSanitariaSnapshot(pkg) {
  return {
    codice: pkg.codice,
    nome: pkg.nome,
    premio_starting_euro: pkg.premio_starting_euro,
    pdf_file: pkg.pdf_file,
    eta_ingresso_max: pkg.eta_ingresso_max,
    highlights: Array.isArray(pkg.highlights) ? [...pkg.highlights] : [],
    pacchetto_predefinito: true,
  };
}

module.exports = {
  loadPackages,
  getSanitariaPackageByCodice,
  canonicalPacchettoSanitariaSnapshot,
};
