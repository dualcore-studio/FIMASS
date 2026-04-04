import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

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
    <div className="relative min-h-screen overflow-hidden bg-[#DDE3EC] flex flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
      {/* Soft vertical gradient — chiaro, corporate */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#E8ECF3] via-[#DFE5EE] to-[#D4DCE8]"
        aria-hidden
      />
      {/* Alone blu molto leggero in alto */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_60%_at_50%_0%,rgba(11,78,162,0.07),transparent_55%)]"
        aria-hidden
      />
      {/* Vignetta soft (non scura) per profondità */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(90,107,132,0.08)_100%)]"
        aria-hidden
      />
      {/* Griglia sottile su sfondo chiaro */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] bg-[linear-gradient(rgba(15,17,21,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,17,21,0.06)_1px,transparent_1px)] bg-[length:56px_56px]"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center">
        {/* Logo — visual hero */}
        <div className="mb-8 sm:mb-9 w-full flex justify-center px-2">
          <div className="relative w-full max-w-[min(100%,92vw,580px)] flex justify-center">
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[min(130%,440px)] w-[min(150%,640px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(253,200,48,0.12)_0%,rgba(11,78,162,0.06)_38%,transparent_70%)] blur-2xl"
              aria-hidden
            />
            <img
              src="/fimass-logo.png"
              alt="FIMASS — Sportello Amico"
              className="relative z-[1] h-auto w-full max-h-[min(44vh,300px)] sm:max-h-[min(46vh,360px)] object-contain object-center bg-transparent drop-shadow-[0_16px_48px_rgba(15,17,21,0.14)] transition-transform duration-300 ease-out motion-safe:hover:scale-[1.01]"
              decoding="async"
            />
          </div>
        </div>

        <div className="w-full max-w-md rounded-2xl border border-gray-200/95 bg-white px-8 py-8 sm:px-9 sm:py-9 shadow-[0_24px_48px_-12px_rgba(15,17,21,0.12),0_0_0_1px_rgba(255,255,255,0.8)_inset]">
          <div className="mb-7 text-center sm:text-left">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900">
              Accesso al portale
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Inserisci le tue credenziali per continuare
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200/90 bg-red-50/90 px-3.5 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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

          <p className="mt-8 text-center text-[11px] leading-relaxed text-gray-400/90">
            &copy; {new Date().getFullYear()} FIMASS Sportello Amico
          </p>
        </div>
      </div>
    </div>
  );
}
