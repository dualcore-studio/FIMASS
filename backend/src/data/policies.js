const { list, getById, insert, upsertById } = require('./store');

async function listPolicies() {
  return list('policies');
}

async function getPolicyById(id) {
  return getById('policies', id);
}

async function createPolicy(data) {
  return insert('policies', data);
}

async function updatePolicy(id, data) {
  return upsertById('policies', id, data);
}

module.exports = { listPolicies, getPolicyById, createPolicy, updatePolicy };
