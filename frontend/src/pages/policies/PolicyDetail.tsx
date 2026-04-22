import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Download,
  Clock,
  ArrowRight,
  Paperclip,
  History,
  LayoutDashboard,
  ExternalLink,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import { formatPremioCasaIt } from '../../config/casaPolizzaPackages';
import { labelForQuoteAttachmentTipo } from '../../config/casaQuoteFlow';
import type { Policy, Attachment, StatusHistory } from '../../types';
import { formatDate, formatDateTime, formatFileSize, formatUnknownValueForDisplay } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import {
  CompactInfoGrid,
  DetailField,
  DetailSectionCard,
  detailColSpanFromDisplayString,
  formatDetailRecordKey,
} from '../../components/detail';

type Tab = 'dati' | 'allegati' | 'storico';

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dati', label: 'Dati', icon: LayoutDashboard },
  { key: 'allegati', label: 'Allegati', icon: Paperclip },
  { key: 'storico', label: 'Storico', icon: History },
];

function displayUserName(item: { nome?: string; cognome?: string; denominazione?: string; role?: string }): string {
  if (item.role === 'struttura' && item.denominazione) return item.denominazione;
  return [item.nome, item.cognome].filter(Boolean).join(' ') || 'Utente';
}

export default function PolicyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const role = currentUser?.role;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dati');

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTipo, setUploadTipo] = useState('documento');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchPolicy = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<Policy>(`/policies/${id}`);
      setPolicy(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare la polizza.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleUpload = async () => {
    if (!id || !uploadFile) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('entity_type', 'policy');
      formData.append('entity_id', id);
      formData.append('tipo', uploadTipo);
      await api.upload('/attachments/upload', formData);
      setUploadFile(null);
      await fetchPolicy();
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : 'Upload non riuscito.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          <p className="text-sm text-gray-500">Caricamento polizza…</p>
        </div>
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/polizze')} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Torna alle polizze
        </button>
        <div className="card p-8 text-center text-red-700">{error || 'Polizza non trovata.'}</div>
      </div>
    );
  }

  const canUploadAttachments =
    role === 'admin' ||
    role === 'supervisore' ||
    role === 'operatore' ||
    (role === 'fornitore' && Number(policy.fornitore_id) === Number(currentUser?.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/polizze')} className="mt-1 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Polizza {policy.numero}
              </h1>
              <StatusBadge stato={policy.stato} type="policy" />
              {policy.is_renewal === true || policy.is_renewal === 1 ? (
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-900 ring-1 ring-indigo-200/80">
                  Da rinnovo
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {policy.tipo_nome} — Creata il {formatDate(policy.created_at)}
              {policy.preventivo_numero && (
                <>
                  {' '}— da preventivo{' '}
                  <Link to={`/preventivi/${policy.preventivo_id || policy.quote_id}`} className="text-blue-600 hover:underline">
                    {policy.preventivo_numero}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {policy.preventivo_numero && (
            <Link
              to={`/preventivi/${policy.preventivo_id || policy.quote_id}`}
              className="btn-secondary"
            >
              <ExternalLink className="h-4 w-4" />
              Vai al Preventivo
            </Link>
          )}

        </div>
      </div>

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
        {activeTab === 'dati' && <TabDati policy={policy} />}
        {activeTab === 'allegati' && (
          <TabAllegati
            canUpload={canUploadAttachments}
            policyStato={policy.stato}
            attachments={policy.attachments || []}
            uploadFile={uploadFile}
            setUploadFile={setUploadFile}
            uploadTipo={uploadTipo}
            setUploadTipo={setUploadTipo}
            uploading={uploading}
            uploadError={uploadError}
            onUpload={handleUpload}
          />
        )}
        {activeTab === 'storico' && <TabStorico history={policy.history || []} />}
      </div>
    </div>
  );
}

/* ───────────── Tab: Dati ───────────── */

function TabDati({ policy }: { policy: Policy }) {
  const casaPacchetto =
    policy.tipo_codice === 'casa' && policy.dati_specifici && typeof policy.dati_specifici === 'object'
      ? (policy.dati_specifici as Record<string, unknown>).pacchetto_casa
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
    policy.tipo_codice === 'casa' && policy.dati_specifici && typeof policy.dati_specifici === 'object'
      ? (policy.dati_specifici as Record<string, unknown>).casa_preventivo
      : null;
  const isCasaPersonalizzato = Boolean(
    policy.tipo_codice === 'casa'
    && casaPreventivoRaw
    && typeof casaPreventivoRaw === 'object'
    && (casaPreventivoRaw as { personalizzato?: unknown }).personalizzato === true,
  );

  const incaricatoDisplay = policy.operatore_id
    ? `${[policy.operatore_nome, policy.operatore_cognome].filter(Boolean).join(' ')} (Operatore)`
    : policy.fornitore_id
      ? `${[policy.fornitore_nome, policy.fornitore_cognome].filter(Boolean).join(' ')} (Fornitore)`
      : '';

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DetailSectionCard title="Assistito">
        <CompactInfoGrid columns="two">
          <DetailField
            label="Nome e cognome"
            value={`${policy.assistito_nome || ''} ${policy.assistito_cognome || ''}`.trim()}
          />
          <DetailField label="Codice fiscale" value={policy.assistito_cf} mono />
          <DetailField label="Data di nascita" value={formatDate(policy.assistito_data_nascita)} />
          <DetailField label="Cellulare" value={policy.assistito_cellulare} />
          <DetailField label="Email" value={policy.assistito_email} />
          <DetailField label="Città" value={policy.assistito_citta} />
          <DetailField label="Indirizzo" value={policy.assistito_indirizzo} />
          <DetailField label="CAP" value={policy.assistito_cap} />
        </CompactInfoGrid>
      </DetailSectionCard>

      <DetailSectionCard title="Dettagli polizza">
        <CompactInfoGrid columns="two">
          <DetailField label="Numero" value={policy.numero} mono />
          <DetailField label="Tipologia" value={policy.tipo_nome} />
          <DetailField label="Struttura" value={policy.struttura_nome} />
          <DetailField label="Incaricato" value={incaricatoDisplay || undefined} />
          <DetailField label="Stato" value={policy.stato} />
          <DetailField label="Data creazione" value={formatDateTime(policy.created_at)} />
          <DetailField label="Ultimo aggiornamento" value={formatDateTime(policy.updated_at)} />
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
            <PolicyCasaPacchettoPdfDownload packageId={casaPacchettoObj.id} nomePacchetto={casaPacchettoObj.nome} />
          </div>
        </DetailSectionCard>
      )}

      <DetailSectionCard title="Note" className="lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/40 px-3 py-2.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Note della struttura</h4>
            {policy.note_struttura?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-gray-800">{policy.note_struttura}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-400">—</p>
            )}
          </div>
          <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/40 px-3 py-2.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Note interne</h4>
            {policy.note_interne?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-gray-800">{policy.note_interne}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-400">—</p>
            )}
          </div>
        </div>
      </DetailSectionCard>

      {policy.dati_specifici && Object.keys(policy.dati_specifici).length > 0 && (
        <DetailSectionCard title="Dati specifici" className="lg:col-span-2">
          <CompactInfoGrid columns="responsive-3">
            {Object.entries(policy.dati_specifici)
              .filter(
                ([key]) =>
                  !String(key).startsWith('_') && key !== 'pacchetto_casa' && key !== 'casa_preventivo',
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

function PolicyCasaPacchettoPdfDownload({ packageId, nomePacchetto }: { packageId: string; nomePacchetto?: string }) {
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
  canUpload: boolean;
  policyStato: string;
  attachments: Attachment[];
  uploadFile: File | null;
  setUploadFile: (f: File | null) => void;
  uploadTipo: string;
  setUploadTipo: (t: string) => void;
  uploading: boolean;
  uploadError: string | null;
  onUpload: () => void;
}

function TabAllegati({
  canUpload,
  policyStato,
  attachments,
  uploadFile,
  setUploadFile,
  uploadTipo,
  setUploadTipo,
  uploading,
  uploadError,
  onUpload,
}: TabAllegatiProps) {
  const showPolizzaTipo = policyStato === 'IN EMISSIONE' || policyStato === 'EMESSA';

  return (
    <div className="space-y-4">
      {canUpload ? (
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
                <option value="ricevuta_pagamento">Ricevuta di pagamento</option>
                {showPolizzaTipo ? <option value="polizza_emessa">Polizza emessa (file finale)</option> : null}
                <option value="altro">Altro</option>
              </select>
            </div>
            <button
              type="button"
              onClick={onUpload}
              disabled={!uploadFile || uploading || (uploadTipo === 'polizza_emessa' && policyStato !== 'IN EMISSIONE')}
              className="btn-primary shrink-0"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Caricamento…' : 'Carica'}
            </button>
          </div>
          {uploadTipo === 'polizza_emessa' && policyStato !== 'IN EMISSIONE' ? (
            <p className="mt-2 text-sm text-amber-800">Il file finale si allega quando la polizza è in stato «In emissione» (anche dal menu Azioni nell&apos;elenco).</p>
          ) : null}
          {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
        </div>
      ) : (
        <div className="card p-4 text-sm leading-snug text-gray-600">
          Gli allegati vengono gestiti dalla struttura in fase di richiesta o dall&apos;incaricato (operatore o fornitore) in gestione pratica. Puoi scaricare i documenti disponibili dalla tabella sotto.
        </div>
      )}

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
                      <StatusBadge stato={h.stato_precedente} type="policy" />
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    </>
                  )}
                  <StatusBadge stato={h.stato_nuovo} type="policy" />
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
