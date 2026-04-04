import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { getUserDisplayName, getRoleLabel, getRoleBadgeColor } from '../../utils/helpers';

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
    <header className="fixed left-60 right-0 top-0 z-30 flex h-[4.5rem] items-center justify-between border-b border-white/[0.06] bg-[#111827]/95 px-6 backdrop-blur-md">
      <form onSubmit={handleSearch} className="max-w-md flex-1">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca preventivi, polizze, assistiti..."
            className="input-field border-white/10 bg-[#0f172a] pl-10 placeholder:text-slate-500"
          />
        </div>
      </form>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
        >
          <Bell size={20} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-white/[0.06]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
              <User size={16} />
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-slate-100">{getUserDisplayName(user)}</p>
              <p className="text-xs leading-tight text-slate-400">{getRoleLabel(user.role)}</p>
            </div>
            <ChevronDown size={16} className="text-slate-500" />
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
    </header>
  );
}
