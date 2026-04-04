import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  UserCheck,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { api } from '../../utils/api';
import KPICard from '../../components/common/KPICard';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import type { Quote, PaginatedResponse } from '../../types';

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

const alertConfig: {
  key: keyof AlertsReport;
  label: string;
  borderClass: string;
}[] = [
  { key: 'pratiche_non_assegnate', label: 'Pratiche non assegnate', borderClass: 'border-l-amber-500' },
  { key: 'standby_prolungato', label: 'Stand-by prolungato', borderClass: 'border-l-orange-500' },
  { key: 'polizze_senza_avanzamento', label: 'Polizze senza avanzamento', borderClass: 'border-l-red-500' },
  { key: 'pratiche_ferme', label: 'Pratiche ferme', borderClass: 'border-l-slate-500' },
];

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
          <p className="text-sm text-gray-500">Caricamento…</p>
        </div>
      </div>
    );
  }

  if (error || !quoteStats || !alerts) {
    return (
      <div className="card border-l-4 border-l-red-500 p-6">
        <p className="text-sm font-medium text-red-800">{error ?? 'Dati non disponibili.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Dashboard operativa{user ? ` — ${getUserDisplayName(user)}` : ''}
        </h1>
        <p className="mt-1 capitalize text-gray-500">{todayLabel}</p>
        <p className="mt-2 text-sm text-gray-600">
          Monitoraggio preventivi e priorità di assegnazione.
        </p>
      </header>

      <section aria-label="Stato preventivi">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Stato preventivi
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KPICard
            title="Presentate"
            value={quoteStats.PRESENTATA}
            icon={<FileText className="h-6 w-6" />}
            color="slate"
          />
          <KPICard
            title="Assegnate"
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
            title="Stand-by"
            value={quoteStats.STANDBY}
            icon={<AlertTriangle className="h-6 w-6" />}
            color="red"
          />
          <KPICard
            title="Elaborate"
            value={quoteStats.ELABORATA}
            icon={<CheckCircle className="h-6 w-6" />}
            color="green"
          />
          <KPICard
            title="Totale"
            value={quoteStats.totale}
            icon={<FileText className="h-6 w-6" />}
            color="slate"
          />
        </div>
      </section>

      <section aria-label="Avvisi">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Avvisi operativi
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {alertConfig.map(({ key, label, borderClass }) => (
            <div key={key} className={`card border-l-4 p-4 ${borderClass}`}>
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{alerts[key]}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Preventivi in attesa di assegnazione" className="card overflow-hidden">
        <div className="portal-card-table-heading px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Ultime richieste presentate</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Preventivi in stato Presentata — assegna un operatore dalla scheda dettaglio.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="portal-table min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Numero</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Assistito</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Tipo</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Struttura</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Data</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Stato</th>
                <th className="px-5 py-3 text-right font-medium text-gray-600">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {presentate.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                    Nessun preventivo in stato Presentata.
                  </td>
                </tr>
              ) : (
                presentate.map((q) => {
                  const nomeAssistito = [q.assistito_nome, q.assistito_cognome].filter(Boolean).join(' ') || '—';
                  return (
                    <tr key={q.id}>
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-gray-900">{q.numero}</td>
                      <td className="px-5 py-3 text-gray-700">{nomeAssistito}</td>
                      <td className="px-5 py-3 text-gray-600">{q.tipo_nome ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{q.struttura_nome ?? '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                        {formatDate(q.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge stato={q.stato} type="quote" />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/preventivi/${q.id}`)}
                          className="btn-primary text-xs py-1.5 px-3"
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
      </section>
    </div>
  );
}
