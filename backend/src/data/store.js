const { AsyncLocalStorage } = require('node:async_hooks');
const { getInstantClient, instantId } = require('../lib/instantdb');

const TABLES = [
  'users',
  'insurance_types',
  'assisted_people',
  'quotes',
  'policy_expirations',
  'quote_status_history',
  'quote_notes',
  'quote_reminders',
  'policies',
  'policy_status_history',
  'attachments',
  'activity_logs',
  'settings',
  'commissions',
  'conversations',
  'conversation_messages',
  'conversation_reads',
  'audit_logs',
  'scadenze_reminder_logs',
  'appointments',
  'appointment_status_history',
];

// ── Rate limit InstantDB ───────────────────────────────────────────
// Il piano admin di Instant limita le query al secondo: la dashboard admin ne
// spara una raffica in parallelo e ne perdeva una parte con un 429. Ritentiamo
// con backoff invece di propagare l'errore ai route handler.
const MAX_RETRY_ATTEMPTS = 4;
const MAX_RETRY_WAIT_MS = 2000;

function isRateLimitError(err) {
  return Boolean(err) && (err.status === 429 || err?.body?.type === 'rate-limited');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRateLimitRetry(run) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await run();
    } catch (err) {
      if (!isRateLimitError(err)) throw err;
      lastError = err;
      const retryAfter = Number(err?.body?.hint?.['retry-after']);
      const base = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 150 * 2 ** attempt;
      // Il jitter evita che le chiamate parallele della stessa pagina ripartano insieme.
      await sleep(Math.min(base, MAX_RETRY_WAIT_MS) + Math.floor(Math.random() * 150));
    }
  }
  throw lastError;
}

// ── Cache per singola richiesta HTTP ───────────────────────────────
// Un handler può leggere la stessa tabella molte volte (auth, view, filtri):
// senza cache ognuna è una query a Instant, e la raffica sfonda il rate limit.
// Vive solo per la durata della richiesta e viene svuotata a ogni scrittura.
const requestCacheStorage = new AsyncLocalStorage();

function runWithRequestCache(fn) {
  return requestCacheStorage.run({ tables: new Map(), pending: new Map(), generation: 0 }, fn);
}

function getRequestCache() {
  return requestCacheStorage.getStore() || null;
}

function invalidateRequestCache() {
  const cache = getRequestCache();
  if (!cache) return;
  cache.tables.clear();
  cache.pending.clear();
  // Le letture già in volo hanno dati anteriori alla scrittura: la generazione
  // le fa scadere così non ripopolano la cache con righe superate.
  cache.generation += 1;
}

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function queryTable(namespace) {
  const db = getInstantClient();
  const payload = await withRateLimitRetry(() => db.query({ [namespace]: {} }));
  const rows = Array.isArray(payload?.[namespace]) ? payload[namespace] : [];
  return rows.map((row) => ({
    ...row,
    _instant_id: row.id,
    id: Number(row.db_id ?? row.id),
  }));
}

async function fetchTable(namespace) {
  const cache = getRequestCache();
  if (!cache) return queryTable(namespace);

  // Copia dell'array a ogni lettura: i chiamanti ordinano in place, la cache no.
  if (cache.tables.has(namespace)) return cache.tables.get(namespace).slice();
  if (cache.pending.has(namespace)) return (await cache.pending.get(namespace)).slice();

  const generation = cache.generation;
  const pending = queryTable(namespace)
    .then((rows) => {
      if (cache.generation === generation) cache.tables.set(namespace, rows);
      return rows;
    })
    .finally(() => {
      cache.pending.delete(namespace);
    });
  cache.pending.set(namespace, pending);
  return (await pending).slice();
}

async function fetchAllTables(tableNames = TABLES) {
  const db = getInstantClient();
  const cache = getRequestCache();
  const generation = cache ? cache.generation : 0;

  // Quello che è già in cache non va richiesto di nuovo a Instant.
  const missing = cache ? tableNames.filter((t) => !cache.tables.has(t)) : tableNames;
  if (!missing.length) {
    const cached = {};
    for (const table of tableNames) cached[table] = cache.tables.get(table).slice();
    return cached;
  }

  const query = missing.reduce((acc, t) => {
    acc[t] = {};
    return acc;
  }, {});
  const payload = await withRateLimitRetry(() => db.query(query));
  const tables = {};
  for (const table of tableNames) {
    if (cache && cache.tables.has(table) && !(table in payload)) {
      tables[table] = cache.tables.get(table).slice();
      continue;
    }
    tables[table] = Array.isArray(payload?.[table])
      ? payload[table].map((r) => ({
          ...r,
          _instant_id: r.id,
          id: Number(r.db_id ?? r.id),
        }))
      : [];
    // Abbiamo già i dati: le fetchTable successive nella stessa richiesta
    // non devono tornare a interrogare Instant.
    if (cache && cache.generation === generation && !cache.tables.has(table)) {
      cache.tables.set(table, tables[table]);
    }
  }
  return tables;
}

function normalizeInput(data) {
  const out = { ...data };
  Object.keys(out).forEach((key) => {
    if (out[key] === undefined) delete out[key];
  });
  return out;
}

// Instant accetta una proiezione dei campi; se questa app girasse su una
// versione che non la supporta si torna alla lettura completa.
let supportsFieldProjection = true;

async function nextNumericId(namespace) {
  // Serve solo il massimo di db_id: chiedere le righe intere voleva dire
  // scaricare tutta activity_logs (o audit_logs) a ogni inserimento, e sono
  // le tabelle che crescono a ogni login.
  if (supportsFieldProjection) {
    try {
      const db = getInstantClient();
      const payload = await withRateLimitRetry(() => db.query({ [namespace]: { $: { fields: ['db_id'] } } }));
      const rows = Array.isArray(payload?.[namespace]) ? payload[namespace] : [];
      const max = rows.reduce((acc, row) => Math.max(acc, Number(row.db_id ?? row.id) || 0), 0);
      // Se ci sono righe ma nessun db_id, la proiezione ha scartato il campo:
      // restituire 1 qui vorrebbe dire assegnare un id già in uso.
      if (rows.length && max === 0) {
        throw new Error(`nextNumericId: nessun db_id nella proiezione di ${namespace}`);
      }
      return max + 1;
    } catch (err) {
      if (isRateLimitError(err)) throw err;
      // Un id sbagliato creerebbe duplicati: meglio pagare la lettura intera.
      console.warn('nextNumericId: proiezione non disponibile, uso la lettura completa:', err?.message || err);
      supportsFieldProjection = false;
    }
  }

  const rows = await fetchTable(namespace);
  const max = rows.reduce((acc, row) => Math.max(acc, Number(row.id) || 0), 0);
  return max + 1;
}

async function insert(namespace, data) {
  const db = getInstantClient();
  const logicalId = data.id ? Number(data.id) : await nextNumericId(namespace);
  const instantEntityId = instantId();
  const row = normalizeInput({
    ...data,
    db_id: logicalId,
    created_at: data.created_at || nowIso(),
    updated_at: data.updated_at || nowIso(),
  });
  delete row.id;
  await withRateLimitRetry(() => db.transact([db.tx[namespace][instantEntityId].update(row)]));
  invalidateRequestCache();
  return { ...row, id: logicalId, _instant_id: instantEntityId };
}

async function upsertById(namespace, id, patch) {
  const db = getInstantClient();
  const rows = await fetchTable(namespace);
  const current = rows.find((r) => Number(r.id) === Number(id)) || null;
  if (!current) {
    return insert(namespace, { ...patch, id: Number(id) });
  }
  const row = normalizeInput({
    ...current,
    ...patch,
    db_id: Number(id),
    updated_at: nowIso(),
  });
  delete row.id;
  delete row._instant_id;
  await withRateLimitRetry(() => db.transact([db.tx[namespace][current._instant_id].update(row)]));
  invalidateRequestCache();
  return { ...row, id: Number(id), _instant_id: current._instant_id };
}

async function removeById(namespace, id) {
  const db = getInstantClient();
  const current = await getById(namespace, id);
  if (!current) {
    throw new Error(`removeById: record not found in ${namespace} for id ${id}`);
  }
  if (!current._instant_id) {
    throw new Error(`removeById: missing Instant id for ${namespace}#${id}`);
  }
  await withRateLimitRetry(() => db.transact([db.tx[namespace][current._instant_id].delete()]));
  invalidateRequestCache();
}

async function getById(namespace, id) {
  const rows = await fetchTable(namespace);
  return rows.find((row) => Number(row.id) === Number(id)) || null;
}

async function findOne(namespace, predicate) {
  const rows = await fetchTable(namespace);
  return rows.find(predicate) || null;
}

async function list(namespace, predicate = null) {
  const rows = await fetchTable(namespace);
  return predicate ? rows.filter(predicate) : rows;
}

function like(haystack, needle) {
  if (!needle) return true;
  return String(haystack || '').toLowerCase().includes(String(needle).toLowerCase());
}

function sortBy(rows, sortByField, sortDir = 'asc') {
  const dir = String(sortDir).toLowerCase() === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a?.[sortByField];
    const bv = b?.[sortByField];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), 'it', { sensitivity: 'base' }) * dir;
  });
}

function paginate(rows, page = 1, limit = 25) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.max(1, Number(limit) || 25);
  const offset = (p - 1) * l;
  const total = rows.length;
  return {
    data: rows.slice(offset, offset + l),
    total,
    page: p,
    limit: l,
    totalPages: Math.max(1, Math.ceil(total / l)),
  };
}

module.exports = {
  TABLES,
  nowIso,
  like,
  sortBy,
  paginate,
  fetchTable,
  fetchAllTables,
  runWithRequestCache,
  insert,
  upsertById,
  removeById,
  getById,
  findOne,
  list,
};
