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
