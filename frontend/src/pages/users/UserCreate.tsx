import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  UserCog,
  User as UserIcon,
  Building2,
  Check,
} from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { InsuranceType, User } from '../../types';

type UserRole = User['role'];

const ROLE_CARDS: {
  role: UserRole;
  title: string;
  description: string;
  icon: typeof Shield;
  accent: string;
}[] = [
  {
    role: 'admin',
    title: 'Admin',
    description: 'Accesso completo al portale, configurazione e supervisione globale.',
    icon: Shield,
    accent: 'from-violet-500/10 to-purple-600/5 ring-violet-200',
  },
  {
    role: 'supervisore',
    title: 'Supervisore',
    description: 'Coordina operatori e strutture, monitora le pratiche e i flussi.',
    icon: UserCog,
    accent: 'from-blue-500/10 to-sky-600/5 ring-blue-200',
  },
  {
    role: 'operatore',
    title: 'Operatore',
    description: 'Gestisce preventivi e polizze assegnate allo sportello.',
    icon: UserIcon,
    accent: 'from-amber-500/10 to-orange-600/5 ring-amber-200',
  },
  {
    role: 'struttura',
    title: 'Struttura',
    description: 'Account per sedi convenzionate con tipologie abilitate dedicate.',
    icon: Building2,
    accent: 'from-emerald-500/10 to-teal-600/5 ring-emerald-200',
  },
];

export default function UserCreate() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<UserRole | null>(null);

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [denominazione, setDenominazione] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confermaPassword, setConfermaPassword] = useState('');
  const [stato, setStato] = useState<User['stato']>('attivo');

  const [tutteTipologie, setTutteTipologie] = useState(true);
  const [tipologieSelezionate, setTipologieSelezionate] = useState<Set<string>>(() => new Set());
  const [portalTipologie, setPortalTipologie] = useState<{ codice: string; label: string }[]>([]);
  const [tipologieLoadError, setTipologieLoadError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    api
      .get<InsuranceType[]>('/settings/insurance-types')
      .then((types) => {
        if (cancelled) return;
        const active = types.filter((t) => String(t.stato).toLowerCase() === 'attivo');
        const opts = active.map((t) => ({ codice: t.codice, label: t.nome }));
        setPortalTipologie(opts);
        setTipologieSelezionate(new Set(opts.map((o) => o.codice)));
        setTipologieLoadError(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setTipologieLoadError(e instanceof ApiError ? e.message : 'Impossibile caricare le tipologie.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTipologia = (codice: string) => {
    if (tutteTipologie) return;
    setTipologieSelezionate((prev) => {
      const next = new Set(prev);
      if (next.has(codice)) next.delete(codice);
      else next.add(codice);
      return next;
    });
  };

  const setTutte = (checked: boolean) => {
    setTutteTipologie(checked);
    if (checked) setTipologieSelezionate(new Set(portalTipologie.map((t) => t.codice)));
  };

  const validate = (): boolean => {
    const fe: Record<string, string> = {};
    if (!role) {
      setFieldErrors({});
      setError('Seleziona un ruolo.');
      return false;
    }

    if (password !== confermaPassword) {
      fe.confermaPassword = 'Le password non coincidono.';
    }
    if (!password.trim()) fe.password = 'Obbligatorio.';

    if (role === 'struttura') {
      if (!denominazione.trim()) fe.denominazione = 'Obbligatorio.';
      if (!email.trim()) fe.email = 'Obbligatorio.';
      if (!telefono.trim()) fe.telefono = 'Obbligatorio.';
      if (!username.trim()) fe.username = 'Obbligatorio.';
      if (!tutteTipologie && tipologieSelezionate.size === 0) {
        fe.tipologie = 'Seleziona almeno una tipologia oppure "Tutte le tipologie".';
      }
    } else if (role === 'admin') {
      if (!nome.trim()) fe.nome = 'Obbligatorio.';
      if (!cognome.trim()) fe.cognome = 'Obbligatorio.';
      if (!email.trim()) fe.email = 'Obbligatorio.';
      if (!username.trim()) fe.username = 'Obbligatorio.';
    } else {
      if (!nome.trim()) fe.nome = 'Obbligatorio.';
      if (!cognome.trim()) fe.cognome = 'Obbligatorio.';
      if (!email.trim()) fe.email = 'Obbligatorio.';
      if (!username.trim()) fe.username = 'Obbligatorio.';
    }

    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) {
      setError('Correggi i campi evidenziati.');
      return false;
    }
    setError(null);
    return true;
  };

  const buildPayload = () => {
    if (!role) return null;

    const base: Record<string, unknown> = {
      role,
      username: username.trim(),
      password,
      email: email.trim(),
      stato,
    };

    if (role === 'struttura') {
      base.denominazione = denominazione.trim();
      base.telefono = telefono.trim();
      base.enabled_types = tutteTipologie ? ['all'] : Array.from(tipologieSelezionate);
      base.nome = null;
      base.cognome = null;
    } else if (role === 'admin') {
      base.nome = nome.trim();
      base.cognome = cognome.trim();
      base.denominazione = null;
      base.telefono = null;
    } else {
      base.nome = nome.trim();
      base.cognome = cognome.trim();
      base.denominazione = null;
      base.telefono = telefono.trim() || null;
    }

    return base;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || !role) return;

    const body = buildPayload();
    if (!body) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/users', body);
      navigate('/utenti');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Creazione utente non riuscita.');
    } finally {
      setSubmitting(false);
    }
  };

  const goRoleStep = () => {
    setStep(1);
    setError(null);
    setFieldErrors({});
  };

  const selectRoleAndContinue = (r: UserRole) => {
    setRole(r);
    setStep(2);
    setError(null);
    setFieldErrors({});
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <button
        type="button"
        onClick={() => (step === 1 ? navigate('/utenti') : goRoleStep())}
        className="btn-secondary -ml-1 py-1.5 pl-2 pr-3 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        {step === 1 ? 'Torna all’elenco' : 'Indietro'}
      </button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Nuovo utente</h1>
        <p className="mt-1 text-sm text-gray-600">
          Aggiungi un account a <span className="font-medium text-gray-800">Fimass Sportello Amico</span>.
        </p>
      </header>

      <div className="flex items-center gap-2 text-sm">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
            step >= 1 ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'
          }`}
        >
          1
        </div>
        <div className={`h-px flex-1 max-w-[80px] ${step >= 2 ? 'bg-blue-700' : 'bg-gray-200'}`} />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
            step >= 2 ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'
          }`}
        >
          2
        </div>
        <span className="ml-2 text-gray-500">
          {step === 1 ? 'Ruolo' : 'Dati utente'}
        </span>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLE_CARDS.map(({ role: r, title, description, icon: Icon, accent }) => (
            <button
              key={r}
              type="button"
              onClick={() => selectRoleAndContinue(r)}
              className={`card group relative overflow-hidden p-6 text-left ring-1 transition hover:shadow-md bg-gradient-to-br ${accent} hover:ring-blue-300`}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 text-blue-700 shadow-sm ring-1 ring-gray-100">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700 opacity-0 transition group-hover:opacity-100">
                Continua
                <Check className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-6 p-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ruolo selezionato</p>
              <p className="text-lg font-semibold text-gray-900">
                {ROLE_CARDS.find((c) => c.role === role)?.title}
              </p>
            </div>
            <button type="button" onClick={goRoleStep} className="btn-secondary text-xs">
              Cambia ruolo
            </button>
          </div>

          {role === 'struttura' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Denominazione <span className="text-red-500">*</span>
                </label>
                <input
                  value={denominazione}
                  onChange={(e) => setDenominazione(e.target.value)}
                  className="input-field"
                />
                {fieldErrors.denominazione ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.denominazione}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                />
                {fieldErrors.email ? <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Telefono <span className="text-red-500">*</span>
                </label>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="input-field"
                />
                {fieldErrors.telefono ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.telefono}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field font-mono text-sm"
                  autoComplete="username"
                />
                {fieldErrors.username ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.username}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Stato <span className="text-red-500">*</span>
                </label>
                <select
                  value={stato}
                  onChange={(e) => setStato(e.target.value as User['stato'])}
                  className="input-field"
                >
                  <option value="attivo">Attivo</option>
                  <option value="disattivo">Disattivo</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                <p className="text-sm font-semibold text-gray-900">Tipologie abilitate</p>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={tutteTipologie}
                    onChange={(e) => setTutte(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500"
                  />
                  Tutte le tipologie
                </label>
                {tipologieLoadError ? (
                  <p className="text-xs text-red-600">{tipologieLoadError}</p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  {portalTipologie.map(({ codice, label }) => (
                    <label
                      key={codice}
                      className={`flex items-start gap-2 text-sm ${
                        tutteTipologie ? 'cursor-not-allowed opacity-50' : 'cursor-pointer text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={tutteTipologie}
                        checked={tipologieSelezionate.has(codice)}
                        onChange={() => toggleTipologia(codice)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {fieldErrors.tipologie ? (
                  <p className="text-xs text-red-600">{fieldErrors.tipologie}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className="input-field" />
                {fieldErrors.nome ? <p className="mt-1 text-xs text-red-600">{fieldErrors.nome}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Cognome <span className="text-red-500">*</span>
                </label>
                <input
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  className="input-field"
                />
                {fieldErrors.cognome ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.cognome}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                />
                {fieldErrors.email ? <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p> : null}
              </div>
              {role !== 'admin' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Telefono</label>
                  <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input-field" />
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field font-mono text-sm"
                  autoComplete="username"
                />
                {fieldErrors.username ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.username}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Stato <span className="text-red-500">*</span>
                </label>
                <select
                  value={stato}
                  onChange={(e) => setStato(e.target.value as User['stato'])}
                  className="input-field"
                >
                  <option value="attivo">Attivo</option>
                  <option value="disattivo">Disattivo</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid gap-4 border-t border-gray-100 pt-6 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                autoComplete="new-password"
              />
              {fieldErrors.password ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Conferma password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={confermaPassword}
                onChange={(e) => setConfermaPassword(e.target.value)}
                className="input-field"
                autoComplete="new-password"
              />
              {fieldErrors.confermaPassword ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.confermaPassword}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => navigate('/utenti')} className="btn-secondary">
              Annulla
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creazione in corso…' : 'Crea utente'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
