import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock3, Shield, ReceiptText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../../utils/api';
import { getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import type { InProgressQuoteRow, PaginatedResponse, Quote } from '../../types';
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
  const [inProgressQuotes, setInProgressQuotes] = useState<InProgressQuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInProgressId, setSelectedInProgressId] = useState<number | null>(null);
  const [sendingReminderFor, setSendingReminderFor] = useState<number | null>(null);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);

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

        let inProgress: InProgressQuoteRow[] = [];
        try {
          inProgress = await api.get<InProgressQuoteRow[]>('/quotes/in-progress?limit=10');
        } catch {
          try {
            const fallback = await api.get<PaginatedResponse<Quote>>('/quotes?stato=IN%20LAVORAZIONE&limit=10');
            inProgress = (fallback.data ?? []).map((quote) => ({
              id: quote.id,
              numero: quote.numero,
              operatore_id: quote.operatore_id,
              operatore_nome: quote.operatore_nome,
              operatore_cognome: quote.operatore_cognome,
              in_lavorazione_dal: quote.updated_at,
              updated_at: quote.updated_at,
            }));
          } catch {
            inProgress = [];
          }
        }

        if (!cancelled) {
          setQuoteStats(q);
          setPolicyStats(p);
          setAlerts(a);
          setInProgressQuotes(inProgress);
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
  const inLavorazioneRows = inProgressQuotes.map((quote) => ({
    id: quote.id,
    numero: quote.numero,
    operatore: [quote.operatore_nome, quote.operatore_cognome].filter(Boolean).join(' ') || 'Operatore non assegnato',
    inLavorazioneDal: quote.in_lavorazione_dal,
  }));
  const selectedInLavorazioneRow = inLavorazioneRows.find((row) => row.id === selectedInProgressId) ?? null;

  async function handleSollecito(quoteId: number) {
    setReminderFeedback(null);
    setSendingReminderFor(quoteId);
    try {
      await api.post(`/quotes/${quoteId}/reminders`);
      setReminderFeedback('Sollecito inviato con successo all’operatore.');
    } catch {
      setReminderFeedback('Invio non riuscito. Riprova tra qualche secondo.');
    } finally {
      setSendingReminderFor(null);
    }
  }

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
          <DashboardWorkColumn title="Preventivi presentati" value={quoteStats.PRESENTATA} icon={FileText} />
          <DashboardWorkColumn
            title="In lavorazione"
            value={quoteStats['IN LAVORAZIONE']}
            icon={Clock3}
            rows={inLavorazioneRows}
            selectedRow={selectedInLavorazioneRow}
            onSelectRow={setSelectedInProgressId}
            onSollecito={handleSollecito}
            isSubmittingSollecitoFor={sendingReminderFor}
            feedback={reminderFeedback}
          />
          <DashboardWorkColumn title="Polizze richieste" value={richieste} icon={Shield} />
          <DashboardWorkColumn title="Polizze emesse" value={emesse} icon={ReceiptText} />
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
  icon: LucideIcon;
  rows?: Array<{ id: number; numero: string; operatore: string; inLavorazioneDal?: string }>;
  selectedRow?: { id: number; numero: string; operatore: string; inLavorazioneDal?: string } | null;
  onSelectRow?: (id: number) => void;
  onSollecito?: (id: number) => void;
  isSubmittingSollecitoFor?: number | null;
  feedback?: string | null;
}

function DashboardWorkColumn({
  title,
  value,
  icon: Icon,
  rows = [],
  selectedRow = null,
  onSelectRow,
  onSollecito,
  isSubmittingSollecitoFor = null,
  feedback = null,
}: DashboardWorkColumnProps) {
  return (
    <article className="min-h-[27rem] rounded-xl border border-slate-200/90 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{title}</h3>
        </div>
        <span className="text-3xl font-semibold leading-none tabular-nums text-slate-900">{value}</span>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="px-1 text-xs text-slate-400">Nessun record disponibile.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelectRow?.(row.id)}
                  className="w-full rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-left transition-colors hover:bg-slate-100/80"
                >
                  <p className="text-xs font-semibold text-slate-700">ID Preventivo: {row.numero}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Operatore: {row.operatore}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedRow && onSollecito && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <p className="text-xs font-semibold text-amber-900">Preventivo {selectedRow.numero}</p>
          <p className="mt-1 text-xs text-amber-800">
            In lavorazione da: <span className="font-semibold">{formatElapsedTime(selectedRow.inLavorazioneDal)}</span>
          </p>
          <button
            type="button"
            onClick={() => onSollecito(selectedRow.id)}
            disabled={isSubmittingSollecitoFor === selectedRow.id}
            className="mt-2 inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmittingSollecitoFor === selectedRow.id ? 'Invio in corso…' : 'Sollecita'}
          </button>
          {feedback && <p className="mt-2 text-xs text-amber-900">{feedback}</p>}
        </div>
      )}
    </article>
  );
}

function formatElapsedTime(dateString?: string): string {
  if (!dateString) return 'dato non disponibile';
  const from = new Date(dateString);
  const diffMs = Date.now() - from.getTime();
  if (Number.isNaN(diffMs) || diffMs <= 0) return 'meno di 1 ora';

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days === 0) return `${hours}h`;
  if (hours === 0) return `${days}g`;
  return `${days}g ${hours}h`;
}
