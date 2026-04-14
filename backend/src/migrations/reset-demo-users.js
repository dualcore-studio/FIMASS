const bcrypt = require('bcryptjs');
const { findOne, insert, upsertById } = require('../data/store');
const { isInstantConfigured } = require('../lib/instantdb');

const DEMO_USERS = [
  {
    username: 'admin',
    password: 'Bottone1',
    role: 'admin',
    nome: 'Marco',
    cognome: 'Rossi',
    denominazione: null,
    email: 'admin@fimass.it',
    stato: 'attivo',
    enabled_types: null,
  },
  {
    username: 'supervisore1',
    password: 'super123',
    role: 'supervisore',
    nome: 'Laura',
    cognome: 'Bianchi',
    denominazione: null,
    email: 'supervisore@fimass.it',
    stato: 'attivo',
    enabled_types: null,
  },
  {
    username: 'operatore1',
    password: 'oper123',
    role: 'operatore',
    nome: 'Anna',
    cognome: 'Ferraro',
    denominazione: null,
    email: 'operatore@fimass.it',
    stato: 'attivo',
    enabled_types: null,
  },
  {
    username: 'struttura1',
    password: 'strut123',
    role: 'struttura',
    nome: null,
    cognome: null,
    denominazione: 'Agenzia Demo',
    email: 'struttura@fimass.it',
    stato: 'attivo',
    enabled_types: ['all'],
  },
];

async function resetDemoUsers() {
  if (!isInstantConfigured()) {
    throw new Error('InstantDB non configurato. Servono INSTANT_APP_ID e INSTANT_ADMIN_TOKEN.');
  }

  for (const user of DEMO_USERS) {
    const existing = await findOne('users', (u) => u.username === user.username);
    const passwordHash = bcrypt.hashSync(user.password, 10);

    if (existing) {
      await upsertById('users', existing.id, {
        username: user.username,
        password: passwordHash,
        role: user.role,
        nome: user.nome,
        cognome: user.cognome,
        denominazione: user.denominazione,
        email: user.email,
        stato: user.stato,
        enabled_types: user.enabled_types,
      });
      console.log(`Aggiornato utente ${user.username}`);
    } else {
      await insert('users', {
        username: user.username,
        password: passwordHash,
        role: user.role,
        nome: user.nome,
        cognome: user.cognome,
        denominazione: user.denominazione,
        email: user.email,
        stato: user.stato,
        enabled_types: user.enabled_types,
      });
      console.log(`Creato utente ${user.username}`);
    }
  }

  console.log('Reset utenti demo completato.');
}

resetDemoUsers().catch((err) => {
  console.error('Errore reset utenti demo:', err);
  process.exit(1);
});
