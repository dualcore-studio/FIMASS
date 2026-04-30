const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isVercel = Boolean(process.env.VERCEL);
const defaultDbPath = isVercel
  ? '/tmp/fimass.db'
  : path.join(__dirname, '..', '..', 'data', 'fimass.db');
const DB_PATH = process.env.DB_PATH || defaultDbPath;

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','supervisore','operatore','fornitore','struttura')),
      nome TEXT,
      cognome TEXT,
      denominazione TEXT,
      email TEXT NOT NULL,
      telefono TEXT,
      stato TEXT NOT NULL DEFAULT 'attivo' CHECK(stato IN ('attivo','disattivo')),
      enabled_types TEXT,
      last_login TEXT,
      commission_type TEXT CHECK(commission_type IS NULL OR commission_type IN ('SEGNALATORE','PARTNER','SPORTELLO_AMICO')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS insurance_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      codice TEXT UNIQUE NOT NULL,
      stato TEXT NOT NULL DEFAULT 'attivo' CHECK(stato IN ('attivo','disattivo')),
      ordine INTEGER DEFAULT 0,
      descrizione TEXT,
      campi_specifici TEXT,
      checklist_allegati TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assisted_people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cognome TEXT NOT NULL,
      data_nascita TEXT,
      codice_fiscale TEXT,
      cellulare TEXT,
      email TEXT,
      indirizzo TEXT,
      cap TEXT,
      citta TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      assistito_id INTEGER REFERENCES assisted_people(id),
      tipo_assicurazione_id INTEGER REFERENCES insurance_types(id),
      struttura_id INTEGER REFERENCES users(id),
      operatore_id INTEGER REFERENCES users(id),
      fornitore_id INTEGER REFERENCES users(id),
      stato TEXT NOT NULL DEFAULT 'PRESENTATA' CHECK(stato IN ('PRESENTATA','ASSEGNATA','IN LAVORAZIONE','STANDBY','ELABORATA')),
      data_decorrenza TEXT,
      note_struttura TEXT,
      note_allegati TEXT,
      dati_specifici TEXT,
      dati_preventivo TEXT,
      has_policy INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quote_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL REFERENCES quotes(id),
      stato_precedente TEXT,
      stato_nuovo TEXT NOT NULL,
      motivo TEXT,
      utente_id INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quote_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL REFERENCES quotes(id),
      utente_id INTEGER REFERENCES users(id),
      tipo TEXT DEFAULT 'interna',
      testo TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quote_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL REFERENCES quotes(id),
      operatore_id INTEGER NOT NULL REFERENCES users(id),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      read_at TEXT
    );

    CREATE TABLE IF NOT EXISTS policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      quote_id INTEGER NOT NULL REFERENCES quotes(id),
      assistito_id INTEGER REFERENCES assisted_people(id),
      tipo_assicurazione_id INTEGER REFERENCES insurance_types(id),
      struttura_id INTEGER REFERENCES users(id),
      operatore_id INTEGER REFERENCES users(id),
      fornitore_id INTEGER REFERENCES users(id),
      stato TEXT NOT NULL DEFAULT 'RICHIESTA PRESENTATA' CHECK(stato IN ('RICHIESTA PRESENTATA','IN EMISSIONE','EMESSA')),
      dati_specifici TEXT,
      note_struttura TEXT,
      note_interne TEXT,
      compagnia TEXT,
      data_emissione TEXT,
      data_scadenza TEXT,
      rinnovata INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS policy_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES policies(id),
      stato_precedente TEXT,
      stato_nuovo TEXT NOT NULL,
      motivo TEXT,
      utente_id INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('quote','policy','assisted')),
      entity_id INTEGER NOT NULL,
      tipo TEXT,
      nome_file TEXT NOT NULL,
      nome_originale TEXT NOT NULL,
      mime_type TEXT,
      dimensione INTEGER,
      caricato_da INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utente_id INTEGER REFERENCES users(id),
      utente_nome TEXT,
      ruolo TEXT,
      azione TEXT NOT NULL,
      modulo TEXT,
      riferimento_id INTEGER,
      riferimento_tipo TEXT,
      dettaglio TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chiave TEXT UNIQUE NOT NULL,
      valore TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      policy_number TEXT NOT NULL,
      structure_id INTEGER NOT NULL REFERENCES users(id),
      structure_name TEXT,
      collaborator_name TEXT,
      portal TEXT,
      company TEXT,
      policy_premium REAL,
      broker_commission REAL,
      client_invoice REAL,
      sportello_amico_commission REAL,
      structure_commission_type TEXT NOT NULL CHECK(structure_commission_type IN ('SEGNALATORE','PARTNER','SPORTELLO_AMICO')),
      structure_commission_percentage INTEGER NOT NULL,
      structure_commission_amount REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_stato ON quotes(stato);
    CREATE INDEX IF NOT EXISTS idx_quotes_struttura ON quotes(struttura_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_operatore ON quotes(operatore_id);
    CREATE INDEX IF NOT EXISTS idx_quote_reminders_operatore ON quote_reminders(operatore_id, read_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_quote_reminders_quote ON quote_reminders(quote_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_policies_stato ON policies(stato);
    CREATE INDEX IF NOT EXISTS idx_policies_quote ON policies(quote_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_utente ON activity_logs(utente_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_assisted_cf ON assisted_people(codice_fiscale);
    CREATE INDEX IF NOT EXISTS idx_commissions_structure ON commissions(structure_id);
    CREATE INDEX IF NOT EXISTS idx_commissions_date ON commissions(date);

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('quote','policy','info')),
      entity_id INTEGER NOT NULL,
      struttura_id INTEGER NOT NULL REFERENCES users(id),
      assignee_id INTEGER NOT NULL REFERENCES users(id),
      assignee_role TEXT NOT NULL CHECK(assignee_role IN ('operatore','fornitore')),
      last_message_preview TEXT,
      last_message_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      author_role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      read_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_struttura ON conversations(struttura_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_assignee ON conversations(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation ON conversation_messages(conversation_id);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_conv_quote_policy ON conversations(entity_type, entity_id) WHERE entity_type IN ('quote','policy');
    CREATE UNIQUE INDEX IF NOT EXISTS ux_conv_info_pair ON conversations(struttura_id, assignee_id) WHERE entity_type = 'info';

    CREATE TABLE IF NOT EXISTS conversation_reads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      last_read_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(conversation_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_conv_reads_user ON conversation_reads(user_id);
    CREATE INDEX IF NOT EXISTS idx_conv_reads_conversation ON conversation_reads(conversation_id);
  `);

  // Migrazione difensiva: DB esistenti creati prima dell'introduzione dei solleciti
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quote_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL REFERENCES quotes(id),
        operatore_id INTEGER NOT NULL REFERENCES users(id),
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        read_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_quote_reminders_operatore ON quote_reminders(operatore_id, read_at, created_at);
      CREATE INDEX IF NOT EXISTS idx_quote_reminders_quote ON quote_reminders(quote_id, created_at);
    `);
  } catch (e) {
    console.error('ensure quote_reminders migration:', e);
  }

  try {
    const cols = db.prepare('PRAGMA table_info(insurance_types)').all();
    const hasDescr = Array.isArray(cols) && cols.some((c) => c.name === 'descrizione');
    if (!hasDescr) {
      db.exec('ALTER TABLE insurance_types ADD COLUMN descrizione TEXT');
    }
  } catch (e) {
    console.error('ensure insurance_types.descrizione migration:', e);
  }

  try {
    const qcols = db.prepare('PRAGMA table_info(quotes)').all();
    const hasNoteAllegati = Array.isArray(qcols) && qcols.some((c) => c.name === 'note_allegati');
    if (!hasNoteAllegati) {
      db.exec('ALTER TABLE quotes ADD COLUMN note_allegati TEXT');
    }
  } catch (e) {
    console.error('ensure quotes.note_allegati migration:', e);
  }

  try {
    const ucols = db.prepare('PRAGMA table_info(users)').all();
    const hasCommissionType = Array.isArray(ucols) && ucols.some((c) => c.name === 'commission_type');
    if (!hasCommissionType) {
      db.exec(
        "ALTER TABLE users ADD COLUMN commission_type TEXT CHECK(commission_type IS NULL OR commission_type IN ('SEGNALATORE','PARTNER','SPORTELLO_AMICO'))",
      );
      db.exec("UPDATE users SET commission_type = 'SEGNALATORE' WHERE role = 'struttura' AND commission_type IS NULL");
    }
  } catch (e) {
    console.error('ensure users.commission_type migration:', e);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS commissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        policy_number TEXT NOT NULL,
        structure_id INTEGER NOT NULL REFERENCES users(id),
        structure_name TEXT,
        collaborator_name TEXT,
        portal TEXT,
        company TEXT,
        policy_premium REAL,
        broker_commission REAL,
        client_invoice REAL,
        sportello_amico_commission REAL,
        structure_commission_type TEXT NOT NULL CHECK(structure_commission_type IN ('SEGNALATORE','PARTNER','SPORTELLO_AMICO')),
        structure_commission_percentage INTEGER NOT NULL,
        structure_commission_amount REAL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_commissions_structure ON commissions(structure_id);
      CREATE INDEX IF NOT EXISTS idx_commissions_date ON commissions(date);
    `);
  } catch (e) {
    console.error('ensure commissions table migration:', e);
  }

  migrateCommissionTypeEnumsIfNeeded();
  migrateCommissionsNullableEconomicsSqliteIfNeeded();
  migrateCommissionsLiquidatedSqliteIfNeeded();
  migrateFornitoreAndMessagingSqliteIfNeeded();
  migratePrivacyGdprSqliteIfNeeded();
  migratePoliciesScadenzeSqliteIfNeeded();
  migratePolicyRenewalsSqliteIfNeeded();
  migrateAppointmentsSqliteIfNeeded();
}

function migrateAppointmentsSqliteIfNeeded() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        struttura_id INTEGER NOT NULL REFERENCES users(id),
        fornitore_id INTEGER NOT NULL REFERENCES users(id),
        created_by_user_id INTEGER REFERENCES users(id),
        assistito_nome TEXT NOT NULL,
        assistito_cognome TEXT NOT NULL,
        assistito_telefono TEXT,
        assistito_email TEXT,
        modalita TEXT NOT NULL,
        oggetto TEXT NOT NULL,
        note TEXT,
        data_appuntamento TEXT NOT NULL,
        ora_inizio TEXT NOT NULL,
        ora_fine TEXT NOT NULL,
        durata_minuti INTEGER NOT NULL DEFAULT 60,
        luogo TEXT,
        link_videocall TEXT,
        numero_telefonico_riferimento TEXT,
        stato TEXT NOT NULL DEFAULT 'RICHIESTO',
        motivo_riprogrammazione TEXT,
        motivo_annullamento TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_appointments_fornitore_data ON appointments(fornitore_id, data_appuntamento);
      CREATE INDEX IF NOT EXISTS idx_appointments_struttura ON appointments(struttura_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_stato ON appointments(stato);

      CREATE TABLE IF NOT EXISTS appointment_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        stato_precedente TEXT,
        stato_nuovo TEXT NOT NULL,
        utente_id INTEGER REFERENCES users(id),
        nota TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_appointment_hist_app ON appointment_status_history(appointment_id);
    `);
  } catch (e) {
    console.error('migrateAppointmentsSqliteIfNeeded:', e);
  }
}

/** Tabella scadenze/rinnovi + colonne collegamento su preventivi e polizze (SQLite locale). */
function migratePolicyRenewalsSqliteIfNeeded() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS policy_expirations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        policy_id INTEGER NOT NULL UNIQUE REFERENCES policies(id),
        renewal_status TEXT NOT NULL DEFAULT 'da_rinnovare',
        renewal_quote_id INTEGER REFERENCES quotes(id),
        renewed_by_policy_id INTEGER REFERENCES policies(id),
        renewal_completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_policy_expirations_quote ON policy_expirations(renewal_quote_id);
    `);
    const qcols = db.prepare('PRAGMA table_info(quotes)').all();
    const qNames = new Set(Array.isArray(qcols) ? qcols.map((c) => c.name) : []);
    if (!qNames.has('is_renewal')) db.exec('ALTER TABLE quotes ADD COLUMN is_renewal INTEGER NOT NULL DEFAULT 0');
    if (!qNames.has('renewal_source_expiration_id')) {
      db.exec('ALTER TABLE quotes ADD COLUMN renewal_source_expiration_id INTEGER REFERENCES policy_expirations(id)');
    }
    if (!qNames.has('renewal_source_policy_id')) {
      db.exec('ALTER TABLE quotes ADD COLUMN renewal_source_policy_id INTEGER REFERENCES policies(id)');
    }
    const pcols = db.prepare('PRAGMA table_info(policies)').all();
    const pNames = new Set(Array.isArray(pcols) ? pcols.map((c) => c.name) : []);
    if (!pNames.has('is_renewal')) db.exec('ALTER TABLE policies ADD COLUMN is_renewal INTEGER NOT NULL DEFAULT 0');
    if (!pNames.has('renewal_source_expiration_id')) {
      db.exec('ALTER TABLE policies ADD COLUMN renewal_source_expiration_id INTEGER REFERENCES policy_expirations(id)');
    }
    if (!pNames.has('renewal_source_policy_id')) {
      db.exec('ALTER TABLE policies ADD COLUMN renewal_source_policy_id INTEGER REFERENCES policies(id)');
    }
  } catch (e) {
    console.error('migratePolicyRenewalsSqliteIfNeeded:', e);
  }
}

/** Colonne scadenze / rinnovo su polizze emesse (SQLite locale / seed). */
function migratePoliciesScadenzeSqliteIfNeeded() {
  try {
    const pcols = db.prepare('PRAGMA table_info(policies)').all();
    const names = new Set(Array.isArray(pcols) ? pcols.map((c) => c.name) : []);
    if (!names.has('data_emissione')) {
      db.exec('ALTER TABLE policies ADD COLUMN data_emissione TEXT');
    }
    if (!names.has('data_scadenza')) {
      db.exec('ALTER TABLE policies ADD COLUMN data_scadenza TEXT');
    }
    if (!names.has('rinnovata')) {
      db.exec('ALTER TABLE policies ADD COLUMN rinnovata INTEGER NOT NULL DEFAULT 0');
    }
    if (!names.has('compagnia')) {
      db.exec('ALTER TABLE policies ADD COLUMN compagnia TEXT');
    }

    const {
      calculatePolicyExpiryDate,
      toIsoDateTime,
      parseDbDateTime,
    } = require('../utils/policyDates');
    const { normalizePolicyStato } = require('../utils/policyStato');
    const histStmt = db.prepare(
      'SELECT stato_nuovo, created_at FROM policy_status_history WHERE policy_id = ? ORDER BY created_at ASC',
    );
    const rows = db
      .prepare(`SELECT id, stato, created_at, updated_at, data_emissione, data_scadenza FROM policies WHERE stato = 'EMESSA'`)
      .all();
    const updBoth = db.prepare('UPDATE policies SET data_emissione = ?, data_scadenza = ? WHERE id = ?');
    const updScad = db.prepare('UPDATE policies SET data_scadenza = ? WHERE id = ?');
    for (const row of rows) {
      if (!row.data_emissione) {
        const hist = histStmt.all(row.id);
        const firstEmessa = hist.find((h) => normalizePolicyStato(h.stato_nuovo) === 'EMESSA');
        const em = firstEmessa?.created_at || row.updated_at || row.created_at;
        const exp = calculatePolicyExpiryDate(parseDbDateTime(em) || new Date());
        updBoth.run(em, toIsoDateTime(exp), row.id);
      } else if (!row.data_scadenza) {
        const exp = calculatePolicyExpiryDate(parseDbDateTime(row.data_emissione));
        if (exp) updScad.run(toIsoDateTime(exp), row.id);
      }
    }
  } catch (e) {
    console.error('migratePoliciesScadenzeSqliteIfNeeded:', e);
  }
}

/** Colonne consensi privacy su preventivi + tabella audit GDPR (SQLite locale / seed). */
function migratePrivacyGdprSqliteIfNeeded() {
  try {
    const qcols = db.prepare('PRAGMA table_info(quotes)').all();
    const qNames = new Set(Array.isArray(qcols) ? qcols.map((c) => c.name) : []);
    if (!qNames.has('privacy_consent_required')) {
      db.exec('ALTER TABLE quotes ADD COLUMN privacy_consent_required INTEGER');
    }
    if (!qNames.has('privacy_consent_at')) {
      db.exec('ALTER TABLE quotes ADD COLUMN privacy_consent_at TEXT');
    }
    if (!qNames.has('privacy_consent_ip')) {
      db.exec('ALTER TABLE quotes ADD COLUMN privacy_consent_ip TEXT');
    }
    if (!qNames.has('privacy_policy_version')) {
      db.exec('ALTER TABLE quotes ADD COLUMN privacy_policy_version TEXT');
    }
    if (!qNames.has('marketing_consent')) {
      db.exec('ALTER TABLE quotes ADD COLUMN marketing_consent INTEGER');
    }
    if (!qNames.has('marketing_consent_at')) {
      db.exec('ALTER TABLE quotes ADD COLUMN marketing_consent_at TEXT');
    }
  } catch (e) {
    console.error('migrate quotes privacy columns:', e);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        metadata_json TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `);
  } catch (e) {
    console.error('ensure audit_logs table:', e);
  }
}

/** SQLite: estende i CHECK su enum provvigioni per DB creati prima di SPORTELLO_AMICO. */
function migrateCommissionTypeEnumsIfNeeded() {
  const inList = "('SEGNALATORE','PARTNER','SPORTELLO_AMICO')";

  try {
    const comm = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='commissions'`).get();
    if (comm?.sql && !comm.sql.includes('SPORTELLO_AMICO')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE commissions__enum_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          policy_number TEXT NOT NULL,
          structure_id INTEGER NOT NULL REFERENCES users(id),
          structure_name TEXT,
          collaborator_name TEXT,
          portal TEXT,
          company TEXT,
          policy_premium REAL,
          broker_commission REAL,
          client_invoice REAL,
          sportello_amico_commission REAL,
          structure_commission_type TEXT NOT NULL CHECK(structure_commission_type IN ${inList}),
          structure_commission_percentage INTEGER NOT NULL,
          structure_commission_amount REAL,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
      db.exec('INSERT INTO commissions__enum_new SELECT * FROM commissions');
      db.exec('DROP TABLE commissions');
      db.exec('ALTER TABLE commissions__enum_new RENAME TO commissions');
      db.exec('CREATE INDEX IF NOT EXISTS idx_commissions_structure ON commissions(structure_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_commissions_date ON commissions(date)');
      db.pragma('foreign_keys = ON');
    }
  } catch (e) {
    try {
      db.pragma('foreign_keys = ON');
    } catch (_) {
      /* ignore */
    }
    console.error('migrate commissions structure_commission_type enum:', e);
  }

  try {
    const usersRow = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
    if (usersRow?.sql && !usersRow.sql.includes('SPORTELLO_AMICO')) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE users__enum_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin','supervisore','operatore','fornitore','struttura')),
          nome TEXT,
          cognome TEXT,
          denominazione TEXT,
          email TEXT NOT NULL,
          telefono TEXT,
          stato TEXT NOT NULL DEFAULT 'attivo' CHECK(stato IN ('attivo','disattivo')),
          enabled_types TEXT,
          last_login TEXT,
          commission_type TEXT CHECK(commission_type IS NULL OR commission_type IN ${inList}),
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
      db.exec('INSERT INTO users__enum_new SELECT * FROM users');
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users__enum_new RENAME TO users');
      db.pragma('foreign_keys = ON');
    }
  } catch (e) {
    try {
      db.pragma('foreign_keys = ON');
    } catch (_) {
      /* ignore */
    }
    console.error('migrate users commission_type enum:', e);
  }
}

/** SQLite: provv. senza importi — sportello_amico_commission / structure_commission_amount possono essere NULL. */
function migrateCommissionsNullableEconomicsSqliteIfNeeded() {
  const inList = "('SEGNALATORE','PARTNER','SPORTELLO_AMICO')";
  try {
    const comm = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='commissions'`).get();
    const sql = comm?.sql && typeof comm.sql === 'string' ? comm.sql : '';
    const needsMigrate =
      sql.includes('sportello_amico_commission REAL NOT NULL') ||
      sql.includes('structure_commission_amount REAL NOT NULL');
    if (!needsMigrate) return;

    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE commissions__amt_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        policy_number TEXT NOT NULL,
        structure_id INTEGER NOT NULL REFERENCES users(id),
        structure_name TEXT,
        collaborator_name TEXT,
        portal TEXT,
        company TEXT,
        policy_premium REAL,
        broker_commission REAL,
        client_invoice REAL,
        sportello_amico_commission REAL,
        structure_commission_type TEXT NOT NULL CHECK(structure_commission_type IN ${inList}),
        structure_commission_percentage INTEGER NOT NULL,
        structure_commission_amount REAL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    db.exec('INSERT INTO commissions__amt_new SELECT * FROM commissions');
    db.exec('DROP TABLE commissions');
    db.exec('ALTER TABLE commissions__amt_new RENAME TO commissions');
    db.exec('CREATE INDEX IF NOT EXISTS idx_commissions_structure ON commissions(structure_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_commissions_date ON commissions(date)');
    db.pragma('foreign_keys = ON');
  } catch (e) {
    try {
      db.pragma('foreign_keys = ON');
    } catch (_) {
      /* ignore */
    }
    console.error('migrate commissions nullable economic columns:', e);
  }
}

/** SQLite: flag liquidazione provvigione struttura (solo admin). */
function migrateCommissionsLiquidatedSqliteIfNeeded() {
  try {
    const cols = db.prepare('PRAGMA table_info(commissions)').all();
    const has = Array.isArray(cols) && cols.some((c) => c.name === 'liquidated');
    if (!has) {
      db.exec('ALTER TABLE commissions ADD COLUMN liquidated INTEGER NOT NULL DEFAULT 0');
    }
  } catch (e) {
    console.error('ensure commissions.liquidated migration:', e);
  }
}

/** Ruolo fornitore, assegnazione polizze e tabelle messaggistica (SQLite locale / seed). */
function migrateFornitoreAndMessagingSqliteIfNeeded() {
  try {
    const qcols = db.prepare('PRAGMA table_info(quotes)').all();
    if (Array.isArray(qcols) && !qcols.some((c) => c.name === 'fornitore_id')) {
      db.exec('ALTER TABLE quotes ADD COLUMN fornitore_id INTEGER REFERENCES users(id)');
    }
  } catch (e) {
    console.error('ensure quotes.fornitore_id migration:', e);
  }

  try {
    const pcols = db.prepare('PRAGMA table_info(policies)').all();
    if (Array.isArray(pcols) && !pcols.some((c) => c.name === 'fornitore_id')) {
      db.exec('ALTER TABLE policies ADD COLUMN fornitore_id INTEGER REFERENCES users(id)');
    }
  } catch (e) {
    console.error('ensure policies.fornitore_id migration:', e);
  }

  try {
    const usersRow = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
    if (usersRow?.sql && !usersRow.sql.includes("'fornitore'")) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE users__fornitore_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin','supervisore','operatore','fornitore','struttura')),
          nome TEXT,
          cognome TEXT,
          denominazione TEXT,
          email TEXT NOT NULL,
          telefono TEXT,
          stato TEXT NOT NULL DEFAULT 'attivo' CHECK(stato IN ('attivo','disattivo')),
          enabled_types TEXT,
          last_login TEXT,
          commission_type TEXT CHECK(commission_type IS NULL OR commission_type IN ('SEGNALATORE','PARTNER','SPORTELLO_AMICO')),
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
      db.exec('INSERT INTO users__fornitore_new SELECT * FROM users');
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users__fornitore_new RENAME TO users');
      db.pragma('foreign_keys = ON');
    }
  } catch (e) {
    try {
      db.pragma('foreign_keys = ON');
    } catch (_) {
      /* ignore */
    }
    console.error('migrate users fornitore role:', e);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('quote','policy','info')),
        entity_id INTEGER NOT NULL,
        struttura_id INTEGER NOT NULL REFERENCES users(id),
        assignee_id INTEGER NOT NULL REFERENCES users(id),
        assignee_role TEXT NOT NULL CHECK(assignee_role IN ('operatore','fornitore')),
        last_message_preview TEXT,
        last_message_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id),
        author_id INTEGER NOT NULL REFERENCES users(id),
        author_role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        read_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_struttura ON conversations(struttura_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_assignee ON conversations(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation ON conversation_messages(conversation_id);
      CREATE UNIQUE INDEX IF NOT EXISTS ux_conv_quote_policy ON conversations(entity_type, entity_id) WHERE entity_type IN ('quote','policy');
      CREATE UNIQUE INDEX IF NOT EXISTS ux_conv_info_pair ON conversations(struttura_id, assignee_id) WHERE entity_type = 'info';
    `);
  } catch (e) {
    console.error('ensure conversations tables migration:', e);
  }

  try {
    const t = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='conversations'").get();
    const sql = t && typeof t.sql === 'string' ? t.sql : '';
    const isLegacyConv =
      sql &&
      sql.includes('quote') &&
      sql.includes('policy') &&
      !sql.includes("'info'");
    if (isLegacyConv) {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE conversations__mig (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL CHECK(entity_type IN ('quote','policy','info')),
          entity_id INTEGER NOT NULL,
          struttura_id INTEGER NOT NULL REFERENCES users(id),
          assignee_id INTEGER NOT NULL REFERENCES users(id),
          assignee_role TEXT NOT NULL CHECK(assignee_role IN ('operatore','fornitore')),
          last_message_preview TEXT,
          last_message_at TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        INSERT INTO conversations__mig SELECT * FROM conversations;
        DROP TABLE conversations;
        ALTER TABLE conversations__mig RENAME TO conversations;
        CREATE INDEX IF NOT EXISTS idx_conversations_struttura ON conversations(struttura_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_assignee ON conversations(assignee_id);
      `);
      db.pragma('foreign_keys = ON');
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_conv_quote_policy ON conversations(entity_type, entity_id) WHERE entity_type IN ('quote','policy');
      CREATE UNIQUE INDEX IF NOT EXISTS ux_conv_info_pair ON conversations(struttura_id, assignee_id) WHERE entity_type = 'info';
    `);
  } catch (e) {
    console.error('migrate conversations for info threads:', e);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_reads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        last_read_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(conversation_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_conv_reads_user ON conversation_reads(user_id);
      CREATE INDEX IF NOT EXISTS idx_conv_reads_conversation ON conversation_reads(conversation_id);
    `);
  } catch (e) {
    console.error('ensure conversation_reads migration:', e);
  }
}

module.exports = { db, initializeDatabase };
