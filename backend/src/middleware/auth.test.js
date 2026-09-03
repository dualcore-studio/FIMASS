const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

// Il middleware carica lo store al require: lo sostituiamo per pilotare
// l'esito del lookup utente senza toccare InstantDB.
const storePath = require.resolve('../data/store');
let getByIdImpl = async () => null;

require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: { getById: (...args) => getByIdImpl(...args) },
};

const { authenticateToken, generateToken } = require('./auth');

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function requestWith(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

const validToken = () => generateToken({ id: 1, username: 'admin', role: 'admin' });

test('a database outage does not invalidate a valid session', async () => {
  // Regressione: il 429 di InstantDB usciva come 401, il client cancellava il
  // token e rimbalzava al login subito dopo l'accesso.
  getByIdImpl = async () => {
    const err = new Error('Your request exceeded the rate limit.');
    err.status = 429;
    throw err;
  };

  const res = fakeRes();
  await authenticateToken(requestWith(validToken()), res, () => {
    assert.fail('next() non deve essere chiamato quando il DB non risponde');
  });

  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(res.body.code, 'AUTH_BACKEND_UNAVAILABLE');
});

test('a valid token for an active user passes through', async () => {
  getByIdImpl = async () => ({ id: 1, username: 'admin', role: 'admin', stato: 'attivo' });

  const req = requestWith(validToken());
  const res = fakeRes();
  let called = false;
  await authenticateToken(req, res, () => {
    called = true;
  });

  assert.ok(called);
  assert.strictEqual(res.statusCode, null);
  assert.strictEqual(req.user.username, 'admin');
});

test('a tampered token is still rejected with 401', async () => {
  getByIdImpl = async () => ({ id: 1, stato: 'attivo' });

  const res = fakeRes();
  await authenticateToken(requestWith('not-a-real-token'), res, () => {
    assert.fail('next() non deve essere chiamato con un token non valido');
  });

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.code, 'TOKEN_INVALID');
});

test('an expired token is still rejected with 401', async () => {
  getByIdImpl = async () => ({ id: 1, stato: 'attivo' });

  const expired = jwt.sign({ id: 1, role: 'admin' }, 'test-secret', { expiresIn: -10 });
  const res = fakeRes();
  await authenticateToken(requestWith(expired), res, () => {
    assert.fail('next() non deve essere chiamato con un token scaduto');
  });

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.code, 'TOKEN_EXPIRED');
});

test('a deactivated account is still rejected with 401', async () => {
  getByIdImpl = async () => ({ id: 1, username: 'admin', stato: 'sospeso' });

  const res = fakeRes();
  await authenticateToken(requestWith(validToken()), res, () => {
    assert.fail('next() non deve essere chiamato per un account disattivato');
  });

  assert.strictEqual(res.statusCode, 401);
});
