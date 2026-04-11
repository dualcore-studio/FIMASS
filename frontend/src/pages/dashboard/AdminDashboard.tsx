import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock3, Shield, ReceiptText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import { getUserDisplayName, isQuoteClosedForAssignment } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import type { InProgressQuoteRow, PaginatedResponse, Policy, Quote, User } from '../../types';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';
import Modal from '../../components/ui/Modal';

const DASHBOARD_ROW_LIMIT = 6;

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
  const [presentedQuotes, setPresentedQuotes] = useState<Quote[]>([]);
  const [inProgressQuotes, setInProgressQuotes] = useState<InProgressQuoteRow[]>([]);
  const [requestedPolicies, setRequestedPolicies] = useState<Policy[]>([]);
  const [issuedPolicies, setIssuedPolicies] = useState<Policy[]>([]);
  const [operators, setOperators] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedPresentedId, setSelectedPresentedId] = useState<number | null>(null);
  const [assignOperatorId, setAssignOperatorId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignFeedback, setAssignFeedback] = useState<string | null>(null);
  const [sollecitoModalOpen, setSollecitoModalOpen] = useState(false);
  const [selectedInProgressId, setSelectedInProgressId] = useState<number | null>(null);
  const [sendingReminderFor, setSendingReminderFor] = useState<number | null>(null);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [q, p, a, presented, policiesRequested, policiesIssued, operatorList] = await Promise.all([
        api.get<QuoteStats>('/quotes/stats'),
        api.get<PolicyStats>('/policies/stats'),
        api.get<AlertsReport>('/reports/alerts'),
        api.get<PaginatedResponse<Quote>>(`/quotes?stato=PRESENTATA&limit=${DASHBOARD_ROW_LIMIT}`),
        api.get<PaginatedResponse<Policy>>(`/policies?stato=RICHIESTA%20PRESENTATA&limit=${DASHBOARD_ROW_LIMIT}`),
        api.get<PaginatedResponse<Policy>>(`/policies?stato=EMESSA&limit=${DASHBOARD_ROW_LIMIT}`),
        api.get<User[]>('/users/operators'),
      ]);

      let inProgress: InProgressQuoteRow[] = [];
      try {
        inProgress = await api.get<InProgressQuoteRow[]>(`/quotes/in-progress?limit=${DASHBOARD_ROW_LIMIT}`);
      } catch {
        try {
          const fallback = await api.get<PaginatedResponse<Quote>>(
            `/quotes?stato=IN%20LAVORAZIONE&limit=${DASHBOARD_ROW_LIMIT}`,
          );
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

      setQuoteStats(q);
      setPolicyStats(p);
      setAlerts(a);
      setPresentedQuotes(presented.data ?? []);
      setInProgressQuotes(inProgress);
      setRequestedPolicies(policiesRequested.data ?? []);
      setIssuedPolicies(policiesIssued.data ?? []);
      setOperators(operatorList);
    } catch {
      setError('Impossibile caricare i dati della dashboard. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--ui-primary)] border-t-transparent" />
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
  const presentedRows = presentedQuotes.map((quote) => ({
    id: quote.id,
    title: `ID Preventivo: ${quote.numero}`,
    subtitle: [quote.assistito_nome, quote.assistito_cognome].filter(Boolean).join(' ') || 'Assistito non disponibile',
  }));
  const inLavorazioneRows = inProgressQuotes.map((quote) => ({
    id: quote.id,
    title: `ID Preventivo: ${quote.numero}`,
    subtitle: [quote.operatore_nome, quote.operatore_cognome].filter(Boolean).join(' ') || 'Operatore non assegnato',
  }));
  const richiesteRows = requestedPolicies.map((policy) => ({
    id: policy.id,
    title: `Polizza: ${policy.numero}`,
    subtitle: `Preventivo: ${policy.preventivo_numero || '-'}`,
  }));
  const emesseRows = issuedPolicies.map((policy) => ({
    id: policy.id,
    title: `Polizza: ${policy.numero}`,
    subtitle: [policy.assistito_nome, policy.assistito_cognome].filter(Boolean).join(' ') || 'Assistito non disponibile',
  }));
  const selectedInLavorazioneRow = inProgressQuotes.find((row) => row.id === selectedInProgressId) ?? null;
  const selectedPresentedRow = presentedQuotes.find((row) => row.id === selectedPresentedId) ?? null;

  function openAssignModal(rowId: number) {
    setSelectedPresentedId(rowId);
    setAssignOperatorId('');
    setAssignFeedback(null);
    setAssignModalOpen(true);
  }

  function closeAssignModal() {
    setAssignModalOpen(false);
    setSelectedPresentedId(null);
    setAssignOperatorId('');
    setAssignFeedback(null);
  }

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

  async function handleAssignQuote(quoteId: number) {
    const row = presentedQuotes.find((q) => q.id === quoteId);
    if (row && isQuoteClosedForAssignment(row.stato)) {
      setAssignFeedback('Non è possibile assegnare una pratica già elaborata.');
      return;
    }
    if (!assignOperatorId) {
      setAssignFeedback('Seleziona un operatore prima di confermare.');
      return;
    }
    setAssignFeedback(null);
    setAssignSubmitting(true);
    try {
      await api.put(`/quotes/${quoteId}/assign`, { operatore_id: Number(assignOperatorId) });
      setAssignFeedback('Preventivo assegnato con successo.');
      window.setTimeout(() => {
        closeAssignModal();
      }, 900);
      await loadDashboard();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : 'Assegnazione non riuscita. Riprova tra qualche secondo.';
      setAssignFeedback(msg);
    } finally {
      setAssignSubmitting(false);
    }
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
    <div className="mx-auto w-full max-w-[74rem] space-y-8">
      <DashboardPageHeader
        title="Dashboard"
        welcomeLine={user ? `Bentornato, ${getUserDisplayName(user)}` : undefined}
        dateLabel={todayLabel}
      />

      <section aria-label="Alert principali" className="pt-1">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Alert principali</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DashboardSummaryCard
            label="Pratiche non assegnate"
            value={alerts.pratiche_non_assegnate}
            to="/preventivi?alert=unassigned"
            valueTone="institutional"
          />
          <DashboardSummaryCard
            label="Polizze senza avanzamento"
            value={alerts.polizze_senza_avanzamento}
            to="/polizze?alert=stale_policies"
            valueTone="work"
          />
          <DashboardSummaryCard
            label="Stand-by prolungato"
            value={alerts.standby_prolungato}
            to="/preventivi?alert=standby_long"
            valueTone="standby"
          />
          <DashboardSummaryCard
            label="Pratiche ferme"
            value={alerts.pratiche_ferme}
            to="/preventivi?alert=stale_quotes"
            valueTone="risk"
          />
        </div>
      </section>

      <section aria-label="Stato lavorazioni" className="pt-0.5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Stato lavorazioni</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <DashboardWorkColumn
            title="Preventivi presentati"
            value={quoteStats.PRESENTATA}
            icon={FileText}
            rows={presentedRows}
            onRowClick={openAssignModal}
          />
          <DashboardWorkColumn
            title="In lavorazione"
            value={quoteStats['IN LAVORAZIONE']}
            icon={Clock3}
            rows={inLavorazioneRows}
            onRowClick={openSollecitoModal}
          />
          <DashboardWorkColumn title="Polizze richieste" value={richieste} icon={Shield} rows={richiesteRows} />
          <DashboardWorkColumn title="Polizze emesse" value={emesse} icon={ReceiptText} rows={emesseRows} />
        </div>
      </section>

      <Modal
        isOpen={assignModalOpen && selectedPresentedRow != null}
        onClose={closeAssignModal}
        title="Assegna operatore"
        size="sm"
      >
        {selectedPresentedRow && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">Preventivo {selectedPresentedRow.numero}</p>
              <p className="mt-1 text-slate-600">
                Assistito:{' '}
                <span className="font-medium text-slate-800">
                  {[selectedPresentedRow.assistito_nome, selectedPresentedRow.assistito_cognome].filter(Boolean).join(' ') || '-'}
                </span>
              </p>
            </div>
            <div>
              <label htmlFor="assign-operator-dashboard" className="mb-1 block text-sm font-medium text-slate-700">
                Operatore
              </label>
              <select
                id="assign-operator-dashboard"
                value={assignOperatorId}
                onChange={(e) => setAssignOperatorId(e.target.value)}
                className="input-field"
              >
                <option value="">Seleziona operatore…</option>
                {operators.map((op) => (
                  <option key={op.id} value={String(op.id)}>
                    {getUserDisplayName(op)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button type="button" onClick={closeAssignModal} className="btn-secondary px-4 py-2 text-sm">
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleAssignQuote(selectedPresentedRow.id)}
                disabled={assignSubmitting}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
              >
                {assignSubmitting ? 'Assegnazione…' : 'Conferma'}
              </button>
            </div>
            {assignFeedback && (
              <p className={`text-sm ${assignFeedback.toLowerCase().includes('successo') ? 'text-emerald-700' : 'text-red-700'}`}>
                {assignFeedback}
              </p>
            )}
          </div>
        )}
      </Modal>

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
                Operatore:{' '}
                <span className="font-medium text-slate-800">
                  {[selectedInLavorazioneRow.operatore_nome, selectedInLavorazioneRow.operatore_cognome].filter(Boolean).join(' ') || 'Operatore non assegnato'}
                </span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                In lavorazione da:{' '}
                <span className="font-semibold text-slate-700">
                  {formatElapsedTime(selectedInLavorazioneRow.in_lavorazione_dal)}
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

type SummaryAccent = 'institutional' | 'work' | 'standby' | 'risk';

interface DashboardSummaryCardProps {
  label: string;
  value: number;
  to: string;
  valueTone: SummaryAccent;
}

const summaryValueClass: Record<SummaryAccent, string> = {
  institutional: 'kpi-value-institutional',
  work: 'kpi-value-work',
  standby: 'kpi-value-standby',
  risk: 'kpi-value-risk',
};

const summaryStripClass: Record<SummaryAccent, string> = {
  institutional: 'bg-[var(--kpi-accent-institutional)]',
  work: 'bg-[var(--kpi-accent-work)]',
  standby: 'bg-[var(--kpi-accent-standby)]',
  risk: 'bg-[var(--kpi-accent-risk)]',
};

function DashboardSummaryCard({ label, value, to, valueTone }: DashboardSummaryCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border-x border-b border-slate-200/85 bg-white shadow-[0_1px_2px_rgba(30,45,77,0.05),0_8px_28px_-12px_rgba(30,45,77,0.09)]">
      <div className={`h-1 w-full shrink-0 ${summaryStripClass[valueTone]}`} aria-hidden />
      <div className="px-5 py-4 text-center">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</h2>
        <p className={`mt-1 text-[2rem] font-semibold leading-none tabular-nums ${summaryValueClass[valueTone]}`}>{value}</p>
        <Link
          to={to}
          className="mt-2 inline-block text-sm font-semibold text-[var(--ui-primary)] transition-colors hover:text-[var(--ui-primary-hover)]"
        >
          Vedi Dettagli
        </Link>
      </div>
    </article>
  );
}

interface DashboardWorkColumnProps {
  title: string;
  value: number;
  icon: LucideIcon;
  rows?: Array<{ id: number; title: string; subtitle?: string; meta?: string }>;
  onRowClick?: (id: number) => void;
}

function DashboardWorkColumn({
  title,
  value,
  icon: Icon,
  rows = [],
  onRowClick,
}: DashboardWorkColumnProps) {
  return (
    <article className="flex min-h-[27rem] flex-col overflow-hidden rounded-2xl border-x border-b border-slate-200/85 bg-white shadow-[0_1px_2px_rgba(30,45,77,0.05),0_8px_28px_-12px_rgba(30,45,77,0.09)]">
      <div className="h-1 w-full shrink-0 bg-[var(--kpi-card-top-bar)]" aria-hidden />
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
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
                  {onRowClick ? (
                    <button
                      type="button"
                      onClick={() => onRowClick(row.id)}
                      className="w-full rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-left transition-colors hover:bg-[rgba(42,77,126,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-primary)]"
                      aria-label={`${row.title}. ${row.subtitle ?? ''}`}
                    >
                      <p className="text-xs font-semibold text-slate-700">{row.title}</p>
                      {row.subtitle && <p className="mt-0.5 text-xs text-slate-500">{row.subtitle}</p>}
                      {row.meta && <p className="mt-0.5 text-[11px] text-slate-400">{row.meta}</p>}
                    </button>
                  ) : (
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-700">{row.title}</p>
                      {row.subtitle && <p className="mt-0.5 text-xs text-slate-500">{row.subtitle}</p>}
                      {row.meta && <p className="mt-0.5 text-[11px] text-slate-400">{row.meta}</p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
