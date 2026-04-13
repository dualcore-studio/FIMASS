/**
 * Sincronizza campi_specifici, checklist_allegati e stato delle tipologie assicurative
 * con le definizioni in lib/insuranceTypeSeedData.js.
 *
 * Esecuzione: dalla cartella backend → node src/migrations/sync-insurance-type-forms.js
 */
const { db, initializeDatabase } = require('../config/database');
const { INSURANCE_TYPES_FORM_DEFINITIONS } = require('../lib/insuranceTypeSeedData');

initializeDatabase();

const stmt = db.prepare(
  'UPDATE insurance_types SET campi_specifici = @campi, checklist_allegati = @allegati, stato = @stato, updated_at = datetime(\'now\') WHERE codice = @codice',
);

const tx = db.transaction(() => {
  for (const t of INSURANCE_TYPES_FORM_DEFINITIONS) {
    const r = stmt.run({
      campi: JSON.stringify(t.campi),
      allegati: JSON.stringify(t.allegati),
      stato: t.stato || 'attivo',
      codice: t.codice,
    });
    if (r.changes === 0) {
      console.warn(`Nessuna riga aggiornata per codice «${t.codice}» (tipologia assente nel DB).`);
    }
  }
});

tx();
console.log('Tipologie assicurative sincronizzate.');
