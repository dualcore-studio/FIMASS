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
    <aside className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 z-40 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'} flex flex-col`}>
      <div className="relative flex min-h-16 shrink-0 items-center border-b border-white/10 bg-[#12151C]">
        <Link
          to="/"
          className={`relative z-10 flex w-full items-center justify-center outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[#0B4EA2]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12151C] ${
            collapsed ? 'px-2 py-2' : 'px-3 py-2'
          }`}
          title="Torna alla dashboard"
        >
          <img
            src="/fimass-logo.png"
            alt="FIMASS — Sportello Amico"
            className={`h-auto w-full max-w-full object-contain object-center drop-shadow-[0_6px_20px_rgba(0,0,0,0.4)] ${
              collapsed ? 'max-h-8' : 'max-h-10'
            }`}
            decoding="async"
          />
        </Link>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
        className="p-3 border-t border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 flex items-center justify-center"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}
