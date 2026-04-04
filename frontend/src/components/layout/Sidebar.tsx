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
      className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-white/[0.06] bg-[#111827] transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}
    >
      <div className="flex h-[4.5rem] w-full shrink-0 items-center border-b border-white/[0.06] px-4">
        <Link
          to="/"
          className="flex h-full w-full min-w-0 items-center outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]"
          title="Torna alla dashboard"
        >
          <img
            src="/fimass-logo.png"
            alt="FIMASS — Sportello Amico"
            className={`block h-auto w-full max-w-full object-contain object-center ${
              collapsed ? 'max-h-9' : 'max-h-[2.875rem] sm:max-h-[3.125rem]'
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
              `flex items-center gap-3 rounded-lg border-l-2 py-2.5 pl-[10px] pr-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                  : 'border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
              } ${collapsed ? 'justify-center border-l-0 pl-0 pr-0' : ''}`
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
