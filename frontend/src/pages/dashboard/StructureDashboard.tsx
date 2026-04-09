import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Clock, CheckCircle, Shield, ExternalLink } from 'lucide-react';
import { api } from '../../utils/api';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import type { Quote, PaginatedResponse } from '../../types';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';
import DashboardPrimaryKpi from '../../components/dashboard/DashboardPrimaryKpi';
import DashboardSecondaryMetric from '../../components/dashboard/DashboardSecondaryMetric';
import DashboardPanel from '../../components/dashboard/DashboardPanel';

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

export default function StructureDashboard() {
  const { user } = useAuth();
  const [quoteStats, setQuoteStats] = useState<QuoteStats | null>(null);
  const [policyStats, setPolicyStats] = useState<PolicyStats | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const emptyQuoteStats: QuoteStats = {
      PRESENTATA: 0,
      ASSEGNATA: 0,
      'IN LAVORAZIONE': 0,
      STANDBY: 0,
      ELABORATA: 0,
      totale: 0,
    };
    const emptyPolicyStats: PolicyStats = {
      'RICHIESTA PRESENTATA': 0,
      'IN VERIFICA': 0,
      'DOCUMENTAZIONE MANCANTE': 0,
      'PRONTA PER EMISSIONE': 0,
      EMESSA: 0,
      totale: 0,
    };

    async function load() {
      setError(null);
      setLoading(true);
      try {
        const [qStatsResult, pStatsResult, listResult] = await Promise.allSettled([
          api.get<QuoteStats>('/quotes/stats'),
          api.get<PolicyStats>('/policies/stats'),
          api.get<PaginatedResponse<Quote>>('/quotes?limit=5'),
        ]);
        if (!cancelled) {
          const qStats = qStatsResult.status === 'fulfilled' ? qStatsResult.value : emptyQuoteStats;
          const pStats = pStatsResult.status === 'fulfilled' ? pStatsResult.value : emptyPolicyStats;
          const list = listResult.status === 'fulfilled' ? listResult.value : { data: [] as Quote[] };
          setQuoteStats(qStats);
          setPolicyStats(pStats);
          setQuotes(list.data);

          const failedRequests = [qStatsResult, pStatsResult, listResult].filter(
            (r) => r.status === 'rejected',
          ).length;
          if (failedRequests > 0) {
            setError(
              failedRequests === 3
                ? 'Impossibile caricare i dati della struttura.'
                : 'Alcuni dati non sono al momento disponibili.',
            );
          }
        }
      } catch {
        if (!cancelled) {
          setError('Impossibile caricare i dati della struttura.');
          setQuoteStats(emptyQuoteStats);
          setPolicyStats(emptyPolicyStats);
          setQuotes([]);
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

  if (!quoteStats || !policyStats) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="border-l-4 border-l-red-500 pl-4 text-sm font-medium text-red-800">
          {error ?? 'Dati non disponibili.'}
        </p>
      </div>
    );
  }

  const polizzeRichieste = policyStats['RICHIESTA PRESENTATA'] ?? 0;

  const operativitaRows = [
    { label: 'Preventivi presentati dalla struttura', value: quoteStats.PRESENTATA },
    { label: 'In lavorazione presso lo sportello', value: quoteStats['IN LAVORAZIONE'] },
    { label: 'In stand-by', value: quoteStats.STANDBY },
    { label: 'Elaborati', value: quoteStats.ELABORATA },
    { label: 'Totale pratiche preventivo', value: quoteStats.totale },
  ];

  const pipelinePolizze = [
    { label: 'In verifica', value: policyStats['IN VERIFICA'] },
    { label: 'Documentazione mancante', value: policyStats['DOCUMENTAZIONE MANCANTE'] },
    { label: 'Pronte per emissione', value: policyStats['PRONTA PER EMISSIONE'] },
    { label: 'Emesse', value: policyStats.EMESSA },
    { label: 'Totale polizze', value: policyStats.totale },
  ];

  return (
    <div className="mx-auto w-full max-w-[88rem] space-y-6 lg:space-y-7">
      <DashboardPageHeader
        title="Dashboard"
        welcomeLine={user ? `Area struttura — ${getUserDisplayName(user)}` : undefined}
        dateLabel={todayLabel}
        description="Gestione richieste e stato delle pratiche della tua struttura su Sportello Amico."
        actions={
          <>
            <Link
              to="/preventivi/nuovo"
              className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm shadow-sm shadow-blue-900/10"
            >
              <Plus className="h-4 w-4" />
              Nuovo Preventivo
            </Link>
            <Link
              to="/polizze/nuova"
              className="btn-primary inline-flex items-center justify-center whitespace-nowrap px-4 py-2.5 text-sm shadow-sm shadow-blue-900/10"
            >
              Nuova Polizza
            </Link>
            <Link
              to="/preventivi"
              className="btn-secondary inline-flex items-center justify-center whitespace-nowrap px-4 py-2.5 text-sm"
            >
              Le pratiche
            </Link>
          </>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {error}
        </div>
      ) : null}

      <section aria-label="Indicatori primari">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Indicatori primari</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <DashboardPrimaryKpi label="Preventivi presentati" value={quoteStats.PRESENTATA} icon={FileText} />
          <DashboardPrimaryKpi label="In lavorazione" value={quoteStats['IN LAVORAZIONE']} icon={Clock} />
          <DashboardPrimaryKpi label="Elaborati" value={quoteStats.ELABORATA} icon={CheckCircle} />
          <DashboardPrimaryKpi label="Polizze richieste" value={polizzeRichieste} icon={Shield} />
        </div>
      </section>

      <section aria-label="Metriche secondarie">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Altri indicatori</p>
        <div className="flex flex-wrap gap-2">
          <DashboardSecondaryMetric label="Stand-by" value={quoteStats.STANDBY} />
          <DashboardSecondaryMetric label="Assegnati" value={quoteStats.ASSEGNATA} />
          <DashboardSecondaryMetric label="Polizze emesse" value={policyStats.EMESSA} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-7">
          <DashboardPanel
            title="Operatività recente"
            description="Panoramica dei volumi preventivo per la tua struttura."
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
            title="Pipeline polizze"
            description="Stato delle richieste di polizza collegate alla struttura."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 sm:px-5">Fase</th>
                    <th className="px-4 py-2.5 text-right sm:px-5">N.</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelinePolizze.map((row) => (
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
      </div>

      <section aria-label="Ultime pratiche">
        <DashboardPanel
          title="Ultime pratiche"
          description="Ultime cinque pratiche preventivo registrate per la struttura."
        >
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Numero</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Assistito</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sm:px-5">Stato</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 sm:px-5">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 sm:px-5">
                      Nessun preventivo registrato.
                    </td>
                  </tr>
                ) : (
                  quotes.map((q) => {
                    const nomeAssistito =
                      [q.assistito_nome, q.assistito_cognome].filter(Boolean).join(' ') || '—';
                    const showPolicyCta = q.stato === 'ELABORATA' && q.has_policy === 0;
                    return (
                      <tr key={q.id}>
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 sm:px-5">
                          {q.numero}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 sm:px-5">{nomeAssistito}</td>
                        <td className="px-4 py-2.5 text-slate-600 sm:px-5">{q.tipo_nome ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 sm:px-5">
                          {formatDate(q.created_at)}
                        </td>
                        <td className="px-4 py-2.5 sm:px-5">
                          <StatusBadge stato={q.stato} type="quote" />
                        </td>
                        <td className="px-4 py-2.5 text-right sm:px-5">
                          <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                            {showPolicyCta && (
                              <Link
                                to={`/preventivi/${q.id}`}
                                className="btn-success inline-flex items-center gap-1.5 whitespace-nowrap py-1.5 px-3 text-xs"
                              >
                                Richiedi emissione polizza
                              </Link>
                            )}
                            <Link
                              to={`/preventivi/${q.id}`}
                              className="btn-secondary inline-flex items-center gap-1.5 py-1.5 px-3 text-xs"
                            >
                              Apri
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </div>
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
