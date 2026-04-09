const fs = require('fs');
const path = require('path');
const { db } = require('../config/database');

const TABLES = [
  'users',
  'insurance_types',
  'assisted_people',
  'quotes',
  'quote_status_history',
  'quote_notes',
  'quote_reminders',
  'policies',
  'policy_status_history',
  'attachments',
  'activity_logs',
  'settings',
];

function main() {
  const outPath = process.argv[2] || path.join(process.cwd(), 'sqlite-export.json');
  const payload = {};
  TABLES.forEach((table) => {
    payload[table] = db.prepare(`SELECT * FROM ${table}`).all();
  });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Export completato: ${outPath}`);
  console.log(`Tabelle esportate: ${TABLES.join(', ')}`);
}

main();
