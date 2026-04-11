import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Search, LogOut, User, ChevronDown } from 'lucide-react';
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

  const sidebarWidthClass = sidebarCollapsed ? 'w-16' : 'w-48';

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
    <header className="fixed left-0 right-0 top-0 z-30 flex h-20 items-stretch border-b border-[var(--portal-nav-border)] bg-[var(--portal-nav-surface)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Intestazione portale: titolo + area (stesso blu sidebar, senza logo) */}
      <Link
        to="/"
        title="Sportello Amico Servizi — Area Assicurativa"
        className={`box-border flex h-full min-w-0 shrink-0 cursor-pointer border-r border-[var(--portal-sidebar-border)] bg-[var(--portal-sidebar-bg)] outline-none transition-colors duration-200 hover:bg-[var(--portal-nav-surface-logo-hover)] focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-inset ${sidebarWidthClass} ${
          sidebarCollapsed ? 'items-center justify-center px-2' : 'items-center justify-start px-4'
        }`}
      >
        {sidebarCollapsed ? (
          <span className="text-center text-[11px] font-bold leading-tight tracking-tight text-[var(--portal-sidebar-text)]">
            SAS
          </span>
        ) : (
          <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
            <span className="text-sm font-semibold leading-snug text-[var(--portal-sidebar-text)]">
              Sportello Amico Servizi
            </span>
            <span className="text-xs font-medium leading-snug text-[var(--portal-sidebar-muted)]">
              Area Assicurativa
            </span>
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 items-center px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="hidden min-w-[1rem] flex-1 sm:block" aria-hidden />
          <form onSubmit={handleSearch} className="w-full max-w-2xl shrink-0 sm:mx-auto">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca preventivi, polizze, assistiti..."
                className="input-field border-[var(--portal-border-subtle)] bg-[#f8fafc] py-2.5 pl-10 placeholder:text-slate-400"
              />
            </div>
          </form>
          <div className="flex min-w-0 flex-1 justify-end">
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--portal-topbar-hover)] sm:px-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(42,77,126,0.12)] text-[var(--ui-primary)]">
                  <User size={16} />
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium leading-tight text-slate-900">{getUserDisplayName(user)}</p>
                  <p className="text-xs leading-tight text-slate-600">{getRoleLabel(user.role)}</p>
                </div>
                <ChevronDown size={16} className="hidden shrink-0 text-slate-500 sm:block" />
              </button>

              {showProfile && (
                <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-slate-200/95 bg-white py-1 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.04)]">
                  <div className="border-b border-slate-200/90 px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{getUserDisplayName(user)}</p>
                    <p className="text-xs text-slate-600">{user.email}</p>
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
    </header>
  );
}
