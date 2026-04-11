import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, ChevronDown } from 'lucide-react';
import { getUserDisplayName, getRoleLabel, getRoleBadgeColor } from '../../utils/helpers';

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className="fixed top-3 right-3 z-30 flex h-12 w-max max-w-[calc(100vw-2rem)] shrink-0 items-center justify-end gap-2 rounded-xl border border-[var(--portal-nav-border)] bg-[var(--portal-nav-surface)] px-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)] sm:px-4">
      <div ref={profileRef} className="relative">
        <button
          type="button"
          onClick={() => setShowProfile(!showProfile)}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-[var(--portal-topbar-hover)] sm:px-2"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(42,77,126,0.12)] text-[var(--ui-primary)]">
            <User size={15} />
          </div>
          <div className="hidden min-w-0 text-left sm:block">
            <p className="truncate text-sm font-medium leading-tight text-slate-900">{getUserDisplayName(user)}</p>
            <p className="truncate text-xs leading-tight text-slate-600">{getRoleLabel(user.role)}</p>
          </div>
          <ChevronDown size={15} className="hidden shrink-0 text-slate-500 sm:block" />
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
    </header>
  );
}
