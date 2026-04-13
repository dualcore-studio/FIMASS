import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Shield,
  User,
  Settings2,
  Paperclip,
  ClipboardCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { InsuranceType, FormField, ChecklistItem, AssistedPerson } from '../../types';
import { formatDate } from '../../utils/helpers';
import {
  activeCampiForFlow,
  activeChecklistForFlow,
  mandatoryChecklistMissing,
} from '../../utils/insuranceTypeConfig';

const STEPS = [
  { label: 'Tipologia', icon: Shield },
  { label: 'Assistito', icon: User },
  { label: 'Dati Specifici', icon: Settings2 },
  { label: 'Allegati', icon: Paperclip },
  { label: 'Riepilogo', icon: ClipboardCheck },
];

interface AssistedForm {
  nome: string;
  cognome: string;
  data_nascita: string;
  codice_fiscale: string;
  cellulare: string;
  email: string;
  indirizzo: string;
  cap: string;
  citta: string;
}

const emptyAssisted: AssistedForm = {
  nome: '',
  cognome: '',
  data_nascita: '',
  codice_fiscale: '',
  cellulare: '',
  email: '',
  indirizzo: '',
  cap: '',
  citta: '',
};

export default function QuoteCreate() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<InsuranceType | null>(null);

  // Step 2
  const [assisted, setAssisted] = useState<AssistedForm>({ ...emptyAssisted });
  const [existingAssisted, setExistingAssisted] = useState(false);
  const [cfChecking, setCfChecking] = useState(false);
  const [dataDecorrenza, setDataDecorrenza] = useState('');
  const [noteStruttura, setNoteStruttura] = useState('');

  // Step 3
  const [datiSpecifici, setDatiSpecifici] = useState<Record<string, any>>({});

  // Step 4
  const [attachmentFiles, setAttachmentFiles] = useState<Record<string, File | null>>({});

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step validation errors
  const [stepErrors, setStepErrors] = useState<string[]>([]);

  useEffect(() => {
    setTypesLoading(true);
    setTypesError(null);
    api.get<InsuranceType[]>('/settings/insurance-types/active')
      .then(setInsuranceTypes)
      .catch((e) => {
        setInsuranceTypes([]);
        setTypesError(e instanceof ApiError ? e.message : 'Impossibile caricare le tipologie assicurative.');
      })
      .finally(() => setTypesLoading(false));
  }, []);

  const handleCfBlur = async () => {
    const cf = assisted.codice_fiscale.trim().toUpperCase();
    if (cf.length < 11) return;
    setCfChecking(true);
    setExistingAssisted(false);
    try {
      const person = await api.get<AssistedPerson>(`/assisted/search/cf/${encodeURIComponent(cf)}`);
      if (person) {
        setAssisted({
          nome: person.nome || '',
          cognome: person.cognome || '',
          data_nascita: person.data_nascita ? person.data_nascita.slice(0, 10) : '',
          codice_fiscale: person.codice_fiscale || cf,
          cellulare: person.cellulare || '',
          email: person.email || '',
          indirizzo: person.indirizzo || '',
          cap: person.cap || '',
          citta: person.citta || '',
        });
        setExistingAssisted(true);
      }
    } catch {
      // Not found — that's fine
    } finally {
      setCfChecking(false);
    }
  };

  const updateAssisted = (field: keyof AssistedForm, value: string) => {
    setAssisted((prev) => ({ ...prev, [field]: value }));
    if (field === 'codice_fiscale') setExistingAssisted(false);
  };

  const updateDatiSpecifici = (nome: string, value: any) => {
    setDatiSpecifici((prev) => ({ ...prev, [nome]: value }));
  };

  const validateStep = (s: number): string[] => {
    const errors: string[] = [];
    if (s === 0 && !selectedType) {
      errors.push('Seleziona una tipologia assicurativa.');
    }
    if (s === 1) {
      if (!assisted.nome.trim()) errors.push('Il nome è obbligatorio.');
      if (!assisted.cognome.trim()) errors.push('Il cognome è obbligatorio.');
      if (!assisted.data_nascita) errors.push('La data di nascita è obbligatoria.');
      if (!assisted.codice_fiscale.trim()) errors.push('Il codice fiscale è obbligatorio.');
      if (!assisted.cellulare.trim()) errors.push('Il cellulare è obbligatorio.');
    }
    if (s === 2 && selectedType) {
      for (const field of activeCampiForFlow(selectedType.campi_specifici)) {
        if (field.obbligatorio) {
          const val = datiSpecifici[field.nome];
          if (val === undefined || val === null || val === '') {
            errors.push(`Il campo "${field.label}" è obbligatorio.`);
          }
        }
      }
    }
    if (s === 3 && selectedType) {
      errors.push(
        ...mandatoryChecklistMissing(
          selectedType.checklist_allegati,
          attachmentFiles,
          datiSpecifici,
        ),
      );
    }
    return errors;
  };

  const goNext = () => {
    const errors = validateStep(step);
    if (errors.length > 0) {
      setStepErrors(errors);
      return;
    }
    setStepErrors([]);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goPrev = () => {
    setStepErrors([]);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    if (!selectedType) return;
    setSubmitError(null);
    const allegatiErr = mandatoryChecklistMissing(
      selectedType.checklist_allegati,
      attachmentFiles,
      datiSpecifici,
    );
    if (allegatiErr.length) {
      setSubmitError(allegatiErr[0]);
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        tipo_assicurazione_id: selectedType.id,
        assistito: {
          nome: assisted.nome.trim(),
          cognome: assisted.cognome.trim(),
          data_nascita: assisted.data_nascita,
          codice_fiscale: assisted.codice_fiscale.trim().toUpperCase(),
          cellulare: assisted.cellulare.trim(),
          email: assisted.email.trim() || null,
          indirizzo: assisted.indirizzo.trim() || null,
          cap: assisted.cap.trim() || null,
          citta: assisted.citta.trim() || null,
        },
        dati_specifici: datiSpecifici,
        data_decorrenza: dataDecorrenza || null,
        note_struttura: noteStruttura.trim() || null,
      };

      const result = await api.post<{ id: number }>('/quotes', body);
      const newId = result.id;

      // Upload attachments
      const filesToUpload = Object.entries(attachmentFiles).filter(([, f]) => f != null);
      for (const [tipo, file] of filesToUpload) {
        if (!file) continue;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entity_type', 'quote');
        formData.append('entity_id', String(newId));
        formData.append('tipo', tipo);
        await api.upload('/attachments/upload', formData);
      }

      navigate(`/preventivi/${newId}`);
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : 'Errore durante la creazione del preventivo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <header className="flex items-start gap-4">
        <button onClick={() => navigate('/preventivi')} className="mt-1 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Nuova Richiesta Preventivo</h1>
          <p className="mt-1 text-sm text-gray-600">Compila tutti i passaggi per inviare la richiesta.</p>
        </div>
      </header>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const completed = i < step;
            const active = i === step;
            return (
              <div key={i} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      completed
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : active
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : 'border-gray-300 bg-white text-gray-400'
                    }`}
                  >
                    {completed ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs font-medium ${active ? 'text-blue-700' : completed ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-2 h-0.5 flex-1 rounded ${i < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Errors */}
      {stepErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <ul className="text-sm text-red-700 space-y-0.5">
              {stepErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="card p-6">
        {step === 0 && (
          <Step1Types
            types={insuranceTypes}
            loading={typesLoading}
            error={typesError}
            selected={selectedType}
            onSelect={(t) => { setSelectedType(t); setDatiSpecifici({}); setAttachmentFiles({}); setStepErrors([]); setStep(1); }}
          />
        )}
        {step === 1 && (
          <Step2Assisted
            assisted={assisted}
            existingAssisted={existingAssisted}
            cfChecking={cfChecking}
            dataDecorrenza={dataDecorrenza}
            noteStruttura={noteStruttura}
            onUpdate={updateAssisted}
            onCfBlur={handleCfBlur}
            onDataDecorrenzaChange={setDataDecorrenza}
            onNoteStrutturaChange={setNoteStruttura}
          />
        )}
        {step === 2 && selectedType && (
          <Step3DatiSpecifici
            fields={activeCampiForFlow(selectedType.campi_specifici)}
            values={datiSpecifici}
            onChange={updateDatiSpecifici}
          />
        )}
        {step === 3 && selectedType && (
          <Step4Attachments
            checklist={activeChecklistForFlow(selectedType.checklist_allegati, datiSpecifici)}
            files={attachmentFiles}
            onChange={(nome, file) => setAttachmentFiles((prev) => ({ ...prev, [nome]: file }))}
          />
        )}
        {step === 4 && selectedType && (
          <Step5Review
            selectedType={selectedType}
            assisted={assisted}
            dataDecorrenza={dataDecorrenza}
            noteStruttura={noteStruttura}
            datiSpecifici={datiSpecifici}
            attachmentFiles={attachmentFiles}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 0}
          className="btn-secondary disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Indietro
        </button>

        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} className="btn-primary">
            Avanti
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-success">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Invio in corso…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Conferma e Invia
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── Step 1: Insurance Type ───────────── */

function Step1Types({
  types,
  loading,
  error,
  selected,
  onSelect,
}: {
  types: InsuranceType[];
  loading: boolean;
  error: string | null;
  selected: InsuranceType | null;
  onSelect: (t: InsuranceType) => void;
}) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="py-8 text-center text-sm text-red-600">{error}</p>;
  }

  if (types.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">Nessuna tipologia assicurativa disponibile.</p>;
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Seleziona la tipologia assicurativa</h2>
      <p className="mb-6 text-sm text-gray-500">Scegli il tipo di copertura per cui richiedere un preventivo.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => {
          const isSelected = selected?.id === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className={`group rounded-xl border-2 p-5 text-left transition-all hover:shadow-md ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                }`}>
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <span className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                    {t.nome}
                  </span>
                  {t.codice && (
                    <p className="mt-0.5 text-xs text-gray-500 font-mono">{t.codice}</p>
                  )}
                  {t.descrizione && (
                    <p className="mt-1 text-xs leading-snug text-gray-600">{t.descrizione}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── Step 2: Assisted Person ───────────── */

function Step2Assisted({
  assisted,
  existingAssisted,
  cfChecking,
  dataDecorrenza,
  noteStruttura,
  onUpdate,
  onCfBlur,
  onDataDecorrenzaChange,
  onNoteStrutturaChange,
}: {
  assisted: AssistedForm;
  existingAssisted: boolean;
  cfChecking: boolean;
  dataDecorrenza: string;
  noteStruttura: string;
  onUpdate: (field: keyof AssistedForm, value: string) => void;
  onCfBlur: () => void;
  onDataDecorrenzaChange: (v: string) => void;
  onNoteStrutturaChange: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Dati dell&apos;assistito</h2>
      <p className="mb-6 text-sm text-gray-500">
        Inserisci i dati anagrafici. Inizia dal codice fiscale per verificare se l&apos;assistito è già presente in archivio.
      </p>

      {existingAssisted && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          Assistito esistente trovato. I dati sono stati precompilati.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Codice Fiscale *</label>
          <div className="relative">
            <input
              type="text"
              value={assisted.codice_fiscale}
              onChange={(e) => onUpdate('codice_fiscale', e.target.value.toUpperCase())}
              onBlur={onCfBlur}
              className="input-field font-mono uppercase"
              placeholder="RSSMRA85M01H501Z"
              maxLength={16}
            />
            {cfChecking && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        </div>

        <FormInput label="Nome *" value={assisted.nome} onChange={(v) => onUpdate('nome', v)} />
        <FormInput label="Cognome *" value={assisted.cognome} onChange={(v) => onUpdate('cognome', v)} />
        <FormInput label="Data di Nascita *" type="date" value={assisted.data_nascita} onChange={(v) => onUpdate('data_nascita', v)} />
        <FormInput label="Cellulare *" type="tel" value={assisted.cellulare} onChange={(v) => onUpdate('cellulare', v)} placeholder="+39 333 1234567" />
        <FormInput label="Email" type="email" value={assisted.email} onChange={(v) => onUpdate('email', v)} placeholder="email@esempio.it" />
        <FormInput label="Indirizzo" value={assisted.indirizzo} onChange={(v) => onUpdate('indirizzo', v)} />
        <FormInput label="CAP" value={assisted.cap} onChange={(v) => onUpdate('cap', v)} maxLength={5} />
        <FormInput label="Città" value={assisted.citta} onChange={(v) => onUpdate('citta', v)} />

        <div className="sm:col-span-2 border-t pt-4 mt-2">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Informazioni aggiuntive</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput label="Data Decorrenza" type="date" value={dataDecorrenza} onChange={onDataDecorrenzaChange} />
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Note per la struttura</label>
              <textarea
                rows={3}
                value={noteStruttura}
                onChange={(e) => onNoteStrutturaChange(e.target.value)}
                className="input-field"
                placeholder="Eventuali note aggiuntive…"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </div>
  );
}

/* ───────────── Step 3: Dynamic Fields ───────────── */

function Step3DatiSpecifici({
  fields,
  values,
  onChange,
}: {
  fields: FormField[];
  values: Record<string, any>;
  onChange: (nome: string, value: any) => void;
}) {
  if (!fields || fields.length === 0) {
    return (
      <div>
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Dati Specifici</h2>
        <p className="py-8 text-center text-sm text-gray-500">
          Nessun dato specifico richiesto per questa tipologia.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Dati Specifici</h2>
      <p className="mb-6 text-sm text-gray-500">Compila i campi richiesti per la tipologia selezionata.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <DynamicField
            key={field.nome}
            field={field}
            value={values[field.nome]}
            onChange={(v) => onChange(field.nome, v)}
          />
        ))}
      </div>
    </div>
  );
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: any;
  onChange: (v: any) => void;
}) {
  const label = `${field.label}${field.obbligatorio ? ' *' : ''}`;

  switch (field.tipo) {
    case 'text':
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
            placeholder={field.placeholder || undefined}
          />
        </div>
      );
    case 'number':
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
            placeholder={field.placeholder || undefined}
          />
        </div>
      );
    case 'date':
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input-field" />
        </div>
      );
    case 'select':
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input-field">
            <option value="">Seleziona…</option>
            {field.opzioni?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    case 'boolean':
      return (
        <div className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            id={`field-${field.nome}`}
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor={`field-${field.nome}`} className="text-sm font-medium text-gray-700">{label}</label>
        </div>
      );
    case 'textarea':
      return (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <textarea
            rows={3}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
            placeholder={field.placeholder || undefined}
          />
        </div>
      );
    case 'radio':
      return (
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-gray-700">{label}</p>
          <div className="flex flex-wrap gap-4">
            {(field.opzioni ?? []).map((opt) => (
              <label key={opt} className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name={`field-${field.nome}`}
                  value={opt}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

/* ───────────── Step 4: Attachments ───────────── */

function Step4Attachments({
  checklist,
  files,
  onChange,
}: {
  checklist: ChecklistItem[];
  files: Record<string, File | null>;
  onChange: (nome: string, file: File | null) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Allegati</h2>
      <p className="mb-6 text-sm text-gray-500">
        Carica i documenti richiesti. I documenti obbligatori sono contrassegnati con *.
      </p>

      {(!checklist || checklist.length === 0) ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Nessun allegato richiesto per questa tipologia. Puoi procedere.
        </p>
      ) : (
        <div className="space-y-4">
          {checklist.map((item) => {
            const file = files[item.nome];
            return (
              <div key={item.nome} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      file ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {file ? <Check className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {item.nome.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        {item.obbligatorio && <span className="text-red-500"> *</span>}
                      </span>
                      {item.descrizione && (
                        <p className="mt-1 text-xs text-gray-600">{item.descrizione}</p>
                      )}
                      {file && (
                        <p className="mt-0.5 text-xs text-gray-500">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                      )}
                    </div>
                  </div>
                  <label className="btn-secondary cursor-pointer py-1.5 px-3 text-xs">
                    <Paperclip className="h-3.5 w-3.5" />
                    {file ? 'Sostituisci' : 'Scegli file'}
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(e) => onChange(item.nome, e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────── Step 5: Review ───────────── */

function Step5Review({
  selectedType,
  assisted,
  dataDecorrenza,
  noteStruttura,
  datiSpecifici,
  attachmentFiles,
}: {
  selectedType: InsuranceType;
  assisted: AssistedForm;
  dataDecorrenza: string;
  noteStruttura: string;
  datiSpecifici: Record<string, any>;
  attachmentFiles: Record<string, File | null>;
}) {
  const uploadCount = Object.values(attachmentFiles).filter(Boolean).length;

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Riepilogo</h2>
      <p className="mb-6 text-sm text-gray-500">Verifica tutti i dati prima di inviare la richiesta.</p>

      <div className="space-y-6">
        {/* Tipologia */}
        <ReviewSection title="Tipologia Assicurativa">
          <ReviewItem label="Tipo" value={selectedType.nome} />
          {selectedType.codice && <ReviewItem label="Codice" value={selectedType.codice} />}
        </ReviewSection>

        {/* Assistito */}
        <ReviewSection title="Dati Assistito">
          <ReviewItem label="Nome e Cognome" value={`${assisted.nome} ${assisted.cognome}`} />
          <ReviewItem label="Codice Fiscale" value={assisted.codice_fiscale} />
          <ReviewItem label="Data di Nascita" value={formatDate(assisted.data_nascita)} />
          <ReviewItem label="Cellulare" value={assisted.cellulare} />
          {assisted.email && <ReviewItem label="Email" value={assisted.email} />}
          {assisted.indirizzo && <ReviewItem label="Indirizzo" value={assisted.indirizzo} />}
          {assisted.cap && <ReviewItem label="CAP" value={assisted.cap} />}
          {assisted.citta && <ReviewItem label="Città" value={assisted.citta} />}
        </ReviewSection>

        {/* Info aggiuntive */}
        <ReviewSection title="Informazioni Aggiuntive">
          <ReviewItem label="Data Decorrenza" value={dataDecorrenza ? formatDate(dataDecorrenza) : '-'} />
          <ReviewItem label="Note" value={noteStruttura || '-'} />
        </ReviewSection>

        {/* Dati specifici */}
        {Object.keys(datiSpecifici).length > 0 && (
          <ReviewSection title="Dati Specifici">
            {Object.entries(datiSpecifici).map(([key, val]) => {
              const field = selectedType.campi_specifici.find((f) => f.nome === key);
              return (
                <ReviewItem
                  key={key}
                  label={field?.label || key}
                  value={typeof val === 'boolean' ? (val ? 'Sì' : 'No') : String(val || '-')}
                />
              );
            })}
          </ReviewSection>
        )}

        {/* Allegati */}
        <ReviewSection title="Allegati">
          {uploadCount === 0 ? (
            <p className="text-sm text-gray-500">Nessun allegato caricato.</p>
          ) : (
            Object.entries(attachmentFiles)
              .filter(([, f]) => f != null)
              .map(([nome, file]) => (
                <ReviewItem
                  key={nome}
                  label={nome.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  value={file!.name}
                />
              ))
          )}
        </ReviewSection>
      </div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      <dl className="grid gap-2 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || '-'}</dd>
    </div>
  );
}
