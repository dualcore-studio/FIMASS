import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, Shield, TrendingUp } from 'lucide-react';
import { api } from '../../utils/api';
import { getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';
import DashboardPrimaryKpi from '../../components/dashboard/DashboardPrimaryKpi';
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

interface PolicyStats {
  'RICHIESTA PRESENTATA': number;
  'IN VERIFICA': number;
  'DOCUMENTAZIONE MANCANTE': number;
  'PRONTA PER EMISSIONE': number;
  EMESSA: number;
  totale: number;
}

interface AlertsReport {
  pratiche_non_assegnate: number;
  standby_prolungato: number;
  polizze_senza_avanzamento: number;
  pratiche_ferme: number;
}

type OperativeRow = {
  area: string;
  focus: string;
  detail: string;
  value: number;
  action: { label: string; to: string } | null;
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [quoteStats, setQuoteStats] = useState<QuoteStats | null>(null);
  const [policyStats, setPolicyStats] = useState<PolicyStats | null>(null);
  const [alerts, setAlerts] = useState<AlertsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setLoading(true);
      try {
        const [q, p, a] = await Promise.all([
          api.get<QuoteStats>('/quotes/stats'),
          api.get<PolicyStats>('/policies/stats'),
          api.get<AlertsReport>('/reports/alerts'),
        ]);
        if (!cancelled) {
          setQuoteStats(q);
          setPolicyStats(p);
          setAlerts(a);
        }
      } catch {
        if (!cancelled) {
          setError('Impossibile caricare i dati della dashboard. Riprova più tardi.');
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
          <p className="text-sm text-slate-500">Caricamento panoramica…</p>
        </div>
      </div>
    );
  }

  if (error || !quoteStats || !policyStats || !alerts) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="border-l-4 border-l-red-500 pl-4 text-sm font-medium text-red-800">
          {error ?? 'Dati non disponibili.'}
        </p>
      </div>
    );
  }

  const richieste = policyStats['RICHIESTA PRESENTATA'] ?? 0;
  const emesse = policyStats.EMESSA ?? 0;

  const polizzeInIter =
    (policyStats['RICHIESTA PRESENTATA'] ?? 0) +
    (policyStats['IN VERIFICA'] ?? 0) +
    (policyStats['DOCUMENTAZIONE MANCANTE'] ?? 0) +
    (policyStats['PRONTA PER EMISSIONE'] ?? 0);

  /** Flussi che indicano dove si concentra il lavoro e dove serve coordinamento. */
  const operativeFlowRows: OperativeRow[] = [
    {
      area: 'Preventivi',
      focus: 'Ingresso — da assegnare',
      detail: 'Pratiche in stato Presentata: assegnazione agli operatori.',
      value: quoteStats.PRESENTATA,
      action: { label: 'Gestisci coda', to: '/preventivi' },
    },
    {
      area: 'Preventivi',
      focus: 'Lavorazione attiva',
      detail: 'Capacità operativa attualmente impegnata sulle pratiche.',
      value: quoteStats['IN LAVORAZIONE'],
      action: null,
    },
    {
      area: 'Preventivi',
      focus: 'Stand-by',
      detail: 'Pratiche in pausa: possibile attrito o attesa documenti.',
      value: quoteStats.STANDBY,
      action: { label: 'Rivedi', to: '/preventivi' },
    },
    {
      area: 'Polizze',
      focus: 'Pipeline pre-emissione',
      detail: 'Richieste e iter amministrativo prima dell’emissione.',
      value: polizzeInIter,
      action: { label: 'Apri polizze', to: '/polizze' },
    },
  ];

  const adminAlertsTotal =
    alerts.pratiche_non_assegnate +
    alerts.polizze_senza_avanzamento +
    alerts.standby_prolungato +
    alerts.pratiche_ferme;

  return (
    <div className="mx-auto w-full max-w-[80rem] space-y-8 lg:space-y-10">
      <DashboardPageHeader
        title="Dashboard"
        welcomeLine={user ? `Bentornato, ${getUserDisplayName(user)}` : undefined}
        dateLabel={todayLabel}
        description="Centro di controllo: dove intervenire, dove si accumula il lavoro e cosa segnala il sistema."
      />

      <section aria-label="Indicatori chiave">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          <DashboardPrimaryKpi label="Preventivi presentati" value={quoteStats.PRESENTATA} icon={FileText} />
          <DashboardPrimaryKpi label="In lavorazione" value={quoteStats['IN LAVORAZIONE']} icon={Clock} />
          <DashboardPrimaryKpi label="Polizze richieste" value={richieste} icon={Shield} />
          <DashboardPrimaryKpi label="Polizze emesse" value={emesse} icon={TrendingUp} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <DashboardPanel
            title="Operatività"
            description="Snapshot del carico sulle code: dove intervenire e dove si accumula il lavoro (dati aggregati attuali)."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 sm:px-5">Area</th>
                    <th className="px-4 py-3 sm:px-5">Focus</th>
                    <th className="hidden px-4 py-3 md:table-cell sm:px-5">Nota</th>
                    <th className="px-4 py-3 text-right sm:px-5">N.</th>
                    <th className="px-4 py-3 text-right sm:px-5"> </th>
                  </tr>
                </thead>
                <tbody>
                  {operativeFlowRows.map((row) => (
                    <tr key={`${row.area}-${row.focus}`} className="border-b border-slate-100 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold text-slate-500 sm:px-5">
                        {row.area}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900 sm:px-5">{row.focus}</td>
                      <td className="hidden max-w-xs px-4 py-3.5 text-slate-500 md:table-cell sm:px-5">
                        {row.detail}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-lg font-semibold tabular-nums text-slate-900 sm:px-5">
                        {row.value}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right sm:px-5">
                        {row.action ? (
                          <Link
                            to={row.action.to}
                            className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                          >
                            {row.action.label}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
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
            description={
              adminAlertsTotal === 0
                ? 'Nessuna anomalia segnalata dai conteggi automatici.'
                : 'Segnalazioni che richiedono verifica o intervento di coordinamento.'
            }
          >
            <DashboardAlertRow
              label="Pratiche non assegnate"
              value={alerts.pratiche_non_assegnate}
              severity="warning"
              badgeText="Assegnazione"
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

      <section aria-label="Interventi amministratore">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          <div className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-4px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-semibold text-slate-900">Pratiche da assegnare</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Coordina l’ingresso in sportello: assegna le pratiche presentate agli operatori e sblocca la coda.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/preventivi"
                className="btn-primary inline-flex items-center justify-center px-4 py-2.5 text-sm shadow-sm shadow-blue-900/10"
              >
                Apri coda preventivi
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-4px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-semibold text-slate-900">Polizze da monitorare</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Verifica le polizze segnalate senza avanzamento e allinea strutture o operatori sullo stato.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Segnalazioni attive:{' '}
              <span className="font-semibold tabular-nums text-slate-800">
                {alerts.polizze_senza_avanzamento}
              </span>
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/polizze"
                className="btn-secondary inline-flex items-center justify-center px-4 py-2.5 text-sm"
              >
                Apri elenco polizze
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
