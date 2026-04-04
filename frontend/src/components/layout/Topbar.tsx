import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Search, Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { getUserDisplayName, getRoleLabel, getRoleBadgeColor } from '../../utils/helpers';

interface TopbarProps {
  sidebarCollapsed: boolean;
}

export default function Topbar({ sidebarCollapsed }: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);

  const sidebarWidthClass = sidebarCollapsed ? 'w-16' : 'w-52';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/preventivi?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-20 items-stretch border-b border-white/[0.06] bg-[#0d1118]/98 backdrop-blur-md">
      {/* Wordmark: un solo link a tutta area, hover uniforme (niente opacity su layer separati) */}
      <Link
        to="/"
        title="Torna alla dashboard"
        className={`box-border flex h-full min-w-0 shrink-0 cursor-pointer items-center border-r border-white/[0.06] bg-[#0a0e14] outline-none transition-colors duration-200 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-inset ${sidebarWidthClass} ${
          sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-4'
        }`}
      >
        <img
          src="/fimass-logo-wordmark.png"
          alt="FIMASS — Sportello Amico"
          width={922}
          height={218}
          draggable={false}
          className={`pointer-events-none block max-h-full w-auto max-w-full select-none bg-transparent object-contain [image-rendering:auto] ${
            sidebarCollapsed ? 'h-7 object-center' : 'h-8 object-left'
          }`}
          decoding="async"
        />
      </Link>

      <div className="flex min-w-0 flex-1 items-center px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="hidden min-w-[1rem] flex-1 sm:block" aria-hidden />
          <form onSubmit={handleSearch} className="w-full max-w-2xl shrink-0 sm:mx-auto">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca preventivi, polizze, assistiti..."
                className="input-field border-white/10 bg-[#0f172a] py-2.5 pl-10 placeholder:text-slate-500"
              />
            </div>
          </form>
          <div className="flex min-w-0 flex-1 justify-end">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
                aria-label="Notifiche"
              >
                <Bell size={20} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0d1118]" />
              </button>

              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfile(!showProfile)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.06] sm:px-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
                    <User size={16} />
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-medium leading-tight text-slate-100">{getUserDisplayName(user)}</p>
                    <p className="text-xs leading-tight text-slate-400">{getRoleLabel(user.role)}</p>
                  </div>
                  <ChevronDown size={16} className="hidden shrink-0 text-slate-500 sm:block" />
                </button>

                {showProfile && (
                  <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-white/10 bg-[#1e293b] py-1 shadow-xl shadow-black/40">
                    <div className="border-b border-white/[0.06] px-4 py-3">
                      <p className="text-sm font-medium text-slate-100">{getUserDisplayName(user)}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                      <span className={`badge mt-1 ${getRoleBadgeColor(user.role)}`}>{getRoleLabel(user.role)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <LogOut size={16} />
                      Esci
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
