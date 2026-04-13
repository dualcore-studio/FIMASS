/** @param {any} t */
function isInsuranceTypeActive(t) {
  const s = t?.stato;
  if (s == null || s === '') return true;
  return String(s).toLowerCase().trim() === 'attivo';
}

function asJsonArray(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

const ALLOWED_FIELD_TYPES = new Set([
  'text', 'number', 'date', 'select', 'boolean', 'textarea', 'radio',
  'multiselect', 'heading', 'info',
]);

function normalizeCampo(raw, index) {
  const nome = String(raw?.nome || '').trim();
  const label = String(raw?.label || '').trim();
  const tipo = String(raw?.tipo || 'text').trim();
  const safeTipo = ALLOWED_FIELD_TYPES.has(tipo) ? tipo : 'text';
  const obbligatorio = Boolean(raw?.obbligatorio);
  const placeholder = raw?.placeholder != null && String(raw.placeholder).trim() !== ''
    ? String(raw.placeholder)
    : null;
  let opzioni = Array.isArray(raw?.opzioni) ? raw.opzioni.map((o) => String(o)) : [];
  if (opzioni.length === 0 && typeof raw?.opzioni === 'string' && raw.opzioni.trim()) {
    opzioni = raw.opzioni.split(/[,|\n]/).map((s) => s.trim()).filter(Boolean);
  }
  const ordine = raw?.ordine != null && raw.ordine !== '' ? Number(raw.ordine) : index;
  let stato = String(raw?.stato || 'attivo').toLowerCase().trim();
  if (stato !== 'attivo' && stato !== 'disattivo') stato = 'attivo';
  const condizione = raw?.condizione != null && String(raw.condizione).trim() !== ''
    ? String(raw.condizione).trim()
    : null;
  const out = {
    nome,
    label,
    tipo: safeTipo,
    obbligatorio,
    ...(placeholder ? { placeholder } : {}),
    ...(opzioni.length ? { opzioni } : {}),
    ordine: Number.isFinite(ordine) ? ordine : index,
    stato,
  };
  if (condizione) out.condizione = condizione;
  return out;
}

function normalizeChecklistItem(raw, index) {
  const nome = String(raw?.nome || '').trim();
  const descrizione = raw?.descrizione != null && String(raw.descrizione).trim() !== ''
    ? String(raw.descrizione).trim()
    : null;
  const obbligatorio = Boolean(raw?.obbligatorio);
  const condizione = raw?.condizione != null && String(raw.condizione).trim() !== ''
    ? String(raw.condizione).trim()
    : null;
  const ordine = raw?.ordine != null && raw.ordine !== '' ? Number(raw.ordine) : index;
  let stato = String(raw?.stato || 'attivo').toLowerCase().trim();
  if (stato !== 'attivo' && stato !== 'disattivo') stato = 'attivo';
  const sezione = raw?.sezione != null && String(raw.sezione).trim() !== ''
    ? String(raw.sezione).trim()
    : null;
  const out = {
    nome,
    obbligatorio,
    ordine: Number.isFinite(ordine) ? ordine : index,
    stato,
  };
  if (descrizione) out.descrizione = descrizione;
  if (condizione) out.condizione = condizione;
  if (sezione) out.sezione = sezione;
  return out;
}

function normalizeCampiSpecifici(arr) {
  const list = asJsonArray(arr, []);
  return list.map((c, i) => normalizeCampo(c, i)).filter((c) => c.nome && c.label);
}

function normalizeChecklistAllegati(arr) {
  const list = asJsonArray(arr, []);
  return list.map((c, i) => normalizeChecklistItem(c, i)).filter((c) => c.nome);
}

function mapInsuranceTypeRow(t) {
  return {
    ...t,
    descrizione: t.descrizione != null ? String(t.descrizione) : null,
    campi_specifici: asJsonArray(t.campi_specifici, []),
    checklist_allegati: asJsonArray(t.checklist_allegati, []),
  };
}

/**
 * Struttura: controlla se il codice tipologia è tra quelli abilitati.
 * @param {{ enabled_types?: any, role?: string }} user
 * @param {string} codice
 */
function strutturaCanUseInsuranceType(user, codice) {
  if (!user || user.role !== 'struttura') return true;
  let enabledTypes = user.enabled_types;
  try {
    enabledTypes = typeof enabledTypes === 'string' ? JSON.parse(enabledTypes) : enabledTypes;
  } catch {
    enabledTypes = null;
  }
  if (!Array.isArray(enabledTypes) || enabledTypes.length === 0) return true;
  const normalized = enabledTypes.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0 || normalized.includes('all')) return true;
  const cod = String(codice || '').trim().toLowerCase();
  return normalized.includes(cod);
}

module.exports = {
  isInsuranceTypeActive,
  asJsonArray,
  normalizeCampiSpecifici,
  normalizeChecklistAllegati,
  mapInsuranceTypeRow,
  strutturaCanUseInsuranceType,
  ALLOWED_FIELD_TYPES,
};
