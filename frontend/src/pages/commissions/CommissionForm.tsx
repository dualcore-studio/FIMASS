import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { Commission, StructureOption } from '../../types';
import {
  commissionPercentForType,
  formatEuro,
  getCommissionTypeBadgeClass,
  getCommissionTypeLabel,
} from '../../utils/helpers';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function CommissionForm() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const editId = params.id ? Number(params.id) : NaN;
  const isCreate = !Number.isFinite(editId);

  const [structures, setStructures] = useState<StructureOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isCreate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [structureId, setStructureId] = useState('');
  const [collaboratorName, setCollaboratorName] = useState('');
  const [portal, setPortal] = useState('');
  const [company, setCompany] = useState('');
  const [policyPremium, setPolicyPremium] = useState('');
  const [brokerCommission, setBrokerCommission] = useState('');
  const [clientInvoice, setClientInvoice] = useState('');
  const [sportelloAmico, setSportelloAmico] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<StructureOption[]>('/users/structures')
      .then((rows) => {
        if (!cancelled) setStructures(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof ApiError ? e.message : 'Impossibile caricare le strutture.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isCreate) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const row = await api.get<Commission>(`/commissions/${editId}`);
        if (cancelled) return;
        setDate(String(row.date).slice(0, 10));
        setCustomerName(row.customer_name);
        setPolicyNumber(row.policy_number);
        setStructureId(String(row.structure_id));
        setCollaboratorName(row.collaborator_name ?? '');
        setPortal(row.portal ?? '');
        setCompany(row.company ?? '');
        setPolicyPremium(row.policy_premium != null ? String(row.policy_premium) : '');
        setBrokerCommission(row.broker_commission != null ? String(row.broker_commission) : '');
        setClientInvoice(row.client_invoice != null ? String(row.client_invoice) : '');
        setSportelloAmico(String(row.sportello_amico_commission));
        setNotes(row.notes ?? '');
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof ApiError ? e.message : 'Impossibile caricare la provvigione.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, isCreate]);

  const selectedStructure = structures.find((s) => s.id === Number(structureId));
  const previewType = selectedStructure?.commission_type ?? 'SEGNALATORE';
  const previewPct = commissionPercentForType(previewType);
  const saNum = Number(String(sportelloAmico).replace(',', '.'));
  const previewAmount = Number.isFinite(saNum) ? roundMoney(saNum * (previewPct / 100)) : 0;

  const validate = (): boolean => {
    const fe: Record<string, string> = {};
    if (!customerName.trim()) fe.customerName = 'Obbligatorio.';
    if (!policyNumber.trim()) fe.policyNumber = 'Obbligatorio.';
    if (!structureId || !Number.isFinite(Number(structureId))) fe.structureId = 'Obbligatorio.';
    const sa = Number(String(sportelloAmico).replace(',', '.'));
    if (!Number.isFinite(sa)) fe.sportelloAmico = 'Importo obbligatorio e valido.';
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) {
      setError('Correggi i campi evidenziati.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const body: Record<string, unknown> = {
      date,
      customer_name: customerName.trim(),
      policy_number: policyNumber.trim(),
      structure_id: Number(structureId),
      collaborator_name: collaboratorName.trim() || null,
      portal: portal.trim() || null,
      company: company.trim() || null,
      policy_premium: policyPremium.trim() === '' ? null : Number(String(policyPremium).replace(',', '.')),
      broker_commission: brokerCommission.trim() === '' ? null : Number(String(brokerCommission).replace(',', '.')),
      client_invoice: clientInvoice.trim() === '' ? null : Number(String(clientInvoice).replace(',', '.')),
      sportello_amico_commission: Number(String(sportelloAmico).replace(',', '.')),
      notes: notes.trim() || null,
    };

    setSubmitting(true);
    setError(null);
    try {
      if (isCreate) {
        await api.post<Commission>('/commissions', body);
      } else {
        await api.put<Commission>(`/commissions/${editId}`, body);
      }
      navigate('/provvigioni');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError && !isCreate && !loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <button type="button" onClick={() => navigate('/provvigioni')} className="btn-secondary -ml-1 py-1.5 pl-2 pr-3 text-sm">
          <ArrowLeft className="h-4 w-4" />
          Torna alle provvigioni
        </button>
        <div className="card border-l-4 border-l-red-500 p-6">
          <p className="text-sm font-medium text-red-800">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!isCreate && loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          <p className="text-sm text-gray-500">Caricamento…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <button type="button" onClick={() => navigate('/provvigioni')} className="btn-secondary -ml-1 py-1.5 pl-2 pr-3 text-sm">
        <ArrowLeft className="h-4 w-4" />
        Torna alle provvigioni
      </button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {isCreate ? 'Nuova provvigione' : 'Modifica provvigione'}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {isCreate
            ? 'Inserisci i dati economici della polizza; la quota struttura si calcola in automatico.'
            : 'Aggiorna i dati; la quota struttura si ricalcola se cambiano struttura o provvigione Sportello Amico.'}
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loadError && isCreate ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Data <span className="text-red-500">*</span>
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Struttura <span className="text-red-500">*</span>
            </label>
            <select
              value={structureId}
              onChange={(e) => setStructureId(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Seleziona…</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.denominazione || `Struttura #${s.id}`}
                </option>
              ))}
            </select>
            {fieldErrors.structureId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.structureId}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nome cliente <span className="text-red-500">*</span>
            </label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-field" />
            {fieldErrors.customerName ? <p className="mt-1 text-xs text-red-600">{fieldErrors.customerName}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Numero polizza <span className="text-red-500">*</span>
            </label>
            <input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} className="input-field" />
            {fieldErrors.policyNumber ? <p className="mt-1 text-xs text-red-600">{fieldErrors.policyNumber}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Collaboratore</label>
            <input value={collaboratorName} onChange={(e) => setCollaboratorName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Portale</label>
            <input value={portal} onChange={(e) => setPortal(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Compagnia</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="input-field" />
          </div>
        </div>

        <div className="grid gap-4 border-t border-gray-100 pt-6 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Premio polizza (€)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={policyPremium}
              onChange={(e) => setPolicyPremium(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Provvigione broker (€)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={brokerCommission}
              onChange={(e) => setBrokerCommission(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fattura cliente (€)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={clientInvoice}
              onChange={(e) => setClientInvoice(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Provvigioni Sportello Amico (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={sportelloAmico}
              onChange={(e) => setSportelloAmico(e.target.value)}
              className="input-field"
            />
            {fieldErrors.sportelloAmico ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.sportelloAmico}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 sm:grid sm:grid-cols-2 sm:gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo struttura (automatico)</p>
            {structureId ? (
              <span className={`badge ${getCommissionTypeBadgeClass(previewType)}`}>
                {getCommissionTypeLabel(previewType)}
              </span>
            ) : (
              <p className="text-sm text-gray-500">Seleziona una struttura</p>
            )}
          </div>
          <div className="mt-4 space-y-2 sm:mt-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Percentuale e provvigione struttura</p>
            <p className="text-lg font-semibold text-gray-900">{previewPct}%</p>
            <p className="text-sm text-gray-700">
              Provvigione struttura: <span className="font-semibold">{formatEuro(previewAmount)}</span>
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Note</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field min-h-[96px]" rows={4} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-6">
          <button type="button" onClick={() => navigate('/provvigioni')} className="btn-secondary">
            Annulla
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Salvataggio…' : isCreate ? 'Crea provvigione' : 'Salva modifiche'}
          </button>
        </div>
      </form>
    </div>
  );
}
