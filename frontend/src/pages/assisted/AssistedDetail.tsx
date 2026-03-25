import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Download,
  UserCheck,
  FileText,
  Shield,
  Paperclip,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { AssistedPerson, Quote, Policy, Attachment } from '../../types';
import { formatDate, formatDateTime, formatFileSize } from '../../utils/helpers';
import StatusBadge from '../../components/common/StatusBadge';

type Tab = 'preventivi' | 'polizze' | 'allegati';

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: 'preventivi', label: 'Preventivi', icon: FileText },
  { key: 'polizze', label: 'Polizze', icon: Shield },
  { key: 'allegati', label: 'Allegati', icon: Paperclip },
];

interface AssistedDetailData extends AssistedPerson {
  quotes: Quote[];
  policies: Policy[];
  attachments: Attachment[];
}

export default function AssistedDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [person, setPerson] = useState<AssistedDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('preventivi');

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: '',
    cognome: '',
    data_nascita: '',
    codice_fiscale: '',
    cellulare: '',
    email: '',
    indirizzo: '',
    cap: '',
    citta: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchPerson = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<AssistedDetailData>(`/assisted/${id}`);
      setPerson(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare i dati dell\'assistito.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPerson();
  }, [fetchPerson]);

  const startEditing = () => {
    if (!person) return;
    setEditForm({
      nome: person.nome || '',
      cognome: person.cognome || '',
      data_nascita: person.data_nascita || '',
      codice_fiscale: person.codice_fiscale || '',
      cellulare: person.cellulare || '',
      email: person.email || '',
      indirizzo: person.indirizzo || '',
      cap: person.cap || '',
      citta: person.citta || '',
    });
    setEditError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await api.put(`/assisted/${id}`, editForm);
      setEditing(false);
      await fetchPerson();
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : 'Impossibile aggiornare i dati.');
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          <p className="text-sm text-gray-500">Caricamento dati assistito…</p>
        </div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/assistiti')} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Torna agli assistiti
        </button>
        <div className="card p-8 text-center text-red-700">{error || 'Assistito non trovato.'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/assistiti')} className="mt-1 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {person.nome} {person.cognome}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {person.codice_fiscale && <span className="font-mono text-xs text-gray-600">{person.codice_fiscale}</span>}
            </p>
          </div>
        </div>
        {!editing && (
          <button onClick={startEditing} className="btn-secondary shrink-0 self-start">
            <Pencil className="h-4 w-4" />
            Modifica
          </button>
        )}
      </div>

      {/* Personal data card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            <UserCheck className="mr-2 inline h-4 w-4" />
            Dati Personali
          </h3>
        </div>

        {editing ? (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="edit-nome" className="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
                <input id="edit-nome" type="text" required value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} className="input-field" />
              </div>
              <div>
                <label htmlFor="edit-cognome" className="mb-1 block text-sm font-medium text-gray-700">Cognome *</label>
                <input id="edit-cognome" type="text" required value={editForm.cognome} onChange={(e) => setEditForm({ ...editForm, cognome: e.target.value })} className="input-field" />
              </div>
              <div>
                <label htmlFor="edit-data-nascita" className="mb-1 block text-sm font-medium text-gray-700">Data di Nascita</label>
                <input id="edit-data-nascita" type="date" value={editForm.data_nascita} onChange={(e) => setEditForm({ ...editForm, data_nascita: e.target.value })} className="input-field" />
              </div>
              <div>
                <label htmlFor="edit-cf" className="mb-1 block text-sm font-medium text-gray-700">Codice Fiscale</label>
                <input id="edit-cf" type="text" value={editForm.codice_fiscale} onChange={(e) => setEditForm({ ...editForm, codice_fiscale: e.target.value.toUpperCase() })} className="input-field font-mono" maxLength={16} />
              </div>
              <div>
                <label htmlFor="edit-cellulare" className="mb-1 block text-sm font-medium text-gray-700">Cellulare</label>
                <input id="edit-cellulare" type="tel" value={editForm.cellulare} onChange={(e) => setEditForm({ ...editForm, cellulare: e.target.value })} className="input-field" />
              </div>
              <div>
                <label htmlFor="edit-email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input-field" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="edit-indirizzo" className="mb-1 block text-sm font-medium text-gray-700">Indirizzo</label>
                <input id="edit-indirizzo" type="text" value={editForm.indirizzo} onChange={(e) => setEditForm({ ...editForm, indirizzo: e.target.value })} className="input-field" />
              </div>
              <div>
                <label htmlFor="edit-cap" className="mb-1 block text-sm font-medium text-gray-700">CAP</label>
                <input id="edit-cap" type="text" value={editForm.cap} onChange={(e) => setEditForm({ ...editForm, cap: e.target.value })} className="input-field" maxLength={5} />
              </div>
              <div>
                <label htmlFor="edit-citta" className="mb-1 block text-sm font-medium text-gray-700">Città</label>
                <input id="edit-citta" type="text" value={editForm.citta} onChange={(e) => setEditForm({ ...editForm, citta: e.target.value })} className="input-field" />
              </div>
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <div className="flex items-center gap-2 pt-2">
              <button type="submit" disabled={editSubmitting} className="btn-primary">
                <Save className="h-4 w-4" />
                {editSubmitting ? 'Salvataggio…' : 'Salva'}
              </button>
              <button type="button" onClick={cancelEditing} className="btn-secondary">
                <X className="h-4 w-4" />
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <InfoRow label="Nome" value={person.nome} />
            <InfoRow label="Cognome" value={person.cognome} />
            <InfoRow label="Data di Nascita" value={formatDate(person.data_nascita)} />
            <InfoRow label="Codice Fiscale" value={person.codice_fiscale} mono />
            <InfoRow label="Cellulare" value={person.cellulare} />
            <InfoRow label="Email" value={person.email} />
            <InfoRow label="Indirizzo" value={person.indirizzo} />
            <InfoRow label="CAP" value={person.cap} />
            <InfoRow label="Città" value={person.citta} />
          </dl>
        )}
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
        {activeTab === 'preventivi' && <TabPreventivi quotes={person.quotes || []} />}
        {activeTab === 'polizze' && <TabPolizze policies={person.policies || []} />}
        {activeTab === 'allegati' && <TabAllegati attachments={person.attachments || []} />}
      </div>
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

/* ───────────── Tab: Preventivi ───────────── */

function TabPreventivi({ quotes }: { quotes: Quote[] }) {
  if (quotes.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">Nessun preventivo collegato.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Numero</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Tipologia</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Stato</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Data</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {quotes.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <Link to={`/preventivi/${q.id}`} className="font-medium text-blue-700 hover:text-blue-800 hover:underline">
                    {q.numero}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{q.tipo_nome || '-'}</td>
                <td className="px-4 py-3"><StatusBadge stato={q.stato} /></td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDate(q.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/preventivi/${q.id}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    Apri
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────── Tab: Polizze ───────────── */

function TabPolizze({ policies }: { policies: Policy[] }) {
  if (policies.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <Shield className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">Nessuna polizza collegata.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Numero</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Tipologia</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Stato</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Data</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {policies.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <Link to={`/polizze/${p.id}`} className="font-medium text-blue-700 hover:text-blue-800 hover:underline">
                    {p.numero}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.tipo_nome || '-'}</td>
                <td className="px-4 py-3"><StatusBadge stato={p.stato} type="policy" /></td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDate(p.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/polizze/${p.id}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    Apri
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────── Tab: Allegati ───────────── */

function TabAllegati({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <Paperclip className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">Nessun allegato presente.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Nome file</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Tipo</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Dimensione</th>
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
    </div>
  );
}
