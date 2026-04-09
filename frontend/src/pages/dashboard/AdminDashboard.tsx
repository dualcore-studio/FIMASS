import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';

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

  return (
    <div className="mx-auto w-full max-w-[74rem] space-y-7">
      <DashboardPageHeader
        title="Dashboard"
        welcomeLine={user ? `Bentornato, ${getUserDisplayName(user)}` : undefined}
        dateLabel={todayLabel}
        description="Centro di controllo dove intervenire, dove si accumula il lavoro e cosa segnala il sistema."
      />

      <section aria-label="Alert principali" className="pt-1">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DashboardSummaryCard
            label="Pratiche non assegnate"
            value={alerts.pratiche_non_assegnate}
            to="/preventivi"
          />
          <DashboardSummaryCard
            label="Polizze senza avanzamento"
            value={alerts.polizze_senza_avanzamento}
            to="/polizze"
          />
          <DashboardSummaryCard
            label="Stand-by prolungato"
            value={alerts.standby_prolungato}
            to="/preventivi"
          />
          <DashboardSummaryCard label="Pratiche ferme" value={alerts.pratiche_ferme} to="/preventivi" />
        </div>
      </section>

      <section aria-label="Stato lavorazioni" className="pt-0.5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <DashboardWorkColumn title="Preventivi presentati" value={quoteStats.PRESENTATA} />
          <DashboardWorkColumn title="In lavorazione" value={quoteStats['IN LAVORAZIONE']} />
          <DashboardWorkColumn title="Polizze richieste" value={richieste} />
          <DashboardWorkColumn title="Polizze emesse" value={emesse} />
        </div>
      </section>
    </div>
  );
}

interface DashboardSummaryCardProps {
  label: string;
  value: number;
  to: string;
}

function DashboardSummaryCard({ label, value, to }: DashboardSummaryCardProps) {
  return (
    <article className="rounded-xl border border-slate-200/90 bg-white px-5 py-4 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-900">{label}</h2>
      <p className="mt-1 text-[2rem] font-semibold leading-none tabular-nums text-slate-900">{value}</p>
      <Link to={to} className="mt-1 inline-block text-sm font-medium text-slate-900 hover:text-blue-700">
        Vedi Dettagli
      </Link>
    </article>
  );
}

interface DashboardWorkColumnProps {
  title: string;
  value: number;
}

function DashboardWorkColumn({ title, value }: DashboardWorkColumnProps) {
  return (
    <article className="min-h-[27rem] rounded-xl border border-slate-200/90 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{title}</h3>
        <span className="text-3xl font-semibold leading-none tabular-nums text-slate-900">{value}</span>
      </div>
    </article>
  );
}
