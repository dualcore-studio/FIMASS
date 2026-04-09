const { list, getById, findOne, insert, upsertById } = require('./store');

async function listUsers() {
  return list('users');
}

async function getUserById(id) {
  return getById('users', id);
}

async function getUserByUsername(username) {
  return findOne('users', (u) => u.username === username);
}

async function createUser(data) {
  return insert('users', data);
}

async function updateUser(id, data) {
  return upsertById('users', id, data);
}

module.exports = { listUsers, getUserById, getUserByUsername, createUser, updateUser };
