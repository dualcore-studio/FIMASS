import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Shield,
  ListChecks,
  FileText,
  ToggleLeft,
  ToggleRight,
  Plus,
  Pencil,
  Trash2,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { ChecklistItem, FormField, InsuranceType } from '../../types';
import TablePagination from '../../components/common/TablePagination';
import SortableTh from '../../components/common/SortableTh';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { useSyncPageToTotalPages } from '../../hooks/useSyncPageToTotalPages';
import { useListTableSort } from '../../hooks/useListTableSort';
import {
  compareBooleans,
  compareNullableStrings,
  compareNumbers,
  compareStringsCaseInsensitive,
  sortDirectionMultiplier,
} from '../../utils/clientTableSort';
import { isFormFieldActive, isChecklistItemActive, sortByOrdine } from '../../utils/insuranceTypeConfig';

type SettingsTab = 'generali' | 'tipologie' | 'campi' | 'checklist';

const TABS: { key: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
  { key: 'generali', label: 'Generali', icon: SlidersHorizontal },
  { key: 'tipologie', label: 'Tipologie Assicurazione', icon: Shield },
  { key: 'campi', label: 'Campi Form', icon: FileText },
  { key: 'checklist', label: 'Checklist Allegati', icon: ListChecks },
];

const FORM_TYPES: FormField['tipo'][] = [
  'text', 'number', 'date', 'select', 'boolean', 'textarea', 'radio', 'multiselect', 'heading', 'info',
];

function typePayload(t: InsuranceType) {
  return {
    nome: t.nome,
    codice: t.codice,
    stato: t.stato,
    ordine: t.ordine,
    descrizione: t.descrizione ?? null,
    campi_specifici: t.campi_specifici,
    checklist_allegati: t.checklist_allegati,
  };
}

function normalizeInsuranceTipoOrdine(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Chiudi"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-gray-100 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('generali');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Impostazioni</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Configurazione amministrativa: tipologie assicurative, moduli e allegati richiesti nei flussi del portale.
        </p>
      </header>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
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

      <div>
        {activeTab === 'generali' && <TabGenerali />}
        {activeTab === 'tipologie' && <TabTipologie />}
        {activeTab === 'campi' && <TabCampiForm />}
        {activeTab === 'checklist' && <TabChecklist />}
      </div>
    </div>
  );
}

/* ───────────── Tab: Generali ───────────── */

function TabGenerali() {
  const [nomePortale, setNomePortale] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<Record<string, string>>('/settings/general')
      .then((data) => setNomePortale(data.nome_portale || ''))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await api.put('/settings/general', { settings: { nome_portale: nomePortale } });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossibile salvare le impostazioni.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="card p-6 max-w-2xl">
      <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Impostazioni generali
      </h3>
      <div className="space-y-5">
        <div>
          <label htmlFor="nome_portale" className="mb-1 block text-sm font-medium text-gray-700">
            Nome portale
          </label>
          <input
            id="nome_portale"
            type="text"
            value={nomePortale}
            onChange={(e) => setNomePortale(e.target.value)}
            className="input-field"
            placeholder="Fimass Sportello Amico"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Impostazioni salvate con successo.</p>}

        <div className="pt-2">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            <Save className="h-4 w-4" />
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Tab: Tipologie ───────────── */

function TabTipologie() {
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<InsuranceType | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formCodice, setFormCodice] = useState('');
  const [formDescr, setFormDescr] = useState('');
  const [formOrdine, setFormOrdine] = useState(0);
  const [formStato, setFormStato] = useState<'attivo' | 'disattivo'>('attivo');
  const [savingModal, setSavingModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<InsuranceType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { sortBy, sortDir, requestSort } = useListTableSort();
  const handleTipologieSort = useCallback(
    (key: string) => {
      requestSort(key);
      setPage(1);
    },
    [requestSort],
  );

  const fetchTypes = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<InsuranceType[]>('/settings/insurance-types');
      setTypes(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare le tipologie.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const openCreate = () => {
    setFormNome('');
    setFormCodice('');
    setFormDescr('');
    setFormOrdine(types.length ? Math.max(...types.map((t) => t.ordine ?? 0)) + 1 : 1);
    setFormStato('attivo');
    setEditing(null);
    setModal('create');
  };

  const openEdit = (t: InsuranceType) => {
    setEditing(t);
    setFormNome(t.nome);
    setFormCodice(t.codice);
    setFormDescr(t.descrizione || '');
    setFormOrdine(t.ordine ?? 0);
    setFormStato(t.stato === 'disattivo' ? 'disattivo' : 'attivo');
    setModal('edit');
  };

  const saveModal = async () => {
    const nom = formNome.trim();
    const cod = formCodice.trim().toLowerCase().replace(/\s+/g, '_');
    if (!nom || !cod) {
      setError('Nome e codice sono obbligatori.');
      return;
    }
    const ordVal = normalizeInsuranceTipoOrdine(formOrdine);
    const dupOrd = types.some((x) => {
      if (modal === 'edit' && editing && x.id === editing.id) return false;
      return normalizeInsuranceTipoOrdine(x.ordine) === ordVal;
    });
    if (dupOrd) {
      setError('Questo numero d\'ordine è già assegnato a un\'altra tipologia.');
      return;
    }
    setSavingModal(true);
    setError(null);
    try {
      if (modal === 'create') {
        await api.post('/settings/insurance-types', {
          nome: nom,
          codice: cod,
          stato: formStato,
          ordine: formOrdine,
          descrizione: formDescr.trim() || null,
          campi_specifici: [],
          checklist_allegati: [],
        });
      } else if (editing) {
        await api.put(`/settings/insurance-types/${editing.id}`, {
          ...typePayload(editing),
          nome: nom,
          codice: cod,
          stato: formStato,
          ordine: formOrdine,
          descrizione: formDescr.trim() || null,
        });
      }
      setModal(null);
      await fetchTypes();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSavingModal(false);
    }
  };

  const handleToggle = async (t: InsuranceType) => {
    setTogglingId(t.id);
    setError(null);
    try {
      await api.put(`/settings/insurance-types/${t.id}`, {
        ...typePayload(t),
        stato: t.stato === 'attivo' ? 'disattivo' : 'attivo',
      });
      await fetchTypes();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/settings/insurance-types/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      await fetchTypes();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Eliminazione non riuscita.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [types]);

  const sortedTypes = useMemo(() => {
    const arr = [...types];
    if (!sortBy) return arr;
    const m = sortDirectionMultiplier(sortDir);
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'nome':
          return compareStringsCaseInsensitive(a.nome, b.nome, m);
        case 'codice':
          return compareStringsCaseInsensitive(a.codice, b.codice, m);
        case 'stato':
          return compareStringsCaseInsensitive(a.stato, b.stato, m);
        case 'ordine':
          return compareNumbers(a.ordine ?? 0, b.ordine ?? 0, m);
        default:
          return 0;
      }
    });
    return arr;
  }, [types, sortBy, sortDir]);

  const tipologieTotalPages = sortedTypes.length === 0 ? 1 : Math.ceil(sortedTypes.length / TABLE_PAGE_SIZE);
  useSyncPageToTotalPages(page, sortedTypes.length ? tipologieTotalPages : undefined, setPage);

  const typesPage = useMemo(() => {
    const start = (page - 1) * TABLE_PAGE_SIZE;
    return sortedTypes.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedTypes, page]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Le tipologie disattivate non compaiono nelle nuove richieste ma restano visibili sulle pratiche già create.
        </p>
        <button type="button" onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Nuova tipologia
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="portal-table min-w-full text-left text-sm">
            <thead>
              <tr>
                <SortableTh sortKey="nome" activeKey={sortBy} direction={sortDir} onRequestSort={handleTipologieSort}>
                  Nome
                </SortableTh>
                <SortableTh sortKey="codice" activeKey={sortBy} direction={sortDir} onRequestSort={handleTipologieSort}>
                  Codice
                </SortableTh>
                <th className="px-4 py-3 font-semibold text-gray-700">Descrizione</th>
                <SortableTh sortKey="stato" activeKey={sortBy} direction={sortDir} onRequestSort={handleTipologieSort}>
                  Stato
                </SortableTh>
                <SortableTh
                  sortKey="ordine"
                  activeKey={sortBy}
                  direction={sortDir}
                  onRequestSort={handleTipologieSort}
                  align="center"
                >
                  Ordine
                </SortableTh>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    Nessuna tipologia configurata.
                  </td>
                </tr>
              ) : (
                typesPage.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{t.nome}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.codice}</td>
                    <td className="max-w-xs px-4 py-3 text-gray-600">
                      {t.descrizione ? (
                        <span className="line-clamp-2">{t.descrizione}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-gray-700">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${t.stato === 'attivo' ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        />
                        {t.stato === 'attivo' ? 'Attivo' : 'Disattivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{t.ordine}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggle(t)}
                          disabled={togglingId === t.id}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-40"
                        >
                          {t.stato === 'attivo' ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                          {t.stato === 'attivo' ? 'Disattiva' : 'Attiva'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(t)}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedTypes.length > 0 && (
          <TablePagination
            page={page}
            totalPages={tipologieTotalPages}
            total={sortedTypes.length}
            onPageChange={setPage}
            entityLabel="tipologie"
          />
        )}
      </div>

      {modal && (
        <Modal
          title={modal === 'create' ? 'Nuova tipologia' : 'Modifica tipologia'}
          onClose={() => !savingModal && setModal(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={savingModal} onClick={() => setModal(null)}>
                Annulla
              </button>
              <button type="button" className="btn-primary" disabled={savingModal} onClick={saveModal}>
                {savingModal ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
              <input className="input-field" value={formNome} onChange={(e) => setFormNome(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Codice *</label>
              <input
                className="input-field font-mono text-sm"
                value={formCodice}
                onChange={(e) => setFormCodice(e.target.value)}
                placeholder="es. rc_auto"
              />
              <p className="mt-1 text-xs text-gray-500">Identificativo univoco (usato anche per le abilitazioni struttura).</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Descrizione breve</label>
              <textarea
                className="input-field"
                rows={3}
                value={formDescr}
                onChange={(e) => setFormDescr(e.target.value)}
                placeholder="Testo mostrato in fase di scelta tipologia…"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ordine</label>
                <input
                  type="number"
                  className="input-field"
                  value={formOrdine}
                  onChange={(e) => setFormOrdine(Number(e.target.value))}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Ordine di visualizzazione univoco (non ripetibile tra tipologie diverse).
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Stato</label>
                <select
                  className="input-field"
                  value={formStato}
                  onChange={(e) => setFormStato(e.target.value as 'attivo' | 'disattivo')}
                >
                  <option value="attivo">Attivo</option>
                  <option value="disattivo">Disattivo</option>
                </select>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal
          title="Elimina tipologia"
          onClose={() => !deleting && setDeleteConfirm(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={deleting} onClick={() => setDeleteConfirm(null)}>
                Annulla
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? 'Eliminazione…' : 'Elimina'}
              </button>
            </div>
          }
        >
          <p className="text-sm text-gray-700">
            Eliminare definitivamente <strong>{deleteConfirm.nome}</strong>? Operazione consentita solo se non esistono
            preventivi o polizze collegati a questa tipologia.
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ───────────── Tab: Campi Form ───────────── */

function emptyFormField(): FormField {
  return {
    nome: '',
    label: '',
    tipo: 'text',
    obbligatorio: false,
    opzioni: [],
    placeholder: '',
    ordine: 0,
    stato: 'attivo',
  };
}

function TabCampiForm() {
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCampi, setPageCampi] = useState(1);
  const [modalIdx, setModalIdx] = useState<number | 'new' | null>(null);
  const [fieldDraft, setFieldDraft] = useState<FormField>(emptyFormField());
  const [opzioniText, setOpzioniText] = useState('');
  const [saving, setSaving] = useState(false);

  const { sortBy, sortDir, requestSort } = useListTableSort();
  const handleCampiSort = useCallback(
    (key: string) => {
      requestSort(key);
      setPageCampi(1);
    },
    [requestSort],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<InsuranceType[]>('/settings/insurance-types');
      setTypes(data);
      setSelectedTypeId((prev) => {
        if (prev != null && data.some((t) => t.id === prev)) return prev;
        return data.length ? data[0].id : null;
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare i dati.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedType = types.find((t) => t.id === selectedTypeId);

  const sortedCampi = useMemo(() => {
    const campi = sortByOrdine(selectedType?.campi_specifici ?? []);
    const arr = [...campi];
    if (!sortBy) return arr;
    const m = sortDirectionMultiplier(sortDir);
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'nome':
          return compareStringsCaseInsensitive(a.nome, b.nome, m);
        case 'label':
          return compareStringsCaseInsensitive(a.label, b.label, m);
        case 'tipo':
          return compareStringsCaseInsensitive(a.tipo, b.tipo, m);
        case 'obbligatorio':
          return compareBooleans(a.obbligatorio, b.obbligatorio, m);
        case 'ordine':
          return compareNumbers(a.ordine ?? 0, b.ordine ?? 0, m);
        case 'stato':
          return compareStringsCaseInsensitive(a.stato ?? 'attivo', b.stato ?? 'attivo', m);
        default:
          return 0;
      }
    });
    return arr;
  }, [selectedType, sortBy, sortDir]);

  const campiTotalPages =
    sortedCampi.length === 0 ? 1 : Math.ceil(sortedCampi.length / TABLE_PAGE_SIZE);
  useSyncPageToTotalPages(pageCampi, sortedCampi.length ? campiTotalPages : undefined, setPageCampi);

  const campiPage = useMemo(() => {
    const start = (pageCampi - 1) * TABLE_PAGE_SIZE;
    return sortedCampi.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedCampi, pageCampi]);

  const persistCampi = async (nextCampi: FormField[]) => {
    if (!selectedType) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/settings/insurance-types/${selectedType.id}`, {
        ...typePayload(selectedType),
        campi_specifici: nextCampi,
      });
      await load();
      setModalIdx(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  const openNewField = () => {
    const nextOrd = selectedType?.campi_specifici.length
      ? Math.max(...selectedType.campi_specifici.map((c) => c.ordine ?? 0)) + 1
      : 0;
    setFieldDraft({ ...emptyFormField(), ordine: nextOrd });
    setOpzioniText('');
    setModalIdx('new');
  };

  const openEditField = (idxGlobal: number) => {
    const campi = sortByOrdine(selectedType?.campi_specifici ?? []);
    const f = campi[idxGlobal];
    if (!f) return;
    setFieldDraft({ ...f, opzioni: f.opzioni ? [...f.opzioni] : [] });
    setOpzioniText((f.opzioni ?? []).join('\n'));
    setModalIdx(idxGlobal);
  };

  const saveField = () => {
    if (!selectedType) return;
    const nomeKey = fieldDraft.nome.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (!nomeKey || !fieldDraft.label.trim()) {
      setError('Nome campo (tecnico) ed etichetta sono obbligatori.');
      return;
    }
    const opzioni =
      fieldDraft.tipo === 'select' || fieldDraft.tipo === 'radio'
        ? opzioniText
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const next: FormField = {
      ...fieldDraft,
      nome: nomeKey,
      label: fieldDraft.label.trim(),
      ordine: Number(fieldDraft.ordine) || 0,
      stato: fieldDraft.stato === 'disattivo' ? 'disattivo' : 'attivo',
      opzioni: opzioni.length ? opzioni : undefined,
      placeholder: fieldDraft.placeholder?.trim() || undefined,
    };

    const listBase = sortByOrdine([...selectedType.campi_specifici]);
    if (modalIdx === 'new') {
      persistCampi([...listBase, next]);
    } else if (typeof modalIdx === 'number') {
      const campiSorted = sortByOrdine([...selectedType.campi_specifici]);
      const f = campiSorted[modalIdx];
      if (!f) return;
      const replaced = campiSorted.map((c) => (c.nome === f.nome ? next : c));
      persistCampi(replaced);
    }
  };

  const removeField = (nome: string) => {
    if (!selectedType) return;
    if (!window.confirm('Rimuovere questo campo dalla configurazione? I dati già salvati nei preventivi restano in archivio.')) return;
    persistCampi(selectedType.campi_specifici.filter((c) => c.nome !== nome));
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="max-w-sm">
        <label htmlFor="select-tipo-campi" className="mb-1 block text-sm font-medium text-gray-700">
          Tipologia
        </label>
        <select
          id="select-tipo-campi"
          value={selectedTypeId ?? ''}
          onChange={(e) => {
            setSelectedTypeId(Number(e.target.value));
            setPageCampi(1);
          }}
          className="input-field"
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      {selectedType && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            I campi disattivati non compaiono nei nuovi preventivi; i valori già inviati restano consultabili sulle pratiche.
          </p>
          <button type="button" className="btn-primary" onClick={openNewField}>
            <Plus className="h-4 w-4" />
            Aggiungi campo
          </button>
        </div>
      )}

      {selectedType && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <SortableTh sortKey="ordine" activeKey={sortBy} direction={sortDir} onRequestSort={handleCampiSort} align="center">
                    Ord.
                  </SortableTh>
                  <SortableTh sortKey="nome" activeKey={sortBy} direction={sortDir} onRequestSort={handleCampiSort}>
                    Nome
                  </SortableTh>
                  <SortableTh sortKey="label" activeKey={sortBy} direction={sortDir} onRequestSort={handleCampiSort}>
                    Etichetta
                  </SortableTh>
                  <SortableTh sortKey="tipo" activeKey={sortBy} direction={sortDir} onRequestSort={handleCampiSort}>
                    Tipo
                  </SortableTh>
                  <SortableTh
                    sortKey="obbligatorio"
                    activeKey={sortBy}
                    direction={sortDir}
                    onRequestSort={handleCampiSort}
                    align="center"
                  >
                    Obbl.
                  </SortableTh>
                  <SortableTh sortKey="stato" activeKey={sortBy} direction={sortDir} onRequestSort={handleCampiSort}>
                    Stato
                  </SortableTh>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {sortedCampi.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      Nessun campo configurato. Aggiungi il primo campo per questa tipologia.
                    </td>
                  </tr>
                ) : (
                  campiPage.map((campo) => {
                    const idxGlobal = sortByOrdine(selectedType.campi_specifici).findIndex((c) => c.nome === campo.nome);
                    return (
                      <tr key={campo.nome}>
                        <td className="px-4 py-3 text-center text-gray-600">{campo.ordine ?? 0}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{campo.nome}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{campo.label}</td>
                        <td className="px-4 py-3">
                          <span className="badge bg-gray-100 text-gray-700">{campo.tipo}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {campo.obbligatorio ? (
                            <span className="font-medium text-emerald-600">Sì</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isFormFieldActive(campo) ? (
                            <span className="text-emerald-700">Attivo</span>
                          ) : (
                            <span className="text-gray-500">Disattivo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
                              onClick={() => openEditField(idxGlobal)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-red-100 p-1.5 text-red-600 hover:bg-red-50"
                              onClick={() => removeField(campo.nome)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {sortedCampi.length > 0 && (
            <TablePagination
              page={pageCampi}
              totalPages={campiTotalPages}
              total={sortedCampi.length}
              onPageChange={setPageCampi}
              entityLabel="campi"
            />
          )}
        </div>
      )}

      {modalIdx !== null && selectedType && (
        <Modal
          title={modalIdx === 'new' ? 'Nuovo campo' : 'Modifica campo'}
          onClose={() => !saving && setModalIdx(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setModalIdx(null)}>
                Annulla
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={saveField}>
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nome tecnico *</label>
              <input
                className="input-field font-mono text-sm"
                value={fieldDraft.nome}
                onChange={(e) => setFieldDraft((d) => ({ ...d, nome: e.target.value }))}
                placeholder="es. targa"
                disabled={modalIdx !== 'new'}
              />
              {modalIdx !== 'new' && (
                <p className="mt-1 text-xs text-gray-500">Il nome tecnico non è modificabile per non invalidare i dati già salvati.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Etichetta *</label>
              <input
                className="input-field"
                value={fieldDraft.label}
                onChange={(e) => setFieldDraft((d) => ({ ...d, label: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
                <select
                  className="input-field"
                  value={fieldDraft.tipo}
                  onChange={(e) => setFieldDraft((d) => ({ ...d, tipo: e.target.value as FormField['tipo'] }))}
                >
                  {FORM_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {ft}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ordine</label>
                <input
                  type="number"
                  className="input-field"
                  value={fieldDraft.ordine ?? 0}
                  onChange={(e) => setFieldDraft((d) => ({ ...d, ordine: Number(e.target.value) }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={fieldDraft.obbligatorio}
                onChange={(e) => setFieldDraft((d) => ({ ...d, obbligatorio: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              Obbligatorio
            </label>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Placeholder</label>
              <input
                className="input-field"
                value={fieldDraft.placeholder || ''}
                onChange={(e) => setFieldDraft((d) => ({ ...d, placeholder: e.target.value }))}
              />
            </div>
            {(fieldDraft.tipo === 'select' || fieldDraft.tipo === 'radio') && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Opzioni (una per riga)</label>
                <textarea
                  className="input-field font-mono text-sm"
                  rows={4}
                  value={opzioniText}
                  onChange={(e) => setOpzioniText(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Stato</label>
              <select
                className="input-field"
                value={fieldDraft.stato === 'disattivo' ? 'disattivo' : 'attivo'}
                onChange={(e) =>
                  setFieldDraft((d) => ({ ...d, stato: e.target.value === 'disattivo' ? 'disattivo' : 'attivo' }))
                }
              >
                <option value="attivo">Attivo</option>
                <option value="disattivo">Disattivo</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ───────────── Tab: Checklist ───────────── */

function emptyChecklistItem(): ChecklistItem {
  return {
    nome: '',
    obbligatorio: false,
    descrizione: '',
    condizione: '',
    ordine: 0,
    stato: 'attivo',
  };
}

function TabChecklist() {
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageChecklist, setPageChecklist] = useState(1);
  const [modalIdx, setModalIdx] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<ChecklistItem>(emptyChecklistItem());
  const [saving, setSaving] = useState(false);

  const { sortBy, sortDir, requestSort } = useListTableSort();
  const handleChecklistSort = useCallback(
    (key: string) => {
      requestSort(key);
      setPageChecklist(1);
    },
    [requestSort],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<InsuranceType[]>('/settings/insurance-types');
      setTypes(data);
      setSelectedTypeId((prev) => {
        if (prev != null && data.some((t) => t.id === prev)) return prev;
        return data.length ? data[0].id : null;
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossibile caricare i dati.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedType = types.find((t) => t.id === selectedTypeId);

  const sortedItems = useMemo(() => {
    const checklistItems = sortByOrdine(selectedType?.checklist_allegati ?? []);
    const arr = [...checklistItems];
    if (!sortBy) return arr;
    const m = sortDirectionMultiplier(sortDir);
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'nome':
          return compareStringsCaseInsensitive(a.nome, b.nome, m);
        case 'obbligatorio':
          return compareBooleans(a.obbligatorio, b.obbligatorio, m);
        case 'ordine':
          return compareNumbers(a.ordine ?? 0, b.ordine ?? 0, m);
        case 'condizione':
          return compareNullableStrings(a.condizione, b.condizione, m);
        case 'stato':
          return compareStringsCaseInsensitive(a.stato ?? 'attivo', b.stato ?? 'attivo', m);
        default:
          return 0;
      }
    });
    return arr;
  }, [selectedType, sortBy, sortDir]);

  const checklistTotalPages =
    sortedItems.length === 0 ? 1 : Math.ceil(sortedItems.length / TABLE_PAGE_SIZE);

  useSyncPageToTotalPages(
    pageChecklist,
    sortedItems.length ? checklistTotalPages : undefined,
    setPageChecklist,
  );

  const checklistPage = useMemo(() => {
    const start = (pageChecklist - 1) * TABLE_PAGE_SIZE;
    return sortedItems.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedItems, pageChecklist]);

  const persistChecklist = async (next: ChecklistItem[]) => {
    if (!selectedType) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/settings/insurance-types/${selectedType.id}`, {
        ...typePayload(selectedType),
        checklist_allegati: next,
      });
      await load();
      setModalIdx(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    const nextOrd = selectedType?.checklist_allegati.length
      ? Math.max(...selectedType.checklist_allegati.map((c) => c.ordine ?? 0)) + 1
      : 0;
    setDraft({ ...emptyChecklistItem(), ordine: nextOrd });
    setModalIdx('new');
  };

  const openEdit = (idxGlobal: number) => {
    const arr = sortByOrdine(selectedType?.checklist_allegati ?? []);
    const row = arr[idxGlobal];
    if (!row) return;
    setDraft({
      ...row,
      descrizione: row.descrizione || '',
      condizione: row.condizione || '',
    });
    setModalIdx(idxGlobal);
  };

  const saveDraft = () => {
    if (!selectedType) return;
    const nome = draft.nome.trim();
    if (!nome) {
      setError("Il nome dell'allegato è obbligatorio.");
      return;
    }
    const item: ChecklistItem = {
      nome,
      obbligatorio: draft.obbligatorio,
      ordine: Number(draft.ordine) || 0,
      stato: draft.stato === 'disattivo' ? 'disattivo' : 'attivo',
    };
    const d = draft.descrizione?.trim();
    if (d) item.descrizione = d;
    const c = draft.condizione?.trim();
    if (c) item.condizione = c;

    const base = sortByOrdine([...selectedType.checklist_allegati]);
    if (modalIdx === 'new') {
      persistChecklist([...base, item]);
    } else if (typeof modalIdx === 'number') {
      const row = base[modalIdx];
      if (!row) return;
      const replaced = base.map((x) => (x.nome === row.nome ? item : x));
      persistChecklist(replaced);
    }
  };

  const removeRow = (nome: string) => {
    if (!selectedType) return;
    if (!window.confirm('Rimuovere questa voce dalla checklist?')) return;
    persistChecklist(selectedType.checklist_allegati.filter((x) => x.nome !== nome));
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="max-w-sm">
        <label htmlFor="select-tipo-checklist" className="mb-1 block text-sm font-medium text-gray-700">
          Tipologia
        </label>
        <select
          id="select-tipo-checklist"
          value={selectedTypeId ?? ''}
          onChange={(e) => {
            setSelectedTypeId(Number(e.target.value));
            setPageChecklist(1);
          }}
          className="input-field"
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      {selectedType && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Il nome voce viene usato come tipo file in archivio. Condizione opzionale: formato{' '}
            <code className="rounded bg-gray-100 px-1">campo=valore</code> sui dati specifici (es. tipo_inquilino=Società).
          </p>
          <button type="button" className="btn-primary" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Aggiungi allegato
          </button>
        </div>
      )}

      {selectedType && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <SortableTh sortKey="ordine" activeKey={sortBy} direction={sortDir} onRequestSort={handleChecklistSort} align="center">
                    Ord.
                  </SortableTh>
                  <SortableTh sortKey="nome" activeKey={sortBy} direction={sortDir} onRequestSort={handleChecklistSort}>
                    Nome
                  </SortableTh>
                  <th className="px-4 py-3 font-semibold text-gray-700">Descrizione</th>
                  <SortableTh
                    sortKey="obbligatorio"
                    activeKey={sortBy}
                    direction={sortDir}
                    onRequestSort={handleChecklistSort}
                    align="center"
                  >
                    Obbl.
                  </SortableTh>
                  <SortableTh sortKey="condizione" activeKey={sortBy} direction={sortDir} onRequestSort={handleChecklistSort}>
                    Condizione
                  </SortableTh>
                  <SortableTh sortKey="stato" activeKey={sortBy} direction={sortDir} onRequestSort={handleChecklistSort}>
                    Stato
                  </SortableTh>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      Nessun allegato configurato. Aggiungi voci per richiederli in fase di preventivo.
                    </td>
                  </tr>
                ) : (
                  checklistPage.map((item) => {
                    const idxGlobal = sortByOrdine(selectedType.checklist_allegati).findIndex((x) => x.nome === item.nome);
                    return (
                      <tr key={item.nome}>
                        <td className="px-4 py-3 text-center text-gray-600">{item.ordine ?? 0}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.nome}</td>
                        <td className="max-w-xs px-4 py-3 text-gray-600">
                          {item.descrizione ? <span className="line-clamp-2">{item.descrizione}</span> : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.obbligatorio ? (
                            <span className="font-medium text-emerald-600">Sì</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{item.condizione || '—'}</td>
                        <td className="px-4 py-3">
                          {isChecklistItemActive(item) ? (
                            <span className="text-emerald-700">Attivo</span>
                          ) : (
                            <span className="text-gray-500">Disattivo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
                              onClick={() => openEdit(idxGlobal)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-red-100 p-1.5 text-red-600 hover:bg-red-50"
                              onClick={() => removeRow(item.nome)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {sortedItems.length > 0 && (
            <TablePagination
              page={pageChecklist}
              totalPages={checklistTotalPages}
              total={sortedItems.length}
              onPageChange={setPageChecklist}
              entityLabel="voci"
            />
          )}
        </div>
      )}

      {modalIdx !== null && selectedType && (
        <Modal
          title={modalIdx === 'new' ? 'Nuovo allegato richiesto' : 'Modifica allegato'}
          onClose={() => !saving && setModalIdx(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setModalIdx(null)}>
                Annulla
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={saveDraft}>
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nome allegato *</label>
              <input
                className="input-field"
                value={draft.nome}
                onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
                disabled={modalIdx !== 'new'}
              />
              {modalIdx !== 'new' && (
                <p className="mt-1 text-xs text-gray-500">Per rinominare un tipo file già in uso, crea una nuova voce e disattiva la vecchia.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Descrizione</label>
              <textarea
                className="input-field"
                rows={2}
                value={draft.descrizione || ''}
                onChange={(e) => setDraft((d) => ({ ...d, descrizione: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ordine</label>
                <input
                  type="number"
                  className="input-field"
                  value={draft.ordine ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, ordine: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Stato</label>
                <select
                  className="input-field"
                  value={draft.stato === 'disattivo' ? 'disattivo' : 'attivo'}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, stato: e.target.value === 'disattivo' ? 'disattivo' : 'attivo' }))
                  }
                >
                  <option value="attivo">Attivo</option>
                  <option value="disattivo">Disattivo</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={draft.obbligatorio}
                onChange={(e) => setDraft((d) => ({ ...d, obbligatorio: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              Obbligatorio
            </label>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Condizione (opzionale)</label>
              <input
                className="input-field font-mono text-sm"
                value={draft.condizione || ''}
                onChange={(e) => setDraft((d) => ({ ...d, condizione: e.target.value }))}
                placeholder="campo=valore"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
