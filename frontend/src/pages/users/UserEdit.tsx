import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import type { InsuranceType, User } from '../../types';

type UserRole = User['role'];

function normalizeEnabledList(enabled: string[] | null | undefined): string[] {
  if (!enabled || enabled.length === 0) return [];
  return enabled.map((c) => String(c).trim()).filter(Boolean);
}

function tipologieAreAll(
  enabled: string[] | null | undefined,
  activeCodes: string[],
): boolean {
  if (!enabled || enabled.length === 0) return true;
  const n = enabled.map((c) => String(c).toLowerCase());
  if (n.includes('all')) return true;
  if (!activeCodes.length) return false;
  const set = new Set(n);
  return activeCodes.length > 0 && activeCodes.every((c) => set.has(c.toLowerCase()));
}

export default function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = id ? Number(id) : NaN;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [role, setRole] = useState<UserRole | null>(null);
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [denominazione, setDenominazione] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [username, setUsername] = useState('');
  const [stato, setStato] = useState<User['stato']>('attivo');

  const [tutteTipologie, setTutteTipologie] = useState(true);
  const [tipologieSelezionate, setTipologieSelezionate] = useState<Set<string>>(() => new Set());
  const [portalTipologie, setPortalTipologie] = useState<{ codice: string; label: string }[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!Number.isFinite(userId)) {
      setLoadError('Utente non valido.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [types, u] = await Promise.all([
          api.get<InsuranceType[]>('/settings/insurance-types'),
          api.get<User>(`/users/${userId}`),
        ]);
        if (cancelled) return;

        const active = types.filter((t) => String(t.stato).toLowerCase() === 'attivo');
        const opts = active.map((t) => ({ codice: t.codice, label: t.nome }));
        const activeCodes = opts.map((o) => o.codice);
        setPortalTipologie(opts);

        setRole(u.role);
        setNome(u.nome ?? '');
        setCognome(u.cognome ?? '');
        setDenominazione(u.denominazione ?? '');
        setEmail(u.email ?? '');
        setTelefono(u.telefono ?? '');
        setUsername(u.username ?? '');
        setStato(u.stato);

        const enabledList = normalizeEnabledList(u.enabled_types);
        const allT = tipologieAreAll(enabledList.length ? enabledList : null, activeCodes);
        setTutteTipologie(allT);
        if (allT) {
          setTipologieSelezionate(new Set(activeCodes));
        } else if (enabledList.length) {
          setTipologieSelezionate(new Set(enabledList));
        } else {
          setTipologieSelezionate(new Set());
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof ApiError ? e.message : 'Impossibile caricare l’utente.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
      setError('Ruolo mancante.');
      return false;
    }

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
    if (!Number.isFinite(userId) || !validate()) return;

    const body = buildPayload();
    if (!body) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.put(`/users/${userId}`, body);
      navigate('/utenti');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Aggiornamento non riuscito.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          <p className="text-sm text-gray-500">Caricamento dati utente…</p>
        </div>
      </div>
    );
  }

  if (loadError || !role) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => navigate('/utenti')}
          className="btn-secondary py-1.5 pl-2 pr-3 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna all’elenco
        </button>
        <div className="card border-l-4 border-l-red-500 p-6">
          <p className="text-sm font-medium text-red-800">{loadError ?? 'Utente non trovato.'}</p>
        </div>
      </div>
    );
  }

  const roleTitle =
    role === 'admin'
      ? 'Admin'
      : role === 'supervisore'
        ? 'Supervisore'
        : role === 'operatore'
          ? 'Operatore'
          : 'Struttura';

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <button
        type="button"
        onClick={() => navigate('/utenti')}
        className="btn-secondary -ml-1 py-1.5 pl-2 pr-3 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna all’elenco
      </button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Modifica utente</h1>
        <p className="mt-1 text-sm text-gray-600">
          Aggiorna i dati dell&apos;account <span className="font-medium text-gray-800">{roleTitle}</span> su{' '}
          <span className="font-medium text-gray-800">Fimass Sportello Amico</span>.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        <div className="border-b border-gray-100 pb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ruolo</p>
          <p className="text-lg font-semibold text-gray-900">{roleTitle}</p>
          <p className="mt-1 text-xs text-gray-500">Il ruolo non è modificabile da questa schermata.</p>
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
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input-field" />
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
              <input value={cognome} onChange={(e) => setCognome(e.target.value)} className="input-field" />
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

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-gray-600">
          Per reimpostare la password utilizza l&apos;azione dall&apos;elenco utenti.
        </p>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-6">
          <button type="button" onClick={() => navigate('/utenti')} className="btn-secondary">
            Annulla
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </form>
    </div>
  );
}
