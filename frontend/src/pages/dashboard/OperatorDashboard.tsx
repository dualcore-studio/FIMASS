import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, Clock, AlertTriangle, CheckCircle, ExternalLink, Bell } from 'lucide-react';
import { api } from '../../utils/api';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatDateTime, getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import type { Quote, PaginatedResponse, QuoteReminder } from '../../types';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';
import DashboardPrimaryKpi from '../../components/dashboard/DashboardPrimaryKpi';
import DashboardPanel from '../../components/dashboard/DashboardPanel';

interface QuoteStats {
  PRESENTATA: number;
  ASSEGNATA: number;
  'IN LAVORAZIONE': number;
  STANDBY: number;
  ELABORATA: number;
  totale: number;
}

export default function OperatorDashboard() {
  const { user } = useAuth();
  const [quoteStats, setQuoteStats] = useState<QuoteStats | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [reminders, setReminders] = useState<QuoteReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setLoading(true);
      try {
        const [stats, list] = await Promise.all([
          api.get<QuoteStats>('/quotes/stats'),
          api.get<PaginatedResponse<Quote>>('/quotes?limit=10'),
        ]);

        let remindersData: QuoteReminder[] = [];
        try {
          remindersData = await api.get<QuoteReminder[]>('/quotes/reminders/mine');
        } catch {
          remindersData = [];
        }

        if (!cancelled) {
          setQuoteStats(stats);
          setQuotes(list.data);
          setReminders(remindersData.filter((r) => !r.read_at));
        }
      } catch {
        if (!cancelled) {
          setError('Impossibile caricare i tuoi preventivi.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayLabel = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--ui-primary)] border-t-transparent" />
          <p className="text-sm text-slate-500">Caricamento…</p>
        </div>
      </div>
    );
  }

  if (error || !quoteStats) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="border-l-4 border-l-red-500 pl-4 text-sm font-medium text-red-800">
          {error ?? 'Dati non disponibili.'}
        </p>
      </div>
    );
  }

  const operativitaRows = [
    { label: 'Pratiche in carico (assegnate)', value: quoteStats.ASSEGNATA },
    { label: 'In lavorazione attiva', value: quoteStats['IN LAVORAZIONE'] },
    { label: 'In stand-by', value: quoteStats.STANDBY },
    { label: 'Completate (elaborate)', value: quoteStats.ELABORATA },
    { label: 'Totale visibile al tuo profilo', value: quoteStats.totale },
  ];

  async function markReminderAsRead(reminderId: number) {
    try {
      await api.put(`/quotes/reminders/${reminderId}/read`);
      setReminders((current) => current.filter((r) => r.id !== reminderId));
    } catch {
      // Non bloccare l'operatore: in caso di errore resta visibile nell'elenco.
    }
  }

  return (
    <div className="mx-auto w-full max-w-[88rem] space-y-6 lg:space-y-7">
      <DashboardPageHeader
        title="Dashboard"
        welcomeLine={user ? `I miei preventivi — ${getUserDisplayName(user)}` : undefined}
        dateLabel={todayLabel}
        description="Riepilogo delle pratiche assegnate a te e accesso rapido alle schede."
        actions={
          <>
            <Link
              to="/preventivi"
              className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm shadow-sm shadow-slate-900/10"
            >
              Tutti i preventivi
            </Link>
          </>
        }
      />

      {reminders.length > 0 ? (
        <section
          aria-label="Solleciti ricevuti"
          aria-live="polite"
          className="kpi-accent-attention overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(15,23,42,0.1)]"
        >
          <div className="border-b border-[var(--portal-border-subtle)] bg-[linear-gradient(to_bottom,#fffefb,#faf8f2)] px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200/80 bg-[#faf6ec] text-[#7a6220]">
                  <Bell className="h-5 w-5" strokeWidth={1.85} aria-hidden />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-[1.05rem]">
                      Solleciti da supervisore / admin
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-[var(--badge-soft-orange-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--badge-soft-orange-text)] ring-1 ring-inset ring-amber-900/10">
                      Azione richiesta
                    </span>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600">
                    Promemoria sulle pratiche in lavorazione: leggi e intervieni sulle pratiche indicate.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <ul className="space-y-2.5">
              {reminders.map((reminder) => (
                <li
                  key={reminder.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/85 bg-slate-50/50 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Preventivo {reminder.quote_numero}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {`Sollecito da ${reminder.created_by_role} `}
                      {[reminder.created_by_nome, reminder.created_by_cognome].filter(Boolean).join(' ') || ''}
                      {' · '}
                      {formatDateTime(reminder.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/preventivi/${reminder.quote_id}`}
                      className="btn-primary inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold"
                    >
                      Apri pratica
                    </Link>
                    <button
                      type="button"
                      onClick={() => markReminderAsRead(reminder.id)}
                      className="btn-secondary rounded-lg px-3 py-2 text-xs font-semibold"
                    >
                      Segna letto
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-label="Indicatori primari">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Le tue attività</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 lg:gap-4">
          <DashboardPrimaryKpi label="Assegnate" value={quoteStats.ASSEGNATA} icon={UserCheck} accent="info" />
          <DashboardPrimaryKpi label="In lavorazione" value={quoteStats['IN LAVORAZIONE']} icon={Clock} accent="work" />
          <DashboardPrimaryKpi label="Stand-by" value={quoteStats.STANDBY} icon={AlertTriangle} accent="standby" />
          <DashboardPrimaryKpi label="Elaborate" value={quoteStats.ELABORATA} icon={CheckCircle} accent="done" />
          <DashboardPrimaryKpi
            label="Solleciti da leggere"
            value={reminders.length}
            icon={Bell}
            accent={reminders.length > 0 ? 'attention' : 'institutional'}
            variant={reminders.length > 0 ? 'attention' : 'default'}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-7">
          <DashboardPanel
            title="Operatività recente"
            description="Stato aggregato delle pratiche collegate al tuo utente."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 sm:px-5">Indicatore</th>
                    <th className="px-4 py-2.5 text-right sm:px-5">Valore</th>
                  </tr>
                </thead>
                <tbody>
                  {operativitaRows.map((row) => (
                    <tr key={row.label} className="border-b border-slate-100 last:border-0 hover:bg-[rgba(42,77,126,0.04)]">
                      <td className="px-4 py-2.5 text-slate-700 sm:px-5">{row.label}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 sm:px-5">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardPanel>
        </div>

        <div className="lg:col-span-5">
          <DashboardPanel
            title="Accesso rapido"
            description="Collegamenti utili per lavorare le pratiche dal portale."
          >
            <ul className="divide-y divide-slate-100 px-4 py-2 sm:px-5">
              <li className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm text-slate-700">Elenco completo preventivi</span>
                <Link
                  to="/preventivi"
                  className="text-xs font-semibold text-[var(--ui-primary)] hover:text-[var(--ui-primary-hover)]"
                >
                  Apri
                </Link>
              </li>
              <li className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm text-slate-700">Polizze</span>
                <Link
                  to="/polizze"
                  className="text-xs font-semibold text-[var(--ui-primary)] hover:text-[var(--ui-primary-hover)]"
                >
                  Apri
                </Link>
              </li>
            </ul>
          </DashboardPanel>
        </div>
      </div>

      <section aria-label="Ultime pratiche">
        <DashboardPanel
          title="Ultime pratiche"
          description="Le ultime pratiche visibili al tuo profilo."
        >
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Numero</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Assistito</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Aggiornato</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Stato</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 sm:px-5">Dettaglio</th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 sm:px-5">
                      Nessun preventivo assegnato al momento.
                    </td>
                  </tr>
                ) : (
                  quotes.map((q) => {
                    const nomeAssistito =
                      [q.assistito_nome, q.assistito_cognome].filter(Boolean).join(' ') || '—';
                    return (
                      <tr key={q.id}>
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 sm:px-5">
                          {q.numero}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 sm:px-5">{nomeAssistito}</td>
                        <td className="px-4 py-2.5 text-slate-600 sm:px-5">{q.tipo_nome ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 sm:px-5">
                          {formatDate(q.updated_at)}
                        </td>
                        <td className="px-4 py-2.5 sm:px-5">
                          <StatusBadge stato={q.stato} type="quote" />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right sm:px-5">
                          <Link
                            to={`/preventivi/${q.id}`}
                            className="btn-secondary inline-flex items-center gap-1.5 py-1.5 px-3 text-xs"
                          >
                            Apri
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
      </section>
    </div>
  );
}
