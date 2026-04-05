import { useEffect, useState } from 'react';
import {
  FileText,
  UserCheck,
  Clock,
  AlertTriangle,
  CheckCircle,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../utils/api';
import KPICard from '../../components/common/KPICard';
import { getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

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

const alertItems: {
  key: keyof AlertsReport;
  label: string;
  borderClass: string;
  icon: typeof AlertTriangle;
}[] = [
  {
    key: 'pratiche_non_assegnate',
    label: 'Pratiche non assegnate',
    borderClass: 'border-l-orange-500',
    icon: FileText,
  },
  {
    key: 'standby_prolungato',
    label: 'Stand-by prolungato',
    borderClass: 'border-l-orange-500',
    icon: Clock,
  },
  {
    key: 'polizze_senza_avanzamento',
    label: 'Polizze senza avanzamento',
    borderClass: 'border-l-red-500',
    icon: Shield,
  },
  {
    key: 'pratiche_ferme',
    label: 'Pratiche ferme',
    borderClass: 'border-l-slate-500',
    icon: AlertTriangle,
  },
];

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
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          <p className="text-sm text-slate-500">Caricamento panoramica…</p>
        </div>
      </div>
    );
  }

  if (error || !quoteStats || !policyStats || !alerts) {
    return (
      <div className="card border-l-4 border-l-red-500 p-6">
        <p className="text-sm font-medium text-red-800">{error ?? 'Dati non disponibili.'}</p>
      </div>
    );
  }

  const richieste = policyStats['RICHIESTA PRESENTATA'] ?? 0;
  const emesse = policyStats.EMESSA ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Bentornato{user ? `, ${getUserDisplayName(user)}` : ''}
          </h1>
          <p className="mt-1.5 capitalize text-slate-600">{todayLabel}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Panoramica globale di Sportello Amico: preventivi, polizze e segnalazioni operative.
          </p>
        </div>
      </header>

      <section aria-label="Indicatori chiave">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
          Indicatori chiave
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard
            title="Preventivi presentati"
            value={quoteStats.PRESENTATA}
            icon={<FileText className="h-6 w-6" />}
            color="slate"
          />
          <KPICard
            title="Preventivi assegnati"
            value={quoteStats.ASSEGNATA}
            icon={<UserCheck className="h-6 w-6" />}
            color="blue"
          />
          <KPICard
            title="In lavorazione"
            value={quoteStats['IN LAVORAZIONE']}
            icon={<Clock className="h-6 w-6" />}
            color="amber"
          />
          <KPICard
            title="In stand-by"
            value={quoteStats.STANDBY}
            icon={<AlertTriangle className="h-6 w-6" />}
            color="red"
          />
          <KPICard
            title="Elaborati"
            value={quoteStats.ELABORATA}
            icon={<CheckCircle className="h-6 w-6" />}
            color="green"
          />
          <KPICard
            title="Polizze richieste"
            value={richieste}
            icon={<Shield className="h-6 w-6" />}
            color="purple"
          />
          <KPICard
            title="Polizze emesse"
            value={emesse}
            icon={<TrendingUp className="h-6 w-6" />}
            color="green"
          />
        </div>
      </section>

      <section aria-label="Avvisi operativi">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
          Avvisi operativi
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {alertItems.map(({ key, label, borderClass, icon: Icon }) => (
            <div
              key={key}
              className={`flex items-center gap-4 rounded-xl border border-slate-200/95 border-l-4 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] ${borderClass}`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{alerts[key]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
