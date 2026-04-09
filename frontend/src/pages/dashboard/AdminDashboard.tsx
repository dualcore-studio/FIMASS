import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock3, Shield, ReceiptText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import { getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import type { InProgressQuoteRow, PaginatedResponse, Quote } from '../../types';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';
import Modal from '../../components/ui/Modal';

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
  const [sollecitoModalOpen, setSollecitoModalOpen] = useState(false);
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

  function openSollecitoModal(rowId: number) {
    setSelectedInProgressId(rowId);
    setReminderFeedback(null);
    setSollecitoModalOpen(true);
  }

  function closeSollecitoModal() {
    setSollecitoModalOpen(false);
    setSelectedInProgressId(null);
    setReminderFeedback(null);
  }

  async function handleSollecito(quoteId: number) {
    setReminderFeedback(null);
    setSendingReminderFor(quoteId);
    try {
      try {
        await api.post('/quotes/sollecito', { quote_id: quoteId });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          await api.post(`/quotes/${quoteId}/reminders`, {});
        } else {
          throw e;
        }
      }
      setReminderFeedback('Sollecito inviato con successo all’operatore.');
      window.setTimeout(() => {
        closeSollecitoModal();
      }, 1200);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : 'Invio non riuscito. Riprova tra qualche secondo.';
      setReminderFeedback(msg);
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
            onOpenSollecito={openSollecitoModal}
          />
          <DashboardWorkColumn title="Polizze richieste" value={richieste} icon={Shield} />
          <DashboardWorkColumn title="Polizze emesse" value={emesse} icon={ReceiptText} />
        </div>
      </section>

      <Modal
        isOpen={sollecitoModalOpen && selectedInLavorazioneRow != null}
        onClose={closeSollecitoModal}
        title="Sollecita operatore"
        size="sm"
      >
        {selectedInLavorazioneRow && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">Preventivo {selectedInLavorazioneRow.numero}</p>
              <p className="mt-1 text-slate-600">
                Operatore: <span className="font-medium text-slate-800">{selectedInLavorazioneRow.operatore}</span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                In lavorazione da:{' '}
                <span className="font-semibold text-slate-700">
                  {formatElapsedTime(selectedInLavorazioneRow.inLavorazioneDal)}
                </span>
              </p>
            </div>
            <p className="text-sm text-slate-600">
              Verrà inviato un sollecito all’operatore assegnato: comparirà nella sua dashboard tra i solleciti da leggere.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button type="button" onClick={closeSollecitoModal} className="btn-secondary px-4 py-2 text-sm">
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleSollecito(selectedInLavorazioneRow.id)}
                disabled={sendingReminderFor === selectedInLavorazioneRow.id}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
              >
                {sendingReminderFor === selectedInLavorazioneRow.id ? 'Invio…' : 'Sollecita'}
              </button>
            </div>
            {reminderFeedback && (
              <p
                className={`text-sm ${reminderFeedback.toLowerCase().includes('successo') ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {reminderFeedback}
              </p>
            )}
          </div>
        )}
      </Modal>
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
  onOpenSollecito?: (id: number) => void;
}

function DashboardWorkColumn({
  title,
  value,
  icon: Icon,
  rows = [],
  onOpenSollecito,
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
                  onClick={() => onOpenSollecito?.(row.id)}
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
