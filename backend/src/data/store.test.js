const test = require('node:test');
const assert = require('node:assert');

// Lo store parla con InstantDB al primo require: sostituiamo il client prima
// di caricarlo, così i test contano le query senza toccare la rete.
const instantPath = require.resolve('../lib/instantdb');
const calls = { query: 0 };
let queryImpl = async () => ({});

require.cache[instantPath] = {
  id: instantPath,
  filename: instantPath,
  loaded: true,
  exports: {
    getInstantClient: () => ({
      query: (...args) => {
        calls.query += 1;
        return queryImpl(...args);
      },
    }),
    isInstantConfigured: () => true,
    instantId: () => 'instant-id',
  },
};

const { fetchTable, fetchAllTables, runWithRequestCache } = require('./store');

function reset(impl) {
  calls.query = 0;
  queryImpl = impl;
}

function rateLimited() {
  const err = new Error('Your request exceeded the rate limit.');
  err.status = 429;
  err.body = { type: 'rate-limited', hint: { 'retry-after': 0 } };
  return err;
}

test('within one request the same table is queried once', async () => {
  reset(async () => ({ users: [{ id: 'uuid-1', db_id: 7, username: 'admin' }] }));

  await runWithRequestCache(async () => {
    const first = await fetchTable('users');
    const second = await fetchTable('users');
    assert.strictEqual(first[0].username, 'admin');
    assert.strictEqual(second[0].id, 7);
  });

  assert.strictEqual(calls.query, 1);
});

test('parallel reads of the same table share a single query', async () => {
  reset(async () => ({ users: [{ id: 'uuid-1', db_id: 7 }] }));

  await runWithRequestCache(async () => {
    await Promise.all([fetchTable('users'), fetchTable('users'), fetchTable('users')]);
  });

  assert.strictEqual(calls.query, 1);
});

test('each caller gets its own array, so in-place sorts do not leak', async () => {
  reset(async () => ({ users: [{ id: 'a', db_id: 2 }, { id: 'b', db_id: 1 }] }));

  await runWithRequestCache(async () => {
    const first = await fetchTable('users');
    first.sort((a, b) => a.id - b.id);
    const second = await fetchTable('users');
    assert.notStrictEqual(first, second);
    assert.strictEqual(second[0].id, 2);
  });
});

test('without a request context nothing is cached', async () => {
  reset(async () => ({ users: [] }));

  await fetchTable('users');
  await fetchTable('users');

  assert.strictEqual(calls.query, 2);
});

test('fetchAllTables primes the cache for later single-table reads', async () => {
  reset(async () => ({ users: [{ id: 'a', db_id: 1 }], quotes: [] }));

  await runWithRequestCache(async () => {
    await fetchAllTables();
    await fetchTable('users');
    await fetchTable('quotes');
  });

  assert.strictEqual(calls.query, 1);
});

test('a rate-limited query is retried instead of failing', async () => {
  let attempts = 0;
  reset(async () => {
    attempts += 1;
    if (attempts < 3) throw rateLimited();
    return { users: [{ id: 'a', db_id: 1 }] };
  });

  const rows = await fetchTable('users');

  assert.strictEqual(attempts, 3);
  assert.strictEqual(rows.length, 1);
});

test('non-rate-limit errors are not retried', async () => {
  let attempts = 0;
  reset(async () => {
    attempts += 1;
    const err = new Error('boom');
    err.status = 500;
    throw err;
  });

  await assert.rejects(() => fetchTable('users'), /boom/);
  assert.strictEqual(attempts, 1);
});
