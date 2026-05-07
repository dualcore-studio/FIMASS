import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Car,
  Check,
  ClipboardCheck,
  Globe,
  HeartPulse,
  Home,
  House,
  Landmark,
  Loader2,
  Paperclip,
  PawPrint,
  Settings2,
  Shield,
  ShieldCheck,
  TrendingUp,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { InsuranceType, FormField, ChecklistItem, AssistedPerson, StructureOption } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { filterInsuranceTypesForStructure } from '../../utils/appointmentPresenzaSlots';
import { formatDate, formatUnknownValueForDisplay } from '../../utils/helpers';
import {
  activeCampiForFlow,
  activeChecklistForFlow,
  mandatoryChecklistMissing,
} from '../../utils/insuranceTypeConfig';
import { formatGaranzieRichiesteRcLine, isRcVeicoliTipo, RC_DATI_SPEC_KEYS_TO_HIDE } from '../../utils/rcAutoGaranzie';
import { PRIVACY_POLICY_VERSION } from '../../config/privacyConfig';
import CasaPolizzaPackageStep from '../../components/quotes/CasaPolizzaPackageStep';
import AffittoPolizzaIntroStep from '../../components/quotes/AffittoPolizzaIntroStep';
import SanitariaPolizzaPackageStep from '../../components/quotes/SanitariaPolizzaPackageStep';
import { formatPremioCasaIt, type CasaPackageDef } from '../../config/casaPolizzaPackages';
import { formatPremioStartingIt, type SanitariaPackageDef } from '../../config/sanitariaPolizzaPackages';
import {
  CASA_PREVENTIVO_FIRMATO_TIPO,
  filterCasaCampiForPackageSelected,
  labelForQuoteAttachmentTipo,
  omitCasaDatiAfterIndirizzoImmobile,
} from '../../config/casaQuoteFlow';
import { omitSanitariaEditableDati } from '../../config/sanitariaQuoteFlow';
import { getProdottoAffittoPayloadForQuote } from '../../config/affittoPolizzaProduct';

const FRAZIONAMENTO_OPTS = ['Mensile', 'Semestrale', 'Annuale'] as const;

const SENZA_DATA_DECORRENZA = new Set(['checkup', 'rc_prof', 'risparmio', 'tcm_mutuo']);
const NASCONDI_BLOCCO_INFO_ASSISTITO = new Set(['checkup', 'risparmio', 'tcm_mutuo']);
const CON_FRAZIONAMENTO_ASSISTITO = new Set(['animali', 'sanitaria', 'casa']);

const CLEAR_DATI_ON_PARENT: Record<string, string[]> = {
  categoria_lavorativa: ['lavoratore_dipendente', 'lavoratore_autonomo', 'altre_categorie'],
  mutuo: ['importo_mutuo', 'durata_mutuo'],
};

/** Icona per card tipologia (step 1) — mappata su `InsuranceType.codice`. */
const INSURANCE_TYPE_CARD_ICONS: Record<string, LucideIcon> = {
  checkup: ShieldCheck,
  scudo_amico: ShieldCheck,
  risparmio: TrendingUp,
  affitto: Home,
  casa: House,
  tcm_mutuo: Landmark,
  sanitaria: HeartPulse,
  animali: PawPrint,
  stranieri: Globe,
  rc_auto: Car,
  rc_prof: Briefcase,
};

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

/** Campi specifici per lo step Dati Specifici: con pacchetto Casa solo fino a indirizzo immobile; con pacchetto Sanitaria nessun campo (solo riepilogo pacchetto). */
function activeCampiSpecificiQuoteStep(
  tipo: InsuranceType | null,
  datiSpecifici: Record<string, unknown>,
  casaPackage: CasaPackageDef | null,
  sanitariaPackage: SanitariaPackageDef | null,
): FormField[] {
  if (!tipo) return [];
  const cod = String(tipo.codice || '').toLowerCase();
  const hasSelectedSanitariaPackage = cod === 'sanitaria' && sanitariaPackage != null;
  if (hasSelectedSanitariaPackage) return [];
  const base = activeCampiForFlow(tipo.campi_specifici, datiSpecifici);
  const hasSelectedCasaPackage = cod === 'casa' && casaPackage != null;
  if (!hasSelectedCasaPackage) return base;
  return filterCasaCampiForPackageSelected(base);
}

export default function QuoteCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const brokerCreazionePreventivo = user?.role === 'fornitore';
  const [step, setStep] = useState(0);

  const [structuresForQuote, setStructuresForQuote] = useState<StructureOption[]>([]);
  const [quoteStrutturaId, setQuoteStrutturaId] = useState('');

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
  const [frazionamento, setFrazionamento] = useState('');
  const [indirizzoStudioProfessionale, setIndirizzoStudioProfessionale] = useState('');

  // Step 3
  const [datiSpecifici, setDatiSpecifici] = useState<Record<string, unknown>>({});

  // Step 4
  const [noteStruttura, setNoteStruttura] = useState('');
  const [noteAllegati, setNoteAllegati] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<Record<string, File | null>>({});

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [privacyMandatory, setPrivacyMandatory] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Step validation errors
  const [stepErrors, setStepErrors] = useState<string[]>([]);

  /** Scelto nello step iniziale Polizza Casa (codice `casa`): abilita il flusso ridotto nei dati specifici. */
  const [casaPackage, setCasaPackage] = useState<CasaPackageDef | null>(null);
  const [sanitariaPackage, setSanitariaPackage] = useState<SanitariaPackageDef | null>(null);
  const hasSelectedCasaPackage =
    Boolean(selectedType && String(selectedType.codice || '').toLowerCase() === 'casa' && casaPackage);
  const hasSelectedSanitariaPackage = Boolean(
    selectedType && String(selectedType.codice || '').toLowerCase() === 'sanitaria' && sanitariaPackage,
  );

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

  useEffect(() => {
    if (!brokerCreazionePreventivo) return;
    api
      .get<StructureOption[]>('/users/structures')
      .then(setStructuresForQuote)
      .catch(() => setStructuresForQuote([]));
  }, [brokerCreazionePreventivo]);

  const selectedQuoteStructure =
    brokerCreazionePreventivo && quoteStrutturaId
      ? structuresForQuote.find((s) => String(s.id) === String(quoteStrutturaId))
      : null;

  const insuranceTypesForBroker = useMemo(() => {
    if (!brokerCreazionePreventivo) return insuranceTypes;
    if (!selectedQuoteStructure) return [];
    return filterInsuranceTypesForStructure(
      insuranceTypes,
      selectedQuoteStructure.enabled_types ?? null,
    ) as InsuranceType[];
  }, [brokerCreazionePreventivo, insuranceTypes, selectedQuoteStructure]);

  const typesForStep1 = brokerCreazionePreventivo ? insuranceTypesForBroker : insuranceTypes;

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

  const updateDatiSpecifici = (nome: string, value: unknown) => {
    setDatiSpecifici((prev) => {
      const next = { ...prev, [nome]: value };
      const toClear = CLEAR_DATI_ON_PARENT[nome];
      if (toClear) {
        for (const k of toClear) delete next[k];
      }
      return next;
    });
  };

  const validateStep = (s: number): string[] => {
    const errors: string[] = [];
    if (s === 0) {
      if (brokerCreazionePreventivo && !quoteStrutturaId) {
        errors.push('Selezionare la struttura di riferimento per cui si presenta la richiesta.');
      }
      if (!selectedType) {
        errors.push('Seleziona una tipologia assicurativa.');
      }
    }
    if (s === 1) {
      if (!assisted.nome.trim()) errors.push('Il nome è obbligatorio.');
      if (!assisted.cognome.trim()) errors.push('Il cognome è obbligatorio.');
      if (!assisted.data_nascita) errors.push('La data di nascita è obbligatoria.');
      if (!assisted.codice_fiscale.trim()) errors.push('Il codice fiscale è obbligatorio.');
      if (!assisted.cellulare.trim()) errors.push('Il cellulare è obbligatorio.');
      if (!assisted.email.trim()) errors.push('L\'email è obbligatoria.');
      if (!assisted.indirizzo.trim()) errors.push('L\'indirizzo di residenza è obbligatorio.');
      if (!assisted.cap.trim()) errors.push('Il CAP è obbligatorio.');
      else if (!/^\d{5}$/.test(assisted.cap.trim())) errors.push('Il CAP deve essere di 5 cifre.');
      if (!assisted.citta.trim()) errors.push('La città è obbligatoria.');
      const cod = selectedType ? String(selectedType.codice || '').toLowerCase() : '';
      if (CON_FRAZIONAMENTO_ASSISTITO.has(cod) && !frazionamento.trim()) {
        errors.push('Il frazionamento è obbligatorio.');
      }
      if (cod === 'rc_prof' && !indirizzoStudioProfessionale.trim()) {
        errors.push('L\'indirizzo dello studio professionale è obbligatorio.');
      }
    }
    if (s === 2 && selectedType) {
      for (const field of activeCampiSpecificiQuoteStep(
        selectedType,
        datiSpecifici,
        casaPackage,
        sanitariaPackage,
      )) {
        if (field.tipo === 'heading' || field.tipo === 'info') continue;
        if (field.obbligatorio) {
          const val = datiSpecifici[field.nome];
          if (field.tipo === 'multiselect') {
            if (!Array.isArray(val) || val.length === 0) {
              errors.push(`Il campo "${field.label}" è obbligatorio.`);
            }
          } else if (val === undefined || val === null || val === '') {
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
    if (s === 4 && !privacyMandatory) {
      errors.push(
        'È necessario prestare il consenso privacy obbligatorio per inviare il preventivo.',
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
    if (step === 0 && selectedType && String(selectedType.codice || '').toLowerCase() === 'affitto') {
      setDatiSpecifici((prev) => ({
        ...prev,
        prodotto_affitto: getProdottoAffittoPayloadForQuote(),
      }));
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goPrev = () => {
    setStepErrors([]);
    if (step === 0 && selectedType) {
      const t = String(selectedType.codice || '').toLowerCase();
      if (t === 'casa' || t === 'sanitaria' || t === 'affitto') {
        setSelectedType(null);
        setCasaPackage(null);
        setSanitariaPackage(null);
        return;
      }
    }
    setStep((s) => Math.max(s - 1, 0));
  };

  const goToStep = (target: number) => {
    if (target < 0 || target >= STEPS.length || target === step) return;
    if (target < step) {
      setStepErrors([]);
      setStep(target);
      return;
    }
    for (let s = step; s < target; s++) {
      const errors = validateStep(s);
      if (errors.length > 0) {
        setStepErrors(errors);
        setStep(s);
        return;
      }
    }
    setStepErrors([]);
    if (step === 0 && target > 0 && selectedType && String(selectedType.codice || '').toLowerCase() === 'affitto') {
      setDatiSpecifici((prev) => ({
        ...prev,
        prodotto_affitto: getProdottoAffittoPayloadForQuote(),
      }));
    }
    setStep(target);
  };

  const handleSubmit = async () => {
    if (!selectedType) return;
    setSubmitError(null);
    const preSubmitErrors = [0, 1, 2, 3, 4].flatMap((si) => validateStep(si));
    if (preSubmitErrors.length) {
      setSubmitError(preSubmitErrors[0]);
      return;
    }
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
      const cod = String(selectedType.codice || '').toLowerCase();
      let mergedDati: Record<string, unknown> = { ...datiSpecifici };
      if (CON_FRAZIONAMENTO_ASSISTITO.has(cod) && frazionamento.trim()) {
        mergedDati = { ...mergedDati, frazionamento: frazionamento.trim() };
      }
      if (cod === 'rc_prof' && indirizzoStudioProfessionale.trim()) {
        mergedDati = { ...mergedDati, indirizzo_studio_professionale: indirizzoStudioProfessionale.trim() };
      }
      if (cod === 'casa') {
        if (casaPackage) {
          mergedDati = omitCasaDatiAfterIndirizzoImmobile(mergedDati, selectedType.campi_specifici);
        }
        const { pacchetto_casa: _pc, casa_preventivo: _cp, ...restDati } = mergedDati;
        if (casaPackage) {
          mergedDati = { ...restDati, pacchetto_casa: { id: casaPackage.id } };
        } else {
          mergedDati = { ...restDati, casa_preventivo: { personalizzato: true } };
        }
      }
      if (cod === 'sanitaria') {
        let work = mergedDati;
        if (sanitariaPackage) {
          work = omitSanitariaEditableDati(work, selectedType.campi_specifici);
        }
        const { pacchetto_sanitaria: _ps, sanitaria_preventivo: _sprev, ...restSan } = work;
        if (sanitariaPackage) {
          mergedDati = {
            ...restSan,
            pacchetto_sanitaria: { codice: sanitariaPackage.codice },
          };
        } else {
          mergedDati = { ...restSan, sanitaria_preventivo: { personalizzato: true } };
        }
      }
      if (cod === 'affitto' && mergedDati.prodotto_affitto == null) {
        mergedDati = { ...mergedDati, prodotto_affitto: getProdottoAffittoPayloadForQuote() };
      }

      const body = {
        tipo_assicurazione_id: selectedType.id,
        assistito: {
          nome: assisted.nome.trim(),
          cognome: assisted.cognome.trim(),
          data_nascita: assisted.data_nascita,
          codice_fiscale: assisted.codice_fiscale.trim().toUpperCase(),
          cellulare: assisted.cellulare.trim(),
          email: assisted.email.trim(),
          indirizzo: assisted.indirizzo.trim(),
          cap: assisted.cap.trim(),
          citta: assisted.citta.trim(),
        },
        dati_specifici: mergedDati,
        data_decorrenza: dataDecorrenza || null,
        note_struttura: noteStruttura.trim() || null,
        note_allegati: noteAllegati.trim() || null,
        privacy_consent_accepted: true,
        marketing_consent: marketingOptIn,
        ...(brokerCreazionePreventivo ? { struttura_id: Number(quoteStrutturaId) } : {}),
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
          <p className="mt-2 text-xs text-gray-500">
            Trattamento dati:{' '}
            <Link to="/privacy" className="font-medium text-[#0B4EA2] underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
              Informativa Privacy
            </Link>{' '}
            (versione {PRIVACY_POLICY_VERSION}).
          </p>
        </div>
      </header>

      {/* Progress bar — step cliccabili (stessa validazione dei pulsanti Avanti) */}
      <div className="card overflow-x-auto p-4">
        <div className="flex min-w-[min(100%,520px)] items-center sm:min-w-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const completed = i < step;
            const active = i === step;
            return (
              <div key={i} className="flex min-w-0 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => goToStep(i)}
                  className={`group flex w-full flex-col items-center gap-1.5 rounded-lg px-0.5 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    active ? '' : 'hover:bg-gray-50/80'
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      completed
                        ? 'border-emerald-500 bg-emerald-500 text-white group-hover:border-emerald-600 group-hover:bg-emerald-600'
                        : active
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : 'border-gray-300 bg-white text-gray-400 group-hover:border-gray-400 group-hover:text-gray-500'
                    }`}
                  >
                    {completed ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span
                    className={`max-w-[5.5rem] text-center text-[11px] font-medium leading-tight sm:max-w-none sm:text-xs ${
                      active ? 'text-blue-700' : completed ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-1 h-0.5 min-w-[8px] flex-1 rounded sm:mx-2 ${i < step ? 'bg-emerald-400' : 'bg-gray-200'}`}
                    aria-hidden
                  />
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
        {step === 0
          && !(
            selectedType
            && ['casa', 'sanitaria', 'affitto'].includes(String(selectedType.codice || '').toLowerCase())
          ) && (
            <>
              {brokerCreazionePreventivo ? (
                <div className="mb-6 space-y-2">
                  <label htmlFor="quote-struttura-broker" className="block text-sm font-medium text-gray-700">
                    Struttura di riferimento *
                  </label>
                  <select
                    id="quote-struttura-broker"
                    className="input-field w-full max-w-md text-sm"
                    value={quoteStrutturaId}
                    onChange={(e) => {
                      setQuoteStrutturaId(e.target.value);
                      setSelectedType(null);
                      setDatiSpecifici({});
                      setAttachmentFiles({});
                      setStepErrors([]);
                    }}
                  >
                    <option value="">Seleziona struttura…</option>
                    {structuresForQuote.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {(s.denominazione || '').trim() || `#${s.id}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">La richiesta risulterà presentata dalla struttura selezionata.</p>
                </div>
              ) : null}
              <Step1Types
            types={typesForStep1}
            loading={typesLoading}
            error={typesError}
            selected={selectedType}
            onSelect={(t) => {
              setSelectedType(t);
              setDatiSpecifici({});
              setAttachmentFiles({});
              setDataDecorrenza('');
              setFrazionamento('');
              setIndirizzoStudioProfessionale('');
              setNoteStruttura('');
              setNoteAllegati('');
              setStepErrors([]);
              setCasaPackage(null);
              setSanitariaPackage(null);
              const cod = String(t.codice || '').toLowerCase();
              if (cod === 'casa' || cod === 'sanitaria' || cod === 'affitto') {
                setStep(0);
              } else {
                setStep(1);
              }
            }}
          />
            </>
          )}
        {step === 0 && selectedType && String(selectedType.codice || '').toLowerCase() === 'casa' && (
          <CasaPolizzaPackageStep
            committedPackageId={casaPackage?.id ?? null}
            onBackToTipologie={() => {
              setSelectedType(null);
              setCasaPackage(null);
              setStepErrors([]);
            }}
            onContinueWithPackage={(pkg) => {
              setCasaPackage(pkg);
              setDatiSpecifici((prev) =>
                selectedType
                  ? omitCasaDatiAfterIndirizzoImmobile(prev, selectedType.campi_specifici)
                  : prev,
              );
              setStepErrors([]);
              setStep(1);
            }}
            onContinuePersonalized={() => {
              setCasaPackage(null);
              setStepErrors([]);
              setStep(1);
            }}
          />
        )}
        {step === 0 && selectedType && String(selectedType.codice || '').toLowerCase() === 'sanitaria' && (
          <SanitariaPolizzaPackageStep
            committedPackageCodice={sanitariaPackage?.codice ?? null}
            onBackToTipologie={() => {
              setSelectedType(null);
              setSanitariaPackage(null);
              setStepErrors([]);
            }}
            onContinueWithPackage={(pkg) => {
              setSanitariaPackage(pkg);
              setDatiSpecifici((prev) =>
                selectedType
                  ? omitSanitariaEditableDati(prev, selectedType.campi_specifici)
                  : prev,
              );
              setStepErrors([]);
              setStep(1);
            }}
            onContinuePersonalized={() => {
              setSanitariaPackage(null);
              setStepErrors([]);
              setStep(1);
            }}
          />
        )}
        {step === 0 && selectedType && String(selectedType.codice || '').toLowerCase() === 'affitto' && (
          <AffittoPolizzaIntroStep
            onBackToTipologie={() => {
              setSelectedType(null);
              setStepErrors([]);
            }}
            onContinue={() => goNext()}
          />
        )}
        {step === 1 && selectedType && (
          <Step2Assisted
            tipoCodice={selectedType.codice}
            assisted={assisted}
            existingAssisted={existingAssisted}
            cfChecking={cfChecking}
            dataDecorrenza={dataDecorrenza}
            frazionamento={frazionamento}
            indirizzoStudioProfessionale={indirizzoStudioProfessionale}
            onUpdate={updateAssisted}
            onCfBlur={handleCfBlur}
            onDataDecorrenzaChange={setDataDecorrenza}
            onFrazionamentoChange={setFrazionamento}
            onIndirizzoStudioChange={setIndirizzoStudioProfessionale}
          />
        )}
        {step === 2 && selectedType && (
          <Step3DatiSpecifici
            tipoCodice={String(selectedType.codice || '').toLowerCase()}
            hasSelectedCasaPackage={hasSelectedCasaPackage}
            casaPackage={casaPackage}
            hasSelectedSanitariaPackage={hasSelectedSanitariaPackage}
            sanitariaPackage={sanitariaPackage}
            fields={activeCampiSpecificiQuoteStep(
              selectedType,
              datiSpecifici,
              casaPackage,
              sanitariaPackage,
            )}
            values={datiSpecifici}
            onChange={updateDatiSpecifici}
          />
        )}
        {step === 3 && selectedType && (
          <Step4Attachments
            tipoCodice={String(selectedType.codice || '').toLowerCase()}
            noteStruttura={noteStruttura}
            onNoteStrutturaChange={setNoteStruttura}
            noteAllegati={noteAllegati}
            onNoteAllegatiChange={setNoteAllegati}
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
            frazionamento={frazionamento}
            indirizzoStudioProfessionale={indirizzoStudioProfessionale}
            noteStruttura={noteStruttura}
            noteAllegati={noteAllegati}
            datiSpecifici={datiSpecifici}
            attachmentFiles={attachmentFiles}
            privacyMandatory={privacyMandatory}
            onPrivacyMandatoryChange={setPrivacyMandatory}
            marketingOptIn={marketingOptIn}
            onMarketingOptInChange={setMarketingOptIn}
            casaPackage={casaPackage}
            sanitariaPackage={sanitariaPackage}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={
            step === 0
            && !(
              selectedType
              && ['casa', 'sanitaria', 'affitto'].includes(String(selectedType.codice || '').toLowerCase())
            )
          }
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
          const TypeIcon = INSURANCE_TYPE_CARD_ICONS[t.codice] ?? Shield;
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
                  <TypeIcon size={20} />
                </div>
                <div>
                  <span className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                    {t.nome}
                  </span>
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
  tipoCodice,
  assisted,
  existingAssisted,
  cfChecking,
  dataDecorrenza,
  frazionamento,
  indirizzoStudioProfessionale,
  onUpdate,
  onCfBlur,
  onDataDecorrenzaChange,
  onFrazionamentoChange,
  onIndirizzoStudioChange,
}: {
  tipoCodice: string;
  assisted: AssistedForm;
  existingAssisted: boolean;
  cfChecking: boolean;
  dataDecorrenza: string;
  frazionamento: string;
  indirizzoStudioProfessionale: string;
  onUpdate: (field: keyof AssistedForm, value: string) => void;
  onCfBlur: () => void;
  onDataDecorrenzaChange: (v: string) => void;
  onFrazionamentoChange: (v: string) => void;
  onIndirizzoStudioChange: (v: string) => void;
}) {
  const cod = String(tipoCodice || '').toLowerCase();
  const nascondiBlocco = NASCONDI_BLOCCO_INFO_ASSISTITO.has(cod);
  const mostraDecorrenza = !SENZA_DATA_DECORRENZA.has(cod);
  const mostraFrazionamento = CON_FRAZIONAMENTO_ASSISTITO.has(cod);
  const mostraIndirizzoStudio = cod === 'rc_prof';

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
        <FormInput label="Email *" type="email" value={assisted.email} onChange={(v) => onUpdate('email', v)} placeholder="email@esempio.it" />
        <FormInput label="Indirizzo di residenza *" value={assisted.indirizzo} onChange={(v) => onUpdate('indirizzo', v)} />
        <FormInput label="CAP *" value={assisted.cap} onChange={(v) => onUpdate('cap', v)} maxLength={5} />
        <FormInput label="Città *" value={assisted.citta} onChange={(v) => onUpdate('citta', v)} />

        {!nascondiBlocco && (mostraDecorrenza || mostraFrazionamento || mostraIndirizzoStudio) && (
          <div className="sm:col-span-2 border-t pt-4 mt-2 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Informazioni aggiuntive</h3>
            {mostraIndirizzoStudio && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Indirizzo dello studio professionale *</label>
                <textarea
                  rows={3}
                  value={indirizzoStudioProfessionale}
                  onChange={(e) => onIndirizzoStudioChange(e.target.value)}
                  className="input-field"
                  placeholder="Indirizzo completo dello studio"
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {mostraDecorrenza && (
                <FormInput label="Data Decorrenza" type="date" value={dataDecorrenza} onChange={onDataDecorrenzaChange} />
              )}
              {mostraFrazionamento && (
                <div className={mostraDecorrenza ? 'sm:col-span-2' : undefined}>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Frazionamento *</label>
                  <select
                    value={frazionamento}
                    onChange={(e) => onFrazionamentoChange(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Seleziona…</option>
                    {FRAZIONAMENTO_OPTS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
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

function CasaSpecsPackageBox({ pkg }: { pkg: CasaPackageDef }) {
  return (
    <div className="mb-6 rounded-lg border border-sky-200/80 bg-sky-50/50 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-sky-950">Pacchetto selezionato</h3>
      <p className="mt-1 text-sm font-medium text-gray-900">{pkg.nome}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
        {pkg.righe.map((r) => (
          <li key={r.label} className="flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-gray-500">{r.label}:</span>
            <span>{formatUnknownValueForDisplay(r.valore)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-md border border-sky-100 bg-white/90 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-sky-800">Premio finale</p>
        <p className="text-lg font-bold text-[#0B4EA2]">{formatPremioCasaIt(pkg.premio_finale_euro)}</p>
      </div>
      <p className="mt-3 text-xs text-gray-500">Riepilogo informativo della scelta effettuata nello step precedente.</p>
    </div>
  );
}

function SanitariaSpecsPackageBox({ pkg }: { pkg: SanitariaPackageDef }) {
  return (
    <div className="mb-6 rounded-lg border border-teal-200/80 bg-teal-50/40 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-teal-950">Pacchetto selezionato</h3>
      <p className="mt-1 text-sm font-medium text-gray-900">{pkg.nome}</p>
      <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm leading-snug text-gray-700">
        {pkg.highlights.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-gray-600">
        Età ingresso massima: <span className="font-medium text-gray-900">{pkg.eta_ingresso_max} anni</span>
      </p>
      <div className="mt-3 rounded-md border border-teal-100 bg-white/90 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-teal-900/80">Premio a partire da</p>
        <p className="text-lg font-bold text-[#0B4EA2]">{formatPremioStartingIt(pkg.premio_starting_euro)}</p>
      </div>
      <p className="mt-2.5 text-xs text-gray-500">Riepilogo informativo della scelta effettuata nello step precedente.</p>
    </div>
  );
}

function Step3DatiSpecifici({
  tipoCodice,
  hasSelectedCasaPackage,
  casaPackage,
  hasSelectedSanitariaPackage,
  sanitariaPackage,
  fields,
  values,
  onChange,
}: {
  tipoCodice: string;
  hasSelectedCasaPackage: boolean;
  casaPackage: CasaPackageDef | null;
  hasSelectedSanitariaPackage: boolean;
  sanitariaPackage: SanitariaPackageDef | null;
  fields: FormField[];
  values: Record<string, unknown>;
  onChange: (nome: string, value: unknown) => void;
}) {
  const showCasaHeader = tipoCodice === 'casa';
  const showSanitariaHeader = tipoCodice === 'sanitaria';

  if (!fields || fields.length === 0) {
    return (
      <div>
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Dati Specifici</h2>
        {showCasaHeader && hasSelectedCasaPackage && casaPackage && <CasaSpecsPackageBox pkg={casaPackage} />}
        {showCasaHeader && !hasSelectedCasaPackage && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
            Richiesta personalizzata senza pacchetto predefinito
          </div>
        )}
        {showSanitariaHeader && hasSelectedSanitariaPackage && sanitariaPackage && (
          <SanitariaSpecsPackageBox pkg={sanitariaPackage} />
        )}
        {showSanitariaHeader && !hasSelectedSanitariaPackage && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
            Preventivo personalizzato senza pacchetto predefinito
          </div>
        )}
        <p className="py-8 text-center text-sm text-gray-500">
          {showSanitariaHeader && hasSelectedSanitariaPackage
            ? 'Con il pacchetto selezionato le garanzie sono quelle del riepilogo: non serve compilare ulteriori opzioni. Puoi passare allo step successivo.'
            : 'Nessun dato specifico richiesto per questa tipologia.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Dati Specifici</h2>
      {showCasaHeader && hasSelectedCasaPackage && casaPackage && <CasaSpecsPackageBox pkg={casaPackage} />}
      {showCasaHeader && !hasSelectedCasaPackage && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
          Richiesta personalizzata senza pacchetto predefinito
        </div>
      )}
      {showSanitariaHeader && hasSelectedSanitariaPackage && sanitariaPackage && (
        <SanitariaSpecsPackageBox pkg={sanitariaPackage} />
      )}
      {showSanitariaHeader && !hasSelectedSanitariaPackage && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
          Preventivo personalizzato senza pacchetto predefinito
        </div>
      )}
      <p className="mb-6 text-sm text-gray-500">
        {showCasaHeader && hasSelectedCasaPackage
          ? "Compila i dati dell'immobile fino all'indirizzo. Coperture e massimali sono quelli del pacchetto: non compariranno opzioni manuali aggiuntive in questa schermata."
          : showSanitariaHeader && !hasSelectedSanitariaPackage
            ? 'Seleziona le garanzie desiderate tra le opzioni disponibili (infortuni e sanitaria).'
            : 'Compila i campi richiesti per la tipologia selezionata.'}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const fullRow =
            field.tipo === 'heading'
            || field.tipo === 'info'
            || field.tipo === 'multiselect'
            || field.tipo === 'textarea'
            || field.tipo === 'radio';
          return (
            <div key={field.nome} className={fullRow ? 'sm:col-span-2' : undefined}>
              <DynamicField
                field={field}
                value={
                  field.tipo === 'multiselect'
                    ? (Array.isArray(values[field.nome]) ? values[field.nome] : [])
                    : values[field.nome]
                }
                onChange={(v) => onChange(field.nome, v)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Valore controllato per input/select/textarea (value React non accetta `unknown`). */
function asControlledString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  return '';
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = `${field.label}${field.obbligatorio ? ' *' : ''}`;
  const str = asControlledString(value);

  switch (field.tipo) {
    case 'text':
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <input
            type="text"
            value={str}
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
            value={str}
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
          <input type="date" value={str} onChange={(e) => onChange(e.target.value)} className="input-field" />
        </div>
      );
    case 'select': {
      const sotto =
        str && field.descrizioni_opzione && field.descrizioni_opzione[str]
          ? field.descrizioni_opzione[str]
          : null;
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <select value={str} onChange={(e) => onChange(e.target.value)} className="input-field">
            <option value="">Seleziona…</option>
            {field.opzioni?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {sotto ? (
            <p className="mt-2 text-sm leading-relaxed text-amber-950 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
              {sotto}
            </p>
          ) : null}
        </div>
      );
    }
    case 'boolean':
      return (
        <div className="flex items-center gap-3">
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
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
          <textarea
            rows={3}
            value={str}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
            placeholder={field.placeholder || undefined}
          />
        </div>
      );
    case 'radio':
      return (
        <div>
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
    case 'multiselect': {
      const selected: string[] = Array.isArray(value) ? value : [];
      const toggle = (opt: string) => {
        const set = new Set(selected);
        if (set.has(opt)) set.delete(opt);
        else set.add(opt);
        onChange([...set]);
      };
      return (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">{label}</p>
          <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
            {field.opzioni?.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="leading-snug">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }
    case 'heading':
      return (
        <h3 className="pt-2 text-base font-semibold text-gray-900 first:pt-0">
          {field.label}
        </h3>
      );
    case 'info':
      return (
        <p className="text-sm leading-relaxed text-amber-950 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
          {field.label}
        </p>
      );
    default:
      return null;
  }
}

/* ───────────── Step 4: Attachments ───────────── */

function Step4Attachments({
  tipoCodice,
  noteStruttura,
  onNoteStrutturaChange,
  noteAllegati,
  onNoteAllegatiChange,
  checklist,
  files,
  onChange,
}: {
  tipoCodice: string;
  noteStruttura: string;
  onNoteStrutturaChange: (v: string) => void;
  noteAllegati: string;
  onNoteAllegatiChange: (v: string) => void;
  checklist: ChecklistItem[];
  files: Record<string, File | null>;
  onChange: (nome: string, file: File | null) => void;
}) {
  const showCasaPreventivoFirmato = tipoCodice === 'casa';
  const filePreventivoFirmato = files[CASA_PREVENTIVO_FIRMATO_TIPO];

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Allegati</h2>
      <p className="mb-6 text-sm text-gray-500">
        Carica i documenti richiesti. I documenti obbligatori sono contrassegnati con *.
      </p>

      <div className="mb-6 space-y-4">
        <div>
          <label htmlFor="note-struttura-richiesta" className="mb-1 block text-sm font-medium text-gray-700">
            Note per l&apos;operatore
          </label>
          <textarea
            id="note-struttura-richiesta"
            rows={3}
            value={noteStruttura}
            onChange={(e) => onNoteStrutturaChange(e.target.value)}
            className="input-field"
            placeholder="Opzionale: indicazioni o riferimenti utili per chi gestisce la pratica…"
          />
        </div>
        <div>
          <label htmlFor="note-allegati-richiesta" className="mb-1 block text-sm font-medium text-gray-700">
            Note sugli allegati
          </label>
          <textarea
            id="note-allegati-richiesta"
            rows={3}
            value={noteAllegati}
            onChange={(e) => onNoteAllegatiChange(e.target.value)}
            className="input-field"
            placeholder="Eventuali indicazioni sui documenti che caricherai…"
          />
        </div>
      </div>

      {showCasaPreventivoFirmato && (
        <div className="mb-6 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-4">
          <h4 className="mb-1 text-sm font-semibold text-gray-800">Documento facoltativo</h4>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  filePreventivoFirmato ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {filePreventivoFirmato ? <Check className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
              </div>
              <div>
                <span className="text-sm font-medium text-gray-900">Preventivo firmato</span>
                <p className="mt-1 text-xs text-gray-600">
                  Allega il PDF riepilogativo firmato dal cliente, se disponibile. Campo facoltativo.
                </p>
                {filePreventivoFirmato && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {filePreventivoFirmato.name} ({(filePreventivoFirmato.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>
            <label className="btn-secondary cursor-pointer py-1.5 px-3 text-xs">
              <Paperclip className="h-3.5 w-3.5" />
              {filePreventivoFirmato ? 'Sostituisci' : 'Scegli file'}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => onChange(CASA_PREVENTIVO_FIRMATO_TIPO, e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>
      )}

      {(!checklist || checklist.length === 0) ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Nessun allegato obbligatorio richiesto per questa tipologia. Puoi procedere.
        </p>
      ) : (
        <div className="space-y-4">
          {checklist.map((item, idx) => {
            const file = files[item.nome];
            const prev = idx > 0 ? checklist[idx - 1] : null;
            const showSezione = item.sezione && (!prev || prev.sezione !== item.sezione);
            return (
              <div key={item.nome}>
                {showSezione ? (
                  <h4 className="mb-2 text-sm font-semibold text-gray-800">{item.sezione}</h4>
                ) : null}
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        file ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {file ? <Check className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {item.nome}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────── Step 5: Review ───────────── */

function formatReviewValue(val: unknown): string {
  return formatUnknownValueForDisplay(val);
}

function Step5Review({
  selectedType,
  assisted,
  dataDecorrenza,
  frazionamento,
  indirizzoStudioProfessionale,
  noteStruttura,
  noteAllegati,
  datiSpecifici,
  attachmentFiles,
  privacyMandatory,
  onPrivacyMandatoryChange,
  marketingOptIn,
  onMarketingOptInChange,
  casaPackage,
  sanitariaPackage,
}: {
  selectedType: InsuranceType;
  assisted: AssistedForm;
  dataDecorrenza: string;
  frazionamento: string;
  indirizzoStudioProfessionale: string;
  noteStruttura: string;
  noteAllegati: string;
  datiSpecifici: Record<string, unknown>;
  attachmentFiles: Record<string, File | null>;
  privacyMandatory: boolean;
  onPrivacyMandatoryChange: (v: boolean) => void;
  marketingOptIn: boolean;
  onMarketingOptInChange: (v: boolean) => void;
  casaPackage: CasaPackageDef | null;
  sanitariaPackage: SanitariaPackageDef | null;
}) {
  const uploadCount = Object.values(attachmentFiles).filter(Boolean).length;
  const cod = String(selectedType.codice || '').toLowerCase();
  let mergedDati: Record<string, unknown> = { ...datiSpecifici };
  if (CON_FRAZIONAMENTO_ASSISTITO.has(cod) && frazionamento.trim()) {
    mergedDati.frazionamento = frazionamento.trim();
  }
  if (cod === 'rc_prof' && indirizzoStudioProfessionale.trim()) {
    mergedDati.indirizzo_studio_professionale = indirizzoStudioProfessionale.trim();
  }
  if (cod === 'casa' && casaPackage) {
    mergedDati = omitCasaDatiAfterIndirizzoImmobile(mergedDati, selectedType.campi_specifici);
  }
  const skipDatiKeys = new Set<string>();
  if (CON_FRAZIONAMENTO_ASSISTITO.has(cod)) skipDatiKeys.add('frazionamento');
  if (cod === 'rc_prof') skipDatiKeys.add('indirizzo_studio_professionale');
  const codTipo = String(selectedType.codice || '').toLowerCase();
  const isRcFlow = isRcVeicoliTipo(selectedType.codice);
  const datiEntries = Object.entries(mergedDati).filter(
    ([k]) =>
      !String(k).startsWith('_')
      && !skipDatiKeys.has(k)
      && !(
        String(selectedType.codice || '').toLowerCase() === 'casa'
        && (k === 'pacchetto_casa' || k === 'casa_preventivo')
      )
      && !(
        String(selectedType.codice || '').toLowerCase() === 'sanitaria'
        && (k === 'pacchetto_sanitaria' || k === 'sanitaria_preventivo')
      )
      && !(codTipo === 'affitto' && k === 'prodotto_affitto')
      && !(isRcFlow && RC_DATI_SPEC_KEYS_TO_HIDE.has(k)),
  );

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Riepilogo</h2>
      <p className="mb-6 text-sm text-gray-500">Verifica tutti i dati prima di inviare la richiesta.</p>

      <div className="space-y-6">
        {/* Tipologia */}
        <ReviewSection title="Tipologia Assicurativa">
          <ReviewItem label="Nome" value={selectedType.nome} />
          <ReviewItem
            label="Descrizione"
            value={selectedType.descrizione?.trim() ? selectedType.descrizione.trim() : '-'}
          />
        </ReviewSection>

        {codTipo === 'casa' && casaPackage && (
          <ReviewSection title="Pacchetto selezionato">
            <div className="sm:col-span-2">
              <ReviewItem label="Nome pacchetto" value={casaPackage.nome} />
            </div>
            {casaPackage.righe.map((r) => (
              <ReviewItem key={r.label} label={r.label} value={formatUnknownValueForDisplay(r.valore)} />
            ))}
            <div className="sm:col-span-2 rounded-lg border border-sky-100 bg-sky-50/80 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-sky-800">Premio finale</p>
              <p className="text-lg font-bold text-[#0B4EA2]">{formatPremioCasaIt(casaPackage.premio_finale_euro)}</p>
            </div>
          </ReviewSection>
        )}

        {codTipo === 'casa' && !casaPackage && (
          <ReviewSection title="Polizza Casa">
            <div className="sm:col-span-2 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
              <p className="font-medium">Preventivo personalizzato</p>
              <p className="mt-1 text-amber-900/90">
                Nessun pacchetto predefinito selezionato. La richiesta verrà gestita come preventivo su misura.
              </p>
            </div>
          </ReviewSection>
        )}

        {codTipo === 'sanitaria' && sanitariaPackage && (
          <ReviewSection title="Pacchetto selezionato">
            <div className="sm:col-span-2">
              <ReviewItem label="Nome pacchetto" value={sanitariaPackage.nome} />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-gray-500">Garanzie principali</p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-gray-900">
                {sanitariaPackage.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
            <ReviewItem label="Età ingresso massima" value={`${sanitariaPackage.eta_ingresso_max} anni`} />
            <div className="sm:col-span-2 rounded-lg border border-teal-100 bg-teal-50/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-teal-900/85">Premio a partire da</p>
              <p className="text-lg font-bold text-[#0B4EA2]">
                {formatPremioStartingIt(sanitariaPackage.premio_starting_euro)}
              </p>
            </div>
          </ReviewSection>
        )}

        {codTipo === 'sanitaria' && !sanitariaPackage && (
          <ReviewSection title="Polizza Sanitaria">
            <div className="sm:col-span-2 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
              <p className="font-medium">Preventivo personalizzato</p>
              <p className="mt-1 text-amber-900/90">
                Nessun pacchetto predefinito associato. La richiesta verrà gestita come preventivo su misura.
              </p>
            </div>
          </ReviewSection>
        )}

        {codTipo === 'affitto'
          && mergedDati.prodotto_affitto != null
          && typeof mergedDati.prodotto_affitto === 'object' ? (
          <ReviewSection title="Prodotto Tutela Affitto">
            {(() => {
              const o = mergedDati.prodotto_affitto as Record<string, unknown>;
              return (
                <>
                  <ReviewItem label="Codice prodotto" value={String(o.product_code ?? '—')} />
                  <ReviewItem label="Nome prodotto" value={String(o.product_name ?? '—')} />
                  <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Premio a partire da (indicativo)</p>
                    <p className="mt-1 text-base font-bold text-[#0B4EA2]">
                      {String(o.starting_price_label ?? '—')}
                    </p>
                  </div>
                  <ReviewItem label="PDF riepilogo" value={String(o.riepilogo_pdf ?? '—')} />
                  <ReviewItem
                    label="Scheda introduttiva"
                    value={o.intro_visualizzata === true ? 'Sì, visualizzata in fase di richiesta' : '—'}
                  />
                </>
              );
            })()}
          </ReviewSection>
        ) : null}

        {/* Assistito */}
        <ReviewSection title="Dati Assistito">
          <ReviewItem label="Nome e Cognome" value={`${assisted.nome} ${assisted.cognome}`} />
          <ReviewItem label="Codice Fiscale" value={assisted.codice_fiscale} />
          <ReviewItem label="Data di Nascita" value={formatDate(assisted.data_nascita)} />
          <ReviewItem label="Cellulare" value={assisted.cellulare} />
          <ReviewItem label="Email" value={assisted.email} />
          <ReviewItem label="Indirizzo di residenza" value={assisted.indirizzo} />
          <ReviewItem label="CAP" value={assisted.cap} />
          <ReviewItem label="Città" value={assisted.citta} />
        </ReviewSection>

        {/* Info aggiuntive */}
        <ReviewSection title="Informazioni Aggiuntive">
          <ReviewItem label="Data Decorrenza" value={dataDecorrenza ? formatDate(dataDecorrenza) : '—'} />
          {CON_FRAZIONAMENTO_ASSISTITO.has(cod) && (
            <ReviewItem label="Frazionamento" value={frazionamento || '-'} />
          )}
          {cod === 'rc_prof' && (
            <ReviewItem label="Indirizzo dello studio professionale" value={indirizzoStudioProfessionale || '-'} />
          )}
          <ReviewItem label="Note per l&apos;operatore" value={noteStruttura?.trim() ? noteStruttura.trim() : '-'} />
          <ReviewItem label="Note sugli allegati" value={noteAllegati?.trim() ? noteAllegati.trim() : '-'} />
        </ReviewSection>

        {/* Dati specifici */}
        {(datiEntries.length > 0 || isRcFlow) && (
          <ReviewSection title="Dati Specifici">
            {isRcFlow ? (
              <ReviewItem label="Garanzie richieste" value={formatGaranzieRichiesteRcLine(mergedDati)} />
            ) : null}
            {datiEntries
              .filter(([key]) => {
                const field = selectedType.campi_specifici.find((f) => f.nome === key);
                return field?.tipo !== 'heading' && field?.tipo !== 'info';
              })
              .map(([key, val]) => {
                const field = selectedType.campi_specifici.find((f) => f.nome === key);
                return (
                  <ReviewItem
                    key={key}
                    label={field?.label || key}
                    value={formatReviewValue(val)}
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
                  label={labelForQuoteAttachmentTipo(nome)}
                  value={file!.name}
                />
              ))
          )}
        </ReviewSection>

        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-5">
          <h3 className="text-sm font-semibold text-gray-900">Privacy e consensi</h3>
          <p className="mt-1 text-xs text-gray-500">
            Obbligatorio per l’invio. Versione informativa: {PRIVACY_POLICY_VERSION}.
          </p>
          <label className="mt-4 flex cursor-pointer gap-3 text-sm leading-snug text-gray-800">
            <input
              type="checkbox"
              checked={privacyMandatory}
              onChange={(e) => onPrivacyMandatoryChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-700 focus:ring-blue-600"
            />
            <span>
              Dichiaro di aver letto l’
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#0B4EA2] underline-offset-2 hover:underline"
              >
                Informativa Privacy
              </Link>{' '}
              e di autorizzare il trattamento dei dati personali ai fini della gestione della richiesta di preventivo e
              delle eventuali attività connesse.
            </span>
          </label>
          <label className="mt-4 flex cursor-pointer gap-3 text-sm leading-snug text-gray-700">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => onMarketingOptInChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-700 focus:ring-blue-600"
            />
            <span>
              Acconsento a ricevere comunicazioni informative e promozionali relative ai servizi assicurativi
              (facoltativo).
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
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
