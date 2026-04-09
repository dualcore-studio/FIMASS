const fs = require('fs');
const path = require('path');
const { insert, upsertById } = require('../data/store');

const ORDER = [
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

async function upsertTable(table, rows) {
  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    if (row.id != null) {
      await upsertById(table, row.id, row);
      updated += 1;
    } else {
      await insert(table, row);
      inserted += 1;
    }
  }
  return { inserted, updated };
}

async function main() {
  const inPath = process.argv[2] || path.join(process.cwd(), 'sqlite-export.json');
  if (!fs.existsSync(inPath)) {
    throw new Error(`File non trovato: ${inPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const report = {};
  for (const table of ORDER) {
    const rows = Array.isArray(raw[table]) ? raw[table] : [];
    report[table] = await upsertTable(table, rows);
    console.log(`${table}:`, report[table]);
  }
  const reportPath = path.join(process.cwd(), 'instantdb-import-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Import completato. Report: ${reportPath}`);
}

main().catch((err) => {
  console.error('Import fallito:', err);
  process.exit(1);
});
