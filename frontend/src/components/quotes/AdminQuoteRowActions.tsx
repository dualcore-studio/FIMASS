import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { Quote } from '../../types';
import { api, ApiError } from '../../utils/api';
import {
  adminCanAssignQuote,
  adminCanDownloadPreventivoFinale,
  adminCanReassignQuote,
} from '../../utils/quoteAdminActions';

type Props = {
  quote: Quote;
  onNavigateDetail: (id: number) => void;
  onOpenAssign: (quote: Quote) => void;
  onOpenReassign: (quote: Quote) => void;
  onOpenDelete: (id: number) => void;
  onOpenHistory: (id: number) => void;
  onActionError: (message: string) => void;
};

export default function AdminQuoteRowActions({
  quote,
  onNavigateDetail,
  onOpenAssign,
  onOpenReassign,
  onOpenDelete,
  onOpenHistory,
  onActionError,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const assignEnabled = adminCanAssignQuote(quote.stato);
  const reassignEnabled = adminCanReassignQuote(quote.stato);
  const downloadPrevEnabled = adminCanDownloadPreventivoFinale(
    quote.stato,
    quote.preventivo_finale_attachment_id,
  );

  const updatePosition = () => {
    const trigger = wrapRef.current?.querySelector<HTMLElement>('[data-quote-actions-trigger]');
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const menuWidth = 228;
    let left = r.right - menuWidth;
    const margin = 8;
    if (left < margin) left = margin;
    if (left + menuWidth > window.innerWidth - margin) {
      left = window.innerWidth - menuWidth - margin;
    }
    setMenuPos({ top: r.bottom + 4, left });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

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
      await api.download(`/attachments/download/${quote.preventivo_finale_attachment_id}`, name);
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

  const menu = open ? (
    <div
      ref={menuRef}
      className="fixed z-[200] max-h-[min(70vh,420px)] overflow-y-auto rounded-lg border border-gray-200/90 bg-white py-1 shadow-lg ring-1 ring-black/5"
      style={{
        top: menuPos.top,
        left: menuPos.left,
        width: 228,
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
          if (!assignEnabled) return;
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
          if (!reassignEnabled) return;
          close();
          onOpenReassign(quote);
        }}
      >
        Riassegna
      </button>
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
          if (!open) updatePosition();
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
