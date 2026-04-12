import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ArrowRight, Clock } from 'lucide-react';
import type { Policy, StatusHistory } from '../../types';
import { api, ApiError } from '../../utils/api';
import { formatDateTime } from '../../utils/helpers';
import StatusBadge from '../common/StatusBadge';
import Modal from '../ui/Modal';

const MENU_WIDTH = 240;
const VIEW_MARGIN = 8;
const MENU_GAP = 4;
const MENU_MAX_PX = 420;
const MENU_VH_CAP = 0.7;

type MenuPos = { top: number; left: number; maxHeightPx?: number };

function displayUserName(item: { nome?: string; cognome?: string; denominazione?: string; role?: string }): string {
  if (item.role === 'struttura' && item.denominazione) return item.denominazione;
  return [item.nome, item.cognome].filter(Boolean).join(' ') || 'Utente';
}

function PolicyHistoryBody({ history }: { history: StatusHistory[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-slate-500">Nessun cambiamento di stato registrato.</p>;
  }
  return (
    <div className="relative max-h-[min(60vh,420px)] overflow-y-auto pr-1">
      <div className="absolute bottom-0 left-4 top-0 w-0.5 bg-slate-200" />
      <ul className="space-y-5">
        {history.map((h, i) => (
          <li key={h.id} className="relative pl-10">
            <div
              className={`absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 border-white shadow-sm ${
                i === 0 ? 'bg-blue-600' : 'bg-slate-400'
              }`}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {h.stato_precedente && (
                <>
                  <StatusBadge stato={h.stato_precedente} type="policy" />
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </>
              )}
              <StatusBadge stato={h.stato_nuovo} type="policy" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{displayUserName(h)}</span>
              <span>·</span>
              <Clock className="h-3 w-3" />
              <time>{formatDateTime(h.created_at)}</time>
            </div>
            {h.motivo ? (
              <p className="mt-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">{h.motivo}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type PolicyRowActionsProps = {
  policy: Policy;
  variant: 'struttura' | 'backoffice';
  onNavigateOpen: (id: number) => void;
  onActionError: (message: string) => void;
  onRefresh?: () => void;
};

export default function PolicyRowActions({
  policy,
  variant,
  onNavigateOpen,
  onActionError,
  onRefresh,
}: PolicyRowActionsProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<StatusHistory[]>([]);

  const [emessaOpen, setEmessaOpen] = useState(false);
  const [emessaFile, setEmessaFile] = useState<File | null>(null);
  const [emessaSubmitting, setEmessaSubmitting] = useState(false);

  const close = () => setOpen(false);

  const updatePosition = useCallback(() => {
    const trigger = wrapRef.current?.querySelector<HTMLElement>('[data-policy-actions-trigger]');
    if (!trigger) return;

    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = r.right - MENU_WIDTH;
    if (left < VIEW_MARGIN) left = VIEW_MARGIN;
    if (left + MENU_WIDTH > vw - VIEW_MARGIN) {
      left = vw - MENU_WIDTH - VIEW_MARGIN;
    }

    const menuEl = menuRef.current;
    const cap = Math.min(MENU_MAX_PX, vh * MENU_VH_CAP);
    const rawContent = menuEl?.scrollHeight ?? 300;
    const contentH = Math.min(Math.max(rawContent, 1), cap);

    const spaceBelow = Math.max(0, vh - VIEW_MARGIN - r.bottom - MENU_GAP);
    const spaceAbove = Math.max(0, r.top - VIEW_MARGIN - MENU_GAP);

    let top: number;
    let maxHeightPx: number | undefined;

    if (contentH <= spaceBelow) {
      top = r.bottom + MENU_GAP;
    } else if (contentH <= spaceAbove) {
      top = r.top - contentH - MENU_GAP;
    } else if (spaceBelow >= spaceAbove) {
      top = r.bottom + MENU_GAP;
      maxHeightPx = Math.max(1, spaceBelow);
    } else {
      maxHeightPx = Math.max(1, spaceAbove);
      top = r.top - maxHeightPx - MENU_GAP;
    }

    const boxH = maxHeightPx ?? contentH;
    if (top + boxH > vh - VIEW_MARGIN) {
      top = Math.max(VIEW_MARGIN, vh - VIEW_MARGIN - boxH);
    }

    setMenuPos({ top, left, maxHeightPx });
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
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updatePosition]);

  const openHistory = async () => {
    close();
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryRows([]);
    try {
      const data = await api.get<Policy>(`/policies/${policy.id}`);
      setHistoryRows(data.history || []);
    } catch (e) {
      onActionError(e instanceof ApiError ? e.message : 'Impossibile caricare lo storico.');
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const putInEmissione = async () => {
    if (policy.stato !== 'RICHIESTA PRESENTATA') return;
    close();
    try {
      await api.put(`/policies/${policy.id}/status`, { stato: 'IN EMISSIONE' });
      onRefresh?.();
    } catch (e) {
      onActionError(e instanceof ApiError ? e.message : 'Aggiornamento non riuscito.');
    }
  };

  const submitEmessa = async () => {
    if (!emessaFile) {
      onActionError('Seleziona il file della polizza emessa.');
      return;
    }
    setEmessaSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', emessaFile);
      formData.append('entity_type', 'policy');
      formData.append('entity_id', String(policy.id));
      formData.append('tipo', 'polizza_emessa');
      await api.upload('/attachments/upload', formData);
      await api.put(`/policies/${policy.id}/status`, { stato: 'EMESSA' });
      setEmessaOpen(false);
      setEmessaFile(null);
      onRefresh?.();
    } catch (e) {
      onActionError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setEmessaSubmitting(false);
    }
  };

  const downloadReceipt = async () => {
    const id = policy.ricevuta_pagamento_attachment_id;
    if (!id) return;
    close();
    try {
      await api.download(`/attachments/download/${id}`, `ricevuta-${policy.numero.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      onActionError(e instanceof ApiError ? e.message : 'Download non riuscito.');
    }
  };

  const downloadPolizza = async () => {
    const id = policy.polizza_emessa_attachment_id;
    if (!id) return;
    close();
    try {
      await api.download(`/attachments/download/${id}`, `polizza-${policy.numero.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      onActionError(e instanceof ApiError ? e.message : 'Download non riuscito.');
    }
  };

  const itemClass = (enabled: boolean) =>
    `flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm transition ${
      enabled ? 'cursor-pointer text-gray-800 hover:bg-slate-100' : 'cursor-not-allowed text-gray-400'
    }`;

  const receiptId = policy.ricevuta_pagamento_attachment_id;
  const polizzaId = policy.polizza_emessa_attachment_id;

  const backofficeMenu =
    open && variant === 'backoffice' ? (
      <div
        ref={menuRef}
        className="fixed z-[200] max-h-[min(70vh,420px)] overflow-y-auto rounded-lg border border-gray-200/90 bg-white py-1 shadow-lg ring-1 ring-black/5"
        style={{
          top: menuPos.top,
          left: menuPos.left,
          width: MENU_WIDTH,
          ...(menuPos.maxHeightPx != null ? { maxHeight: menuPos.maxHeightPx } : {}),
        }}
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          className={itemClass(true)}
          onClick={() => {
            close();
            onNavigateOpen(policy.id);
          }}
        >
          Apri
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(Boolean(receiptId))}
          disabled={!receiptId}
          onClick={() => {
            if (!receiptId) return;
            void downloadReceipt();
          }}
        >
          Scarica ricevuta pagamento
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(policy.stato === 'RICHIESTA PRESENTATA')}
          disabled={policy.stato !== 'RICHIESTA PRESENTATA'}
          onClick={() => void putInEmissione()}
        >
          In emissione
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(policy.stato === 'IN EMISSIONE')}
          disabled={policy.stato !== 'IN EMISSIONE'}
          onClick={() => {
            close();
            setEmessaFile(null);
            setEmessaOpen(true);
          }}
        >
          Emessa
        </button>
        <button type="button" role="menuitem" className={itemClass(true)} onClick={() => void openHistory()}>
          Storico stati
        </button>
      </div>
    ) : null;

  const strutturaMenu =
    open && variant === 'struttura' ? (
      <div
        ref={menuRef}
        className="fixed z-[200] max-h-[min(70vh,420px)] overflow-y-auto rounded-lg border border-gray-200/90 bg-white py-1 shadow-lg ring-1 ring-black/5"
        style={{
          top: menuPos.top,
          left: menuPos.left,
          width: MENU_WIDTH,
          ...(menuPos.maxHeightPx != null ? { maxHeight: menuPos.maxHeightPx } : {}),
        }}
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          className={itemClass(true)}
          onClick={() => {
            close();
            onNavigateOpen(policy.id);
          }}
        >
          Apri
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(Boolean(receiptId))}
          disabled={!receiptId}
          onClick={() => {
            if (!receiptId) return;
            void downloadReceipt();
          }}
        >
          Scarica ricevuta pagamento
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(policy.stato === 'EMESSA' && Boolean(polizzaId))}
          disabled={policy.stato !== 'EMESSA' || !polizzaId}
          onClick={() => {
            if (policy.stato !== 'EMESSA' || !polizzaId) return;
            void downloadPolizza();
          }}
        >
          Scarica polizza
        </button>
        <button type="button" role="menuitem" className={itemClass(true)} onClick={() => void openHistory()}>
          Storico stati
        </button>
      </div>
    ) : null;

  return (
    <>
      <div ref={wrapRef} className="relative inline-flex">
        <button
          type="button"
          data-policy-actions-trigger
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          Azioni
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </div>
      {open ? <div className="fixed inset-0 z-[190]" aria-hidden onClick={close} /> : null}
      {typeof document !== 'undefined' && (backofficeMenu || strutturaMenu)
        ? createPortal(backofficeMenu || strutturaMenu, document.body)
        : null}

      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Storico stati polizza" size="md">
        {historyLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          </div>
        ) : (
          <PolicyHistoryBody history={historyRows} />
        )}
      </Modal>

      <Modal
        isOpen={emessaOpen}
        onClose={() => !emessaSubmitting && setEmessaOpen(false)}
        title="Polizza emessa"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Carica il file definitivo della polizza (obbligatorio). Lo stato verrà impostato su <strong>EMESSA</strong>.
          </p>
          <div>
            <label htmlFor="policy-final-file" className="mb-1 block text-sm font-medium text-slate-700">
              File polizza emessa
            </label>
            <input
              id="policy-final-file"
              type="file"
              onChange={(e) => setEmessaFile(e.target.files?.[0] || null)}
              className="input-field text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-blue-700"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" disabled={emessaSubmitting} onClick={() => setEmessaOpen(false)}>
              Annulla
            </button>
            <button type="button" className="btn-primary" disabled={emessaSubmitting} onClick={() => void submitEmessa()}>
              {emessaSubmitting ? 'Salvataggio…' : 'Conferma'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
