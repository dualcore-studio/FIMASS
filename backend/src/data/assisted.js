const { list, getById, findOne, insert, upsertById } = require('./store');

async function listAssisted() {
  return list('assisted_people');
}

async function getAssistedById(id) {
  return getById('assisted_people', id);
}

async function getAssistedByCf(codiceFiscale) {
  return findOne('assisted_people', (a) => a.codice_fiscale === codiceFiscale);
}

async function createAssisted(data) {
  return insert('assisted_people', data);
}

async function updateAssisted(id, data) {
  return upsertById('assisted_people', id, data);
}

module.exports = { listAssisted, getAssistedById, getAssistedByCf, createAssisted, updateAssisted };
