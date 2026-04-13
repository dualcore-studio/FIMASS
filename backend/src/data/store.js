const { getInstantClient, instantId } = require('../lib/instantdb');

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
  'commissions',
];

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function fetchTable(namespace) {
  const db = getInstantClient();
  const payload = await db.query({ [namespace]: {} });
  const rows = Array.isArray(payload?.[namespace]) ? payload[namespace] : [];
  return rows.map((row) => ({
    ...row,
    _instant_id: row.id,
    id: Number(row.db_id ?? row.id),
  }));
}

async function fetchAllTables() {
  const db = getInstantClient();
  const query = TABLES.reduce((acc, t) => {
    acc[t] = {};
    return acc;
  }, {});
  const payload = await db.query(query);
  const tables = {};
  for (const table of TABLES) {
    tables[table] = Array.isArray(payload?.[table])
      ? payload[table].map((r) => ({
          ...r,
          _instant_id: r.id,
          id: Number(r.db_id ?? r.id),
        }))
      : [];
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

async function nextNumericId(namespace) {
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
  await db.transact([db.tx[namespace][instantEntityId].update(row)]);
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
  await db.transact([db.tx[namespace][current._instant_id].update(row)]);
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
  await db.transact([db.tx[namespace][current._instant_id].delete()]);
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
  insert,
  upsertById,
  removeById,
  getById,
  findOne,
  list,
};
