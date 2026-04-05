import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, Shield, TrendingUp } from 'lucide-react';
import { api } from '../../utils/api';
import { getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
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

  const operativitaRows = [
    { label: 'Preventivi assegnati agli operatori', value: quoteStats.ASSEGNATA },
    { label: 'Preventivi in stand-by', value: quoteStats.STANDBY },
    { label: 'Preventivi elaborati (chiusi positivamente)', value: quoteStats.ELABORATA },
    { label: 'Portafoglio preventivi (totale)', value: quoteStats.totale },
    { label: 'Polizze in verifica', value: policyStats['IN VERIFICA'] },
    { label: 'Polizze con documentazione mancante', value: policyStats['DOCUMENTAZIONE MANCANTE'] },
    { label: 'Polizze pronte per emissione', value: policyStats['PRONTA PER EMISSIONE'] },
  ];

  const pipelineDetailRows: { area: string; voce: string; valore: number }[] = [
    { area: 'Preventivi', voce: 'Presentata', valore: quoteStats.PRESENTATA },
    { area: 'Preventivi', voce: 'Assegnata', valore: quoteStats.ASSEGNATA },
    { area: 'Preventivi', voce: 'In lavorazione', valore: quoteStats['IN LAVORAZIONE'] },
    { area: 'Preventivi', voce: 'Stand-by', valore: quoteStats.STANDBY },
    { area: 'Preventivi', voce: 'Elaborata', valore: quoteStats.ELABORATA },
    { area: 'Polizze', voce: 'Richiesta presentata', valore: policyStats['RICHIESTA PRESENTATA'] },
    { area: 'Polizze', voce: 'In verifica', valore: policyStats['IN VERIFICA'] },
    { area: 'Polizze', voce: 'Documentazione mancante', valore: policyStats['DOCUMENTAZIONE MANCANTE'] },
    { area: 'Polizze', voce: 'Pronta per emissione', valore: policyStats['PRONTA PER EMISSIONE'] },
    { area: 'Polizze', voce: 'Emessa', valore: policyStats.EMESSA },
  ];

  const quickLink = (to: string, label: string) => (
    <Link
      to={to}
      className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm shadow-sm shadow-blue-900/10"
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-[88rem] space-y-6 lg:space-y-7">
      <DashboardPageHeader
        title="Dashboard"
        welcomeLine={user ? `Bentornato, ${getUserDisplayName(user)}` : undefined}
        dateLabel={todayLabel}
        description="Panoramica esecutiva di Sportello Amico: volumi chiave, alert operativi e stato della pipeline preventivi e polizze."
        actions={
          <>
            {quickLink('/preventivi/nuovo', 'Nuovo Preventivo')}
            {quickLink('/polizze/nuova', 'Nuova Polizza')}
            {quickLink('/preventivi', 'Assegna Pratica')}
          </>
        }
      />

      <section aria-label="Indicatori primari">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Indicatori primari</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <DashboardPrimaryKpi label="Preventivi presentati" value={quoteStats.PRESENTATA} icon={FileText} />
          <DashboardPrimaryKpi label="In lavorazione" value={quoteStats['IN LAVORAZIONE']} icon={Clock} />
          <DashboardPrimaryKpi label="Polizze richieste" value={richieste} icon={Shield} />
          <DashboardPrimaryKpi label="Polizze emesse" value={emesse} icon={TrendingUp} />
        </div>
      </section>

      <section aria-label="Metriche secondarie">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Pipeline e volumi</p>
        <div className="flex flex-wrap gap-2">
          <DashboardSecondaryMetric label="Assegnati" value={quoteStats.ASSEGNATA} />
          <DashboardSecondaryMetric label="Stand-by" value={quoteStats.STANDBY} />
          <DashboardSecondaryMetric label="Elaborati" value={quoteStats.ELABORATA} />
          <DashboardSecondaryMetric label="Tot. preventivi" value={quoteStats.totale} />
          <DashboardSecondaryMetric label="Polizze in verifica" value={policyStats['IN VERIFICA']} />
          <DashboardSecondaryMetric label="Doc. mancante" value={policyStats['DOCUMENTAZIONE MANCANTE']} />
          <DashboardSecondaryMetric label="Pronte emissione" value={policyStats['PRONTA PER EMISSIONE']} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-7">
          <DashboardPanel
            title="Operatività recente"
            description="Snapshot operativo dai dati aggregati attuali: volumi e colli di bottiglia nella pipeline."
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
            description="Segnalazioni che richiedono attenzione: interveni dalla lista pratiche o polizze."
          >
            <DashboardAlertRow
              label="Pratiche non assegnate"
              value={alerts.pratiche_non_assegnate}
              severity="warning"
              badgeText="Attenzione"
              action={
                <Link to="/preventivi" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
                  Vai ai preventivi
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
                  Vai alle polizze
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
                  Vai ai preventivi
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
                  Vai ai preventivi
                </Link>
              }
            />
          </DashboardPanel>
        </div>
      </div>

      <section aria-label="Dettaglio pipeline">
        <DashboardPanel
          title="Ultime voci di pipeline"
          description="Dettaglio per stato su preventivi e polizze — utile per revisione operativa e reportistica."
        >
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Area</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Stato / voce</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 sm:px-5">Conteggio</th>
                </tr>
              </thead>
              <tbody>
                {pipelineDetailRows.map((row) => (
                  <tr key={`${row.area}-${row.voce}`}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 sm:px-5">{row.area}</td>
                    <td className="px-4 py-2.5 text-slate-800 sm:px-5">{row.voce}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 sm:px-5">
                      {row.valore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
      </section>
    </div>
  );
}
