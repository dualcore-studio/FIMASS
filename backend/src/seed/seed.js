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
  ['admin', hash('admin123'), 'admin', 'Marco', 'Rossi', null, 'admin@fimass.it', null, 'attivo', null, '2026-03-24 09:00:00'],
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

const insuranceTypes = [
  { nome: 'RC Auto / Moto / Autocarri', codice: 'rc_auto', ordine: 1,
    campi: [
      { nome: 'targa', label: 'Targa o Telaio', tipo: 'text', obbligatorio: true },
      { nome: 'tipo_veicolo', label: 'Tipo Veicolo', tipo: 'select', opzioni: ['Auto','Moto','Autocarro','Ciclomotore'], obbligatorio: true },
      { nome: 'marca', label: 'Marca', tipo: 'text', obbligatorio: true },
      { nome: 'modello', label: 'Modello', tipo: 'text', obbligatorio: true },
      { nome: 'alimentazione', label: 'Alimentazione', tipo: 'select', opzioni: ['Benzina','Diesel','GPL','Metano','Ibrido','Elettrico'], obbligatorio: true },
      { nome: 'kw', label: 'KW', tipo: 'number', obbligatorio: true },
      { nome: 'anno_immatricolazione', label: 'Anno Immatricolazione', tipo: 'number', obbligatorio: true },
      { nome: 'valore_veicolo', label: 'Valore Veicolo (€)', tipo: 'number', obbligatorio: false },
      { nome: 'proprietario_diverso', label: 'Proprietario diverso dal contraente', tipo: 'boolean', obbligatorio: false },
      { nome: 'tipo_guida', label: 'Tipo Guida', tipo: 'select', opzioni: ['Libera','Esperta','Esclusiva'], obbligatorio: true },
      { nome: 'classe_cu', label: 'Classe CU', tipo: 'text', obbligatorio: true },
      { nome: 'attestato_rischio', label: 'Attestato di Rischio', tipo: 'text', obbligatorio: false },
      { nome: 'garanzie_richieste', label: 'Garanzie Richieste', tipo: 'textarea', obbligatorio: false },
      { nome: 'massimale_rc', label: 'Massimale RC', tipo: 'select', opzioni: ['6.450.000€','10.000.000€','15.000.000€','25.000.000€','50.000.000€'], obbligatorio: true }
    ],
    allegati: [
      { nome: 'Libretto Veicolo', obbligatorio: true },
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: true },
      { nome: 'Patente', obbligatorio: false },
      { nome: 'Atto Acquisto / Voltura', obbligatorio: false }
    ]
  },
  { nome: 'Casa', codice: 'casa', ordine: 2,
    campi: [
      { nome: 'tipologia_abitazione', label: 'Tipologia Abitazione', tipo: 'select', opzioni: ['Appartamento','Villa','Villetta a schiera','Attico','Altro'], obbligatorio: true },
      { nome: 'mq', label: 'Metri Quadri', tipo: 'number', obbligatorio: true },
      { nome: 'anno_costruzione', label: 'Anno Costruzione', tipo: 'number', obbligatorio: true },
      { nome: 'uso', label: 'Uso', tipo: 'select', opzioni: ['Abituale','Saltuario'], obbligatorio: true },
      { nome: 'proprieta_affitto', label: 'Proprietà o Affitto', tipo: 'select', opzioni: ['Proprietà','Affitto'], obbligatorio: true },
      { nome: 'indirizzo_immobile', label: 'Indirizzo Immobile', tipo: 'text', obbligatorio: true },
      { nome: 'garanzie_richieste', label: 'Garanzie Richieste', tipo: 'textarea', obbligatorio: false },
      { nome: 'massimale_rct', label: 'Massimale RCT', tipo: 'select', opzioni: ['250.000€','500.000€','1.000.000€'], obbligatorio: true }
    ],
    allegati: [
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: true }
    ]
  },
  { nome: 'Affitto Assicurato', codice: 'affitto', ordine: 3,
    campi: [
      { nome: 'canone_mensile', label: 'Canone Mensile (€)', tipo: 'number', obbligatorio: true },
      { nome: 'durata_contratto', label: 'Durata Contratto (mesi)', tipo: 'number', obbligatorio: true },
      { nome: 'indirizzo_immobile', label: 'Indirizzo Immobile', tipo: 'text', obbligatorio: true },
      { nome: 'tipologia_immobile', label: 'Tipologia Immobile', tipo: 'select', opzioni: ['Residenziale','Commerciale','Ufficio'], obbligatorio: true },
      { nome: 'tipo_inquilino', label: 'Tipo Inquilino', tipo: 'select', opzioni: ['Persona Fisica','Società'], obbligatorio: true }
    ],
    allegati: [
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: true },
      { nome: 'Busta Paga / CUD', obbligatorio: false, condizione: 'tipo_inquilino=Persona Fisica' },
      { nome: 'Visura CCIAA', obbligatorio: false, condizione: 'tipo_inquilino=Società' },
      { nome: 'Bilancio', obbligatorio: false, condizione: 'tipo_inquilino=Società' }
    ]
  },
  { nome: 'Sanitaria / Infortuni', codice: 'sanitaria', ordine: 4,
    campi: [
      { nome: 'attivita_lavorativa', label: 'Attività Lavorativa', tipo: 'text', obbligatorio: true },
      { nome: 'sport_pericolosi', label: 'Sport Pericolosi', tipo: 'boolean', obbligatorio: false },
      { nome: 'patologie_pregresse', label: 'Patologie Pregresse', tipo: 'textarea', obbligatorio: false },
      { nome: 'sinistri_precedenti', label: 'Sinistri Precedenti', tipo: 'textarea', obbligatorio: false },
      { nome: 'polizza_attiva', label: 'Polizza Attiva', tipo: 'boolean', obbligatorio: false },
      { nome: 'beneficiario_caso_morte', label: 'Beneficiario Caso Morte', tipo: 'text', obbligatorio: false },
      { nome: 'garanzie_richieste', label: 'Garanzie Richieste', tipo: 'textarea', obbligatorio: false }
    ],
    allegati: [
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: true }
    ]
  },
  { nome: 'Scudo Amico', codice: 'scudo_amico', ordine: 5,
    campi: [
      { nome: 'attivita_lavorativa', label: 'Attività Lavorativa', tipo: 'text', obbligatorio: true },
      { nome: 'sport_pericolosi', label: 'Sport Pericolosi', tipo: 'boolean', obbligatorio: false },
      { nome: 'patologie_pregresse', label: 'Patologie Pregresse', tipo: 'textarea', obbligatorio: false },
      { nome: 'sinistri_precedenti', label: 'Sinistri Precedenti', tipo: 'textarea', obbligatorio: false },
      { nome: 'polizza_attiva', label: 'Polizza Attiva', tipo: 'boolean', obbligatorio: false },
      { nome: 'beneficiario_caso_morte', label: 'Beneficiario Caso Morte', tipo: 'text', obbligatorio: false },
      { nome: 'garanzie_richieste', label: 'Garanzie Richieste', tipo: 'textarea', obbligatorio: false }
    ],
    allegati: [
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: true }
    ]
  },
  { nome: 'Miglior Amico Cane/Gatto', codice: 'animali', ordine: 6,
    campi: [
      { nome: 'tipo_animale', label: 'Tipo Animale', tipo: 'select', opzioni: ['Cane','Gatto'], obbligatorio: true },
      { nome: 'razza', label: 'Razza', tipo: 'text', obbligatorio: true },
      { nome: 'data_nascita_animale', label: 'Data Nascita Animale', tipo: 'date', obbligatorio: true },
      { nome: 'microchip', label: 'Numero Microchip', tipo: 'text', obbligatorio: true },
      { nome: 'piano', label: 'Piano', tipo: 'select', opzioni: ['Base','Gold','Premium'], obbligatorio: true }
    ],
    allegati: [
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: true }
    ]
  },
  { nome: 'Stranieri', codice: 'stranieri', ordine: 7,
    campi: [
      { nome: 'nazionalita', label: 'Nazionalità', tipo: 'text', obbligatorio: true },
      { nome: 'tipo_richiesta', label: 'Tipo Richiesta', tipo: 'select', opzioni: ['Visto','Permesso di soggiorno','Ricongiungimento','Altro'], obbligatorio: true },
      { nome: 'durata_soggiorno', label: 'Durata Soggiorno (mesi)', tipo: 'number', obbligatorio: true },
      { nome: 'numero_persone', label: 'Numero Persone', tipo: 'number', obbligatorio: true },
      { nome: 'servizi_aggiuntivi', label: 'Servizi Aggiuntivi', tipo: 'textarea', obbligatorio: false }
    ],
    allegati: [
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: false },
      { nome: 'Passaporto', obbligatorio: true }
    ]
  },
  { nome: 'RC Professionale', codice: 'rc_prof', ordine: 8,
    campi: [
      { nome: 'tipo_professione', label: 'Tipo Professione', tipo: 'text', obbligatorio: true },
      { nome: 'area_professionale', label: 'Area Professionale', tipo: 'select', opzioni: ['Sanitaria','Legale','Tecnica','Consulenza','Altro'], obbligatorio: true },
      { nome: 'fatturato', label: 'Fatturato Annuo (€)', tipo: 'number', obbligatorio: true },
      { nome: 'iscrizione_albo', label: 'Iscrizione Albo', tipo: 'text', obbligatorio: true },
      { nome: 'attivita_specifiche', label: 'Attività Specifiche', tipo: 'textarea', obbligatorio: false }
    ],
    allegati: [
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: true },
      { nome: 'Iscrizione Albo', obbligatorio: true }
    ]
  },
  { nome: 'Piani di Risparmio', codice: 'risparmio', ordine: 9,
    campi: [
      { nome: 'categoria_lavorativa', label: 'Categoria Lavorativa', tipo: 'select', opzioni: ['Dipendente','Autonomo','Libero Professionista','Pensionato','Altro'], obbligatorio: true },
      { nome: 'stato_civile', label: 'Stato Civile', tipo: 'select', opzioni: ['Celibe/Nubile','Coniugato/a','Separato/a','Divorziato/a','Vedovo/a'], obbligatorio: true },
      { nome: 'capitale_disponibile', label: 'Capitale Disponibile (€)', tipo: 'number', obbligatorio: true },
      { nome: 'orizzonte_temporale', label: 'Orizzonte Temporale', tipo: 'select', opzioni: ['1-3 anni','3-5 anni','5-10 anni','Oltre 10 anni'], obbligatorio: true },
      { nome: 'obiettivo_investimento', label: 'Obiettivo Investimento', tipo: 'textarea', obbligatorio: false }
    ],
    allegati: [
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: true }
    ]
  },
  { nome: 'TCM / Mutuo', codice: 'tcm_mutuo', ordine: 10,
    campi: [
      { nome: 'fumatore', label: 'Fumatore', tipo: 'boolean', obbligatorio: true },
      { nome: 'capitale_richiesto', label: 'Capitale Richiesto (€)', tipo: 'number', obbligatorio: true },
      { nome: 'durata_anni', label: 'Durata (anni)', tipo: 'number', obbligatorio: true },
      { nome: 'presenza_mutuo', label: 'Presenza Mutuo', tipo: 'boolean', obbligatorio: true },
      { nome: 'importo_mutuo', label: 'Importo Mutuo (€)', tipo: 'number', obbligatorio: false },
      { nome: 'tipo_beneficiario', label: 'Tipo Beneficiario', tipo: 'select', opzioni: ['Eredi legittimi','Coniuge','Banca','Altro'], obbligatorio: true }
    ],
    allegati: [
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: true }
    ]
  },
  { nome: 'Check-up Esigenze Varie', codice: 'checkup', ordine: 11,
    campi: [
      { nome: 'attivita_lavorativa', label: 'Attività Lavorativa', tipo: 'text', obbligatorio: true },
      { nome: 'situazione_abitativa', label: 'Situazione Abitativa', tipo: 'select', opzioni: ['Proprietà','Affitto','Comodato'], obbligatorio: true },
      { nome: 'animali_domestici', label: 'Animali Domestici', tipo: 'boolean', obbligatorio: false },
      { nome: 'viaggi', label: 'Viaggi Frequenti', tipo: 'boolean', obbligatorio: false },
      { nome: 'veicoli_posseduti', label: 'Veicoli Posseduti', tipo: 'textarea', obbligatorio: false },
      { nome: 'coperture_attuali', label: 'Coperture Attuali', tipo: 'textarea', obbligatorio: false },
      { nome: 'persone_da_proteggere', label: 'Persone da Proteggere', tipo: 'number', obbligatorio: false }
    ],
    allegati: [
      { nome: 'Documento Identità', obbligatorio: true },
      { nome: 'Codice Fiscale', obbligatorio: true }
    ]
  }
];

const insertType = db.prepare(`
  INSERT INTO insurance_types (nome, codice, stato, ordine, descrizione, campi_specifici, checklist_allegati) VALUES (?, ?, 'attivo', ?, ?, ?, ?)
`);

const typesTx = db.transaction(() => {
  insuranceTypes.forEach((t) => insertType.run(
    t.nome,
    t.codice,
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
  { num: 'PRV-2026-00005', ass: 5, tipo: 3, strutt: 10, op: null, stato: 'PRESENTATA', dec: '2026-05-01', note: 'Nuovo contratto affitto', dati: { canone_mensile: '800', durata_contratto: '48', indirizzo_immobile: 'Via Roma 22, Torino', tipologia_immobile: 'Residenziale', tipo_inquilino: 'Persona Fisica' }, hasP: 0, created: '2026-03-20 08:00:00' },
  { num: 'PRV-2026-00006', ass: 6, tipo: 8, strutt: 8, op: 5, stato: 'ASSEGNATA', dec: '2026-04-01', note: 'Architetto, necessaria RC', dati: { tipo_professione: 'Architetto', area_professionale: 'Tecnica', fatturato: '75000', iscrizione_albo: 'n. 12345' }, hasP: 0, created: '2026-03-18 09:00:00' },
  { num: 'PRV-2026-00007', ass: 7, tipo: 6, strutt: 7, op: null, stato: 'PRESENTATA', dec: '2026-04-15', note: 'Golden Retriever, vuole piano premium', dati: { tipo_animale: 'Cane', razza: 'Golden Retriever', data_nascita_animale: '2023-06-01', microchip: '380260000123456', piano: 'Premium' }, hasP: 0, created: '2026-03-22 10:00:00' },
  { num: 'PRV-2026-00008', ass: 8, tipo: 10, strutt: 9, op: 6, stato: 'IN LAVORAZIONE', dec: '2026-04-01', note: 'TCM collegata a mutuo casa', dati: { fumatore: false, capitale_richiesto: '200000', durata_anni: '20', presenza_mutuo: true, importo_mutuo: '180000', tipo_beneficiario: 'Banca' }, hasP: 0, created: '2026-03-14 15:00:00' },
  { num: 'PRV-2026-00009', ass: 9, tipo: 7, strutt: 10, op: null, stato: 'PRESENTATA', dec: '2026-04-01', note: 'Richiesta permesso soggiorno', dati: { nazionalita: 'Marocco', tipo_richiesta: 'Permesso di soggiorno', durata_soggiorno: '12', numero_persone: '1' }, hasP: 0, created: '2026-03-23 09:00:00' },
  { num: 'PRV-2026-00010', ass: 10, tipo: 11, strutt: 7, op: 4, stato: 'ELABORATA', dec: '2026-04-01', note: 'Check-up completo situazione assicurativa', dati: { attivita_lavorativa: 'Avvocato', situazione_abitativa: 'Proprietà', animali_domestici: true, viaggi: true, veicoli_posseduti: '2 auto', coperture_attuali: 'Solo RC Auto', persone_da_proteggere: '3' }, hasP: 0, created: '2026-03-05 11:00:00' },
  { num: 'PRV-2026-00011', ass: 1, tipo: 9, strutt: 7, op: 5, stato: 'IN LAVORAZIONE', dec: '2026-06-01', note: 'Interessato a piano risparmio a lungo termine', dati: { categoria_lavorativa: 'Dipendente', stato_civile: 'Coniugato/a', capitale_disponibile: '30000', orizzonte_temporale: '5-10 anni', obiettivo_investimento: 'Protezione capitale e crescita moderata' }, hasP: 0, created: '2026-03-17 13:00:00' },
  { num: 'PRV-2026-00012', ass: 3, tipo: 5, strutt: 9, op: null, stato: 'PRESENTATA', dec: '2026-05-15', note: 'Richiesta Scudo Amico base', dati: { attivita_lavorativa: 'Commercialista', sport_pericolosi: false, polizza_attiva: false }, hasP: 0, created: '2026-03-24 10:00:00' },
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
console.log('Admin:        admin / admin123');
console.log('Supervisore:  supervisore1 / super123');
console.log('Operatore:    operatore1 / oper123');
console.log('Struttura:    struttura1 / strut123');
console.log('==============================');
