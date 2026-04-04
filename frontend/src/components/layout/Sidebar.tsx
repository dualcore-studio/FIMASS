import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  FileText,
  Shield,
  UserCheck,
  BarChart3,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'supervisore', 'operatore', 'struttura'] },
  { path: '/utenti', label: 'Utenti', icon: Users, roles: ['admin', 'supervisore'] },
  { path: '/preventivi', label: 'Preventivi', icon: FileText, roles: ['admin', 'supervisore', 'operatore', 'struttura'] },
  { path: '/polizze', label: 'Polizze', icon: Shield, roles: ['admin', 'supervisore', 'operatore', 'struttura'] },
  { path: '/assistiti', label: 'Assistiti', icon: UserCheck, roles: ['admin', 'supervisore', 'operatore', 'struttura'] },
  { path: '/report', label: 'Report', icon: BarChart3, roles: ['admin', 'supervisore'] },
  { path: '/log-attivita', label: 'Log Attività', icon: ClipboardList, roles: ['admin', 'supervisore'] },
];

const settingsItem = {
  path: '/impostazioni',
  label: 'Impostazioni',
  icon: Settings,
  roles: ['admin'],
};

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export default function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const { user } = useAuth();

  const filteredItems = menuItems.filter((item) => user && item.roles.includes(user.role));
  const showSettings = user && settingsItem.roles.includes(user.role);

  const widthClass = collapsed ? 'w-16' : 'w-52';

  return (
    <aside
      className={`fixed left-0 top-20 z-40 flex h-[calc(100vh-5rem)] flex-col border-r border-white/[0.06] bg-[#0a0e14] transition-all duration-200 ${widthClass}`}
    >
      <nav className="flex flex-1 flex-col overflow-hidden px-2 py-3">
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {filteredItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[10px] py-2.5 pl-[10px] pr-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-500/20 text-blue-100 shadow-sm shadow-blue-900/20'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {showSettings && (
          <div className="mt-auto shrink-0 border-t border-white/[0.06] pt-2">
            <NavLink
              to={settingsItem.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[10px] py-2.5 pl-[10px] pr-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-500/20 text-blue-100 shadow-sm shadow-blue-900/20'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
              title={collapsed ? settingsItem.label : undefined}
            >
              <Settings size={20} className="shrink-0" />
              {!collapsed && <span>{settingsItem.label}</span>}
            </NavLink>
          </div>
        )}
      </nav>

      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        className="flex items-center justify-center border-t border-white/[0.06] p-3 text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
        aria-label={collapsed ? 'Espandi menu' : 'Comprimi menu'}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}
