import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PortalBackgroundLayers } from '../../components/layout/PortalBackground';
import { PasswordInput } from '../../components/common/PasswordInput';

const inputClass =
  'w-full rounded-xl border border-gray-200/95 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-[0_1px_2px_rgba(15,17,21,0.04)] placeholder:text-gray-400/75 transition-[border-color,box-shadow] duration-200 focus:outline-none focus:border-[var(--ui-primary)] focus:ring-[3px] focus:ring-[var(--ui-focus-ring)]';

const LOGIN_BROKER_DISCLAIMER =
  "Il servizio di intermediazione assicurativa di FIMASS by Sportello Amico è gestito da Tuo Broker srls, Broker Assicurativo regolamentato dall'IVASS ed iscritto al RUI in data 16/02/2021 con numero B000677151 consultabile sul Registro Unico Intermediari • P.IVA 16028461008 • PEC pectuobroker@pec.it";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Errore durante il login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[var(--portal-app-bg)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <PortalBackgroundLayers />
      </div>

      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col px-4 pb-3 pt-[max(0.75rem,3.5dvh)] sm:px-6 sm:pt-[max(1rem,5dvh)]">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-h-full w-full flex-col items-center justify-center">
              <div className="flex w-full max-w-xl flex-col items-center">
                {/* Logo — stessa scala percepita, limiti in dvh per stare in viewport senza scroll */}
                <div className="mb-4 w-full shrink-0 flex justify-center px-2 sm:mb-5">
                  <div className="relative flex w-full max-w-md justify-center">
                    <img
                      src="/fimass-logo-main.svg"
                      alt="FIMASS by Sportello Amico — Servizi per la famiglia e l'azienda"
                      className="relative z-[1] h-auto w-full object-contain object-center bg-transparent [image-rendering:auto] transition-transform duration-300 ease-out motion-safe:hover:scale-[1.01]"
                      decoding="async"
                    />
                  </div>
                </div>

                <div className="w-full max-w-md min-h-0 shrink overflow-y-hidden rounded-2xl border border-slate-200/95 bg-white px-7 py-6 shadow-[0_24px_56px_-20px_rgba(15,23,42,0.14),0_0_0_1px_rgba(15,23,42,0.04)_inset] sm:px-8 sm:py-7">
                  <div className="mb-5 text-center sm:mb-6 sm:text-left">
                    <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900">
                      Accesso al portale
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                      Inserisci le tue credenziali per continuare
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-xl border border-red-200/90 bg-red-50/90 px-3.5 py-3 text-sm text-red-800">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="login-username" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                        Username
                      </label>
                      <input
                        id="login-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={inputClass}
                        placeholder="Inserisci username"
                        required
                        autoFocus
                        autoComplete="username"
                      />
                    </div>

                    <div>
                      <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                        Password
                      </label>
                      <PasswordInput
                        id="login-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputClass}
                        placeholder="Inserisci password"
                        required
                        autoComplete="current-password"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-1 w-full rounded-xl bg-[#0B4EA2] py-3 text-sm font-semibold text-white shadow-sm shadow-[#0B4EA2]/20 transition-[background-color,box-shadow,transform] duration-200 hover:bg-[#0a4690] hover:shadow-md hover:shadow-[#0B4EA2]/18 active:scale-[0.998] active:bg-[#093d82] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none inline-flex items-center justify-center"
                    >
                      {loading ? (
                        <span className="inline-block h-5 w-5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Accedi'
                      )}
                    </button>
                  </form>

                  <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400/90">
                    &copy; {new Date().getFullYear()} FIMASS Sportello Amico
                  </p>
                </div>
              </div>
            </div>
          </div>

          <footer
            className="mt-2 shrink-0 pt-2 text-center sm:mt-3 sm:pt-3"
            role="contentinfo"
          >
            <p className="mx-auto max-w-2xl px-1 text-[11px] leading-relaxed text-slate-500/90 sm:text-xs sm:leading-relaxed [text-wrap:pretty] break-words">
              {LOGIN_BROKER_DISCLAIMER}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
