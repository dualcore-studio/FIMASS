const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

function bootstrapDatabaseIfEmpty() {
  const existingAdmin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (existingAdmin) return;

  const hash = (value) => bcrypt.hashSync(value, 10);

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, role, nome, cognome, denominazione, email, stato, enabled_types)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'attivo', ?)
  `);

  const insertType = db.prepare(`
    INSERT INTO insurance_types (nome, codice, stato, ordine, campi_specifici, checklist_allegati)
    VALUES (?, ?, 'attivo', ?, ?, ?)
  `);

  const insertSetting = db.prepare(`
    INSERT INTO settings (chiave, valore) VALUES (?, ?)
  `);

  const tx = db.transaction(() => {
    insertUser.run('admin', hash('admin123'), 'admin', 'Marco', 'Rossi', null, 'admin@fimass.it', null);
    insertUser.run('supervisore1', hash('super123'), 'supervisore', 'Laura', 'Bianchi', null, 'supervisore@fimass.it', null);
    insertUser.run('operatore1', hash('oper123'), 'operatore', 'Anna', 'Ferraro', null, 'operatore@fimass.it', null);
    insertUser.run('struttura1', hash('strut123'), 'struttura', null, null, 'Agenzia Demo', 'struttura@fimass.it', JSON.stringify(['all']));

    insertType.run(
      'RC Auto / Moto / Autocarri',
      'rc_auto',
      1,
      JSON.stringify([{ nome: 'targa', label: 'Targa o Telaio', tipo: 'text', obbligatorio: true }]),
      JSON.stringify([{ nome: 'Documento Identita', obbligatorio: true }])
    );

    insertSetting.run('nome_portale', 'Fimass Sportello Amico');
    insertSetting.run('colore_primario', '#1e40af');
    insertSetting.run('colore_secondario', '#3b82f6');
  });

  tx();
  console.log('Bootstrap DB eseguito: creati utenti e dati base.');
}

module.exports = { bootstrapDatabaseIfEmpty };
