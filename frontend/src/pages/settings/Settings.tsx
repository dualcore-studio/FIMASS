import { useCallback, useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Palette,
  Shield,
  ListChecks,
  FileText,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { InsuranceType } from '../../types';

type SettingsTab = 'generali' | 'tipologie' | 'campi' | 'checklist';

const TABS: { key: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
  { key: 'generali', label: 'Generali', icon: Palette },
  { key: 'tipologie', label: 'Tipologie Assicurazione', icon: Shield },
  { key: 'campi', label: 'Campi Form', icon: FileText },
  { key: 'checklist', label: 'Checklist Allegati', icon: ListChecks },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('generali');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Impostazioni</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Configurazione generale del portale Fimass Sportello Amico.
        </p>
      </header>

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
        {activeTab === 'generali' && <TabGenerali />}
        {activeTab === 'tipologie' && <TabTipologie />}
        {activeTab === 'campi' && <TabCampiForm />}
        {activeTab === 'checklist' && <TabChecklist />}
      </div>
    </div>
  );
}

/* ───────────── Tab: Generali ───────────── */

interface GeneralSettings {
  nome_portale: string;
  colore_primario: string;
  colore_secondario: string;
}

function TabGenerali() {
  const [settings, setSettings] = useState<GeneralSettings>({
    nome_portale: '',
    colore_primario: '#1d4ed8',
    colore_secondario: '#64748b',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<GeneralSettings>('/settings/general')
      .then((data) => setSettings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await api.put('/settings/general', { settings });
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
        Impostazioni Generali
      </h3>
      <div className="space-y-5">
        <div>
          <label htmlFor="nome_portale" className="mb-1 block text-sm font-medium text-gray-700">
            Nome Portale
          </label>
          <input
            id="nome_portale"
            type="text"
            value={settings.nome_portale}
            onChange={(e) => setSettings({ ...settings, nome_portale: e.target.value })}
            className="input-field"
            placeholder="Fimass Sportello Amico"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="colore_primario" className="mb-1 block text-sm font-medium text-gray-700">
              Colore Primario
            </label>
            <div className="flex items-center gap-3">
              <input
                id="colore_primario"
                type="color"
                value={settings.colore_primario}
                onChange={(e) => setSettings({ ...settings, colore_primario: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200"
              />
              <input
                type="text"
                value={settings.colore_primario}
                onChange={(e) => setSettings({ ...settings, colore_primario: e.target.value })}
                className="input-field flex-1 font-mono text-sm"
                maxLength={7}
              />
            </div>
          </div>
          <div>
            <label htmlFor="colore_secondario" className="mb-1 block text-sm font-medium text-gray-700">
              Colore Secondario
            </label>
            <div className="flex items-center gap-3">
              <input
                id="colore_secondario"
                type="color"
                value={settings.colore_secondario}
                onChange={(e) => setSettings({ ...settings, colore_secondario: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200"
              />
              <input
                type="text"
                value={settings.colore_secondario}
                onChange={(e) => setSettings({ ...settings, colore_secondario: e.target.value })}
                className="input-field flex-1 font-mono text-sm"
                maxLength={7}
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Impostazioni salvate con successo.</p>}

        <div className="pt-2">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            <Save className="h-4 w-4" />
            {saving ? 'Salvataggio…' : 'Salva Impostazioni'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Tab: Tipologie Assicurazione ───────────── */

function TabTipologie() {
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

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

  const handleToggle = async (id: number) => {
    setTogglingId(id);
    try {
      await api.put(`/settings/insurance-types/${id}/toggle`);
      await fetchTypes();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="card p-8 text-center text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="portal-table min-w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Nome</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Codice</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Stato</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center">Ordine</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {types.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  Nessuna tipologia configurata.
                </td>
              </tr>
            ) : (
              types.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{t.nome}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.codice}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-gray-700">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${t.stato === 'attivo' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      {t.stato === 'attivo' ? 'Attivo' : 'Disattivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{t.ordine}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggle(t.id)}
                      disabled={togglingId === t.id}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-40"
                      title={t.stato === 'attivo' ? 'Disattiva' : 'Attiva'}
                    >
                      {t.stato === 'attivo' ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      {t.stato === 'attivo' ? 'Disattiva' : 'Attiva'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────── Tab: Campi Form ───────────── */

function TabCampiForm() {
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<InsuranceType[]>('/settings/insurance-types')
      .then((data) => {
        setTypes(data);
        if (data.length > 0) setSelectedTypeId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedType = types.find((t) => t.id === selectedTypeId);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <label htmlFor="select-tipo-campi" className="mb-1 block text-sm font-medium text-gray-700">
          Seleziona Tipologia
        </label>
        <select
          id="select-tipo-campi"
          value={selectedTypeId ?? ''}
          onChange={(e) => setSelectedTypeId(Number(e.target.value))}
          className="input-field"
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
      </div>

      {selectedType && selectedType.campi_specifici.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Nome Campo</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Label</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Tipo</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center">Obbligatorio</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Opzioni</th>
                </tr>
              </thead>
              <tbody>
                {selectedType.campi_specifici.map((campo, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{campo.nome}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{campo.label}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-gray-100 text-gray-700">{campo.tipo}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {campo.obbligatorio ? (
                        <span className="text-emerald-600 font-medium">Sì</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {campo.opzioni?.join(', ') || <span className="text-gray-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card px-6 py-12 text-center text-sm text-gray-500">
          {selectedType ? 'Nessun campo specifico configurato per questa tipologia.' : 'Seleziona una tipologia.'}
        </div>
      )}
    </div>
  );
}

/* ───────────── Tab: Checklist Allegati ───────────── */

function TabChecklist() {
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<InsuranceType[]>('/settings/insurance-types')
      .then((data) => {
        setTypes(data);
        if (data.length > 0) setSelectedTypeId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedType = types.find((t) => t.id === selectedTypeId);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <label htmlFor="select-tipo-checklist" className="mb-1 block text-sm font-medium text-gray-700">
          Seleziona Tipologia
        </label>
        <select
          id="select-tipo-checklist"
          value={selectedTypeId ?? ''}
          onChange={(e) => setSelectedTypeId(Number(e.target.value))}
          className="input-field"
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
      </div>

      {selectedType && selectedType.checklist_allegati.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="portal-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Documento</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center">Obbligatorio</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Condizione</th>
                </tr>
              </thead>
              <tbody>
                {selectedType.checklist_allegati.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.nome}</td>
                    <td className="px-4 py-3 text-center">
                      {item.obbligatorio ? (
                        <span className="text-emerald-600 font-medium">Sì</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {item.condizione || <span className="text-gray-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card px-6 py-12 text-center text-sm text-gray-500">
          {selectedType ? 'Nessun elemento checklist configurato per questa tipologia.' : 'Seleziona una tipologia.'}
        </div>
      )}
    </div>
  );
}
