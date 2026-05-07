const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { list, getById, insert, upsertById, removeById, like, paginate } = require('../data/store');
const { logActivity } = require('./logs');
const {
  APPOINTMENT_STATI,
  APPOINTMENT_MODALITA,
  DURATE_AMMESSE,
  normalizeStato,
  isStatoChiuso,
  strutturaPuoModificare,
} = require('../utils/appointmentStato');
const { TIME_RE, addMinutesToOra, intervalsOverlap, sameData } = require('../utils/appointmentsTime');
const { validatePresenzaAppointmentSlot } = require('../utils/appointmentPresenzaSlot');
const {
  sendAppointmentCreatedToFornitoreMail,
  sendAppointmentUpdateToStrutturaMail,
  sendAppointmentVideocallConfirmedToAssistitoMail,
  sendAppointmentAnnullatoToFornitoreMail,
} = require('../lib/resend');

const router = express.Router();

const PARTECIPANT_ROLES = ['struttura', 'fornitore', 'admin', 'supervisore'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getUserDisplayName(u) {
  if (!u) return '—';
  if (u.role === 'struttura') return u.denominazione || u.email;
  return [u.nome, u.cognome].filter(Boolean).join(' ') || u.email;
}

function assistitoLabel(apt) {
  return [apt.assistito_nome, apt.assistito_cognome].filter(Boolean).join(' ').trim() || '—';
}

function dataOraIt(apt) {
  const d = String(apt.data_appuntamento || '').slice(0, 10);
  const parts = d.split('-');
  const dataIt = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
  return [dataIt, apt.ora_inizio].filter(Boolean).join(' ').trim();
}

function conflittoConta(stato) {
  const s = normalizeStato(stato);
  return s !== 'ANNULLATO' && s !== 'COMPLETATO';
}

/**
 * @returns {string|null} messaggio errore
 */
function findSlotConflict(appointments, { fornitoreId, data, oraInizio, durata, excludeId }) {
  const oi = String(oraInizio || '').trim();
  for (const a of appointments) {
    if (excludeId != null && Number(a.id) === Number(excludeId)) continue;
    if (Number(a.fornitore_id) !== Number(fornitoreId)) continue;
    if (!sameData(a.data_appuntamento, data)) continue;
    if (!conflittoConta(a.stato)) continue;
    if (intervalsOverlap(oi, durata, a.ora_inizio, Number(a.durata_minuti) || 60)) {
      return 'Esiste già un appuntamento per lo stesso fornitore in questo orario';
    }
  }
  return null;
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

/** Almeno 5 cifre (ignora spazi, +, trattini). */
function isValidAssistitoPhone(s) {
  const digits = String(s || '').replace(/\D/g, '');
  return digits.length >= 5;
}

/**
 * In conferma, per telefonata si usa solo il telefono assistito (nessun ulteriore "numero di riferimento").
 * @param {'creazione'|'conferma'} phase
 */
function validateModalitaFields(modalita, { luogo, link_videocall, assistito_telefono }, phase) {
  const m = String(modalita || '').toLowerCase();
  if (m === 'presenza') {
    if (!String(luogo || '').trim()) {
      return phase === 'conferma' ? 'Indicare il luogo' : 'Il luogo è obbligatorio per appuntamenti in presenza';
    }
  } else if (m === 'videocall') {
    if (phase === 'conferma' && !String(link_videocall || '').trim()) {
      return 'Il link videocall è obbligatorio in fase di conferma';
    }
  } else if (m === 'telefonata') {
    if (phase === 'conferma' && !String(assistito_telefono || '').trim()) {
      return 'Il telefono dell’assistito è obbligatorio per confermare la telefonata';
    }
  }
  return null;
}

async function loadApptsContext() {
  const rows = await list('appointments');
  const users = await list('users');
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return { appointments: rows, usersById: byId, users };
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    nome: u.nome,
    cognome: u.cognome,
    denominazione: u.denominazione,
    email: u.email,
    telefono: u.telefono || null,
    role: u.role,
  };
}

function enrich(apt, usersById) {
  return {
    ...apt,
    struttura: publicUser(usersById[apt.struttura_id]),
    fornitore: publicUser(usersById[apt.fornitore_id]),
    creato_da: publicUser(apt.created_by_user_id != null ? usersById[apt.created_by_user_id] : null),
  };
}

async function historyFor(appointmentId) {
  const rows = await list('appointment_status_history', (h) => Number(h.appointment_id) === Number(appointmentId));
  return rows
    .map((h) => ({ ...h, id: h.id }))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

async function enrichHistory(rows, usersById) {
  return rows.map((h) => ({
    ...h,
    utente: publicUser(h.utente_id != null ? usersById[h.utente_id] : null),
  }));
}

async function recordHistory({ appointmentId, oldStatus, newStatus, utenteId, nota }) {
  await insert('appointment_status_history', {
    appointment_id: appointmentId,
    stato_precedente: oldStatus != null ? String(oldStatus) : null,
    stato_nuovo: String(newStatus),
    utente_id: utenteId,
    nota: nota || null,
  });
}

// --- list ---
router.get('/', authenticateToken, authorizeRoles(...PARTECIPANT_ROLES), (req, res) => {
  (async () => {
    const {
      page = 1,
      limit = 10,
      stato,
      data_da,
      data_a,
      fornitore_id,
      struttura_id,
      modalita,
      assistito,
      oggetto,
      sort_by: sortByParam,
      sort_dir: sortDir = 'asc',
    } = req.query;
    const { user } = req;
    try {
      const { appointments, usersById } = await loadApptsContext();
      let rows = appointments;

      if (user.role === 'struttura') {
        rows = rows.filter((a) => Number(a.struttura_id) === Number(user.id));
      } else if (user.role === 'fornitore') {
        rows = rows.filter((a) => Number(a.fornitore_id) === Number(user.id));
      }

      if (stato) rows = rows.filter((a) => normalizeStato(a.stato) === String(stato).toUpperCase());
      if (data_da) rows = rows.filter((a) => String(a.data_appuntamento) >= String(data_da));
      if (data_a) rows = rows.filter((a) => String(a.data_appuntamento) <= String(data_a));
      if (fornitore_id) rows = rows.filter((a) => Number(a.fornitore_id) === Number(fornitore_id));
      if (struttura_id) rows = rows.filter((a) => Number(a.struttura_id) === Number(struttura_id));
      if (modalita) rows = rows.filter((a) => String(a.modalita) === String(modalita).toLowerCase());
      if (assistito) {
        const n = String(assistito);
        rows = rows.filter(
          (a) => like(a.assistito_nome, n) || like(a.assistito_cognome, n) || like(`${a.assistito_nome} ${a.assistito_cognome}`, n),
        );
      }
      if (oggetto) {
        const n = String(oggetto);
        rows = rows.filter((a) => like(a.oggetto, n));
      }

      const sortAscending = String(sortDir).toLowerCase() !== 'desc';
      const sorted = [...rows].sort((a, b) => {
        const c1 = String(a.data_appuntamento || '').localeCompare(String(b.data_appuntamento || ''));
        if (c1 !== 0) return sortAscending ? c1 : -c1;
        const c2 = String(a.ora_inizio || '').localeCompare(String(b.ora_inizio || ''));
        return sortAscending ? c2 : -c2;
      });
      const payload = paginate(sorted, page, limit);
      payload.data = payload.data.map((a) => enrich(a, usersById));
      res.json(payload);
    } catch (err) {
      console.error('appointments list:', err);
      res.status(500).json({ error: 'Errore nel recupero degli appuntamenti' });
    }
  })();
});

// --- history (prima di /:id) ---
router.get('/:id/history', authenticateToken, authorizeRoles(...PARTECIPANT_ROLES), (req, res) => {
  (async () => {
    const { user } = req;
    const id = req.params.id;
    const apt = await getById('appointments', id);
    if (!apt) return res.status(404).json({ error: 'Appuntamento non trovato' });
    if (user.role === 'struttura' && Number(apt.struttura_id) !== Number(user.id)) return res.status(403).json({ error: 'Accesso negato' });
    if (user.role === 'fornitore' && Number(apt.fornitore_id) !== Number(user.id)) return res.status(403).json({ error: 'Accesso negato' });
    const { usersById } = await loadApptsContext();
    const hist = await historyFor(id);
    res.json(await enrichHistory(hist, usersById));
  })().catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Errore' });
  });
});

// --- detail ---
router.get('/:id', authenticateToken, authorizeRoles(...PARTECIPANT_ROLES), (req, res) => {
  (async () => {
    const { user } = req;
    const id = req.params.id;
    try {
      const apt = await getById('appointments', id);
      if (!apt) return res.status(404).json({ error: 'Appuntamento non trovato' });
      if (user.role === 'struttura' && Number(apt.struttura_id) !== Number(user.id)) {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      if (user.role === 'fornitore' && Number(apt.fornitore_id) !== Number(user.id)) {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      const { usersById } = await loadApptsContext();
      const hist = await historyFor(apt.id);
      const histEnr = await enrichHistory(hist, usersById);
      res.json({ ...enrich(apt, usersById), history: histEnr });
    } catch (err) {
      console.error('appointment detail:', err);
      res.status(500).json({ error: 'Errore nel recupero' });
    }
  })();
});

// --- create (struttura) ---
router.post('/', authenticateToken, authorizeRoles('struttura'), (req, res) => {
  (async () => {
    const { user } = req;
    const body = req.body || {};
    const fornitoreId = body.fornitore_id;
    const modalita = String(body.modalita || '').toLowerCase();
    const assistito_nome = String(body.assistito_nome || '').trim();
    const assistito_cognome = String(body.assistito_cognome || '').trim();
    const oggetto = String(body.oggetto || '').trim();
    const data_appuntamento = String(body.data_appuntamento || '').trim();
    const ora_inizio = String(body.ora_inizio || '').trim();
    const durata_minuti = DURATE_AMMESSE.has(Number(body.durata_minuti)) ? Number(body.durata_minuti) : 60;
    const note = body.note != null ? String(body.note) : null;
    const luogo = body.luogo != null ? String(body.luogo).trim() : '';
    const assistito_telefono = body.assistito_telefono != null ? String(body.assistito_telefono).trim() : '';
    const assistito_email = body.assistito_email != null ? String(body.assistito_email).trim() : '';

    try {
      if (!fornitoreId) return res.status(400).json({ error: 'Fornitore obbligatorio' });
      const forn = await getById('users', fornitoreId);
      if (!forn || forn.role !== 'fornitore' || forn.stato !== 'attivo') {
        return res.status(400).json({ error: 'Fornitore non valido' });
      }
      if (!APPOINTMENT_MODALITA.has(modalita)) return res.status(400).json({ error: 'Modalità non valida' });
      if (!assistito_nome || !assistito_cognome) return res.status(400).json({ error: 'Nome e cognome assistito obbligatori' });
      if (!isValidAssistitoPhone(assistito_telefono)) {
        return res.status(400).json({ error: 'Il telefono assistito non è valido (inserire almeno 5 cifre)' });
      }
      if (!assistito_email) return res.status(400).json({ error: 'Email assistito obbligatoria' });
      if (!isValidEmail(assistito_email)) return res.status(400).json({ error: 'Email assistito non valida' });
      if (!oggetto) return res.status(400).json({ error: 'Oggetto obbligatorio' });
      if (!DATE_RE.test(data_appuntamento)) return res.status(400).json({ error: 'Data appuntamento non valida' });
      if (!TIME_RE.test(ora_inizio)) return res.status(400).json({ error: 'Ora inizio non valida (formato HH:MM)' });
      const vMode = validateModalitaFields(
        modalita,
        { luogo, link_videocall: null, assistito_telefono },
        'creazione',
      );
      if (vMode) return res.status(400).json({ error: vMode });

      const presenzaErr = validatePresenzaAppointmentSlot(modalita, data_appuntamento, ora_inizio, durata_minuti);
      if (presenzaErr) return res.status(400).json({ error: presenzaErr });

      const ora_fine = addMinutesToOra(ora_inizio, durata_minuti);
      if (!ora_fine) return res.status(400).json({ error: 'Impossibile calcolare l\'orario di fine' });

      const { appointments } = await loadApptsContext();
      const conf = findSlotConflict(appointments, {
        fornitoreId,
        data: data_appuntamento,
        oraInizio: ora_inizio,
        durata: durata_minuti,
        excludeId: null,
      });
      if (conf) return res.status(409).json({ error: conf });

      const created = await insert('appointments', {
        struttura_id: user.id,
        fornitore_id: fornitoreId,
        created_by_user_id: user.id,
        assistito_nome,
        assistito_cognome,
        assistito_telefono,
        assistito_email,
        modalita,
        oggetto,
        note: note || null,
        data_appuntamento,
        ora_inizio,
        ora_fine,
        durata_minuti,
        luogo: luogo || null,
        link_videocall: null,
        /** Non più usato per telefonata: usare `assistito_telefono`. Lasciare null. */
        numero_telefonico_riferimento: null,
        stato: 'RICHIESTO',
        motivo_riprogrammazione: null,
        motivo_annullamento: null,
      });
      await recordHistory({
        appointmentId: created.id,
        oldStatus: null,
        newStatus: 'RICHIESTO',
        utenteId: user.id,
        nota: 'Creazione richiesta',
      });

      const strutt = await getById('users', user.id);
      logActivity({
        utente_id: user.id,
        utente_nome: getUserDisplayName(strutt),
        ruolo: user.role,
        azione: 'appuntamento_creato',
        modulo: 'appuntamenti',
        riferimento_id: created.id,
        riferimento_tipo: 'appointment',
        dettaglio: `Oggetto: ${oggetto}`,
      });

      await sendAppointmentCreatedToFornitoreMail({
        to: forn.email,
        fornitoreName: getUserDisplayName(forn),
        appointmentId: created.id,
        oggetto,
        strutturaNome: getUserDisplayName(strutt),
        assistitoNome: assistitoLabel(created),
        modalita,
        dataOra: dataOraIt(created),
        note: note || undefined,
        luogo: luogo || undefined,
        telefonoAssistito: assistito_telefono || undefined,
        linkVideocall: null,
      });

      const { usersById } = await loadApptsContext();
      res.status(201).json(enrich(created, usersById));
    } catch (err) {
      console.error('appointments create:', err);
      res.status(500).json({ error: 'Errore durante la creazione' });
    }
  })();
});

// --- update ---
router.put('/:id', authenticateToken, authorizeRoles('struttura', 'admin', 'supervisore'), (req, res) => {
  (async () => {
    const { user } = req;
    const id = req.params.id;
    const body = req.body || {};
    const apt0 = await getById('appointments', id);
    if (!apt0) return res.status(404).json({ error: 'Appuntamento non trovato' });

    if (user.role === 'struttura' && Number(apt0.struttura_id) !== Number(user.id)) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    if (user.role === 'struttura' && isStatoChiuso(apt0.stato)) {
      return res.status(400).json({ error: 'Appuntamento non modificabile' });
    }
    if (user.role === 'struttura' && !strutturaPuoModificare(apt0.stato)) {
      return res.status(400).json({ error: 'In questo stato la modifica non è consentita' });
    }
    if ((user.role === 'admin' || user.role === 'supervisore') && isStatoChiuso(apt0.stato) && body.stato != null) {
      return res.status(400).json({ error: 'Modifica stato non consentita su appuntamento chiuso' });
    }
    if (user.role === 'struttura' && body.fornitore_id != null) {
      return res.status(400).json({ error: 'Non è possibile cambiare fornitore' });
    }

    try {
      const { appointments, usersById } = await loadApptsContext();
      let fornitoreId = Number(apt0.fornitore_id);
      if ((user.role === 'admin' || user.role === 'supervisore') && body.fornitore_id != null) {
        fornitoreId = Number(body.fornitore_id);
        const forn = await getById('users', fornitoreId);
        if (!forn || forn.role !== 'fornitore' || forn.stato !== 'attivo') {
          return res.status(400).json({ error: 'Fornitore non valido' });
        }
      }

      const patch = { ...apt0 };
      const fields = [
        'assistito_nome',
        'assistito_cognome',
        'assistito_telefono',
        'assistito_email',
        'modalita',
        'oggetto',
        'note',
        'data_appuntamento',
        'ora_inizio',
        'durata_minuti',
        'luogo',
        'link_videocall',
        'numero_telefonico_riferimento',
      ];
      for (const f of fields) {
        if (body[f] !== undefined) patch[f] = body[f];
      }
      if (body.modalita) patch.modalita = String(body.modalita).toLowerCase();
      if (body.durata_minuti != null) {
        patch.durata_minuti = DURATE_AMMESSE.has(Number(body.durata_minuti)) ? Number(body.durata_minuti) : Number(apt0.durata_minuti) || 60;
      }
      patch.fornitore_id = user.role === 'struttura' ? apt0.fornitore_id : fornitoreId;
      if (String(patch.modalita).toLowerCase() === 'telefonata') {
        patch.numero_telefonico_riferimento = null;
      }

      const assistTelMerged =
        patch.assistito_telefono != null && patch.assistito_telefono !== undefined
          ? String(patch.assistito_telefono).trim()
          : String(apt0.assistito_telefono || '').trim();
      const assistEmMerged =
        patch.assistito_email != null && patch.assistito_email !== undefined
          ? String(patch.assistito_email).trim()
          : String(apt0.assistito_email || '').trim();
      if (!isValidAssistitoPhone(assistTelMerged)) {
        return res.status(400).json({ error: 'Il telefono assistito non è valido (inserire almeno 5 cifre)' });
      }
      if (!isValidEmail(assistEmMerged)) {
        return res.status(400).json({ error: 'Email assistito obbligatoria o non valida' });
      }
      patch.assistito_telefono = assistTelMerged;
      patch.assistito_email = assistEmMerged;

      const mCheck = String(patch.modalita != null ? patch.modalita : apt0.modalita);
      if (user.role === 'struttura' || user.role === 'admin' || user.role === 'supervisore') {
        const vMode = validateModalitaFields(
          mCheck,
          {
            luogo: patch.luogo != null ? patch.luogo : apt0.luogo,
            link_videocall: null,
            assistito_telefono: assistTelMerged,
          },
          'creazione',
        );
        if (vMode) return res.status(400).json({ error: vMode });
      }

      if (patch.ora_inizio && !TIME_RE.test(String(patch.ora_inizio).trim())) {
        return res.status(400).json({ error: 'Ora inizio non valida' });
      }
      if (patch.data_appuntamento && !DATE_RE.test(String(patch.data_appuntamento).trim())) {
        return res.status(400).json({ error: 'Data non valida' });
      }
      if (isStatoChiuso(apt0.stato) && user.role === 'struttura') {
        return res.status(400).json({ error: 'Appuntamento non modificabile' });
      }

      const dm = Number(patch.durata_minuti) || 60;
      const oi = String(patch.ora_inizio != null ? patch.ora_inizio : apt0.ora_inizio).trim();
      const d = String(patch.data_appuntamento != null ? patch.data_appuntamento : apt0.data_appuntamento).trim();
      const effModalitaPut = String(patch.modalita != null ? patch.modalita : apt0.modalita).toLowerCase();
      const presenzaErrPut = validatePresenzaAppointmentSlot(effModalitaPut, d, oi, dm);
      if (presenzaErrPut) return res.status(400).json({ error: presenzaErrPut });
      const of = addMinutesToOra(oi, dm);
      if (!of) return res.status(400).json({ error: 'Ora o durata non valida' });
      patch.ora_fine = of;

      if (user.role === 'admin' || user.role === 'supervisore') {
        if (body.stato != null) {
          const newS = String(body.stato).toUpperCase();
          if (!APPOINTMENT_STATI.has(newS)) return res.status(400).json({ error: 'Stato non valido' });
          if (newS !== normalizeStato(apt0.stato)) {
            if (isStatoChiuso(apt0.stato)) {
              return res.status(400).json({ error: 'Modifica stato non consentita' });
            }
            await recordHistory({
              appointmentId: id,
              oldStatus: apt0.stato,
              newStatus: newS,
              utenteId: user.id,
              nota: body.nota_stato != null ? String(body.nota_stato) : null,
            });
            patch.stato = newS;
          }
        }
      }

      const conf = findSlotConflict(appointments, {
        fornitoreId: patch.fornitore_id,
        data: d,
        oraInizio: oi,
        durata: dm,
        excludeId: id,
      });
      if (conf) return res.status(409).json({ error: conf });

      delete patch.id;
      delete patch._instant_id;
      const updated = await upsertById('appointments', id, {
        ...patch,
        fornitore_id: Number(patch.fornitore_id),
        struttura_id: Number(apt0.struttura_id),
      });
      logActivity({
        utente_id: user.id,
        utente_nome: getUserDisplayName(await getById('users', user.id)),
        ruolo: user.role,
        azione: 'appuntamento_modificato',
        modulo: 'appuntamenti',
        riferimento_id: Number(id),
        riferimento_tipo: 'appointment',
      });
      res.json(enrich(updated, usersById));
    } catch (err) {
      console.error('appointments put:', err);
      res.status(500).json({ error: 'Errore nel salvataggio' });
    }
  })();
});

// --- confirm ---
router.post('/:id/confirm', authenticateToken, authorizeRoles('fornitore', 'admin', 'supervisore'), (req, res) => {
  (async () => {
    const { user } = req;
    const id = req.params.id;
    const body = req.body || {};
    const apt0 = await getById('appointments', id);
    if (!apt0) return res.status(404).json({ error: 'Appuntamento non trovato' });
    if (user.role === 'fornitore' && Number(apt0.fornitore_id) !== Number(user.id)) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    if (isStatoChiuso(apt0.stato)) return res.status(400).json({ error: 'Appuntamento non modificabile' });
    const newLuogo = body.luogo != null ? String(body.luogo).trim() : apt0.luogo;
    const newLink = body.link_videocall != null ? String(body.link_videocall).trim() : apt0.link_videocall;
    const v = validateModalitaFields(
      apt0.modalita,
      { luogo: newLuogo, link_videocall: newLink, assistito_telefono: apt0.assistito_telefono },
      'conferma',
    );
    if (v) return res.status(400).json({ error: v });
    const oldS = String(apt0.stato);
    if (oldS === 'ANNULLATO' || oldS === 'COMPLETATO') {
      return res.status(400).json({ error: 'Stato non valido per conferma' });
    }
    const isTel = String(apt0.modalita).toLowerCase() === 'telefonata';
    const updated = await upsertById('appointments', id, {
      ...apt0,
      luogo: newLuogo || null,
      link_videocall: newLink || null,
      numero_telefonico_riferimento: isTel ? null : apt0.numero_telefonico_riferimento,
      stato: 'CONFERMATO',
    });
    await recordHistory({
      appointmentId: id,
      oldStatus: oldS,
      newStatus: 'CONFERMATO',
      utenteId: user.id,
      nota: 'Confermato',
    });
    const strutt = await getById('users', apt0.struttura_id);
    const forn = await getById('users', apt0.fornitore_id);
    if (strutt) {
      await sendAppointmentUpdateToStrutturaMail({
        kind: 'confermato',
        to: strutt.email,
        strutturaNome: getUserDisplayName(strutt),
        appointmentId: Number(id),
        oggetto: apt0.oggetto,
        fornitoreName: forn ? getUserDisplayName(forn) : '—',
        assistitoNome: assistitoLabel(apt0),
        modalita: apt0.modalita,
        dataOra: dataOraIt(updated),
        luogo: newLuogo || undefined,
        linkVideocall: newLink || undefined,
        telefonoAssistito: apt0.assistito_telefono || undefined,
        note: apt0.note || undefined,
      });
    }
    if (String(apt0.modalita).toLowerCase() === 'videocall') {
      const assistTo = String(apt0.assistito_email || '').trim();
      if (assistTo) {
        await sendAppointmentVideocallConfirmedToAssistitoMail({
          to: assistTo,
          assistitoNome: assistitoLabel(apt0),
          fornitoreName: forn ? getUserDisplayName(forn) : '—',
          oggetto: apt0.oggetto,
          dataOra: dataOraIt(updated),
          linkVideocall: newLink || '',
        });
      }
    }
    const { usersById } = await loadApptsContext();
    logActivity({ utente_id: user.id, utente_nome: getUserDisplayName(await getById('users', user.id)), ruolo: user.role, azione: 'appuntamento_confermato', modulo: 'appuntamenti', riferimento_id: Number(id), riferimento_tipo: 'appointment' });
    res.json(enrich(updated, usersById));
  })().catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Errore' });
  });
});

// --- reschedule ---
router.post('/:id/reschedule', authenticateToken, authorizeRoles('fornitore', 'admin', 'supervisore'), (req, res) => {
  (async () => {
    const { user } = req;
    const id = req.params.id;
    const body = req.body || {};
    const apt0 = await getById('appointments', id);
    if (!apt0) return res.status(404).json({ error: 'Appuntamento non trovato' });
    if (user.role === 'fornitore' && Number(apt0.fornitore_id) !== Number(user.id)) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    if (isStatoChiuso(apt0.stato) && user.role === 'fornitore') {
      return res.status(400).json({ error: 'Appuntamento chiuso' });
    }

    const data_appuntamento = String(body.data_appuntamento || apt0.data_appuntamento).trim();
    const ora_inizio = String(body.ora_inizio || apt0.ora_inizio).trim();
    const durata_minuti = DURATE_AMMESSE.has(Number(body.durata_minuti)) ? Number(body.durata_minuti) : Number(apt0.durata_minuti) || 60;
    const motivo = String(body.motivo_riprogrammazione || '').trim();
    if (!DATE_RE.test(data_appuntamento) || !TIME_RE.test(ora_inizio)) {
      return res.status(400).json({ error: 'Data o ora non valida' });
    }
    if (!motivo) return res.status(400).json({ error: 'Motivo riprogrammazione obbligatorio' });

    let targetFornitoreId = Number(apt0.fornitore_id);
    if (body.fornitore_id != null && String(body.fornitore_id).trim() !== '') {
      targetFornitoreId = Number(body.fornitore_id);
    }
    if (!Number.isFinite(targetFornitoreId)) {
      return res.status(400).json({ error: 'Broker non valido' });
    }
    const fornTarget = await getById('users', targetFornitoreId);
    if (!fornTarget || fornTarget.role !== 'fornitore' || fornTarget.stato !== 'attivo') {
      return res.status(400).json({ error: 'Broker selezionato non valido' });
    }

    const effModalitaRe = String(apt0.modalita || '').toLowerCase();
    const presenzaErrRe = validatePresenzaAppointmentSlot(
      effModalitaRe,
      data_appuntamento,
      ora_inizio,
      durata_minuti,
    );
    if (presenzaErrRe) return res.status(400).json({ error: presenzaErrRe });

    const ora_fine = addMinutesToOra(ora_inizio, durata_minuti);
    if (!ora_fine) return res.status(400).json({ error: 'Durata non valida' });
    const { appointments } = await loadApptsContext();
    const conf = findSlotConflict(appointments, {
      fornitoreId: targetFornitoreId,
      data: data_appuntamento,
      oraInizio: ora_inizio,
      durata: durata_minuti,
      excludeId: id,
    });
    if (conf) return res.status(409).json({ error: conf });
    const oldS = String(apt0.stato);
    const updated = await upsertById('appointments', id, {
      ...apt0,
      fornitore_id: targetFornitoreId,
      data_appuntamento,
      ora_inizio,
      durata_minuti,
      ora_fine,
      stato: 'DA RIPROGRAMMARE',
      motivo_riprogrammazione: motivo,
    });
    await recordHistory({ appointmentId: id, oldStatus: oldS, newStatus: 'DA RIPROGRAMMARE', utenteId: user.id, nota: motivo });
    const strutt = await getById('users', apt0.struttura_id);
    const forn = await getById('users', updated.fornitore_id);
    if (strutt) {
      await sendAppointmentUpdateToStrutturaMail({
        kind: 'riprogrammato',
        to: strutt.email,
        strutturaNome: getUserDisplayName(strutt),
        appointmentId: Number(id),
        oggetto: apt0.oggetto,
        fornitoreName: forn ? getUserDisplayName(forn) : '—',
        assistitoNome: assistitoLabel(apt0),
        modalita: apt0.modalita,
        dataOra: dataOraIt(updated),
        luogo: updated.luogo || undefined,
        linkVideocall: updated.link_videocall || undefined,
        telefonoAssistito: updated.assistito_telefono || undefined,
        note: apt0.note || undefined,
        extraMotivo: motivo,
      });
    }
    const { usersById } = await loadApptsContext();
    res.json(enrich(updated, usersById));
  })().catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Errore' });
  });
});

// --- struttura accepts counter-proposal: go back to RICHIESTO with new time set by structure via PUT.
// --- cancel ---
router.post('/:id/cancel', authenticateToken, authorizeRoles('struttura', 'fornitore', 'admin', 'supervisore'), (req, res) => {
  (async () => {
    const { user } = req;
    const id = req.params.id;
    const motivo = String((req.body || {}).motivo_annullamento || '').trim();
    if (!motivo) return res.status(400).json({ error: 'Motivo annullamento obbligatorio' });
    const apt0 = await getById('appointments', id);
    if (!apt0) return res.status(404).json({ error: 'Appuntamento non trovato' });
    if (user.role === 'struttura' && Number(apt0.struttura_id) !== Number(user.id)) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    if (user.role === 'fornitore' && Number(apt0.fornitore_id) !== Number(user.id)) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    if (isStatoChiuso(apt0.stato) && (user.role === 'struttura' || user.role === 'fornitore')) {
      return res.status(400).json({ error: 'Appuntamento già chiuso' });
    }
    const oldS = String(apt0.stato);
    const updated = await upsertById('appointments', id, { ...apt0, stato: 'ANNULLATO', motivo_annullamento: motivo });
    await recordHistory({ appointmentId: id, oldStatus: oldS, newStatus: 'ANNULLATO', utenteId: user.id, nota: motivo });
    const strutt = await getById('users', apt0.struttura_id);
    const forn = await getById('users', apt0.fornitore_id);
    const baseMail = {
      appointmentId: Number(id),
      oggetto: apt0.oggetto,
      assistitoNome: assistitoLabel(apt0),
      modalita: apt0.modalita,
      dataOra: dataOraIt(apt0),
      luogo: apt0.luogo || undefined,
      linkVideocall: apt0.link_videocall || undefined,
      telefonoAssistito: apt0.assistito_telefono || undefined,
      note: apt0.note || undefined,
      extraMotivo: motivo,
    };
    if (strutt && (user.role === 'fornitore' || user.role === 'admin' || user.role === 'supervisore')) {
      await sendAppointmentUpdateToStrutturaMail({
        kind: 'annullato',
        to: strutt.email,
        strutturaNome: getUserDisplayName(strutt),
        fornitoreName: forn ? getUserDisplayName(forn) : '—',
        ...baseMail,
      });
    }
    if (forn && (user.role === 'struttura' || user.role === 'admin' || user.role === 'supervisore')) {
      await sendAppointmentAnnullatoToFornitoreMail({
        to: forn.email,
        fornitoreName: getUserDisplayName(forn),
        strutturaNome: strutt ? getUserDisplayName(strutt) : '—',
        ...baseMail,
      });
    }
    const { usersById } = await loadApptsContext();
    res.json(enrich(updated, usersById));
  })().catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Errore' });
  });
});

// --- complete ---
router.post('/:id/complete', authenticateToken, authorizeRoles('fornitore', 'admin', 'supervisore'), (req, res) => {
  (async () => {
    const { user } = req;
    const id = req.params.id;
    const apt0 = await getById('appointments', id);
    if (!apt0) return res.status(404).json({ error: 'Appuntamento non trovato' });
    if (user.role === 'fornitore' && Number(apt0.fornitore_id) !== Number(user.id)) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    if (isStatoChiuso(apt0.stato)) return res.status(400).json({ error: 'Stato non valido' });
    const body = req.body || {};
    let noteComplRaw = body.note_completamento != null ? String(body.note_completamento).trim() : '';
    if (noteComplRaw.length > 4000) noteComplRaw = noteComplRaw.slice(0, 4000);
    const noteCompl = noteComplRaw || null;
    const oldS = String(apt0.stato);
    const updated = await upsertById('appointments', id, { ...apt0, stato: 'COMPLETATO', note_completamento: noteCompl });
    await recordHistory({ appointmentId: id, oldStatus: oldS, newStatus: 'COMPLETATO', utenteId: user.id, nota: 'Completato' });
    const { usersById } = await loadApptsContext();
    res.json(enrich(updated, usersById));
  })().catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Errore' });
  });
});

// --- reassign (admin) ---
router.post('/:id/reassign', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const { user } = req;
    const id = req.params.id;
    const fornitoreId = Number((req.body || {}).fornitore_id);
    if (!fornitoreId) return res.status(400).json({ error: 'fornitore_id obbligatorio' });
    const forn = await getById('users', fornitoreId);
    if (!forn || forn.role !== 'fornitore' || forn.stato !== 'attivo') {
      return res.status(400).json({ error: 'Fornitore non valido' });
    }
    const apt0 = await getById('appointments', id);
    if (!apt0) return res.status(404).json({ error: 'Appuntamento non trovato' });
    const { appointments } = await loadApptsContext();
    const d = String(apt0.data_appuntamento);
    const oi = String(apt0.ora_inizio);
    const dm = Number(apt0.durata_minuti) || 60;
    const conf = findSlotConflict(appointments, { fornitoreId, data: d, oraInizio: oi, durata: dm, excludeId: id });
    if (conf) return res.status(409).json({ error: conf });
    const oldS = String(apt0.stato);
    const updated = await upsertById('appointments', id, { ...apt0, fornitore_id: fornitoreId });
    await recordHistory({
      appointmentId: id,
      oldStatus: oldS,
      newStatus: oldS,
      utenteId: user.id,
      nota: `Riassegnazione fornitore → ${getUserDisplayName(forn)} (#${fornitoreId})`,
    });
    const { usersById } = await loadApptsContext();
    res.json(enrich(updated, usersById));
  })().catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Errore' });
  });
});

// --- delete ---
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const id = req.params.id;
    const apt0 = await getById('appointments', id);
    if (!apt0) return res.status(404).json({ error: 'Appuntamento non trovato' });
    const hist = await list('appointment_status_history', (h) => Number(h.appointment_id) === Number(id));
    for (const h of hist) {
      try {
        await removeById('appointment_status_history', h.id);
      } catch (e) {
        console.warn(e);
      }
    }
    await removeById('appointments', id);
    res.json({ ok: true });
  })().catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Errore' });
  });
});

module.exports = router;
