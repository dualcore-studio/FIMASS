const fs = require('fs');
const path = require('path');

const PACKAGES_PATH = path.join(__dirname, '..', '..', '..', 'shared', 'casaPolizzaPackages.json');

let cached;

function loadPackages() {
  if (cached) return cached;
  const raw = fs.readFileSync(PACKAGES_PATH, 'utf8');
  cached = JSON.parse(raw);
  if (!Array.isArray(cached)) throw new Error('casaPolizzaPackages: formato non valido');
  return cached;
}

function getCasaPackageById(id) {
  if (id == null || id === '') return null;
  const sid = String(id).trim();
  return loadPackages().find((p) => p && p.id === sid) || null;
}

function canonicalPacchettoSnapshot(pkg) {
  return {
    id: pkg.id,
    nome: pkg.nome,
    premio_finale_euro: pkg.premio_finale_euro,
    righe: Array.isArray(pkg.righe) ? pkg.righe.map((r) => ({ label: r.label, valore: r.valore })) : [],
    da_pacchetto_predefinito: true,
  };
}

module.exports = {
  loadPackages,
  getCasaPackageById,
  canonicalPacchettoSnapshot,
};
