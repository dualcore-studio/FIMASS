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
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Quote, User, Attachment, QuoteNote, StatusHistory } from '../../types';
import { formatDate, formatDateTime, getUserDisplayName } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/ui/Modal';

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

  // Standby modal
  const [showStandbyModal, setShowStandbyModal] = useState(false);
  const [standbyMotivo, setStandbyMotivo] = useState('');
  const [standbyError, setStandbyError] = useState<string | null>(null);

  // Elaborata modal
  const [showElaborataModal, setShowElaborataModal] = useState(false);
  const [elaborataFile, setElaborataFile] = useState<File | null>(null);
  const [elaborataError, setElaborataError] = useState<string | null>(null);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [operators, setOperators] = useState<User[]>([]);
  const [assignOperatorId, setAssignOperatorId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

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
    if (role === 'admin' || role === 'supervisore') {
      api.get<User[]>('/users/operators').then(setOperators).catch(() => {});
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

  const handleStandbyConfirm = async () => {
    if (!standbyMotivo.trim()) {
      setStandbyError('Il motivo è obbligatorio.');
      return;
    }
    setStandbyError(null);
    await handleStatusChange('STANDBY', standbyMotivo.trim());
    setShowStandbyModal(false);
    setStandbyMotivo('');
  };

  const handleElaborataConfirm = async () => {
    if (!elaborataFile) {
      setElaborataError('Il file del preventivo è obbligatorio.');
      return;
    }
    if (!id) return;
    setElaborataError(null);
    setStatusSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', elaborataFile);
      formData.append('entity_type', 'quote');
      formData.append('entity_id', id);
      formData.append('tipo', 'preventivo_elaborato');
      await api.upload('/attachments/upload', formData);
      await handleStatusChange('ELABORATA');
      setShowElaborataModal(false);
      setElaborataFile(null);
    } catch (e) {
      setElaborataError(e instanceof ApiError ? e.message : 'Caricamento non riuscito.');
      setStatusSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!id || !assignOperatorId) {
      setAssignError('Seleziona un operatore.');
      return;
    }
    setAssignError(null);
    setAssignSubmitting(true);
    try {
      await api.put(`/quotes/${id}/assign`, { operatore_id: Number(assignOperatorId) });
      setShowAssignModal(false);
      setAssignOperatorId('');
      await fetchQuote();
    } catch (e) {
      setAssignError(e instanceof ApiError ? e.message : 'Assegnazione non riuscita.');
    } finally {
      setAssignSubmitting(false);
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

  const isAssignedOperator = role === 'operatore' && quote?.operatore_id === currentUser?.id;
  const canAssign = role === 'admin' || role === 'supervisore';

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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Preventivo {quote.numero}
              </h1>
              <StatusBadge stato={quote.stato} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {quote.tipo_nome} — Creato il {formatDate(quote.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Operator status buttons */}
          {isAssignedOperator && quote.stato === 'ASSEGNATA' && (
            <button
              onClick={() => handleStatusChange('IN LAVORAZIONE')}
              disabled={statusSubmitting}
              className="btn-primary"
            >
              <Play className="h-4 w-4" />
              Inizia Lavorazione
            </button>
          )}
          {isAssignedOperator && quote.stato === 'IN LAVORAZIONE' && (
            <>
              <button
                onClick={() => { setShowStandbyModal(true); setStandbyMotivo(''); setStandbyError(null); }}
                disabled={statusSubmitting}
                className="btn-secondary"
              >
                <Pause className="h-4 w-4" />
                Metti in Standby
              </button>
              <button
                onClick={() => { setShowElaborataModal(true); setElaborataFile(null); setElaborataError(null); }}
                disabled={statusSubmitting}
                className="btn-success"
              >
                <CheckCircle2 className="h-4 w-4" />
                Segna come Elaborata
              </button>
            </>
          )}
          {isAssignedOperator && quote.stato === 'STANDBY' && (
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
                setAssignOperatorId(quote.operatore_id ? String(quote.operatore_id) : '');
                setAssignError(null);
              }}
              className="btn-secondary"
            >
              <UserCheck className="h-4 w-4" />
              {quote.operatore_id ? 'Riassegna' : 'Assegna'}
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
        {activeTab === 'dati' && <TabDati quote={quote} />}
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
            isAssignedOperator={isAssignedOperator}
            onRefresh={fetchQuote}
          />
        )}
      </div>

      {/* Standby Modal */}
      <Modal isOpen={showStandbyModal} onClose={() => setShowStandbyModal(false)} title="Metti in Standby" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Inserisci il motivo per cui il preventivo viene messo in standby. Il campo è obbligatorio.
          </p>
          <div>
            <label htmlFor="standby-motivo" className="mb-1 block text-sm font-medium text-gray-700">
              Motivo standby *
            </label>
            <textarea
              id="standby-motivo"
              rows={3}
              value={standbyMotivo}
              onChange={(e) => setStandbyMotivo(e.target.value)}
              className="input-field"
              placeholder="Descrivi il motivo…"
            />
          </div>
          {standbyError && <p className="text-sm text-red-600">{standbyError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowStandbyModal(false)} className="btn-secondary">Annulla</button>
            <button type="button" onClick={handleStandbyConfirm} disabled={statusSubmitting} className="btn-primary">
              {statusSubmitting ? 'Salvando…' : 'Conferma'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Elaborata Modal */}
      <Modal isOpen={showElaborataModal} onClose={() => setShowElaborataModal(false)} title="Segna come Elaborata" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Per segnare il preventivo come elaborato è necessario caricare il file del preventivo.
          </p>
          <div>
            <label htmlFor="elaborata-file" className="mb-1 block text-sm font-medium text-gray-700">
              File preventivo *
            </label>
            <input
              id="elaborata-file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setElaborataFile(e.target.files?.[0] || null)}
              className="input-field text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {elaborataError && <p className="text-sm text-red-600">{elaborataError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowElaborataModal(false)} className="btn-secondary">Annulla</button>
            <button type="button" onClick={handleElaborataConfirm} disabled={statusSubmitting} className="btn-success">
              {statusSubmitting ? 'Caricamento…' : 'Conferma'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assegna Operatore" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Seleziona l&apos;operatore a cui assegnare il preventivo.
          </p>
          <div>
            <label htmlFor="detail-assign-operator" className="mb-1 block text-sm font-medium text-gray-700">
              Operatore
            </label>
            <select
              id="detail-assign-operator"
              value={assignOperatorId}
              onChange={(e) => setAssignOperatorId(e.target.value)}
              className="input-field"
            >
              <option value="">Seleziona operatore…</option>
              {operators.map((o) => (
                <option key={o.id} value={String(o.id)}>{getUserDisplayName(o)}</option>
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
    </div>
  );
}

/* ───────────── Tab: Dati ───────────── */

function TabDati({ quote }: { quote: Quote }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Assistito */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Assistito</h3>
        <dl className="space-y-3 text-sm">
          <InfoRow label="Nome e Cognome" value={`${quote.assistito_nome || ''} ${quote.assistito_cognome || ''}`} />
          <InfoRow label="Codice Fiscale" value={quote.assistito_cf} mono />
          <InfoRow label="Data di Nascita" value={formatDate(quote.assistito_data_nascita)} />
          <InfoRow label="Cellulare" value={quote.assistito_cellulare} />
          <InfoRow label="Email" value={quote.assistito_email} />
          <InfoRow label="Indirizzo" value={quote.assistito_indirizzo} />
          <InfoRow label="CAP" value={quote.assistito_cap} />
          <InfoRow label="Città" value={quote.assistito_citta} />
        </dl>
      </div>

      {/* Dettagli preventivo */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Dettagli Preventivo</h3>
        <dl className="space-y-3 text-sm">
          <InfoRow label="Numero" value={quote.numero} mono />
          <InfoRow label="Tipologia" value={quote.tipo_nome} />
          <InfoRow label="Struttura" value={quote.struttura_nome} />
          <InfoRow
            label="Operatore"
            value={
              quote.operatore_id
                ? [quote.operatore_nome, quote.operatore_cognome].filter(Boolean).join(' ')
                : undefined
            }
          />
          <InfoRow label="Stato" value={quote.stato} />
          <InfoRow label="Data Decorrenza" value={formatDate(quote.data_decorrenza)} />
          <InfoRow label="Data Creazione" value={formatDateTime(quote.created_at)} />
          <InfoRow label="Ultimo Aggiornamento" value={formatDateTime(quote.updated_at)} />
        </dl>
      </div>

      {/* Note struttura */}
      {quote.note_struttura && (
        <div className="card p-6 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Note della Struttura</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{quote.note_struttura}</p>
        </div>
      )}

      {/* Dati specifici */}
      {quote.dati_specifici && Object.keys(quote.dati_specifici).length > 0 && (
        <div className="card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Dati Specifici</h3>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {Object.entries(quote.dati_specifici).map(([key, value]) => (
              <InfoRow
                key={key}
                label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                value={typeof value === 'boolean' ? (value ? 'Sì' : 'No') : String(value ?? '-')}
              />
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className={`mt-0.5 text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>
        {value?.trim() || <span className="text-gray-400">-</span>}
      </dd>
    </div>
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
    <div className="space-y-6">
      {/* Upload form */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Carica Allegato</h3>
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
          <div className="px-6 py-12 text-center text-sm text-gray-500">Nessun allegato presente.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Nome file</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Tipo</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Dimensione</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Caricato da</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Data</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {attachments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.nome_originale}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{a.tipo.replace(/_/g, ' ')}</td>
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
    <div className="space-y-6">
      {/* Add note form */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Aggiungi Nota</h3>
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
        <div className="card px-6 py-12 text-center text-sm text-gray-500">Nessuna nota presente.</div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="card p-4">
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
    return <div className="card px-6 py-12 text-center text-sm text-gray-500">Nessun cambiamento di stato registrato.</div>;
  }

  return (
    <div className="card p-6">
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        <ul className="space-y-6">
          {history.map((h, i) => (
            <li key={h.id} className="relative pl-10">
              <div className={`absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 border-white ${
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
  onRefresh: () => void;
}

function TabPreventivo({ quote, role, isAssignedOperator, onRefresh }: TabPreventivoProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const preventivoAttachment = (quote.attachments || []).find(
    (a) => a.tipo === 'preventivo_elaborato'
  );

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

  return (
    <div className="space-y-6">
      {/* PDF del preventivo */}
      {preventivoAttachment ? (
        <div className="card p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Documento Preventivo
          </h3>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
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
              onClick={() => api.download(`/attachments/download/${preventivoAttachment.id}`, preventivoAttachment.nome_originale)}
              className="btn-primary"
            >
              <Download className="h-4 w-4" />
              Scarica PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="card px-6 py-12 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Nessun documento preventivo caricato.</p>
          <p className="mt-1 text-xs text-gray-400">
            {canUpload
              ? 'Carica il PDF del preventivo elaborato qui sotto.'
              : 'Il documento sarà disponibile quando l\u2019operatore lo caricherà.'}
          </p>
        </div>
      )}

      {/* Upload form per operatore/admin */}
      {canUpload && (
        <div className="card p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
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
      {quote.dati_preventivo && Object.keys(quote.dati_preventivo).length > 0 && (
        <div className="card p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Dati Preventivo Elaborato</h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {Object.entries(quote.dati_preventivo).map(([key, value]) => (
              <InfoRow
                key={key}
                label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                value={typeof value === 'boolean' ? (value ? 'Sì' : 'No') : String(value ?? '-')}
              />
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
