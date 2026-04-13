const { fetchAllTables } = require('./store');
const { normalizePolicyStato } = require('../utils/policyStato');

function parseMaybeJson(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function mapById(rows) {
  const map = new Map();
  rows.forEach((r) => map.set(Number(r.id), r));
  return map;
}

async function loadContext() {
  const tables = await fetchAllTables();
  return {
    ...tables,
    usersById: mapById(tables.users),
    assistedById: mapById(tables.assisted_people),
    typesById: mapById(tables.insurance_types),
    quotesById: mapById(tables.quotes),
    policiesById: mapById(tables.policies),
  };
}

function enrichQuote(quote, ctx) {
  const assisted = ctx.assistedById.get(Number(quote.assistito_id)) || {};
  const type = ctx.typesById.get(Number(quote.tipo_assicurazione_id)) || {};
  const struttura = ctx.usersById.get(Number(quote.struttura_id)) || {};
  const operatore = ctx.usersById.get(Number(quote.operatore_id)) || {};
  return {
    ...quote,
    assistito_nome: assisted.nome,
    assistito_cognome: assisted.cognome,
    assistito_cf: assisted.codice_fiscale,
    assistito_data_nascita: assisted.data_nascita,
    assistito_cellulare: assisted.cellulare,
    assistito_email: assisted.email,
    assistito_indirizzo: assisted.indirizzo,
    assistito_cap: assisted.cap,
    assistito_citta: assisted.citta,
    tipo_nome: type.nome,
    tipo_codice: type.codice,
    struttura_nome: struttura.denominazione,
    struttura_email: struttura.email,
    operatore_nome: operatore.nome,
    operatore_cognome: operatore.cognome,
    dati_specifici: parseMaybeJson(quote.dati_specifici),
    dati_preventivo: parseMaybeJson(quote.dati_preventivo),
  };
}

function enrichPolicy(policy, ctx) {
  const assisted = ctx.assistedById.get(Number(policy.assistito_id)) || {};
  const type = ctx.typesById.get(Number(policy.tipo_assicurazione_id)) || {};
  const struttura = ctx.usersById.get(Number(policy.struttura_id)) || {};
  const operatore = ctx.usersById.get(Number(policy.operatore_id)) || {};
  const quote = ctx.quotesById.get(Number(policy.quote_id)) || {};
  const polAtts = (ctx.attachments || []).filter(
    (a) => a.entity_type === 'policy' && Number(a.entity_id) === Number(policy.id),
  );
  const ricevuta = polAtts.find((a) => a.tipo === 'ricevuta_pagamento');
  const polizzaFinale = polAtts.find((a) => a.tipo === 'polizza_emessa');
  return {
    ...policy,
    stato: normalizePolicyStato(policy.stato),
    assistito_nome: assisted.nome,
    assistito_cognome: assisted.cognome,
    assistito_cf: assisted.codice_fiscale,
    assistito_data_nascita: assisted.data_nascita,
    assistito_cellulare: assisted.cellulare,
    assistito_email: assisted.email,
    assistito_indirizzo: assisted.indirizzo,
    assistito_cap: assisted.cap,
    assistito_citta: assisted.citta,
    tipo_nome: type.nome,
    tipo_codice: type.codice,
    struttura_nome: struttura.denominazione,
    operatore_nome: operatore.nome,
    operatore_cognome: operatore.cognome,
    preventivo_numero: quote.numero,
    preventivo_id: quote.id,
    dati_specifici: parseMaybeJson(policy.dati_specifici),
    ricevuta_pagamento_attachment_id: ricevuta ? Number(ricevuta.id) : null,
    polizza_emessa_attachment_id: polizzaFinale ? Number(polizzaFinale.id) : null,
  };
}

module.exports = { loadContext, enrichQuote, enrichPolicy, parseMaybeJson };
