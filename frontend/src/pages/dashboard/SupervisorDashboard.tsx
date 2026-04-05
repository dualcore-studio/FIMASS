import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, UserCheck, Clock, CheckCircle } from 'lucide-react';
import { api } from '../../utils/api';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import type { Quote, PaginatedResponse } from '../../types';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';
import DashboardPrimaryKpi from '../../components/dashboard/DashboardPrimaryKpi';
import DashboardSecondaryMetric from '../../components/dashboard/DashboardSecondaryMetric';
import DashboardPanel from '../../components/dashboard/DashboardPanel';
import DashboardAlertRow from '../../components/dashboard/DashboardAlertRow';

interface QuoteStats {
  PRESENTATA: number;
  ASSEGNATA: number;
  'IN LAVORAZIONE': number;
  STANDBY: number;
  ELABORATA: number;
  totale: number;
}

interface AlertsReport {
  pratiche_non_assegnate: number;
  standby_prolungato: number;
  polizze_senza_avanzamento: number;
  pratiche_ferme: number;
}

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quoteStats, setQuoteStats] = useState<QuoteStats | null>(null);
  const [presentate, setPresentate] = useState<Quote[]>([]);
  const [alerts, setAlerts] = useState<AlertsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setLoading(true);
      try {
        const [stats, quotesRes, alertsRes] = await Promise.all([
          api.get<QuoteStats>('/quotes/stats'),
          api.get<PaginatedResponse<Quote>>('/quotes?stato=PRESENTATA&limit=10'),
          api.get<AlertsReport>('/reports/alerts'),
        ]);
        if (!cancelled) {
          setQuoteStats(stats);
          setPresentate(quotesRes.data);
          setAlerts(alertsRes);
        }
      } catch {
        if (!cancelled) {
          setError('Impossibile caricare la dashboard operativa.');
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
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          <p className="text-sm text-slate-500">Caricamento…</p>
        </div>
      </div>
    );
  }

  if (error || !quoteStats || !alerts) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="border-l-4 border-l-red-500 pl-4 text-sm font-medium text-red-800">
          {error ?? 'Dati non disponibili.'}
        </p>
      </div>
    );
  }

  const operativitaRows = [
    { label: 'Preventivi in attesa di assegnazione (stato Presentata)', value: quoteStats.PRESENTATA },
    { label: 'Già assegnati agli operatori', value: quoteStats.ASSEGNATA },
    { label: 'In lavorazione attiva', value: quoteStats['IN LAVORAZIONE'] },
    { label: 'In stand-by', value: quoteStats.STANDBY },
    { label: 'Elaborati', value: quoteStats.ELABORATA },
    { label: 'Totale portafoglio', value: quoteStats.totale },
  ];

  return (
    <div className="mx-auto w-full max-w-[88rem] space-y-6 lg:space-y-7">
      <DashboardPageHeader
        title="Dashboard"
        welcomeLine={user ? `Operatività — ${getUserDisplayName(user)}` : undefined}
        dateLabel={todayLabel}
        description="Monitoraggio preventivi, code di assegnazione e alert operativi per coordinare lo sportello."
        actions={
          <>
            <Link
              to="/preventivi"
              className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm shadow-sm shadow-blue-900/10"
            >
              Assegna pratica
            </Link>
            <Link
              to="/report"
              className="btn-secondary inline-flex items-center justify-center whitespace-nowrap px-4 py-2.5 text-sm"
            >
              Report
            </Link>
          </>
        }
      />

      <section aria-label="Indicatori primari">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Indicatori primari</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <DashboardPrimaryKpi label="Preventivi presentati" value={quoteStats.PRESENTATA} icon={FileText} />
          <DashboardPrimaryKpi label="In lavorazione" value={quoteStats['IN LAVORAZIONE']} icon={Clock} />
          <DashboardPrimaryKpi label="Assegnate" value={quoteStats.ASSEGNATA} icon={UserCheck} />
          <DashboardPrimaryKpi label="Elaborate" value={quoteStats.ELABORATA} icon={CheckCircle} />
        </div>
      </section>

      <section aria-label="Metriche secondarie">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Altri volumi</p>
        <div className="flex flex-wrap gap-2">
          <DashboardSecondaryMetric label="Stand-by" value={quoteStats.STANDBY} />
          <DashboardSecondaryMetric label="Totale" value={quoteStats.totale} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-7">
          <DashboardPanel
            title="Operatività recente"
            description="Riepilogo volumi preventivi e stato della coda di lavorazione."
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
                    <tr key={row.label} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
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
            title="Alert operativi"
            description="Priorità di intervento sulla base dei report consolidati."
          >
            <DashboardAlertRow
              label="Pratiche non assegnate"
              value={alerts.pratiche_non_assegnate}
              severity="warning"
              badgeText="Attenzione"
              action={
                <Link to="/preventivi" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  Apri
                </Link>
              }
            />
            <DashboardAlertRow
              label="Polizze senza avanzamento"
              value={alerts.polizze_senza_avanzamento}
              severity="critical"
              badgeText="Critico"
              action={
                <Link to="/polizze" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  Apri
                </Link>
              }
            />
            <DashboardAlertRow
              label="Stand-by prolungato"
              value={alerts.standby_prolungato}
              severity="warning"
              badgeText="Follow-up"
              action={
                <Link to="/preventivi" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  Apri
                </Link>
              }
            />
            <DashboardAlertRow
              label="Pratiche ferme"
              value={alerts.pratiche_ferme}
              severity="neutral"
              badgeText="Monitoraggio"
              action={
                <Link to="/preventivi" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  Apri
                </Link>
              }
            />
          </DashboardPanel>
        </div>
      </div>

      <section aria-label="Ultime pratiche">
        <DashboardPanel
          title="Ultime pratiche — richieste presentate"
          description="Preventivi in stato Presentata: assegna un operatore dalla scheda dettaglio."
        >
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Numero</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Assistito</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Struttura</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Stato</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 sm:px-5">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {presentate.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 sm:px-5">
                      Nessun preventivo in stato Presentata.
                    </td>
                  </tr>
                ) : (
                  presentate.map((q) => {
                    const nomeAssistito =
                      [q.assistito_nome, q.assistito_cognome].filter(Boolean).join(' ') || '—';
                    return (
                      <tr key={q.id}>
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 sm:px-5">
                          {q.numero}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 sm:px-5">{nomeAssistito}</td>
                        <td className="px-4 py-2.5 text-slate-600 sm:px-5">{q.tipo_nome ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600 sm:px-5">{q.struttura_nome ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 sm:px-5">
                          {formatDate(q.created_at)}
                        </td>
                        <td className="px-4 py-2.5 sm:px-5">
                          <StatusBadge stato={q.stato} type="quote" />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right sm:px-5">
                          <button
                            type="button"
                            onClick={() => navigate(`/preventivi/${q.id}`)}
                            className="btn-primary py-1.5 px-3 text-xs"
                          >
                            Assegna
                          </button>
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
