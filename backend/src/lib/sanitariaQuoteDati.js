/**
 * Rimuove dai dati specifici i campi configurati sulla tipologia Sanitaria (garanzie manuali, boolean, ecc.)
 * quando il preventivo è legato a un pacchetto predefinito.
 */
function parseCampiSpecifici(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function editableCampoNomiFromCampi(campi) {
  return campi
    .filter(
      (f) =>
        f
        && f.nome
        && !String(f.nome).startsWith('_')
        && f.tipo !== 'heading'
        && f.tipo !== 'info',
    )
    .map((f) => String(f.nome));
}

function stripSanitariaEditableKeys(rest, insType) {
  const campi = parseCampiSpecifici(insType.campi_specifici);
  const names = editableCampoNomiFromCampi(campi);
  const out = { ...rest };
  for (const k of names) {
    if (Object.prototype.hasOwnProperty.call(out, k)) delete out[k];
  }
  return out;
}

module.exports = {
  stripSanitariaEditableKeys,
};
