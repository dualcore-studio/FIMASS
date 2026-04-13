const bcrypt = require('bcryptjs');
const { findOne, insert } = require('../data/store');
const { isInstantConfigured } = require('../lib/instantdb');

async function bootstrapDatabaseIfEmpty() {
  if (!isInstantConfigured()) {
    console.warn('InstantDB non configurato: bootstrap saltato.');
    return;
  }
  const existingAdmin = await findOne('users', (u) => u.username === 'admin');
  if (existingAdmin) return;

  const hash = (value) => bcrypt.hashSync(value, 10);

  await insert('users', { username: 'admin', password: hash('admin123'), role: 'admin', nome: 'Marco', cognome: 'Rossi', denominazione: null, email: 'admin@fimass.it', stato: 'attivo', enabled_types: null });
  await insert('users', { username: 'supervisore1', password: hash('super123'), role: 'supervisore', nome: 'Laura', cognome: 'Bianchi', denominazione: null, email: 'supervisore@fimass.it', stato: 'attivo', enabled_types: null });
  await insert('users', { username: 'operatore1', password: hash('oper123'), role: 'operatore', nome: 'Anna', cognome: 'Ferraro', denominazione: null, email: 'operatore@fimass.it', stato: 'attivo', enabled_types: null });
  await insert('users', { username: 'struttura1', password: hash('strut123'), role: 'struttura', nome: null, cognome: null, denominazione: 'Agenzia Demo', email: 'struttura@fimass.it', stato: 'attivo', enabled_types: ['all'], commission_type: 'SEGNALATORE' });
  await insert('insurance_types', {
    nome: 'RC Auto / Moto / Autocarri',
    codice: 'rc_auto',
    stato: 'attivo',
    ordine: 1,
    descrizione: null,
    campi_specifici: [{ nome: 'targa', label: 'Targa o Telaio', tipo: 'text', obbligatorio: true }],
    checklist_allegati: [{ nome: 'Documento Identita', obbligatorio: true }],
  });
  await insert('settings', { chiave: 'nome_portale', valore: 'Fimass Sportello Amico' });
  console.log('Bootstrap DB eseguito: creati utenti e dati base.');
}

module.exports = { bootstrapDatabaseIfEmpty };
