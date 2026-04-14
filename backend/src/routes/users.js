const express = require('express');
const bcrypt = require('bcryptjs');
const { list, getById, findOne, insert, upsertById, removeById, like, paginate } = require('../data/store');
const { sortUsersForList } = require('../utils/userListSort');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { logActivity } = require('./logs');

const router = express.Router();

const COMMISSION_TYPES = new Set(['SEGNALATORE', 'PARTNER', 'SPORTELLO_AMICO']);

function getUserDisplayName(user) {
  return user.role === 'struttura' ? user.denominazione : `${user.nome} ${user.cognome}`;
}

function assertCallerCanManageAdminTarget(req, targetUser, res) {
  if (targetUser.role === 'admin' && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Solo un amministratore può gestire gli account admin.' });
    return false;
  }
  return true;
}

async function countRole(role) {
  const rows = await list('users', (u) => u.role === role);
  return rows.length;
}

async function countActiveAdmins() {
  const rows = await list('users', (u) => u.role === 'admin' && u.stato === 'attivo');
  return rows.length;
}

router.get('/', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const { page = 1, limit = 25, role, stato, search, sort_by: sortBy, sort_dir: sortDir } = req.query;
    try {
      let users = await list('users');
      if (role) users = users.filter((u) => u.role === role);
      if (stato) users = users.filter((u) => u.stato === stato);
      if (search) {
        users = users.filter((u) => like(u.username, search) || like(u.email, search) || like(u.nome, search) || like(u.cognome, search) || like(u.denominazione, search));
      }
      const sortMap = {
        nome: 'denominazione',
        ruolo: 'role',
        email: 'email',
        username: 'username',
        stato: 'stato',
        ultimo_accesso: 'last_login',
        created_at: 'created_at',
      };
      users = sortUsersForList(users, sortBy, sortDir || 'desc', sortMap);
      const payload = paginate(users, page, limit);
      payload.data = payload.data.map((u) => ({
        ...u,
        enabled_types: typeof u.enabled_types === 'string' ? JSON.parse(u.enabled_types) : (u.enabled_types || null),
      }));
      res.json(payload);
    } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ error: 'Errore nel recupero utenti' });
    }
  })();
});

router.get('/operators', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const operators = (await list('users', (u) => u.role === 'operatore' && u.stato === 'attivo'))
      .sort((a, b) => `${a.cognome || ''} ${a.nome || ''}`.localeCompare(`${b.cognome || ''} ${b.nome || ''}`, 'it'))
      .map((u) => ({ id: u.id, nome: u.nome, cognome: u.cognome, email: u.email, role: 'operatore' }));
    res.json(operators);
  })();
});

/** Operatori e fornitori attivi — per assegnazione preventivi. */
router.get('/assignees', authenticateToken, authorizeRoles('admin', 'supervisore', 'fornitore'), (req, res) => {
  (async () => {
    const assignees = (await list('users', (u) => (u.role === 'operatore' || u.role === 'fornitore') && u.stato === 'attivo'))
      .sort((a, b) => `${a.cognome || ''} ${a.nome || ''}`.localeCompare(`${b.cognome || ''} ${b.nome || ''}`, 'it'))
      .map((u) => ({
        id: u.id,
        nome: u.nome,
        cognome: u.cognome,
        email: u.email,
        role: u.role,
      }));
    res.json(assignees);
  })();
});

router.get('/structures', authenticateToken, authorizeRoles('admin', 'supervisore', 'operatore', 'fornitore'), (req, res) => {
  (async () => {
    const structures = (await list('users', (u) => u.role === 'struttura' && u.stato === 'attivo'))
      .sort((a, b) => String(a.denominazione || '').localeCompare(String(b.denominazione || ''), 'it'))
      .map((u) => ({
        id: u.id,
        denominazione: u.denominazione,
        email: u.email,
        role: 'struttura',
        commission_type: u.commission_type && COMMISSION_TYPES.has(u.commission_type) ? u.commission_type : 'SEGNALATORE',
      }));
    res.json(structures);
  })();
});

router.get('/:id', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const user = await getById('users', req.params.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    user.enabled_types = typeof user.enabled_types === 'string' ? JSON.parse(user.enabled_types) : (user.enabled_types || null);
    res.json(user);
  })();
});

router.post('/', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    const {
      username,
      password,
      role,
      nome,
      cognome,
      denominazione,
      email,
      telefono,
      stato,
      enabled_types,
      commission_type,
    } = req.body;

    if (!username || !password || !role || !email) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    if (role === 'struttura') {
      const ct = commission_type != null ? String(commission_type).toUpperCase() : '';
      if (!COMMISSION_TYPES.has(ct)) {
        return res.status(400).json({
          error: 'Tipo provvigione struttura obbligatorio (Segnalatore, Partner o Sportello Amico)',
        });
      }
    }

    const existing = await findOne('users', (u) => u.username === username);
    if (existing) return res.status(409).json({ error: 'Username già in uso' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const ctInsert =
      role === 'struttura' ? String(commission_type).toUpperCase() : null;
    const result = await insert('users', {
      username,
      password: hashedPassword,
      role,
      nome: nome || null,
      cognome: cognome || null,
      denominazione: denominazione || null,
      email,
      telefono: telefono || null,
      stato: stato || 'attivo',
      enabled_types: enabled_types || null,
      commission_type: ctInsert,
    });

    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'CREAZIONE_UTENTE',
      modulo: 'utenti',
      riferimento_id: result.id,
      riferimento_tipo: 'user',
      dettaglio: `Creato utente ${username} con ruolo ${role}`
    });

    res.status(201).json({ id: result.id, message: 'Utente creato con successo' });
  })().catch((err) => {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Errore nella creazione utente' });
  });
});

router.put('/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    const { nome, cognome, denominazione, email, telefono, stato, enabled_types, role, commission_type } = req.body;
    const userId = req.params.id;

    const user = await getById('users', userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    const nextRole = role !== undefined && role !== null && role !== '' ? role : user.role;
    let nextCommissionType = null;
    if (nextRole === 'struttura') {
      const raw =
        commission_type !== undefined && commission_type !== null && commission_type !== ''
          ? String(commission_type).toUpperCase()
          : user.commission_type || 'SEGNALATORE';
      if (!COMMISSION_TYPES.has(raw)) {
        return res.status(400).json({ error: 'Tipo provvigione struttura non valido' });
      }
      nextCommissionType = raw;
    }

    const nextStato = stato || 'attivo';
    if (nextStato === 'disattivo' && nextRole === 'admin' && user.stato === 'attivo') {
      const activeAdmins = await countActiveAdmins();
      if (activeAdmins <= 1) {
        return res.status(400).json({ error: 'Non è possibile disattivare l\'unico amministratore attivo.' });
      }
    }

    await upsertById('users', userId, {
      nome: nome || null,
      cognome: cognome || null,
      denominazione: denominazione || null,
      email,
      telefono: telefono || null,
      stato: nextStato,
      enabled_types: enabled_types || null,
      role: nextRole,
      commission_type: nextCommissionType,
    });

    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'MODIFICA_UTENTE',
      modulo: 'utenti',
      riferimento_id: parseInt(userId),
      riferimento_tipo: 'user',
      dettaglio: `Modificato utente ${user.username}`
    });

    res.json({ message: 'Utente aggiornato con successo' });
  })().catch((err) => {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento utente' });
  });
});

router.post('/:id/reset-password', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Nuova password richiesta' });

    const user = await getById('users', req.params.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    if (!assertCallerCanManageAdminTarget(req, user, res)) return;

    const hashedPassword = bcrypt.hashSync(password, 10);
    await upsertById('users', req.params.id, { password: hashedPassword });

    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'RESET_PASSWORD',
      modulo: 'utenti',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'user',
      dettaglio: `Reset password per utente ${user.username}`
    });

    res.json({ message: 'Password reimpostata con successo' });
  })().catch((err) => {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Errore nel reset password' });
  });
});

router.post('/:id/toggle-status', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const user = await getById('users', req.params.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    if (!assertCallerCanManageAdminTarget(req, user, res)) return;

    const newStato = user.stato === 'attivo' ? 'disattivo' : 'attivo';
    if (newStato === 'disattivo' && user.role === 'admin') {
      const activeAdmins = await countActiveAdmins();
      if (activeAdmins <= 1) {
        return res.status(400).json({ error: 'Non è possibile disattivare l\'unico amministratore attivo.' });
      }
    }
    await upsertById('users', req.params.id, { stato: newStato });

    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: newStato === 'attivo' ? 'RIATTIVAZIONE_UTENTE' : 'DISATTIVAZIONE_UTENTE',
      modulo: 'utenti',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'user',
      dettaglio: `Utente ${user.username} ${newStato === 'attivo' ? 'riattivato' : 'disattivato'}`
    });

    res.json({ message: `Utente ${newStato === 'attivo' ? 'riattivato' : 'disattivato'} con successo`, stato: newStato });
  })().catch((err) => {
    console.error('Error toggling user status:', err);
    res.status(500).json({ error: 'Errore nel cambio stato utente' });
  });
});

router.delete('/:id', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'ID utente non valido' });
    }
    const user = await getById('users', userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    if (!assertCallerCanManageAdminTarget(req, user, res)) return;

    if (Number(req.user.id) === userId) {
      return res.status(400).json({ error: 'Non puoi eliminare il tuo account.' });
    }

    if (user.role === 'admin') {
      const n = await countRole('admin');
      if (n <= 1) {
        return res.status(400).json({ error: 'Non è possibile eliminare l\'unico amministratore.' });
      }
    }

    await removeById('users', userId);

    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'ELIMINAZIONE_UTENTE',
      modulo: 'utenti',
      riferimento_id: userId,
      riferimento_tipo: 'user',
      dettaglio: `Eliminato utente ${user.username}`
    });

    res.json({ message: 'Utente eliminato con successo' });
  })().catch((err) => {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Errore nell\'eliminazione utente' });
  });
});

module.exports = router;
