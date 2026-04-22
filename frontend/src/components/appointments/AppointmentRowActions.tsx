import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Appointment } from '../../types';
import { api, ApiError } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import { modalitaLabel, strutturaCanEditTable, isAppointmentClosed } from '../../utils/appointmentLabels';
import AppointmentHistoryModal from './AppointmentHistoryModal';

const MENU_WIDTH = 240;
const VIEW_MARGIN = 8;
const MENU_GAP = 4;

type MenuPos = { top: number; left: number; maxHeightPx?: number };

type Props = {
  row: Appointment;
  onRefresh: () => void | Promise<void>;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onNavigateDetail: (id: number) => void;
  /** Per riassegnazione (admin/supervisore) */
  suppliers?: { id: number; nome: string | null; cognome: string | null }[];
  /** Nasconde la voce «Apri» (es. modale dettaglio già aperta) */
  hideOpenInMenu?: boolean;
  uiVariant?: 'menu' | 'toolbar';
  /** Se false, non mostrare il controllo «Storico stati» (es. gestito dal contenitore). */
  historyInActions?: boolean;
  /** Conferma senza modale intermedio: usa i valori passati dal contenitore (luogo / link videocall). */
  embeddedConfirm?: boolean;
  confirmLuogo?: string;
  confirmLink?: string;
  /** Lato struttura: apre modifica in modale invece della pagina dedicata. */
  onStrutturaEditRequest?: (id: number) => void;
};

const toolbarBtn =
  'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50';

export default function AppointmentRowActions({
  row,
  onRefresh,
  onError,
  onSuccess,
  onNavigateDetail,
  suppliers = [],
  hideOpenInMenu = false,
  uiVariant = 'menu',
  historyInActions = true,
  embeddedConfirm = false,
  confirmLuogo: confirmLuogoExternal,
  confirmLink: confirmLinkExternal,
  onStrutturaEditRequest,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });

  const [histOpen, setHistOpen] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLuogo, setConfirmLuogo] = useState('');
  const [confirmLink, setConfirmLink] = useState('');
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

  useEffect(() => {
    if (confirmOpen) {
      setConfirmLuogo(row.luogo || '');
      setConfirmLink(row.link_videocall || '');
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
    const luogoVal = embeddedConfirm ? String(confirmLuogoExternal ?? '').trim() : confirmLuogo;
    const linkVal = embeddedConfirm ? String(confirmLinkExternal ?? '').trim() : confirmLink;
    if (row.modalita === 'presenza' && !luogoVal.trim()) {
      onError('Indicare il luogo.');
      return;
    }
    if (row.modalita === 'videocall' && !linkVal.trim()) {
      onError('Indicare il link videocall.');
      return;
    }
    if (row.modalita === 'telefonata' && !String(row.assistito_telefono || '').trim()) {
      onError('Il telefono dell’assistito è obbligatorio per confermare la telefonata.');
      return;
    }
    setConfirmBusy(true);
    try {
      await api.post(`/appointments/${row.id}/confirm`, {
        luogo: row.modalita === 'presenza' ? luogoVal : undefined,
        link_videocall: row.modalita === 'videocall' ? linkVal : undefined,
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
      {hideOpenInMenu ? null : (
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
      )}
      {(showStrutturaActions && canStrutturaEdit) || showAdminActions ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => {
            closeMenu();
            if (showStrutturaActions && canStrutturaEdit && onStrutturaEditRequest) {
              onStrutturaEditRequest(row.id);
            } else {
              navigate(`/appuntamenti/${row.id}?modifica=1`);
            }
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
          Riprogramma
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
      {historyInActions ? (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => {
            setHistOpen(true);
            closeMenu();
          }}
        >
          Storico stati
        </button>
      ) : null}
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

  const onConfermaToolbar = () => {
    if (embeddedConfirm) void handleConfirm();
    else setConfirmOpen(true);
  };

  const showConfirmToolbarBtn = canConfirm && (row.stato === 'RICHIESTO' || row.stato === 'DA RIPROGRAMMARE');

  const actionModals = (
    <>
      <AppointmentHistoryModal appointmentId={row.id} isOpen={histOpen} onClose={() => setHistOpen(false)} onError={onError} />

      <Modal isOpen={confirmOpen} onClose={() => !confirmBusy && setConfirmOpen(false)} title="Conferma appuntamento" size="md">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-3 text-sm">
            <p className="font-medium text-slate-900">{row.oggetto}</p>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Data</dt>
                <dd className="tabular-nums text-slate-800">{String(row.data_appuntamento || '').slice(0, 10)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Ora</dt>
                <dd className="tabular-nums text-slate-800">{row.ora_inizio}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Durata</dt>
                <dd className="text-slate-800">{row.durata_minuti} minuti</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Modalità</dt>
                <dd className="text-slate-800">{modalitaLabel(row.modalita)}</dd>
              </div>
            </dl>
          </div>
          {row.modalita === 'presenza' ? (
            <div>
              <label className="text-sm font-medium text-slate-700">Luogo *</label>
              <input
                className="input-field mt-1 w-full text-sm"
                value={confirmLuogo}
                onChange={(e) => setConfirmLuogo(e.target.value)}
              />
            </div>
          ) : null}
          {row.modalita === 'videocall' ? (
            <div>
              <label className="text-sm font-medium text-slate-700">Link videocall *</label>
              <input
                className="input-field mt-1 w-full text-sm"
                value={confirmLink}
                onChange={(e) => setConfirmLink(e.target.value)}
                placeholder="https://…"
              />
            </div>
          ) : null}
          {row.modalita === 'telefonata' ? (
            <p className="rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm text-slate-700">
              Telefonata sull&apos;assistito: <strong className="text-slate-900">{row.assistito_telefono || '—'}</strong>
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/90 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setConfirmOpen(false)} disabled={confirmBusy}>
              Annulla
            </button>
            <button type="button" className="btn-primary" onClick={handleConfirm} disabled={confirmBusy}>
              {confirmBusy ? 'Salvataggio…' : 'Conferma appuntamento'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={reschedOpen} onClose={() => !resBusy && setReschedOpen(false)} title="Riprogramma appuntamento" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Nuova data *</label>
              <input type="date" className="input-field mt-1 w-full text-sm" value={resData} onChange={(e) => setResData(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Nuova ora *</label>
              <input type="time" className="input-field mt-1 w-full text-sm" value={resOra} onChange={(e) => setResOra(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Durata</label>
            <select className="input-field mt-1 w-full text-sm" value={resDurata} onChange={(e) => setResDurata(e.target.value)}>
              <option value="30">30 minuti</option>
              <option value="60">60 minuti</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Motivo / nota riprogrammazione *</label>
            <textarea className="input-field mt-1 w-full resize-y text-sm" rows={3} value={resMotivo} onChange={(e) => setResMotivo(e.target.value)} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/90 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setReschedOpen(false)} disabled={resBusy}>
              Annulla
            </button>
            <button type="button" className="btn-primary" onClick={handleReschedule} disabled={resBusy}>
              {resBusy ? 'Salvataggio…' : 'Salva nuova proposta'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={cancelOpen} onClose={() => !cancelBusy && setCancelOpen(false)} title="Annulla appuntamento" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Motivo annullamento *</label>
            <textarea className="input-field mt-1 w-full resize-y text-sm" rows={3} value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/90 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>
              Chiudi
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              onClick={handleCancel}
              disabled={cancelBusy}
            >
              {cancelBusy ? 'Salvataggio…' : 'Conferma annullamento'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={completeOpen} onClose={() => !completeBusy && setCompleteOpen(false)} title="Completa appuntamento" size="sm">
        <p className="text-sm text-slate-600">Confermi di voler segnare questo appuntamento come completato? L&apos;operazione aggiornerà lo stato nell&apos;agenda.</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200/90 pt-4">
          <button type="button" className="btn-secondary" onClick={() => setCompleteOpen(false)} disabled={completeBusy}>
            Annulla
          </button>
          <button type="button" className="btn-primary" onClick={handleComplete} disabled={completeBusy}>
            {completeBusy ? 'Salvataggio…' : 'Segna come completato'}
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
    </>
  );

  if (uiVariant === 'toolbar') {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2" data-appt-actions-root>
          {showStrutturaActions && canStrutturaEdit && onStrutturaEditRequest ? (
            <button
              type="button"
              className={`${toolbarBtn} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}
              onClick={() => onStrutturaEditRequest(row.id)}
            >
              Modifica
            </button>
          ) : null}
          {showConfirmToolbarBtn ? (
            <button
              type="button"
              className={`${toolbarBtn} bg-blue-600 text-white hover:bg-blue-700`}
              onClick={onConfermaToolbar}
              disabled={embeddedConfirm && confirmBusy}
            >
              {embeddedConfirm && confirmBusy ? 'Salvataggio…' : 'Conferma'}
            </button>
          ) : null}
          {canResched ? (
            <button
              type="button"
              className={`${toolbarBtn} bg-orange-500 text-white hover:bg-orange-600`}
              onClick={() => setReschedOpen(true)}
              disabled={resBusy}
            >
              Riprogramma
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              className={`${toolbarBtn} bg-red-600 text-white hover:bg-red-700`}
              onClick={() => setCancelOpen(true)}
              disabled={cancelBusy}
            >
              Annulla
            </button>
          ) : null}
          {canComplete && row.stato !== 'ANNULLATO' ? (
            <button
              type="button"
              className={`${toolbarBtn} bg-emerald-600 text-white hover:bg-emerald-700`}
              onClick={() => setCompleteOpen(true)}
              disabled={completeBusy}
            >
              Completa
            </button>
          ) : null}
          {historyInActions ? (
            <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs font-medium" onClick={() => setHistOpen(true)}>
              Storico stati
            </button>
          ) : null}
        </div>
        {actionModals}
      </>
    );
  }

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
      {actionModals}
    </div>
  );
}
