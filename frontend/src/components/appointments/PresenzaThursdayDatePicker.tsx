import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { dataIsoIsThursday } from '../../utils/appointmentPresenzaSlots';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseLocalYMD(iso: string): Date | null {
  const raw = iso.trim().slice(0, 10);
  if (!DATE_RE.test(raw)) return null;
  const [yy, mm, dd] = raw.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  const d = new Date(yy, mm - 1, dd, 12, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toIsoLocal(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  /** Mostrato nel trigger quando non c’è selezione */
  placeholder?: string;
};

const WEEKDAY_LABELS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'] as const;

/**
 * Solo giovedì selezionabili; gli altri giorni sono visivamente disabilitati (grigi / barrati).
 * Nessuna digitazione diretta sulla data ISO.
 */
export default function PresenzaThursdayDatePicker({
  value,
  onChange,
  className,
  buttonClassName,
  disabled,
  placeholder = 'Data',
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [floatPos, setFloatPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const selected = parseLocalYMD(value);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selected ?? new Date()));

  useEffect(() => {
    if (value && dataIsoIsThursday(value)) {
      const d = parseLocalYMD(value);
      if (d) setVisibleMonth(startOfMonth(d));
    }
  }, [value]);

  const updateFloatPosition = useCallback(() => {
    const t = triggerRef.current;
    const p = panelRef.current;
    if (!t) return;
    const rect = t.getBoundingClientRect();
    const margin = 6;
    const pad = 8;
    const rawW = p?.offsetWidth;
    const rawH = p?.offsetHeight;
    const estW = Math.min(rawW && rawW > 0 ? rawW : 288, window.innerWidth - 2 * pad);
    const h = rawH && rawH > 0 ? rawH : 340;

    let left = rect.left;
    if (left + estW > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - estW - pad);
    }
    if (left < pad) left = pad;

    let top = rect.bottom + margin;
    if (top + h > window.innerHeight - pad) {
      top = rect.top - h - margin;
    }
    if (top < pad) top = pad;

    setFloatPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open || disabled) return;
    updateFloatPosition();
    const id = requestAnimationFrame(() => updateFloatPosition());
    return () => cancelAnimationFrame(id);
  }, [open, disabled, visibleMonth, updateFloatPosition]);

  useEffect(() => {
    if (!open || disabled) return;
    const onReposition = () => updateFloatPosition();
    window.addEventListener('resize', onReposition);
    document.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      document.removeEventListener('scroll', onReposition, true);
    };
  }, [open, disabled, updateFloatPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (triggerRef.current?.contains(node)) return;
      if (panelRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const triggerLabel =
    selected && dataIsoIsThursday(value)
      ? format(selected, 'dd/MM/yyyy')
      : placeholder;

  const calendarPanel = open && !disabled && (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Calendario: solo giorni giovedì"
      className="fixed z-[100] min-w-[18rem] max-w-[calc(100vw-1rem)] rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
      style={{ top: floatPos.top, left: floatPos.left }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Mese precedente"
          className="inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--ui-focus-ring)] focus-visible:outline-none"
          onClick={() => setVisibleMonth((m) => startOfMonth(addMonths(m, -1)))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center text-sm font-semibold capitalize text-slate-800">
          {format(visibleMonth, 'LLLL yyyy', { locale: it })}
        </div>
        <button
          type="button"
          aria-label="Mese successivo"
          className="inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--ui-focus-ring)] focus-visible:outline-none"
          onClick={() => setVisibleMonth((m) => startOfMonth(addMonths(m, 1)))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {WEEKDAY_LABELS.map((l, i) => (
          <span key={`wdh-${i}-${l}`}>{l}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const thu = d.getDay() === 4;
          const inMonth = isSameMonth(d, visibleMonth);
          const isSel = !!(selected && isSameDay(d, selected));

          const canPick = thu;
          return (
            <button
              key={toIsoLocal(d)}
              type="button"
              disabled={!canPick}
              onClick={() => {
                if (!canPick) return;
                onChange(toIsoLocal(d));
                setOpen(false);
              }}
              className={[
                'aspect-square max-h-10 rounded-md text-sm transition',
                canPick
                  ? isSel
                    ? 'bg-[var(--ui-primary)] font-semibold text-white shadow-inner'
                    : [
                        'font-medium hover:bg-slate-100 active:bg-slate-200 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--ui-focus-ring)] focus-visible:outline-none',
                        inMonth ? 'text-slate-800' : 'text-slate-600',
                      ].join(' ')
                  : ['cursor-not-allowed text-slate-400 line-through opacity-55', !inMonth && 'opacity-35'].filter(Boolean).join(' '),
              ].join(' ')}
              aria-label={
                canPick
                  ? `Giovedì ${format(d, 'd MMMM yyyy', { locale: it })}`
                  : `${format(d, 'EEEE d', { locale: it })} non disponibile`
              }
              aria-pressed={isSel || undefined}
            >
              <span>{format(d, 'd')}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-snug text-slate-500">
        Sono selezionabili solo i <strong className="font-medium text-slate-600">giovedì</strong>. Gli altri giorni non sono
        disponibili.
      </p>
    </div>
  );

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={[
          'flex w-full min-w-0 items-center justify-between gap-2 text-left outline-none',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          buttonClassName ??
            'rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-offset-white transition hover:border-slate-300 focus-visible:border-slate-300 focus-visible:ring-2 focus-visible:ring-[var(--ui-focus-ring)]',
          'h-9 py-0',
        ].filter(Boolean).join(' ')}
      >
        <span
          className={[
            'min-w-0 flex-1 whitespace-nowrap tabular-nums',
            triggerLabel === placeholder ? 'text-slate-400' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {triggerLabel}
        </span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500 opacity-70" aria-hidden />
      </button>
      {typeof document !== 'undefined' && calendarPanel ? createPortal(calendarPanel, document.body) : null}
    </div>
  );
}
