const { init, id } = require('@instantdb/admin');

let client = null;

function isInstantConfigured() {
  return Boolean(process.env.INSTANT_APP_ID && process.env.INSTANT_ADMIN_TOKEN);
}

function getInstantClient() {
  if (!isInstantConfigured()) {
    throw new Error('InstantDB non configurato: INSTANT_APP_ID e INSTANT_ADMIN_TOKEN richiesti');
  }
  if (!client) {
    client = init({
      appId: process.env.INSTANT_APP_ID,
      adminToken: process.env.INSTANT_ADMIN_TOKEN,
    });
  }
  return client;
}

module.exports = { getInstantClient, isInstantConfigured, instantId: id };
