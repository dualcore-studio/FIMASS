import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parse, startOfMonth, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Appointment } from '../../types';
import { getUserDisplayName } from '../../utils/helpers';
import { appointmentCalendarChipClass, appointmentCalendarDotClass, modalitaLabel } from '../../utils/appointmentLabels';
import { parseMonthKey } from '../../utils/appointmentCalendarMonth';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MAX_VISIBLE_DEFAULT = 4;

function dayKey(apt: Appointment): string {
  return String(apt.data_appuntamento || '').slice(0, 10);
}

function assistitoDisplay(a: Appointment): string {
  const s = [a.assistito_nome, a.assistito_cognome].filter(Boolean).join(' ').trim();
  return s || '—';
}

function formatTimeRange(a: Appointment): string {
  const start = String(a.ora_inizio || '').slice(0, 5);
  const end = String(a.ora_fine || '').slice(0, 5);
  if (start && end) return `${start} – ${end}`;
  return start || '—';
}

type Props = {
  monthKey: string;
  items: Appointment[];
  loading: boolean;
  onMonthChange: (key: string) => void;
  onSelectAppointment: (a: Appointment) => void;
};

type HoverTip = {
  apt: Appointment;
  x: number;
  y: number;
};

export default function AppointmentsMonthCalendar({ monthKey, items, loading, onMonthChange, onSelectAppointment }: Props) {
  const anchor = parseMonthKey(monthKey);
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDate = new Map<string, Appointment[]>();
  for (const a of items) {
    const k = dayKey(a);
    if (!k) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    if (!isSameMonth(parse(k, 'yyyy-MM-dd', new Date()), monthStart)) continue;
    const list = byDate.get(k) ?? [];
    list.push(a);
    byDate.set(k, list);
  }
  for (const [, list] of byDate) {
    list.sort((x, y) => String(x.ora_inizio || '').localeCompare(String(y.ora_inizio || '')));
  }

  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());
  const [hoverTip, setHoverTip] = useState<HoverTip | null>(null);
  const tipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTipSoon = useCallback(() => {
    if (tipHideTimer.current) clearTimeout(tipHideTimer.current);
    tipHideTimer.current = setTimeout(() => setHoverTip(null), 120);
  }, []);

  const showTip = useCallback((e: React.MouseEvent, apt: Appointment) => {
    if (tipHideTimer.current) clearTimeout(tipHideTimer.current);
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const pad = 6;
    const tipW = 288;
    const estH = 200;
    let x = r.left;
    let y = r.bottom + pad;
    if (x + tipW > window.innerWidth - 8) x = Math.max(8, window.innerWidth - tipW - 8);
    if (x < 8) x = 8;
    if (y + estH > window.innerHeight - 8) y = Math.max(8, r.top - estH - pad);
    setHoverTip({ apt, x, y });
  }, []);

  useEffect(() => {
    return () => {
      if (tipHideTimer.current) clearTimeout(tipHideTimer.current);
    };
  }, []);

  const toggleDayExpand = (k: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const label = format(anchor, 'LLLL yyyy', { locale: it });
  const title = label.charAt(0).toUpperCase() + label.slice(1);

  const go = (dir: -1 | 1) => {
    const n = addMonths(anchor, dir);
    onMonthChange(format(n, 'yyyy-MM'));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-[var(--portal-table-header-bg)] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} className="btn-secondary !py-1.5 !px-2" aria-label="Mese precedente">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => go(1)} className="btn-secondary !py-1.5 !px-2" aria-label="Mese successivo">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h2 className="min-w-0 text-center text-base font-semibold capitalize tracking-tight text-slate-900 sm:text-lg">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => onMonthChange(format(startOfMonth(new Date()), 'yyyy-MM'))}
          className="text-sm font-medium text-[var(--ui-primary)] hover:underline"
        >
          Oggi
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--ui-primary)] border-t-transparent" />
            <p className="text-sm text-slate-500">Caricamento appuntamenti…</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[680px] grid-cols-7 border-b border-slate-200/70 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-l border-slate-200/60 px-0.5 py-2 first:border-l-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid min-w-[680px] grid-cols-7">
            {days.map((day, i) => {
              const inMonth = isSameMonth(day, monthStart);
              const k = format(day, 'yyyy-MM-dd');
              const list = inMonth ? (byDate.get(k) ?? []) : [];
              const expanded = expandedDays.has(k);
              const maxVis = expanded ? list.length : MAX_VISIBLE_DEFAULT;
              const visible = list.slice(0, maxVis);
              const hiddenCount = expanded ? 0 : Math.max(0, list.length - MAX_VISIBLE_DEFAULT);

              return (
                <div
                  key={k + i}
                  className={`min-h-[104px] border-b border-r border-slate-200/55 p-1 sm:min-h-[112px] sm:p-1.5 ${i % 7 === 0 ? 'border-l border-slate-200/55' : ''} ${
                    inMonth ? 'bg-white' : 'bg-slate-50/60'
                  }`}
                >
                  <div className={`mb-0.5 text-left text-xs tabular-nums ${inMonth ? 'font-medium text-slate-800' : 'text-slate-300'}`}>
                    {isSameDay(day, new Date()) ? (
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-white">
                        {format(day, 'd')}
                      </span>
                    ) : (
                      <span className="inline-block pl-0.5 pt-0.5">{format(day, 'd')}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-px">
                    {visible.map((a) => {
                      const time = String(a.ora_inizio || '').slice(0, 5);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onSelectAppointment(a)}
                          onMouseEnter={(e) => showTip(e, a)}
                          onMouseLeave={clearTipSoon}
                          className={`flex w-full min-w-0 items-center gap-0.5 border-l-2 py-0.5 pl-1 pr-0.5 text-left text-[11px] leading-[1.25] text-slate-800 transition hover:brightness-[0.98] ${appointmentCalendarChipClass(a.stato)}`}
                          style={{ minHeight: 22, maxHeight: 24 }}
                        >
                          <span className={`mt-[1px] h-1.5 w-1.5 shrink-0 rounded-full ${appointmentCalendarDotClass(a.stato)}`} aria-hidden />
                          <span className="min-w-0 flex-1 truncate tabular-nums">
                            <span className="tabular-nums text-slate-600">{time}</span>
                            <span className="text-slate-600"> </span>
                            <span className="font-medium text-slate-900">{assistitoDisplay(a)}</span>
                          </span>
                        </button>
                      );
                    })}
                    {hiddenCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleDayExpand(k)}
                        className="mt-0.5 w-full py-0.5 text-left text-[11px] font-medium text-[var(--ui-primary)] hover:underline"
                      >
                        +{hiddenCount} altri
                      </button>
                    ) : null}
                    {expanded && list.length > MAX_VISIBLE_DEFAULT ? (
                      <button
                        type="button"
                        onClick={() => toggleDayExpand(k)}
                        className="mt-0.5 w-full py-0.5 text-left text-[11px] text-slate-500 hover:text-slate-700 hover:underline"
                      >
                        Mostra meno
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hoverTip
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[200] w-72 max-w-[calc(100vw-16px)] rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-left text-xs shadow-lg shadow-slate-900/10"
              style={{ left: hoverTip.x, top: hoverTip.y }}
              role="tooltip"
            >
              <p className="font-semibold text-slate-900">{assistitoDisplay(hoverTip.apt)}</p>
              <p className="mt-1.5 tabular-nums text-slate-600">{formatTimeRange(hoverTip.apt)}</p>
              <dl className="mt-2 space-y-1.5 text-slate-600">
                <div className="flex gap-2">
                  <dt className="shrink-0 text-slate-500">Fornitore</dt>
                  <dd className="min-w-0 font-medium text-slate-800">
                    {hoverTip.apt.fornitore ? getUserDisplayName(hoverTip.apt.fornitore) : '—'}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-slate-500">Modalità</dt>
                  <dd className="min-w-0 font-medium text-slate-800">{modalitaLabel(hoverTip.apt.modalita)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-slate-500">Stato</dt>
                  <dd className="min-w-0 font-medium text-slate-800">{hoverTip.apt.stato}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-slate-500">Oggetto</dt>
                  <dd className="min-w-0 break-words font-medium text-slate-800">{hoverTip.apt.oggetto || '—'}</dd>
                </div>
              </dl>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
