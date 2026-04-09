const { list, getById, insert, upsertById } = require('./store');

async function listQuotes() {
  return list('quotes');
}

async function getQuoteById(id) {
  return getById('quotes', id);
}

async function createQuote(data) {
  return insert('quotes', data);
}

async function updateQuote(id, data) {
  return upsertById('quotes', id, data);
}

module.exports = { listQuotes, getQuoteById, createQuote, updateQuote };
