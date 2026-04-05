import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { PortalBackgroundLayers } from '../../components/layout/PortalBackground';

const inputClass =
  'w-full rounded-xl border border-gray-200/95 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-[0_1px_2px_rgba(15,17,21,0.04)] placeholder:text-gray-400/75 transition-[border-color,box-shadow] duration-200 focus:outline-none focus:border-[#0B4EA2] focus:ring-[3px] focus:ring-[#0B4EA2]/18';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0F1B36]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <PortalBackgroundLayers variant="login" />
      </div>

      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-start overflow-hidden px-4 pb-3 pt-[max(0.75rem,3.5dvh)] sm:px-6 sm:pt-[max(1rem,5dvh)]">
        <div className="flex min-h-0 w-full max-w-xl flex-col items-center overflow-hidden">
          {/* Logo — stessa scala percepita, limiti in dvh per stare in viewport senza scroll */}
          <div className="mb-4 w-full shrink-0 flex justify-center px-2 sm:mb-5">
            <div className="relative flex w-full max-w-[min(100%,92vw,580px)] justify-center">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[min(130%,440px)] w-[min(150%,640px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(253,200,48,0.07)_0%,rgba(11,78,162,0.05)_35%,transparent_68%)] blur-2xl"
                aria-hidden
              />
              <img
                src="/fimass-logo-full.png"
                alt="FIMASS by Sportello Amico — Servizi per la famiglia e l'azienda"
                className="relative z-[1] h-auto w-full max-h-[min(28dvh,180px)] sm:max-h-[min(32dvh,220px)] object-contain object-center bg-transparent [image-rendering:auto] drop-shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out motion-safe:hover:scale-[1.01]"
                decoding="async"
              />
            </div>
          </div>

          <div className="w-full max-w-md min-h-0 shrink overflow-y-hidden rounded-2xl border border-gray-200/90 bg-[#F8F9FB] px-7 py-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)_inset] sm:px-8 sm:py-7">
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
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                  placeholder="Inserisci password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors duration-200 hover:bg-[#0B4EA2]/8 hover:text-[#0B4EA2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B4EA2]/30"
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />}
                </button>
              </div>
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
  );
}
