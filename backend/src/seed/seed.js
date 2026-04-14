const bcrypt = require('bcryptjs');
const { db, initializeDatabase } = require('../config/database');

initializeDatabase();

// ── Idempotency guard ──────────────────────────────────────────────
// If the admin user already exists the database has been seeded before.
// Running this script a second time is a safe no-op.
const existing = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (existing) {
  console.log('Database already seeded (admin user found). Skipping.');
  console.log('To re-seed from scratch, delete the database file and run again.');
  process.exit(0);
}

console.log('Seeding database...');

const hash = (pw) => bcrypt.hashSync(pw, 10);

const insertUser = db.prepare(`
  INSERT INTO users (username, password, role, nome, cognome, denominazione, email, telefono, stato, enabled_types, last_login)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const users = [
  ['admin', hash('Bottone1'), 'admin', 'Marco', 'Rossi', null, 'admin@fimass.it', null, 'attivo', null, '2026-03-24 09:00:00'],
  ['supervisore1', hash('super123'), 'supervisore', 'Laura', 'Bianchi', null, 'l.bianchi@fimass.it', '3331234567', 'attivo', null, '2026-03-24 08:30:00'],
  ['supervisore2', hash('super123'), 'supervisore', 'Giuseppe', 'Verde', null, 'g.verde@fimass.it', '3339876543', 'attivo', null, '2026-03-23 14:00:00'],
  ['operatore1', hash('oper123'), 'operatore', 'Anna', 'Ferraro', null, 'a.ferraro@fimass.it', '3401112233', 'attivo', null, '2026-03-24 10:00:00'],
  ['operatore2', hash('oper123'), 'operatore', 'Luca', 'Martini', null, 'l.martini@fimass.it', '3402223344', 'attivo', null, '2026-03-24 11:00:00'],
  ['operatore3', hash('oper123'), 'operatore', 'Francesca', 'Conti', null, 'f.conti@fimass.it', '3403334455', 'attivo', null, '2026-03-23 16:00:00'],
  ['struttura1', hash('strut123'), 'struttura', null, null, 'Agenzia Napoli Centro', 'napoli.centro@partner.it', '0815551234', 'attivo', JSON.stringify(['all']), '2026-03-24 08:00:00'],
  ['struttura2', hash('strut123'), 'struttura', null, null, 'Sportello Roma EUR', 'roma.eur@partner.it', '0665554321', 'attivo', JSON.stringify(['rc_auto','casa','sanitaria']), '2026-03-24 09:30:00'],
  ['struttura3', hash('strut123'), 'struttura', null, null, 'Agenzia Milano Duomo', 'milano.duomo@partner.it', '0245556789', 'attivo', JSON.stringify(['all']), '2026-03-23 10:00:00'],
  ['struttura4', hash('strut123'), 'struttura', null, null, 'Sportello Torino Porta Nuova', 'torino.pn@partner.it', '0115559876', 'attivo', JSON.stringify(['rc_auto','affitto','stranieri']), '2026-03-22 11:00:00'],
];

const transaction = db.transaction(() => {
  users.forEach(u => insertUser.run(...u));
});
transaction();

console.log('Users seeded');

const { INSURANCE_TYPES_FORM_DEFINITIONS } = require('../lib/insuranceTypeSeedData');

const insertType = db.prepare(`
  INSERT INTO insurance_types (nome, codice, stato, ordine, descrizione, campi_specifici, checklist_allegati) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const typesTx = db.transaction(() => {
  INSURANCE_TYPES_FORM_DEFINITIONS.forEach((t) => insertType.run(
    t.nome,
    t.codice,
    t.stato || 'attivo',
    t.ordine,
    null,
    JSON.stringify(t.campi),
    JSON.stringify(t.allegati),
  ));
});
typesTx();

console.log('Insurance types seeded');

const insertAssisted = db.prepare(`
  INSERT INTO assisted_people (nome, cognome, data_nascita, codice_fiscale, cellulare, email, indirizzo, cap, citta, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const assistedPeople = [
  ['Mario', 'Esposito', '1985-03-15', 'SPSMRA85C15F839X', '3401234567', 'mario.esposito@email.it', 'Via Roma 45', '80100', 'Napoli', 7],
  ['Giulia', 'Romano', '1990-07-22', 'RMNGLI90L62H501T', '3402345678', 'giulia.romano@email.it', 'Via Garibaldi 12', '00142', 'Roma', 8],
  ['Paolo', 'Colombo', '1978-11-08', 'CLMPLA78S08F205K', '3403456789', 'paolo.colombo@email.it', 'Corso Buenos Aires 88', '20124', 'Milano', 9],
  ['Sara', 'Russo', '1992-01-30', 'RSSSRA92A70F839R', '3404567890', 'sara.russo@email.it', 'Via Toledo 100', '80134', 'Napoli', 7],
  ['Andrea', 'Ferrari', '1983-06-18', 'FRRNDR83H18L219Q', '3405678901', 'andrea.ferrari@email.it', 'Via Po 15', '10123', 'Torino', 10],
  ['Chiara', 'Moretti', '1995-09-25', 'MRTCHR95P65H501L', '3406789012', 'chiara.moretti@email.it', 'Via Appia 200', '00183', 'Roma', 8],
  ['Roberto', 'Rizzo', '1975-04-12', 'RZZRRT75D12F839S', '3407890123', 'roberto.rizzo@email.it', 'Via Chiaia 55', '80121', 'Napoli', 7],
  ['Valentina', 'Costa', '1988-12-05', 'CSTVNT88T45F205J', '3408901234', 'valentina.costa@email.it', 'Via Montenapoleone 3', '20121', 'Milano', 9],
  ['Francesco', 'Gallo', '1980-08-20', 'GLLFNC80M20L219P', '3409012345', 'francesco.gallo@email.it', 'Corso Vittorio 44', '10128', 'Torino', 10],
  ['Elena', 'De Luca', '1993-05-14', 'DLCLEN93E54F839W', '3410123456', 'elena.deluca@email.it', 'Via Posillipo 78', '80123', 'Napoli', 7],
];

const assistedTx = db.transaction(() => {
  assistedPeople.forEach(a => insertAssisted.run(...a));
});
assistedTx();

console.log('Assisted people seeded');

const insertQuote = db.prepare(`
  INSERT INTO quotes (numero, assistito_id, tipo_assicurazione_id, struttura_id, operatore_id, stato, data_decorrenza, note_struttura, dati_specifici, has_policy, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertHistory = db.prepare(`INSERT INTO quote_status_history (quote_id, stato_precedente, stato_nuovo, motivo, utente_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`);

const quotes = [
  { num: 'PRV-2026-00001', ass: 1, tipo: 1, strutt: 7, op: 4, stato: 'ELABORATA', dec: '2026-04-01', note: 'Cliente storico, vuole migliorare classe', dati: { targa: 'NA123AB', tipo_veicolo: 'Auto', marca: 'Fiat', modello: 'Panda', alimentazione: 'Benzina', kw: '69', anno_immatricolazione: '2020', tipo_guida: 'Libera', classe_cu: '1', massimale_rc: '6.450.000€' }, hasP: 1, created: '2026-03-10 09:00:00' },
  { num: 'PRV-2026-00002', ass: 2, tipo: 2, strutt: 8, op: 5, stato: 'IN LAVORAZIONE', dec: '2026-04-15', note: 'Appartamento zona EUR', dati: { tipologia_abitazione: 'Appartamento', mq: '95', anno_costruzione: '2005', uso: 'Abituale', proprieta_affitto: 'Proprietà', indirizzo_immobile: 'Via Laurentina 300', massimale_rct: '500.000€' }, hasP: 0, created: '2026-03-12 10:30:00' },
  { num: 'PRV-2026-00003', ass: 3, tipo: 1, strutt: 9, op: 6, stato: 'ELABORATA', dec: '2026-05-01', note: 'Passaggio da altra compagnia', dati: { targa: 'MI456CD', tipo_veicolo: 'Auto', marca: 'BMW', modello: 'Serie 3', alimentazione: 'Diesel', kw: '150', anno_immatricolazione: '2022', tipo_guida: 'Esperta', classe_cu: '3', massimale_rc: '10.000.000€' }, hasP: 0, created: '2026-03-08 11:00:00' },
  { num: 'PRV-2026-00004', ass: 4, tipo: 4, strutt: 7, op: 4, stato: 'STANDBY', dec: '2026-04-01', note: 'Richiesta urgente', dati: { attivita_lavorativa: 'Impiegata', sport_pericolosi: false, garanzie_richieste: 'Ricovero, Diaria' }, hasP: 0, created: '2026-03-15 14:00:00' },
  { num: 'PRV-2026-00005', ass: 5, tipo: 3, strutt: 10, op: null, stato: 'PRESENTATA', dec: '2026-05-01', note: 'Nuovo contratto affitto', dati: { canone_mensile: '800', durata_contratto: '48', indirizzo_immobile: 'Via Roma 22, Torino', tipologia_immobile: 'Residenziale', affittuario_tipologia: 'Persona Fisica', affittuario_nome: 'Luigi', affittuario_cognome: 'Bianchi', affittuario_data_nascita: '1990-01-15', affittuario_comune_nascita: 'Torino', affittuario_provincia_nascita: 'TO', affittuario_codice_fiscale: 'BNCLGU90A15L219X', affittuario_indirizzo_residenza: 'Via Roma 22', affittuario_cellulare: '3401112233', affittuario_email: 'l.bianchi@email.it' }, hasP: 0, created: '2026-03-20 08:00:00' },
  { num: 'PRV-2026-00006', ass: 6, tipo: 8, strutt: 8, op: 5, stato: 'ASSEGNATA', dec: '2026-04-01', note: 'Architetto, necessaria RC', dati: { tipo_professione: 'Architetto', laurea: 'Architettura', data_iscrizione_albo: '2015-06-01', fatturato: '75000', tipo_struttura_operativa: 'Studio associato', inquadramento_professionale: 'Socio', interventi_invasivi: 'No', medicina_estetica: 'No', chirurgia_vertebrale: 'No' }, hasP: 0, created: '2026-03-18 09:00:00' },
  { num: 'PRV-2026-00007', ass: 7, tipo: 6, strutt: 7, op: null, stato: 'PRESENTATA', dec: '2026-04-15', note: 'Golden Retriever, piano Gold', dati: { tipo_animale: 'Cane', razza: 'Golden Retriever', data_nascita_animale: '2023-06-01', microchip: '380260000123456', piano: 'Gold' }, hasP: 0, created: '2026-03-22 10:00:00' },
  { num: 'PRV-2026-00008', ass: 8, tipo: 10, strutt: 9, op: 6, stato: 'IN LAVORAZIONE', dec: '2026-04-01', note: 'TCM collegata a mutuo casa', dati: { categoria_lavorativa: 'Dipendente', lavoratore_dipendente: 'Impiegato', stato_civile: 'Coniugato/Convivente', soggetto_a_carico: 'Sì', fumatore: 'No (da almeno 2 anni)', durata_polizza_anni: '20 anni', capitale_scelto: '200000,00', mutuo: 'Sì', importo_mutuo: '180000', durata_mutuo: '20 anni' }, hasP: 0, created: '2026-03-14 15:00:00' },
  { num: 'PRV-2026-00009', ass: 9, tipo: 7, strutt: 10, op: null, stato: 'PRESENTATA', dec: '2026-04-01', note: 'Richiesta permesso soggiorno', dati: { nazionalita: 'Marocco', tipo_richiesta: 'Permesso di soggiorno', durata_soggiorno: '12', numero_persone: '1' }, hasP: 0, created: '2026-03-23 09:00:00' },
  { num: 'PRV-2026-00010', ass: 10, tipo: 11, strutt: 7, op: 4, stato: 'ELABORATA', dec: '2026-04-01', note: 'Check-up completo situazione assicurativa', dati: { attivita_lavorativa: 'Avvocato', situazione_abitativa: 'Proprietà', animali_domestici: true, viaggi: true, veicoli_posseduti: '2 auto', coperture_attuali: 'Solo RC Auto', persone_da_proteggere: '3' }, hasP: 0, created: '2026-03-05 11:00:00' },
  { num: 'PRV-2026-00011', ass: 1, tipo: 9, strutt: 7, op: 5, stato: 'IN LAVORAZIONE', dec: '2026-06-01', note: 'Interessato a piano risparmio a lungo termine', dati: { categoria_lavorativa: 'Dipendente', lavoratore_dipendente: 'Impiegato', stato_civile: 'Coniugato/Convivente', soggetto_a_carico: 'Sì', copertura_altra_polizza: 'Nessuna copertura assicurativa', obiettivo_principale: 'Proteggere il capitale investito', capitale_investimenti_12_mesi: 'Da 15000,00 a 50.000,00', orizzonte_liquidita: ['Ho un fondo per le emergenze posso permettermi di vincolarli anche per 3/5 anni senza particolari problemi'] }, hasP: 0, created: '2026-03-17 13:00:00' },
];

const quotesTx = db.transaction(() => {
  quotes.forEach((q, i) => {
    insertQuote.run(q.num, q.ass, q.tipo, q.strutt, q.op, q.stato, q.dec, q.note, JSON.stringify(q.dati), q.hasP, q.created, q.created);

    const qid = i + 1;
    insertHistory.run(qid, null, 'PRESENTATA', null, q.strutt, q.created);

    if (['ASSEGNATA', 'IN LAVORAZIONE', 'STANDBY', 'ELABORATA'].includes(q.stato)) {
      insertHistory.run(qid, 'PRESENTATA', 'ASSEGNATA', null, 2, q.created);
    }
    if (['IN LAVORAZIONE', 'STANDBY', 'ELABORATA'].includes(q.stato)) {
      insertHistory.run(qid, 'ASSEGNATA', 'IN LAVORAZIONE', null, q.op, q.created);
    }
    if (q.stato === 'STANDBY') {
      insertHistory.run(qid, 'IN LAVORAZIONE', 'STANDBY', 'In attesa di documentazione integrativa dal cliente', q.op, q.created);
    }
    if (q.stato === 'ELABORATA') {
      insertHistory.run(qid, 'IN LAVORAZIONE', 'ELABORATA', null, q.op, q.created);
    }
  });
});
quotesTx();

console.log('Quotes seeded');

const insertPolicy = db.prepare(`
  INSERT INTO policies (numero, quote_id, assistito_id, tipo_assicurazione_id, struttura_id, operatore_id, stato, dati_specifici, note_struttura, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertPolicyHistory = db.prepare(`INSERT INTO policy_status_history (policy_id, stato_precedente, stato_nuovo, utente_id, created_at) VALUES (?, ?, ?, ?, ?)`);

const policiesTx = db.transaction(() => {
  insertPolicy.run('POL-2026-00001', 1, 1, 1, 7, 4, 'IN EMISSIONE',
    JSON.stringify({ targa: 'NA123AB', tipo_veicolo: 'Auto', marca: 'Fiat', modello: 'Panda' }),
    'Pagamento effettuato tramite bonifico',
    '2026-03-18 09:00:00', '2026-03-20 14:00:00');

  insertPolicyHistory.run(1, null, 'RICHIESTA PRESENTATA', 7, '2026-03-18 09:00:00');
  insertPolicyHistory.run(1, 'RICHIESTA PRESENTATA', 'IN EMISSIONE', 2, '2026-03-20 14:00:00');
});
policiesTx();

console.log('Policies seeded');

const insertNote = db.prepare(`INSERT INTO quote_notes (quote_id, utente_id, tipo, testo, created_at) VALUES (?, ?, ?, ?, ?)`);
const notesTx = db.transaction(() => {
  insertNote.run(1, 4, 'operativa', 'Verificata documentazione completa. Preventivo elaborato con tariffa agevolata per classe 1.', '2026-03-15 16:00:00');
  insertNote.run(1, 7, 'struttura', 'Il cliente chiede se è possibile aggiungere garanzia furto.', '2026-03-12 09:30:00');
  insertNote.run(4, 4, 'operativa', 'In attesa del certificato medico aggiornato.', '2026-03-16 10:00:00');
  insertNote.run(2, 5, 'operativa', 'Verifico copertura danni acqua condotta.', '2026-03-19 11:00:00');
});
notesTx();

const insertSetting = db.prepare("INSERT INTO settings (chiave, valore) VALUES (?, ?)");
const settingsTx = db.transaction(() => {
  insertSetting.run('nome_portale', 'Fimass Sportello Amico');
});
settingsTx();

const insertLog = db.prepare(`INSERT INTO activity_logs (utente_id, utente_nome, ruolo, azione, modulo, riferimento_id, riferimento_tipo, dettaglio, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const logsTx = db.transaction(() => {
  insertLog.run(1, 'Marco Rossi', 'admin', 'LOGIN', 'auth', null, null, 'Login effettuato', '2026-03-24 09:00:00');
  insertLog.run(7, 'Agenzia Napoli Centro', 'struttura', 'CREAZIONE_PREVENTIVO', 'preventivi', 1, 'quote', 'Creato preventivo PRV-2026-00001', '2026-03-10 09:00:00');
  insertLog.run(2, 'Laura Bianchi', 'supervisore', 'ASSEGNAZIONE', 'preventivi', 1, 'quote', 'Preventivo PRV-2026-00001 assegnato a Anna Ferraro', '2026-03-11 09:00:00');
  insertLog.run(4, 'Anna Ferraro', 'operatore', 'CAMBIO_STATO', 'preventivi', 1, 'quote', 'PRV-2026-00001: ASSEGNATA → IN LAVORAZIONE', '2026-03-12 10:00:00');
  insertLog.run(4, 'Anna Ferraro', 'operatore', 'CAMBIO_STATO', 'preventivi', 1, 'quote', 'PRV-2026-00001: IN LAVORAZIONE → ELABORATA', '2026-03-15 16:00:00');
  insertLog.run(7, 'Agenzia Napoli Centro', 'struttura', 'CREAZIONE_POLIZZA', 'polizze', 1, 'policy', 'Creata richiesta polizza POL-2026-00001 da preventivo PRV-2026-00001', '2026-03-18 09:00:00');
});
logsTx();

console.log('');
console.log('Seed completed successfully!');
console.log('');
console.log('=== CREDENZIALI DI ACCESSO ===');
console.log('Admin:        admin / Bottone1');
console.log('Supervisore:  supervisore1 / super123');
console.log('Operatore:    operatore1 / oper123');
console.log('Struttura:    struttura1 / strut123');
console.log('==============================');
