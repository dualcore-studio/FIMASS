import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  RotateCcw,
  UserCheck,
  FileText,
  Upload,
  Download,
  Send,
  Clock,
  ArrowRight,
  Paperclip,
  MessageSquare,
  History,
  ClipboardList,
  LayoutDashboard,
  Trash2,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import { formatPremioCasaIt } from '../../config/casaPolizzaPackages';
import { labelForQuoteAttachmentTipo } from '../../config/casaQuoteFlow';
import { downloadPreventivoFinale } from '../../utils/downloadPreventivoFinale';
import { rcPreventivoPdfDownloadFilename } from '../../utils/rcPreventivoPdfFilename';
import { userCanRegenerateRcRiepilogoPdf } from '../../utils/rcAutoElaboration';
import type { Quote, User, Attachment, QuoteNote, StatusHistory } from '../../types';
import {
  formatDate,
  formatDateTime,
  formatUnknownValueForDisplay,
  getUserDisplayName,
  isQuoteClosedForAssignment,
} from '../../utils/helpers';
import { canAssignPreventivi } from '../../utils/roleCapabilities';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/ui/Modal';
import {
  OperatorStandbyModal,
  OperatorElaborataModal,
} from '../../components/quotes/OperatorQuoteWorkflowModals';
import {
  CompactInfoGrid,
  DetailField,
  DetailSectionCard,
  detailColSpanFromDisplayString,
  formatDetailRecordKey,
} from '../../components/detail';
import {
  formatGaranzieRichiesteRcLine,
  isRcVeicoliTipo,
  RC_DATI_SPEC_KEYS_TO_HIDE,
} from '../../utils/rcAutoGaranzie';

type Tab = 'dati' | 'allegati' | 'note' | 'storico' | 'preventivo';

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dati', label: 'Dati', icon: LayoutDashboard },
  { key: 'allegati', label: 'Allegati', icon: Paperclip },
  { key: 'note', label: 'Note', icon: MessageSquare },
  { key: 'storico', label: 'Storico', icon: History },
  { key: 'preventivo', label: 'Preventivo', icon: ClipboardList },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function displayUserName(item: { nome?: string; cognome?: string; denominazione?: string; role?: string }): string {
  if (item.role === 'struttura' && item.denominazione) return item.denominazione;
  return [item.nome, item.cognome].filter(Boolean).join(' ') || 'Utente';
}

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const role = currentUser?.role;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dati');

  // Status change
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const [showStandbyModal, setShowStandbyModal] = useState(false);
  const [showElaborataModal, setShowElaborataModal] = useState(false);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignees, setAssignees] = useState<User[]>([]);
  const [assignOperatorId, setAssignOperatorId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Attachments
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTipo, setUploadTipo] = useState('documento');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Notes
  const [noteText, setNoteText] = useState('');
  const [noteTipo, setNoteTipo] = useState('nota');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<Quote>(`/quotes/${id}`);
      setQuote(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare il preventivo.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  useEffect(() => {
    if (quote && isQuoteClosedForAssignment(quote.stato)) {
      setShowAssignModal(false);
    }
  }, [quote?.stato]);

  useEffect(() => {
    if (canAssignPreventivi(role)) {
      api.get<User[]>('/users/assignees').then(setAssignees).catch(() => {});
    }
  }, [role]);

  const handleStatusChange = async (newStato: string, motivo?: string) => {
    if (!id) return;
    setActionError(null);
    setStatusSubmitting(true);
    try {
      await api.put(`/quotes/${id}/status`, { stato: newStato, ...(motivo ? { motivo } : {}) });
      await fetchQuote();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Cambio stato non riuscito.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!id || !assignOperatorId) {
      setAssignError('Seleziona un incaricato.');
      return;
    }
    setAssignError(null);
    setAssignSubmitting(true);
    try {
      await api.put(`/quotes/${id}/assign`, { assigned_user_id: Number(assignOperatorId) });
      setShowAssignModal(false);
      setAssignOperatorId('');
      await fetchQuote();
    } catch (e) {
      setAssignError(e instanceof ApiError ? e.message : 'Assegnazione non riuscita.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleDeleteQuote = async () => {
    if (!id) return;
    setActionError(null);
    setDeleteSubmitting(true);
    try {
      await api.delete(`/quotes/${id}`);
      navigate('/preventivi');
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Eliminazione preventivo non riuscita.');
    } finally {
      setDeleteSubmitting(false);
      setShowDeleteModal(false);
    }
  };

  const handleUpload = async () => {
    if (!id || !uploadFile) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('entity_type', 'quote');
      formData.append('entity_id', id);
      formData.append('tipo', uploadTipo);
      await api.upload('/attachments/upload', formData);
      setUploadFile(null);
      await fetchQuote();
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : 'Upload non riuscito.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddNote = async () => {
    if (!id || !noteText.trim()) return;
    setNoteError(null);
    setNoteSubmitting(true);
    try {
      await api.post(`/quotes/${id}/notes`, { testo: noteText.trim(), tipo: noteTipo });
      setNoteText('');
      await fetchQuote();
    } catch (e) {
      setNoteError(e instanceof ApiError ? e.message : 'Impossibile aggiungere la nota.');
    } finally {
      setNoteSubmitting(false);
    }
  };

  const isAssignedStaff =
    !!quote &&
    ((role === 'operatore' && quote.operatore_id === currentUser?.id) ||
      (role === 'fornitore' && Number(quote.fornitore_id) === Number(currentUser?.id)));
  const canAssign = !!quote && canAssignPreventivi(role) && !isQuoteClosedForAssignment(quote.stato);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          <p className="text-sm text-gray-500">Caricamento preventivo…</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/preventivi')} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Torna ai preventivi
        </button>
        <div className="card p-8 text-center text-red-700">{error || 'Preventivo non trovato.'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/preventivi')} className="mt-1 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Preventivo {quote.numero}
              </h1>
              <StatusBadge stato={quote.stato} />
              {quote.is_renewal === true || quote.is_renewal === 1 ? (
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-900 ring-1 ring-indigo-200/80">
                  Rinnovo
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {quote.tipo_nome} — Creato il {formatDate(quote.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Operator status buttons */}
          {isAssignedStaff && quote.stato === 'ASSEGNATA' && (
            <>
              <button
                onClick={() => handleStatusChange('IN LAVORAZIONE')}
                disabled={statusSubmitting}
                className="btn-primary"
              >
                <Play className="h-4 w-4" />
                Inizia Lavorazione
              </button>
              <button
                type="button"
                onClick={() => setShowStandbyModal(true)}
                disabled={statusSubmitting}
                className="btn-secondary"
              >
                <Pause className="h-4 w-4" />
                Metti in Standby
              </button>
            </>
          )}
          {isAssignedStaff && quote.stato === 'IN LAVORAZIONE' && (
            <>
              <button
                type="button"
                onClick={() => setShowStandbyModal(true)}
                disabled={statusSubmitting}
                className="btn-secondary"
              >
                <Pause className="h-4 w-4" />
                Metti in Standby
              </button>
              <button
                type="button"
                onClick={() => setShowElaborataModal(true)}
                disabled={statusSubmitting}
                className="btn-success"
              >
                <CheckCircle2 className="h-4 w-4" />
                Segna come Elaborata
              </button>
            </>
          )}
          {isAssignedStaff && quote.stato === 'STANDBY' && (
            <button
              onClick={() => handleStatusChange('IN LAVORAZIONE')}
              disabled={statusSubmitting}
              className="btn-primary"
            >
              <RotateCcw className="h-4 w-4" />
              Riprendi Lavorazione
            </button>
          )}

          {/* Struttura: request policy */}
          {role === 'struttura' && quote.stato === 'ELABORATA' && quote.has_policy === 0 && (
            <Link to={`/polizze/nuova?quote_id=${quote.id}`} className="btn-success">
              <FileText className="h-4 w-4" />
              Richiedi Emissione Polizza
            </Link>
          )}

          {/* Assign/Reassign */}
          {canAssign && (
            <button
              onClick={() => {
                setShowAssignModal(true);
                setAssignOperatorId(
                  quote.operatore_id
                    ? String(quote.operatore_id)
                    : quote.fornitore_id
                      ? String(quote.fornitore_id)
                      : '',
                );
                setAssignError(null);
              }}
              className="btn-secondary"
            >
              <UserCheck className="h-4 w-4" />
              {quote.operatore_id || quote.fornitore_id ? 'Riassegna' : 'Assegna'}
            </button>
          )}

          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Elimina preventivo
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'dati' && <TabDati quote={quote} viewerRole={role} />}
        {activeTab === 'allegati' && (
          <TabAllegati
            attachments={quote.attachments || []}
            uploadFile={uploadFile}
            setUploadFile={setUploadFile}
            uploadTipo={uploadTipo}
            setUploadTipo={setUploadTipo}
            uploading={uploading}
            uploadError={uploadError}
            onUpload={handleUpload}
          />
        )}
        {activeTab === 'note' && (
          <TabNote
            notes={quote.notes || []}
            noteText={noteText}
            setNoteText={setNoteText}
            noteTipo={noteTipo}
            setNoteTipo={setNoteTipo}
            noteSubmitting={noteSubmitting}
            noteError={noteError}
            onAddNote={handleAddNote}
          />
        )}
        {activeTab === 'storico' && <TabStorico history={quote.history || []} />}
        {activeTab === 'preventivo' && (
          <TabPreventivo
            quote={quote}
            role={role}
            isAssignedOperator={isAssignedStaff}
            canRegenerateRiepilogoRc={userCanRegenerateRcRiepilogoPdf(quote, role, currentUser?.id)}
            onRefresh={fetchQuote}
          />
        )}
      </div>

      <OperatorStandbyModal
        isOpen={showStandbyModal}
        onClose={() => setShowStandbyModal(false)}
        quoteId={Number(id)}
        onCompleted={fetchQuote}
        onError={setActionError}
      />
      <OperatorElaborataModal
        isOpen={showElaborataModal}
        onClose={() => setShowElaborataModal(false)}
        quoteId={Number(id)}
        quote={quote}
        onCompleted={fetchQuote}
        onError={setActionError}
      />

      {/* Assign Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={quote?.operatore_id || quote?.fornitore_id ? 'Riassegna incaricato' : 'Assegna incaricato'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Solo amministratore e supervisore possono assegnare o riassegnare. Scegli un operatore o un broker come
            incaricato che lavorerà la pratica.
          </p>
          <div>
            <label htmlFor="detail-assign-operator" className="mb-1 block text-sm font-medium text-gray-700">
              Incaricato
            </label>
            <select
              id="detail-assign-operator"
              value={assignOperatorId}
              onChange={(e) => setAssignOperatorId(e.target.value)}
              className="input-field"
            >
              <option value="">Seleziona…</option>
              {assignees.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {getUserDisplayName(o)} ({o.role === 'fornitore' ? 'Broker' : 'Operatore'})
                </option>
              ))}
            </select>
          </div>
          {assignError && <p className="text-sm text-red-600">{assignError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAssignModal(false)} className="btn-secondary">Annulla</button>
            <button type="button" onClick={handleAssign} disabled={assignSubmitting} className="btn-primary">
              {assignSubmitting ? 'Assegnazione…' : 'Conferma'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => !deleteSubmitting && setShowDeleteModal(false)}
        title="Elimina preventivo"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Operazione irreversibile: verranno eliminati storico stato, note, solleciti, allegati e, se presente, la
            polizza collegata a questo preventivo.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="btn-secondary"
              disabled={deleteSubmitting}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleDeleteQuote}
              disabled={deleteSubmitting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {deleteSubmitting ? 'Eliminazione…' : 'Elimina'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ───────────── Tab: Dati ───────────── */

function TabDati({ quote, viewerRole }: { quote: Quote; viewerRole?: string }) {
  const showPrivacyPanel =
    viewerRole === 'admin' ||
    viewerRole === 'supervisore' ||
    viewerRole === 'operatore' ||
    viewerRole === 'fornitore';

  const casaPacchetto =
    quote.tipo_codice === 'casa' && quote.dati_specifici && typeof quote.dati_specifici === 'object'
      ? (quote.dati_specifici as Record<string, unknown>).pacchetto_casa
      : null;
  const casaPacchettoObj =
    casaPacchetto && typeof casaPacchetto === 'object'
      ? (casaPacchetto as {
          id?: string;
          nome?: string;
          premio_finale_euro?: number;
          righe?: { label?: string; valore?: string }[];
        })
      : null;

  const casaPreventivoRaw =
    quote.tipo_codice === 'casa' && quote.dati_specifici && typeof quote.dati_specifici === 'object'
      ? (quote.dati_specifici as Record<string, unknown>).casa_preventivo
      : null;
  const isCasaPersonalizzato = Boolean(
    quote.tipo_codice === 'casa'
    && casaPreventivoRaw
    && typeof casaPreventivoRaw === 'object'
    && (casaPreventivoRaw as { personalizzato?: unknown }).personalizzato === true,
  );

  const incaricatoDisplay =
    quote.operatore_id
      ? [quote.operatore_nome, quote.operatore_cognome].filter(Boolean).join(' ')
      : quote.fornitore_id
        ? [quote.fornitore_nome, quote.fornitore_cognome].filter(Boolean).join(' ')
        : '';

  const dsRecord =
    quote.dati_specifici && typeof quote.dati_specifici === 'object'
      ? (quote.dati_specifici as Record<string, unknown>)
      : null;
  const garanzieRichiesteLine =
    isRcVeicoliTipo(quote.tipo_codice) && dsRecord != null
      ? formatGaranzieRichiesteRcLine(dsRecord)
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {showPrivacyPanel ? (
        <DetailSectionCard
          title="Tracciamento consensi (sola lettura)"
          variant="muted"
          className="lg:col-span-2"
        >
          {quote.privacy_consent_untracked ? (
            <p className="text-sm leading-snug text-gray-600">
              Consenso non tracciato (record precedente all’introduzione della nuova policy).
            </p>
          ) : (
            <CompactInfoGrid columns="two">
              <DetailField
                label="Consenso privacy"
                value={quote.privacy_consent_required ? 'Prestato' : 'Non prestato'}
              />
              <DetailField
                label="Data consenso"
                value={quote.privacy_consent_at ? formatDateTime(quote.privacy_consent_at) : undefined}
              />
              <DetailField label="Versione informativa" value={quote.privacy_policy_version} />
              <DetailField
                label="Consenso marketing"
                value={
                  quote.marketing_consent === true ? 'Sì' : quote.marketing_consent === false ? 'No' : undefined
                }
              />
              {quote.marketing_consent_at ? (
                <DetailField
                  label="Data consenso marketing"
                  value={formatDateTime(quote.marketing_consent_at)}
                />
              ) : null}
            </CompactInfoGrid>
          )}
          <p className="mt-2.5 border-t border-slate-200/80 pt-2.5 text-[11px] leading-snug text-gray-400">
            L’indirizzo IP è conservato a fini di prova lato sistema e non è mostrato qui.
          </p>
        </DetailSectionCard>
      ) : null}

      <DetailSectionCard title="Assistito">
        <CompactInfoGrid columns="two">
          <DetailField
            label="Nome e cognome"
            value={`${quote.assistito_nome || ''} ${quote.assistito_cognome || ''}`.trim()}
          />
          <DetailField label="Codice fiscale" value={quote.assistito_cf} mono />
          <DetailField label="Data di nascita" value={formatDate(quote.assistito_data_nascita)} />
          <DetailField label="Cellulare" value={quote.assistito_cellulare} />
          <DetailField label="Email" value={quote.assistito_email} />
          <DetailField label="Città" value={quote.assistito_citta} />
          <DetailField label="Indirizzo" value={quote.assistito_indirizzo} />
          <DetailField label="CAP" value={quote.assistito_cap} />
        </CompactInfoGrid>
      </DetailSectionCard>

      <DetailSectionCard title="Dettagli preventivo">
        <CompactInfoGrid columns="two">
          <DetailField label="Numero" value={quote.numero} mono />
          <DetailField label="Tipologia" value={quote.tipo_nome} />
          <DetailField label="Struttura" value={quote.struttura_nome} />
          <DetailField label="Incaricato" value={incaricatoDisplay || undefined} />
          <DetailField label="Stato" value={quote.stato} />
          <DetailField label="Data decorrenza" value={formatDate(quote.data_decorrenza)} />
          <DetailField label="Data creazione" value={formatDateTime(quote.created_at)} />
          <DetailField label="Ultimo aggiornamento" value={formatDateTime(quote.updated_at)} />
        </CompactInfoGrid>
      </DetailSectionCard>

      {isCasaPersonalizzato && !casaPacchettoObj?.id && (
        <DetailSectionCard title="Polizza Casa" variant="amber" className="lg:col-span-2">
          <p className="text-sm font-medium leading-snug text-amber-950">Preventivo personalizzato</p>
          <p className="mt-1.5 text-sm leading-snug text-amber-900/85">
            Richiesta senza pacchetto predefinito: la pratica è stata avviata come preventivo su misura.
          </p>
        </DetailSectionCard>
      )}

      {casaPacchettoObj?.id && (
        <DetailSectionCard title="Pacchetto polizza Casa" variant="sky" className="lg:col-span-2">
          <CompactInfoGrid columns="responsive-3">
            <DetailField label="Nome pacchetto" value={casaPacchettoObj.nome || undefined} colSpan="full" />
            {typeof casaPacchettoObj.premio_finale_euro === 'number' ? (
              <DetailField label="Premio finale" value={formatPremioCasaIt(casaPacchettoObj.premio_finale_euro)} />
            ) : null}
            {Array.isArray(casaPacchettoObj.righe) && casaPacchettoObj.righe.length > 0
              ? casaPacchettoObj.righe.map((r, i) => (
                  <DetailField
                    key={i}
                    label={r.label || '—'}
                    value={r.valore != null ? formatUnknownValueForDisplay(r.valore) : undefined}
                    colSpan={detailColSpanFromDisplayString(
                      r.valore != null ? formatUnknownValueForDisplay(r.valore) : '',
                    )}
                  />
                ))
              : null}
          </CompactInfoGrid>
          <div className="mt-3 border-t border-sky-200/60 pt-3">
            <CasaPacchettoPdfDownload packageId={casaPacchettoObj.id} nomePacchetto={casaPacchettoObj.nome} />
          </div>
        </DetailSectionCard>
      )}

      <DetailSectionCard title="Note" className="lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/40 px-3 py-2.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Note della struttura</h4>
            {quote.note_struttura?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-gray-800">{quote.note_struttura}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-400">—</p>
            )}
          </div>
          <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/40 px-3 py-2.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Note sugli allegati</h4>
            {quote.note_allegati && String(quote.note_allegati).trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-gray-800">
                {String(quote.note_allegati).trim()}
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-400">—</p>
            )}
          </div>
        </div>
      </DetailSectionCard>

      {quote.dati_specifici && Object.keys(quote.dati_specifici).length > 0 && (
        <DetailSectionCard title="Dati specifici" className="lg:col-span-2">
          <CompactInfoGrid columns="responsive-3">
            {garanzieRichiesteLine != null ? (
              <DetailField
                label="Garanzie richieste"
                value={garanzieRichiesteLine}
                colSpan={detailColSpanFromDisplayString(garanzieRichiesteLine)}
              />
            ) : null}
            {Object.entries(quote.dati_specifici)
              .filter(
                ([key]) =>
                  !String(key).startsWith('_')
                  && key !== 'pacchetto_casa'
                  && key !== 'casa_preventivo'
                  && !(isRcVeicoliTipo(quote.tipo_codice) && RC_DATI_SPEC_KEYS_TO_HIDE.has(key)),
              )
              .map(([key, value]) => {
                const formatted = formatUnknownValueForDisplay(value);
                return (
                  <DetailField
                    key={key}
                    label={formatDetailRecordKey(key)}
                    value={formatted}
                    colSpan={detailColSpanFromDisplayString(formatted)}
                  />
                );
              })}
          </CompactInfoGrid>
        </DetailSectionCard>
      )}
    </div>
  );
}

function CasaPacchettoPdfDownload({ packageId, nomePacchetto }: { packageId: string; nomePacchetto?: string }) {
  const [busy, setBusy] = useState(false);
  const safeName = (nomePacchetto || 'pacchetto')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 100);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api.download(
            `/quotes/casa-pacchetti/${encodeURIComponent(packageId)}/riepilogo-pdf`,
            `Riepilogo-${safeName}.pdf`,
          );
        } catch (e) {
          window.alert(e instanceof ApiError ? e.message : 'Download non riuscito.');
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-900 shadow-sm transition hover:bg-sky-50 disabled:opacity-60"
    >
      <Download className={`h-4 w-4 ${busy ? 'animate-pulse' : ''}`} />
      {busy ? 'Preparazione…' : 'Scarica PDF riepilogo pacchetto (cliente)'}
    </button>
  );
}

/* ───────────── Tab: Allegati ───────────── */

interface TabAllegatiProps {
  attachments: Attachment[];
  uploadFile: File | null;
  setUploadFile: (f: File | null) => void;
  uploadTipo: string;
  setUploadTipo: (t: string) => void;
  uploading: boolean;
  uploadError: string | null;
  onUpload: () => void;
}

function TabAllegati({ attachments, uploadFile, setUploadFile, uploadTipo, setUploadTipo, uploading, uploadError, onUpload }: TabAllegatiProps) {
  return (
    <div className="space-y-4">
      {/* Upload form */}
      <div className="card p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Carica allegato</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="upload-file" className="mb-1 block text-sm font-medium text-gray-700">File</label>
            <input
              id="upload-file"
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="input-field text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div className="min-w-[180px]">
            <label htmlFor="upload-tipo" className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
            <select id="upload-tipo" value={uploadTipo} onChange={(e) => setUploadTipo(e.target.value)} className="input-field">
              <option value="documento">Documento</option>
              <option value="carta_identita">Carta d&apos;identità</option>
              <option value="codice_fiscale">Codice Fiscale</option>
              <option value="altro">Altro</option>
            </select>
          </div>
          <button
            type="button"
            onClick={onUpload}
            disabled={!uploadFile || uploading}
            className="btn-primary shrink-0"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Caricamento…' : 'Carica'}
          </button>
        </div>
        {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
      </div>

      {/* Attachments list */}
      <div className="card overflow-hidden">
        {attachments.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Nessun allegato presente.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Nome file</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Tipo</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Dimensione</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Caricato da</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Data</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{a.nome_originale}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{labelForQuoteAttachmentTipo(a.tipo)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatFileSize(a.dimensione)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {displayUserName({ nome: a.caricato_nome, cognome: a.caricato_cognome, denominazione: a.caricato_denominazione })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDateTime(a.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => api.download(`/attachments/download/${a.id}`, a.nome_originale)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Scarica
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── Tab: Note ───────────── */

interface TabNoteProps {
  notes: QuoteNote[];
  noteText: string;
  setNoteText: (t: string) => void;
  noteTipo: string;
  setNoteTipo: (t: string) => void;
  noteSubmitting: boolean;
  noteError: string | null;
  onAddNote: () => void;
}

function TabNote({ notes, noteText, setNoteText, noteTipo, setNoteTipo, noteSubmitting, noteError, onAddNote }: TabNoteProps) {
  return (
    <div className="space-y-4">
      {/* Add note form */}
      <div className="card p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Aggiungi nota</h3>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <textarea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Scrivi una nota…"
                className="input-field"
              />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="min-w-[160px]">
              <label htmlFor="note-tipo" className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
              <select id="note-tipo" value={noteTipo} onChange={(e) => setNoteTipo(e.target.value)} className="input-field">
                <option value="nota">Nota</option>
                <option value="comunicazione">Comunicazione</option>
                <option value="richiesta">Richiesta</option>
              </select>
            </div>
            <button
              type="button"
              onClick={onAddNote}
              disabled={!noteText.trim() || noteSubmitting}
              className="btn-primary"
            >
              <Send className="h-4 w-4" />
              {noteSubmitting ? 'Invio…' : 'Invia'}
            </button>
          </div>
          {noteError && <p className="text-sm text-red-600">{noteError}</p>}
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="card px-4 py-8 text-center text-sm text-gray-500">Nessuna nota presente.</div>
      ) : (
        <div className="space-y-2.5">
          {notes.map((n) => (
            <div key={n.id} className="card border-slate-200/80 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">
                    {displayUserName(n)}
                  </span>
                  <span className={`badge ${
                    n.tipo === 'comunicazione' ? 'bg-blue-100 text-blue-700' :
                    n.tipo === 'richiesta' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {n.tipo}
                  </span>
                </div>
                <time className="shrink-0 text-xs text-gray-500">{formatDateTime(n.created_at)}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{n.testo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── Tab: Storico ───────────── */

function TabStorico({ history }: { history: StatusHistory[] }) {
  if (history.length === 0) {
    return <div className="card px-4 py-8 text-center text-sm text-gray-500">Nessun cambiamento di stato registrato.</div>;
  }

  return (
    <div className="card p-4">
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        <ul className="space-y-4">
          {history.map((h, i) => (
            <li key={h.id} className="relative pl-10">
              <div className={`absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 border-[#f3f5f9] shadow-[0_0_0_1px_rgba(226,232,240,0.9)] ${
                i === 0 ? 'bg-blue-600' : 'bg-gray-400'
              }`} />
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {h.stato_precedente && (
                    <>
                      <StatusBadge stato={h.stato_precedente} />
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    </>
                  )}
                  <StatusBadge stato={h.stato_nuovo} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{displayUserName(h)}</span>
                  <span>·</span>
                  <Clock className="h-3 w-3" />
                  <time>{formatDateTime(h.created_at)}</time>
                </div>
                {h.motivo && (
                  <p className="mt-1.5 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 border border-gray-100">
                    {h.motivo}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────── Tab: Preventivo ───────────── */

interface TabPreventivoProps {
  quote: Quote;
  role?: string;
  isAssignedOperator: boolean;
  canRegenerateRiepilogoRc: boolean;
  onRefresh: () => void;
}

function TabPreventivo({
  quote,
  role,
  isAssignedOperator,
  canRegenerateRiepilogoRc,
  onRefresh,
}: TabPreventivoProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingAllegato, setDownloadingAllegato] = useState(false);
  const [rigeneraBusy, setRigeneraBusy] = useState(false);
  const [riepilogoSuccess, setRiepilogoSuccess] = useState<string | null>(null);

  const isRcAuto = String(quote.tipo_codice || '').toLowerCase() === 'rc_auto';

  const preventivoAttachment = [...(quote.attachments || []).filter((a) => a.tipo === 'preventivo_elaborato')].sort(
    (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')),
  )[0];

  const riepilogoAttachment = [...(quote.attachments || []).filter((a) => a.tipo === 'preventivo_riepilogo_rc')].sort(
    (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')),
  )[0];

  const canUpload =
    (isAssignedOperator || role === 'admin') &&
    ['IN LAVORAZIONE', 'ELABORATA'].includes(quote.stato);

  const handleUploadPreventivo = async () => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', 'quote');
      formData.append('entity_id', String(quote.id));
      formData.append('tipo', 'preventivo_elaborato');
      await api.upload('/attachments/upload', formData);
      setFile(null);
      onRefresh();
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : 'Upload non riuscito.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadPreventivo = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      const name = isRcAuto
        ? riepilogoAttachment?.nome_originale || rcPreventivoPdfDownloadFilename(quote)
        : preventivoAttachment?.nome_originale || `preventivo-${quote.id}.pdf`;
      if (!isRcAuto && !preventivoAttachment) return;
      if (isRcAuto && quote.stato === 'ELABORATA' && !riepilogoAttachment && !preventivoAttachment) return;
      await downloadPreventivoFinale(quote.id, name);
    } catch (e) {
      setDownloadError(e instanceof ApiError ? e.message : 'Download non riuscito.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadAllegatoOperatore = async () => {
    if (!preventivoAttachment) return;
    setDownloadError(null);
    setDownloadingAllegato(true);
    try {
      await api.download(`/attachments/download/${preventivoAttachment.id}`, preventivoAttachment.nome_originale);
    } catch (e) {
      setDownloadError(e instanceof ApiError ? e.message : 'Download non riuscito.');
    } finally {
      setDownloadingAllegato(false);
    }
  };

  const handleRigeneraRiepilogoRc = async () => {
    if (!canRegenerateRiepilogoRc || rigeneraBusy) return;
    setRiepilogoSuccess(null);
    setDownloadError(null);
    setRigeneraBusy(true);
    try {
      const res = await api.post<{ message: string; filename?: string }>(
        `/quotes/${quote.id}/rigenera-riepilogo-rc-auto`,
      );
      const downloadName = res.filename?.trim() || rcPreventivoPdfDownloadFilename(quote);
      setRiepilogoSuccess('Preventivo rigenerato con successo');
      try {
        await downloadPreventivoFinale(quote.id, downloadName);
      } catch (dl) {
        setDownloadError(
          dl instanceof ApiError
            ? `${dl.message} Usa «Scarica preventivo» per scaricare il file aggiornato.`
            : 'Download automatico non riuscito. Usa «Scarica preventivo».',
        );
      }
      await onRefresh();
    } catch (e) {
      setDownloadError(e instanceof ApiError ? e.message : 'Rigenerazione preventivo non riuscita.');
    } finally {
      setRigeneraBusy(false);
    }
  };

  const showRiepilogoCard =
    isRcAuto && quote.stato === 'ELABORATA' && (riepilogoAttachment != null || canRegenerateRiepilogoRc);
  const showLegacySingleCard = !isRcAuto && preventivoAttachment;
  const showEmptyState =
    !showRiepilogoCard && !showLegacySingleCard && !(isRcAuto && quote.stato === 'ELABORATA' && !riepilogoAttachment);

  return (
    <div className="space-y-4">
      {showRiepilogoCard ? (
        <div className="card p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Preventivo (PDF sistema)
          </h3>
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <FileText className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {riepilogoAttachment?.nome_originale ?? 'Preventivo PDF (sistema)'}
                </p>
                <p className="text-xs text-gray-500">
                  {riepilogoAttachment
                    ? formatFileSize(riepilogoAttachment.dimensione)
                    : 'File non disponibile: usa «Rigenera Preventivo» o «Scarica preventivo».'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPreventivo}
                disabled={downloading || rigeneraBusy}
                className="btn-primary"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Download…' : 'Scarica preventivo'}
              </button>
              {canRegenerateRiepilogoRc ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleRigeneraRiepilogoRc();
                  }}
                  disabled={rigeneraBusy}
                  className="btn-secondary"
                  title="Rigenera il preventivo PDF con il template aggiornato (dati già salvati). Avvia anche il download del nuovo file."
                >
                  <RotateCcw className="h-4 w-4" />
                  {rigeneraBusy ? 'Rigenerazione…' : 'Rigenera Preventivo'}
                </button>
              ) : null}
            </div>
          </div>
          {riepilogoSuccess ? <p className="mt-2 text-sm text-emerald-700">{riepilogoSuccess}</p> : null}
          {downloadError ? <p className="mt-2 text-sm text-red-600">{downloadError}</p> : null}
        </div>
      ) : null}

      {isRcAuto && quote.stato === 'ELABORATA' && preventivoAttachment ? (
        <div className="card p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Allegato operatore
          </h3>
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <FileText className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{preventivoAttachment.nome_originale}</p>
                <p className="text-xs text-gray-500">{formatFileSize(preventivoAttachment.dimensione)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadAllegatoOperatore}
              disabled={downloadingAllegato}
              className="btn-secondary"
            >
              <Download className="h-4 w-4" />
              {downloadingAllegato ? 'Download…' : 'Scarica allegato operatore'}
            </button>
          </div>
        </div>
      ) : null}

      {showLegacySingleCard ? (
        <div className="card p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Documento preventivo
          </h3>
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <FileText className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{preventivoAttachment.nome_originale}</p>
                <p className="text-xs text-gray-500">{formatFileSize(preventivoAttachment.dimensione)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadPreventivo}
              disabled={downloading}
              className="btn-primary"
            >
              <Download className="h-4 w-4" />
              {downloading ? 'Download…' : 'Scarica PDF'}
            </button>
          </div>
          {downloadError ? <p className="mt-2 text-sm text-red-600">{downloadError}</p> : null}
        </div>
      ) : null}

      {showEmptyState ? (
        <div className="card px-4 py-8 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Nessun documento preventivo caricato.</p>
          <p className="mt-1 text-xs text-gray-400">
            {canUpload
              ? 'Carica il PDF del preventivo elaborato qui sotto.'
              : 'Il documento sarà disponibile quando l\u2019operatore lo caricherà.'}
          </p>
        </div>
      ) : null}

      {isRcAuto && quote.stato === 'ELABORATA' && !riepilogoAttachment && !canRegenerateRiepilogoRc ? (
        <p className="text-sm text-amber-800">
          Il preventivo PDF di sistema sarà disponibile dopo l&apos;elaborazione da parte dell&apos;incaricato tramite il
          modale dedicato.
        </p>
      ) : null}

      {/* Upload form per operatore/admin */}
      {canUpload && (
        <div className="card p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {preventivoAttachment ? 'Sostituisci documento' : 'Carica documento preventivo'}
          </h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="preventivo-file" className="mb-1 block text-sm font-medium text-gray-700">
                File PDF
              </label>
              <input
                id="preventivo-file"
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="input-field text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <button
              type="button"
              onClick={handleUploadPreventivo}
              disabled={!file || uploading}
              className="btn-primary shrink-0"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Caricamento…' : 'Carica Preventivo'}
            </button>
          </div>
          {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
        </div>
      )}

      {/* Dati preventivo (se presenti) */}
      {(() => {
        const dp = quote.dati_preventivo;
        if (!dp || typeof dp !== 'object') return null;
        const elabora = dp.elaborazione_rc_auto;
        const rest = Object.entries(dp).filter(([k]) => k !== 'elaborazione_rc_auto');
        if (!elabora && rest.length === 0) return null;
        const fmtEuro = (n: unknown) =>
          typeof n === 'number'
            ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
            : '—';
        return (
          <>
            {elabora && typeof elabora === 'object' && elabora !== null ? (
              <DetailSectionCard title="Riepilogo premi (RC Auto)">
                <div className="space-y-2.5 text-sm">
                  {Array.isArray((elabora as { pricingBreakdown?: unknown }).pricingBreakdown) &&
                  ((elabora as { pricingBreakdown: { nome: string; prezzo: number }[] }).pricingBreakdown.length >
                    0) ? (
                    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                      {(elabora as { pricingBreakdown: { nome: string; prezzo: number }[] }).pricingBreakdown.map(
                        (row) => (
                          <li key={row.nome} className="flex justify-between gap-3 px-3 py-2">
                            <span className="text-gray-800">{row.nome}</span>
                            <span className="tabular-nums text-gray-900">{fmtEuro(row.prezzo)}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="text-gray-500">Nessuna garanzia tariffata.</p>
                  )}
                  <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 font-semibold">
                    <span>Totale</span>
                    <span className="tabular-nums">
                      {fmtEuro((elabora as { totalPrice?: number }).totalPrice)}
                    </span>
                  </div>
                  {(elabora as { notes?: string | null }).notes ? (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Note operatore</p>
                      <p className="mt-1 whitespace-pre-wrap text-gray-800">
                        {(elabora as { notes: string }).notes}
                      </p>
                    </div>
                  ) : null}
                  {(elabora as { elaboratedAt?: string }).elaboratedAt ? (
                    <p className="text-xs text-gray-500">
                      Elaborato il {formatDateTime(String((elabora as { elaboratedAt: string }).elaboratedAt))}
                    </p>
                  ) : null}
                </div>
              </DetailSectionCard>
            ) : null}
            {rest.length > 0 ? (
              <DetailSectionCard title="Dati preventivo elaborato">
                <CompactInfoGrid columns="responsive-3">
                  {rest.map(([key, value]) => {
                    const formatted = formatUnknownValueForDisplay(value);
                    return (
                      <DetailField
                        key={key}
                        label={formatDetailRecordKey(key)}
                        value={formatted}
                        colSpan={detailColSpanFromDisplayString(formatted)}
                      />
                    );
                  })}
                </CompactInfoGrid>
              </DetailSectionCard>
            ) : null}
          </>
        );
      })()}
    </div>
  );
}
