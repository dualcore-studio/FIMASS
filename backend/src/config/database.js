const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'fimass.db');

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
      role TEXT NOT NULL CHECK(role IN ('admin','supervisore','operatore','struttura')),
      nome TEXT,
      cognome TEXT,
      denominazione TEXT,
      email TEXT NOT NULL,
      telefono TEXT,
      stato TEXT NOT NULL DEFAULT 'attivo' CHECK(stato IN ('attivo','disattivo')),
      enabled_types TEXT,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS insurance_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      codice TEXT UNIQUE NOT NULL,
      stato TEXT NOT NULL DEFAULT 'attivo' CHECK(stato IN ('attivo','disattivo')),
      ordine INTEGER DEFAULT 0,
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
      stato TEXT NOT NULL DEFAULT 'PRESENTATA' CHECK(stato IN ('PRESENTATA','ASSEGNATA','IN LAVORAZIONE','STANDBY','ELABORATA')),
      data_decorrenza TEXT,
      note_struttura TEXT,
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

    CREATE TABLE IF NOT EXISTS policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      quote_id INTEGER NOT NULL REFERENCES quotes(id),
      assistito_id INTEGER REFERENCES assisted_people(id),
      tipo_assicurazione_id INTEGER REFERENCES insurance_types(id),
      struttura_id INTEGER REFERENCES users(id),
      operatore_id INTEGER REFERENCES users(id),
      stato TEXT NOT NULL DEFAULT 'RICHIESTA PRESENTATA' CHECK(stato IN ('RICHIESTA PRESENTATA','IN VERIFICA','DOCUMENTAZIONE MANCANTE','PRONTA PER EMISSIONE','EMESSA')),
      dati_specifici TEXT,
      note_struttura TEXT,
      note_interne TEXT,
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

    CREATE INDEX IF NOT EXISTS idx_quotes_stato ON quotes(stato);
    CREATE INDEX IF NOT EXISTS idx_quotes_struttura ON quotes(struttura_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_operatore ON quotes(operatore_id);
    CREATE INDEX IF NOT EXISTS idx_policies_stato ON policies(stato);
    CREATE INDEX IF NOT EXISTS idx_policies_quote ON policies(quote_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_utente ON activity_logs(utente_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_assisted_cf ON assisted_people(codice_fiscale);
  `);
}

module.exports = { db, initializeDatabase };
