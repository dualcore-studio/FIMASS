import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, Clock, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
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

export default function OperatorDashboard() {
  const { user } = useAuth();
  const [quoteStats, setQuoteStats] = useState<QuoteStats | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
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
        if (!cancelled) {
          setQuoteStats(stats);
          setQuotes(list.data);
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
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          <p className="text-sm text-gray-500">Caricamento…</p>
        </div>
      </div>
    );
  }

  if (error || !quoteStats) {
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
          I miei preventivi{user ? ` — ${getUserDisplayName(user)}` : ''}
        </h1>
        <p className="mt-1 capitalize text-gray-500">{todayLabel}</p>
        <p className="mt-2 text-sm text-gray-600">
          Riepilogo delle pratiche assegnate a te e accesso rapido alle schede.
        </p>
      </header>

      <section aria-label="Le tue attività">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Le tue attività
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
        </div>
      </section>

      <section aria-label="Preventivi recenti" className="card overflow-hidden">
        <div className="portal-card-table-heading px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Preventivi recenti</h2>
          <p className="mt-0.5 text-sm text-gray-500">Ultime pratiche assegnate al tuo profilo.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="portal-table min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Numero</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Assistito</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Tipo</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Aggiornato</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Stato</th>
                <th className="px-5 py-3 text-right font-medium text-gray-600">Dettaglio</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                    Nessun preventivo assegnato al momento.
                  </td>
                </tr>
              ) : (
                quotes.map((q) => {
                  const nomeAssistito = [q.assistito_nome, q.assistito_cognome].filter(Boolean).join(' ') || '—';
                  return (
                    <tr key={q.id}>
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-gray-900">{q.numero}</td>
                      <td className="px-5 py-3 text-gray-700">{nomeAssistito}</td>
                      <td className="px-5 py-3 text-gray-600">{q.tipo_nome ?? '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                        {formatDate(q.updated_at)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge stato={q.stato} type="quote" />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
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
      </section>
    </div>
  );
}
