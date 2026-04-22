import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parse, startOfMonth, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Appointment } from '../../types';
import { getAppointmentStatusColor, getUserDisplayName } from '../../utils/helpers';
import { modalitaBadgeClass, modalitaLabel } from '../../utils/appointmentLabels';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function parseMonthKey(m: string | null): Date {
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return startOfMonth(new Date());
  return startOfMonth(parse(`${m}-01`, 'yyyy-MM-dd', new Date()));
}

function dayKey(apt: Appointment): string {
  return String(apt.data_appuntamento || '').slice(0, 10);
}

type Props = {
  monthKey: string;
  items: Appointment[];
  loading: boolean;
  onMonthChange: (key: string) => void;
  onSelectAppointment: (a: Appointment) => void;
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

  const label = format(anchor, 'LLLL yyyy', { locale: it });
  const title = label.charAt(0).toUpperCase() + label.slice(1);

  const go = (dir: -1 | 1) => {
    const n = addMonths(anchor, dir);
    onMonthChange(format(n, 'yyyy-MM'));
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/90 bg-[var(--portal-table-header-bg)] px-3 py-2.5 sm:px-4">
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
        <button type="button" onClick={() => onMonthChange(format(startOfMonth(new Date()), 'yyyy-MM'))} className="text-sm font-medium text-[var(--ui-primary)] hover:underline">
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
        <div className="overflow-x-auto p-1 sm:p-2">
          <div className="grid min-w-[720px] grid-cols-7 border-b border-slate-200/80 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-0.5 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid min-w-[720px] grid-cols-7">
            {days.map((day, i) => {
              const inMonth = isSameMonth(day, monthStart);
              const k = format(day, 'yyyy-MM-dd');
              const list = inMonth ? (byDate.get(k) ?? []) : [];
              return (
                <div
                  key={k + i}
                  className={`min-h-[100px] border-b border-r border-slate-100 p-0.5 sm:min-h-[110px] sm:p-1 ${i % 7 === 0 ? 'border-l' : ''} ${
                    inMonth ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <div
                    className={`mb-0.5 text-right text-xs tabular-nums ${inMonth ? 'font-medium text-slate-800' : 'text-slate-300'}`}
                  >
                    {isSameDay(day, new Date()) ? (
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-white">{format(day, 'd')}</span>
                    ) : (
                      <span className="inline-block p-0.5">{format(day, 'd')}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {list.slice(0, 3).map((a) => {
                      const ass = [a.assistito_nome, a.assistito_cognome].filter(Boolean).join(' ');
                      const fornShort = a.fornitore ? getUserDisplayName(a.fornitore) : '—';
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onSelectAppointment(a)}
                          className="block w-full rounded-md border-l-[3px] border-[var(--ui-primary)] bg-slate-50/90 px-1 py-0.5 text-left text-[11px] leading-snug text-slate-800 shadow-sm ring-1 ring-slate-200/60 transition hover:bg-white hover:ring-slate-300/80"
                        >
                          <span className="block font-medium tabular-nums text-slate-600">{a.ora_inizio?.slice(0, 5)}</span>
                          <span className="line-clamp-2 font-medium text-slate-900">{ass || '—'}</span>
                          <span className="line-clamp-1 text-[10px] text-slate-500" title={fornShort}>
                            {fornShort.length > 22 ? `${fornShort.slice(0, 20)}…` : fornShort}
                          </span>
                          <div className="mt-0.5 flex flex-wrap items-center gap-0.5">
                            <span className={`inline-block max-w-full truncate rounded px-1 py-px text-[9px] font-medium ${modalitaBadgeClass(a.modalita)}`}>
                              {modalitaLabel(a.modalita)}
                            </span>
                            <span className={`max-w-full truncate rounded px-1 py-px text-[8px] font-semibold ${getAppointmentStatusColor(a.stato)}`} title={a.stato}>
                              {a.stato}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {list.length > 3 ? (
                      <p className="pl-0.5 text-[10px] text-slate-500">+{list.length - 3} altri</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { parseMonthKey };
