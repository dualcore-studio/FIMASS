import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Appointment } from '../../types';
import { api, ApiError } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import StatusBadge from '../common/StatusBadge';
import { formatDateTime } from '../../utils/helpers';
import { isAppointmentClosed, strutturaCanEditTable } from '../../utils/appointmentLabels';

const MENU_WIDTH = 240;
const VIEW_MARGIN = 8;
const MENU_GAP = 4;

type MenuPos = { top: number; left: number; maxHeightPx?: number };

type Props = {
  row: Appointment;
  onRefresh: () => void;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onNavigateDetail: (id: number) => void;
  /** Per riassegnazione (admin/supervisore) */
  suppliers?: { id: number; nome: string | null; cognome: string | null }[];
};

function actorLabel(u: { nome?: string | null; cognome?: string | null; denominazione?: string | null; role?: string } | null | undefined) {
  if (!u) return '—';
  if (u.role === 'struttura' && u.denominazione) return u.denominazione;
  return [u.nome, u.cognome].filter(Boolean).join(' ') || '—';
}

export default function AppointmentRowActions({
  row,
  onRefresh,
  onError,
  onSuccess,
  onNavigateDetail,
  suppliers = [],
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });

  const [histOpen, setHistOpen] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [histRows, setHistRows] = useState<
    {
      id: number;
      stato_precedente: string | null;
      stato_nuovo: string;
      nota: string | null;
      created_at: string;
      utente?: { nome?: string | null; cognome?: string | null; denominazione?: string | null; role?: string } | null;
    }[]
  >([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLuogo, setConfirmLuogo] = useState('');
  const [confirmLink, setConfirmLink] = useState('');
  const [confirmTel, setConfirmTel] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [reschedOpen, setReschedOpen] = useState(false);
  const [resData, setResData] = useState('');
  const [resOra, setResOra] = useState('');
  const [resDurata, setResDurata] = useState('60');
  const [resMotivo, setResMotivo] = useState('');
  const [resBusy, setResBusy] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);

  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignFornitore, setReassignFornitore] = useState('');
  const [reassignBusy, setReassignBusy] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const closed = isAppointmentClosed(row.stato);
  const canStrutturaEdit = role === 'struttura' && strutturaCanEditTable(row.stato);

  const closeMenu = () => setOpen(false);

  const updatePosition = useCallback(() => {
    const trigger = wrapRef.current?.querySelector<HTMLElement>('[data-appt-actions-trigger]');
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    let left = r.right - MENU_WIDTH;
    if (left < VIEW_MARGIN) left = VIEW_MARGIN;
    if (left + MENU_WIDTH > vw - VIEW_MARGIN) left = vw - MENU_WIDTH - VIEW_MARGIN;
    const top = r.bottom + MENU_GAP;
    setMenuPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const t = window.setTimeout(updatePosition, 0);
    return () => window.clearTimeout(t);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open, updatePosition]);

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const data = await api.get<typeof histRows>(`/appointments/${row.id}/history`);
      setHistRows(data);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Errore caricamento storico');
    } finally {
      setHistLoading(false);
    }
  };

  const openHistory = () => {
    setHistOpen(true);
    loadHistory();
  };

  useEffect(() => {
    if (confirmOpen) {
      setConfirmLuogo(row.luogo || '');
      setConfirmLink(row.link_videocall || '');
      setConfirmTel(row.numero_telefonico_riferimento || '');
    }
  }, [confirmOpen, row]);

  useEffect(() => {
    if (reschedOpen) {
      setResData(String(row.data_appuntamento || '').slice(0, 10));
      setResOra(row.ora_inizio || '');
      setResDurata(String(row.durata_minuti || 60));
      setResMotivo('');
    }
  }, [reschedOpen, row]);

  const handleConfirm = async () => {
    setConfirmBusy(true);
    try {
      await api.post(`/appointments/${row.id}/confirm`, {
        luogo: row.modalita === 'presenza' ? confirmLuogo : undefined,
        link_videocall: row.modalita === 'videocall' ? confirmLink : undefined,
        numero_telefonico_riferimento: row.modalita === 'telefonata' ? confirmTel : undefined,
      });
      onSuccess?.('Appuntamento confermato.');
      setConfirmOpen(false);
      closeMenu();
      onRefresh();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Errore');
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleReschedule = async () => {
    if (!resMotivo.trim()) {
      onError('Indicare il motivo della riprogrammazione.');
      return;
    }
    setResBusy(true);
    try {
      await api.post(`/appointments/${row.id}/reschedule`, {
        data_appuntamento: resData,
        ora_inizio: resOra,
        durata_minuti: Number(resDurata) || 60,
        motivo_riprogrammazione: resMotivo.trim(),
      });
      onSuccess?.('Riprogrammazione registrata.');
      setReschedOpen(false);
      closeMenu();
      onRefresh();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Errore');
    } finally {
      setResBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelMotivo.trim()) {
      onError('Motivo obbligatorio.');
      return;
    }
    setCancelBusy(true);
    try {
      await api.post(`/appointments/${row.id}/cancel`, { motivo_annullamento: cancelMotivo.trim() });
      onSuccess?.('Appuntamento annullato.');
      setCancelOpen(false);
      setCancelMotivo('');
      closeMenu();
      onRefresh();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Errore');
    } finally {
      setCancelBusy(false);
    }
  };

  const handleComplete = async () => {
    setCompleteBusy(true);
    try {
      await api.post(`/appointments/${row.id}/complete`, {});
      onSuccess?.('Appuntamento completato.');
      setCompleteOpen(false);
      closeMenu();
      onRefresh();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Errore');
    } finally {
      setCompleteBusy(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignFornitore) {
      onError('Seleziona un fornitore.');
      return;
    }
    setReassignBusy(true);
    try {
      await api.post(`/appointments/${row.id}/reassign`, { fornitore_id: Number(reassignFornitore) });
      onSuccess?.('Fornitore aggiornato.');
      setReassignOpen(false);
      closeMenu();
      onRefresh();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Errore');
    } finally {
      setReassignBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleteBusy(true);
    try {
      await api.delete(`/appointments/${row.id}`);
      onSuccess?.('Appuntamento eliminato.');
      setDeleteOpen(false);
      closeMenu();
      onRefresh();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Errore');
    } finally {
      setDeleteBusy(false);
    }
  };

  const showFornitoreActions = role === 'fornitore' || role === 'admin' || role === 'supervisore';
  const showStrutturaActions = role === 'struttura';
  const showAdminActions = role === 'admin' || role === 'supervisore';

  const canConfirm =
    showFornitoreActions &&
    (role === 'admin' || role === 'supervisore' || Number(row.fornitore_id) === Number(user?.id)) &&
    !closed &&
    row.stato !== 'ANNULLATO';

  const canResched =
    canConfirm && (row.stato === 'RICHIESTO' || row.stato === 'CONFERMATO' || row.stato === 'DA RIPROGRAMMARE');

  const canCancel =
    !closed &&
    (showStrutturaActions ||
      (showFornitoreActions &&
        (role === 'admin' || role === 'supervisore' || Number(row.fornitore_id) === Number(user?.id))));

  const canComplete =
    showFornitoreActions &&
    (role === 'admin' || role === 'supervisore' || Number(row.fornitore_id) === Number(user?.id)) &&
    !closed;

  const menuContent = open ? (
    <div
      ref={menuRef}
      className="fixed z-[80] max-h-[min(70vh,420px)] w-[240px] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
      style={{ top: menuPos.top, left: menuPos.left, maxHeight: menuPos.maxHeightPx }}
    >
      <button
        type="button"
        className="block w-full px-3 py-2 text-left hover:bg-slate-50"
        onClick={() => {
          closeMenu();
          onNavigateDetail(row.id);
        }}
      >
        Apri
      </button>
      {(showStrutturaActions && canStrutturaEdit) || showAdminActions ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => {
            closeMenu();
            navigate(`/appuntamenti/${row.id}?modifica=1`);
          }}
        >
          Modifica
        </button>
      ) : null}
      {canConfirm && (row.stato === 'RICHIESTO' || row.stato === 'DA RIPROGRAMMARE') ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => {
            setConfirmOpen(true);
            closeMenu();
          }}
        >
          Conferma
        </button>
      ) : null}
      {canResched ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => {
            setReschedOpen(true);
            closeMenu();
          }}
        >
          Riproponi data
        </button>
      ) : null}
      {canCancel ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => {
            setCancelOpen(true);
            closeMenu();
          }}
        >
          Annulla
        </button>
      ) : null}
      {canComplete && row.stato !== 'ANNULLATO' ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => {
            setCompleteOpen(true);
            closeMenu();
          }}
        >
          Completa
        </button>
      ) : null}
      {showAdminActions ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => {
            setReassignFornitore(String(row.fornitore_id));
            setReassignOpen(true);
            closeMenu();
          }}
        >
          Riassegna fornitore
        </button>
      ) : null}
      <button
        type="button"
        className="block w-full px-3 py-2 text-left hover:bg-slate-50"
        onClick={() => {
          openHistory();
          closeMenu();
        }}
      >
        Storico stati
      </button>
      {showAdminActions ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left text-red-700 hover:bg-red-50"
          onClick={() => {
            setDeleteOpen(true);
            closeMenu();
          }}
        >
          Elimina
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="relative inline-block text-left" ref={wrapRef}>
      <button
        type="button"
        data-appt-actions-trigger
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Azioni
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open ? createPortal(menuContent, document.body) : null}
      {open ? (
        <button type="button" className="fixed inset-0 z-[70] cursor-default bg-transparent" aria-label="Chiudi menu" onClick={closeMenu} />
      ) : null}

      <Modal isOpen={histOpen} onClose={() => setHistOpen(false)} title="Storico stati" size="md">
        {histLoading ? (
          <p className="text-sm text-slate-500">Caricamento…</p>
        ) : histRows.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun record.</p>
        ) : (
          <ul className="max-h-[min(60vh,400px)] space-y-4 overflow-y-auto pr-1">
            {histRows.map((h) => (
              <li key={h.id} className="border-b border-slate-100 pb-3 text-sm last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  {h.stato_precedente ? <StatusBadge stato={h.stato_precedente} type="appointment" /> : null}
                  {h.stato_precedente ? <span className="text-slate-400">→</span> : null}
                  <StatusBadge stato={h.stato_nuovo} type="appointment" />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {actorLabel(h.utente)} · {formatDateTime(h.created_at)}
                </p>
                {h.nota ? <p className="mt-2 rounded border border-slate-100 bg-slate-50 px-2 py-1 text-slate-800">{h.nota}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal isOpen={confirmOpen} onClose={() => !confirmBusy && setConfirmOpen(false)} title="Conferma appuntamento" size="md">
        <div className="space-y-3">
          {row.modalita === 'presenza' ? (
            <div>
              <label className="text-xs text-slate-600">Luogo</label>
              <input
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={confirmLuogo}
                onChange={(e) => setConfirmLuogo(e.target.value)}
              />
            </div>
          ) : null}
          {row.modalita === 'videocall' ? (
            <div>
              <label className="text-xs text-slate-600">Link videocall</label>
              <input
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={confirmLink}
                onChange={(e) => setConfirmLink(e.target.value)}
                placeholder="https://…"
              />
            </div>
          ) : null}
          {row.modalita === 'telefonata' ? (
            <div>
              <label className="text-xs text-slate-600">Numero telefonico di riferimento</label>
              <input
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={confirmTel}
                onChange={(e) => setConfirmTel(e.target.value)}
              />
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setConfirmOpen(false)} disabled={confirmBusy}>
              Indietro
            </button>
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              onClick={handleConfirm}
              disabled={confirmBusy}
            >
              {confirmBusy ? 'Salvataggio…' : 'Conferma'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={reschedOpen} onClose={() => !resBusy && setReschedOpen(false)} title="Riproponi data" size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-600">Data</label>
              <input type="date" className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={resData} onChange={(e) => setResData(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-600">Ora inizio</label>
              <input type="time" className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={resOra} onChange={(e) => setResOra(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-600">Durata (minuti)</label>
            <select className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={resDurata} onChange={(e) => setResDurata(e.target.value)}>
              <option value="30">30</option>
              <option value="60">60</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Motivo riprogrammazione</label>
            <textarea className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" rows={3} value={resMotivo} onChange={(e) => setResMotivo(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setReschedOpen(false)} disabled={resBusy}>
              Indietro
            </button>
            <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" onClick={handleReschedule} disabled={resBusy}>
              {resBusy ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={cancelOpen} onClose={() => !cancelBusy && setCancelOpen(false)} title="Annulla appuntamento" size="md">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-600">Motivo annullamento</label>
            <textarea className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" rows={3} value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>
              Indietro
            </button>
            <button type="button" className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50" onClick={handleCancel} disabled={cancelBusy}>
              {cancelBusy ? '…' : 'Annulla appuntamento'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={completeOpen} onClose={() => !completeBusy && setCompleteOpen(false)} title="Completa appuntamento" size="sm">
        <p className="text-sm text-slate-600">Segnare l&apos;appuntamento come completato?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setCompleteOpen(false)} disabled={completeBusy}>
            No
          </button>
          <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={handleComplete} disabled={completeBusy}>
            {completeBusy ? '…' : 'Sì, completa'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={reassignOpen} onClose={() => !reassignBusy && setReassignOpen(false)} title="Riassegna fornitore" size="sm">
        <div>
          <label className="text-xs text-slate-600">Fornitore</label>
          <select
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            value={reassignFornitore}
            onChange={(e) => setReassignFornitore(e.target.value)}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {[s.nome, s.cognome].filter(Boolean).join(' ') || `Utente #${s.id}`}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setReassignOpen(false)} disabled={reassignBusy}>
            Indietro
          </button>
          <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={handleReassign} disabled={reassignBusy}>
            {reassignBusy ? '…' : 'Salva'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={deleteOpen} onClose={() => !deleteBusy && setDeleteOpen(false)} title="Elimina appuntamento" size="sm">
        <p className="text-sm text-slate-600">Eliminare definitivamente questo appuntamento?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
            Annulla
          </button>
          <button type="button" className="rounded bg-red-700 px-3 py-1.5 text-sm text-white" onClick={handleDelete} disabled={deleteBusy}>
            {deleteBusy ? '…' : 'Elimina'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
