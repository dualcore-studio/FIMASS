import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, FileText, Shield, UserCheck,
  BarChart3, ClipboardList, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'supervisore', 'operatore', 'struttura'] },
  { path: '/utenti', label: 'Utenti', icon: Users, roles: ['admin', 'supervisore'] },
  { path: '/preventivi', label: 'Preventivi', icon: FileText, roles: ['admin', 'supervisore', 'operatore', 'struttura'] },
  { path: '/polizze', label: 'Polizze', icon: Shield, roles: ['admin', 'supervisore', 'operatore', 'struttura'] },
  { path: '/assistiti', label: 'Assistiti', icon: UserCheck, roles: ['admin', 'supervisore', 'operatore', 'struttura'] },
  { path: '/report', label: 'Report', icon: BarChart3, roles: ['admin', 'supervisore'] },
  { path: '/log-attivita', label: 'Log Attività', icon: ClipboardList, roles: ['admin', 'supervisore'] },
  { path: '/impostazioni', label: 'Impostazioni', icon: Settings, roles: ['admin'] },
];

export default function Sidebar() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const filteredItems = menuItems.filter(item => user && item.roles.includes(user.role));

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-white/[0.06] bg-[#161B26] transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}
    >
      <div className="relative flex min-h-[4.5rem] shrink-0 items-center border-b border-white/[0.08] bg-[#0d1017] px-2">
        <Link
          to="/"
          className={`relative z-10 flex w-full min-w-0 items-center justify-center outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1017] ${
            collapsed ? 'py-2' : 'py-2.5'
          }`}
          title="Torna alla dashboard"
        >
          <img
            src="/fimass-logo.png"
            alt="FIMASS — Sportello Amico"
            className={`h-auto w-full max-w-full object-contain object-center drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] ${
              collapsed ? 'max-h-9 px-0.5' : 'max-h-[3.35rem] sm:max-h-[3.65rem]'
            }`}
            decoding="async"
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-500/15 text-blue-300'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
              } ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={20} className="shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center border-t border-white/[0.06] p-3 text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}
