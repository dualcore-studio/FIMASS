import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, ChevronDown } from 'lucide-react';
import { getUserDisplayName, getRoleLabel, getRoleBadgeColor } from '../../utils/helpers';

interface TopbarProps {
  sidebarCollapsed: boolean;
}

export default function Topbar({ sidebarCollapsed }: TopbarProps) {
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

  const leftOffsetClass = sidebarCollapsed ? 'left-16' : 'left-48';

  return (
    <header
      className={`fixed top-0 right-0 z-30 flex h-14 items-center justify-end border-b border-[var(--portal-nav-border)] bg-[var(--portal-nav-surface)] px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[left] duration-200 sm:px-6 ${leftOffsetClass}`}
    >
      <div ref={profileRef} className="relative">
        <button
          type="button"
          onClick={() => setShowProfile(!showProfile)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--portal-topbar-hover)] sm:px-3"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(42,77,126,0.12)] text-[var(--ui-primary)]">
            <User size={16} />
          </div>
          <div className="hidden min-w-0 text-left sm:block">
            <p className="truncate text-sm font-medium leading-tight text-slate-900">{getUserDisplayName(user)}</p>
            <p className="truncate text-xs leading-tight text-slate-600">{getRoleLabel(user.role)}</p>
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
    </header>
  );
}
