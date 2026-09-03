const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDatiPreventivoForMerge } = require('./views');

test('normalizeDatiPreventivoForMerge: oggetto JSON resta clonabile per merge', () => {
  const base = { foo: 1 };
  const out = normalizeDatiPreventivoForMerge(JSON.stringify(base));
  assert.deepEqual(out, base);
  out.bar = 2;
  assert.deepEqual(base, { foo: 1 });
});

test('normalizeDatiPreventivoForMerge: stringa non JSON → {}', () => {
  assert.deepEqual(normalizeDatiPreventivoForMerge('not-json'), {});
});

test('normalizeDatiPreventivoForMerge: array → {} (evita spread indici)', () => {
  assert.deepEqual(normalizeDatiPreventivoForMerge('[1,2]'), {});
});

test('normalizeDatiPreventivoForMerge: null / undefined → {}', () => {
  assert.deepEqual(normalizeDatiPreventivoForMerge(null), {});
  assert.deepEqual(normalizeDatiPreventivoForMerge(undefined), {});
});

// ── Copertura del contesto ─────────────────────────────────────────
// loadContext non scarica più tutte le tabelle: se qualcuno aggiunge un
// `ctx.nuova_tabella` senza metterla in CONTEXT_TABLES otterrebbe undefined
// in produzione. Questo test legge il codice e lo impedisce.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { CONTEXT_TABLES } = require('./views');
const { TABLES } = require('./store');

test('CONTEXT_TABLES copre ogni tabella letta da ctx nel backend', () => {
  const backendSrc = path.join(__dirname, '..');
  const grep = execFileSync(
    'grep',
    ['-rhoE', 'ctx[A-Za-z]*\\.[a-z_]+', backendSrc],
    { encoding: 'utf-8' },
  );

  // Campi calcolati da loadContext o nomi di comodo, non tabelle.
  const derived = new Set(['types', 'assisted', 'policy']);

  const used = new Set(
    grep
      .split('\n')
      .filter(Boolean)
      .map((match) => match.replace(/^ctx[A-Za-z]*\./, ''))
      .filter((name) => !derived.has(name))
      .filter((name) => TABLES.includes(name)),
  );

  const missing = [...used].filter((name) => !CONTEXT_TABLES.includes(name));
  assert.deepStrictEqual(missing, [], `tabelle lette da ctx ma non caricate: ${missing.join(', ')}`);
});
