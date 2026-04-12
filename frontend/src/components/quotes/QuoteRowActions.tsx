import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { Quote } from '../../types';
import { api, ApiError } from '../../utils/api';
import { downloadPreventivoFinale } from '../../utils/downloadPreventivoFinale';
import {
  adminCanAssignQuote,
  adminCanDownloadPreventivoFinale,
  adminCanReassignQuote,
} from '../../utils/quoteAdminActions';
import {
  operatorCanElaborata,
  operatorCanInLavorazione,
  operatorCanStandby,
} from '../../utils/quoteOperatorActions';

const MENU_WIDTH = 228;
const VIEW_MARGIN = 8;
const MENU_GAP = 4;
/** Allineato a max-h-[min(70vh,420px)] nel markup */
const MENU_MAX_PX = 420;
const MENU_VH_CAP = 0.7;

type MenuPos = { top: number; left: number; maxHeightPx?: number };

export type QuoteRowActionsProps = {
  quote: Quote;
  /** `admin`: back-office. `struttura` / `operatore`: voci filtrate per ruolo. */
  variant?: 'admin' | 'struttura' | 'operatore';
  onNavigateDetail: (id: number) => void;
  onOpenHistory: (id: number) => void;
  onActionError: (message: string) => void;
  /** Solo variant `admin` / supervisore */
  onOpenAssign?: (quote: Quote) => void;
  onOpenReassign?: (quote: Quote) => void;
  /** Se valorizzato, mostra la voce Elimina (solo ruoli con permesso effettivo, es. admin). */
  onOpenDelete?: (id: number) => void;
  /** Solo variant `struttura`: modale motivazione standby */
  onOpenStandbyReason?: (quote: Quote) => void;
  /** Solo variant `struttura`: richiesta emissione polizza (ELABORATA senza polizza) */
  onRichiediPolizza?: (quote: Quote) => void;
  /** Solo variant `operatore`: workflow da tabella */
  onOpenOperatorStandby?: (quote: Quote) => void;
  onOpenOperatorElaborata?: (quote: Quote) => void;
  onOpenOperatorInLavorazione?: (quote: Quote) => void;
};

export default function QuoteRowActions({
  quote,
  variant = 'admin',
  onNavigateDetail,
  onOpenAssign,
  onOpenReassign,
  onOpenHistory,
  onActionError,
  onOpenDelete,
  onOpenStandbyReason,
  onRichiediPolizza,
  onOpenOperatorStandby,
  onOpenOperatorElaborata,
  onOpenOperatorInLavorazione,
}: QuoteRowActionsProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });

  const assignEnabled = adminCanAssignQuote(quote.stato);
  const reassignEnabled = adminCanReassignQuote(quote.stato);
  const downloadPrevEnabled = adminCanDownloadPreventivoFinale(
    quote.stato,
    quote.preventivo_finale_attachment_id,
  );
  const standbyReasonEnabled = quote.stato === 'STANDBY';
  const richiediPolizzaEnabled =
    quote.stato === 'ELABORATA' && Number(quote.has_policy) === 0;

  const operatorStandbyEnabled = operatorCanStandby(quote.stato);
  const operatorInLavEnabled = operatorCanInLavorazione(quote.stato);
  const operatorElaborataEnabled = operatorCanElaborata(quote.stato);

  const updatePosition = useCallback(() => {
    const trigger = wrapRef.current?.querySelector<HTMLElement>('[data-quote-actions-trigger]');
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
    if (top < VIEW_MARGIN) {
      top = VIEW_MARGIN;
    }
    if (top + boxH > vh - VIEW_MARGIN) {
      maxHeightPx = Math.max(1, vh - VIEW_MARGIN - top);
    }

    setMenuPos((prev) => {
      if (
        prev.top === top &&
        prev.left === left &&
        prev.maxHeightPx === maxHeightPx
      ) {
        return prev;
      }
      return { top, left, maxHeightPx };
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    // Misura il menu nel portale subito dopo il mount; aggiorna posizione nello stesso frame.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- posizionamento dropdown (stesso schema lista admin)
    updatePosition();
    const el = menuRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updatePosition());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, updatePosition, variant]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, updatePosition, variant]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const close = () => setOpen(false);

  const handleExportPdf = async () => {
    close();
    try {
      await api.download(`/quotes/${quote.id}/summary-pdf`, `preventivo-${quote.id}.pdf`);
    } catch (e) {
      onActionError(e instanceof ApiError ? e.message : 'Esportazione PDF non riuscita.');
    }
  };

  const handleDownloadPreventivo = async () => {
    if (!downloadPrevEnabled || !quote.preventivo_finale_attachment_id) return;
    close();
    try {
      const name = quote.preventivo_finale_nome || `preventivo-finale-${quote.id}.pdf`;
      await downloadPreventivoFinale(quote.id, name);
    } catch (e) {
      onActionError(e instanceof ApiError ? e.message : 'Download non riuscito.');
    }
  };

  const itemClass = (enabled: boolean) =>
    `flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm transition ${
      enabled
        ? 'cursor-pointer text-gray-800 hover:bg-slate-100'
        : 'cursor-not-allowed text-gray-400'
    }`;

  const menu =
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
            onNavigateDetail(quote.id);
          }}
        >
          Apri
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(downloadPrevEnabled)}
          disabled={!downloadPrevEnabled}
          onClick={handleDownloadPreventivo}
        >
          Scarica preventivo
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(richiediPolizzaEnabled)}
          disabled={!richiediPolizzaEnabled}
          onClick={() => {
            if (!richiediPolizzaEnabled || !onRichiediPolizza) return;
            close();
            onRichiediPolizza(quote);
          }}
        >
          Richiedi polizza
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(standbyReasonEnabled)}
          disabled={!standbyReasonEnabled}
          onClick={() => {
            if (!standbyReasonEnabled || !onOpenStandbyReason) return;
            close();
            onOpenStandbyReason(quote);
          }}
        >
          Causa standby
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(true)}
          onClick={() => {
            close();
            onOpenHistory(quote.id);
          }}
        >
          Storico stati
        </button>
      </div>
    ) : open && variant === 'operatore' ? (
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
            onNavigateDetail(quote.id);
          }}
        >
          Apri
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(downloadPrevEnabled)}
          disabled={!downloadPrevEnabled}
          onClick={handleDownloadPreventivo}
        >
          Scarica preventivo
        </button>
        <button type="button" role="menuitem" className={itemClass(true)} onClick={handleExportPdf}>
          Esporta
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(operatorStandbyEnabled)}
          disabled={!operatorStandbyEnabled}
          onClick={() => {
            if (!operatorStandbyEnabled || !onOpenOperatorStandby) return;
            close();
            onOpenOperatorStandby(quote);
          }}
        >
          Standby
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(operatorInLavEnabled)}
          disabled={!operatorInLavEnabled}
          onClick={() => {
            if (!operatorInLavEnabled || !onOpenOperatorInLavorazione) return;
            close();
            onOpenOperatorInLavorazione(quote);
          }}
        >
          In lavorazione
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(operatorElaborataEnabled)}
          disabled={!operatorElaborataEnabled}
          onClick={() => {
            if (!operatorElaborataEnabled || !onOpenOperatorElaborata) return;
            close();
            onOpenOperatorElaborata(quote);
          }}
        >
          Elaborata
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(true)}
          onClick={() => {
            close();
            onOpenHistory(quote.id);
          }}
        >
          Storico stati
        </button>
      </div>
    ) : open && variant === 'admin' ? (
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
            onNavigateDetail(quote.id);
          }}
        >
          Apri
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(assignEnabled)}
          disabled={!assignEnabled}
          onClick={() => {
            if (!assignEnabled || !onOpenAssign) return;
            close();
            onOpenAssign(quote);
          }}
        >
          Assegna
        </button>
        <button type="button" role="menuitem" className={itemClass(true)} onClick={handleExportPdf}>
          Esporta
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(downloadPrevEnabled)}
          disabled={!downloadPrevEnabled}
          onClick={handleDownloadPreventivo}
        >
          Scarica preventivo
        </button>
        <button
          type="button"
          role="menuitem"
          className={itemClass(reassignEnabled)}
          disabled={!reassignEnabled}
          onClick={() => {
            if (!reassignEnabled || !onOpenReassign) return;
            close();
            onOpenReassign(quote);
          }}
        >
          Riassegna
        </button>
        {onOpenDelete ? (
          <button
            type="button"
            role="menuitem"
            className={itemClass(true)}
            onClick={() => {
              close();
              onOpenDelete(quote.id);
            }}
          >
            Elimina
          </button>
        ) : null}
        <button
          type="button"
          role="menuitem"
          className={itemClass(true)}
          onClick={() => {
            close();
            onOpenHistory(quote.id);
          }}
        >
          Storico stati
        </button>
      </div>
    ) : null;

  return (
    <div ref={wrapRef} className="relative flex justify-end">
      <button
        type="button"
        data-quote-actions-trigger
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Azioni
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
