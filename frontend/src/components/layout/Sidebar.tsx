import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUnreadMessages } from '../../context/UnreadMessagesContext';
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
  Banknote,
  MessageSquare,
} from 'lucide-react';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'supervisore', 'operatore', 'fornitore', 'struttura'] },
  { path: '/utenti', label: 'Utenti', icon: Users, roles: ['admin', 'supervisore'] },
  { path: '/preventivi', label: 'Preventivi', icon: FileText, roles: ['admin', 'supervisore', 'operatore', 'fornitore', 'struttura'] },
  { path: '/polizze', label: 'Polizze', icon: Shield, roles: ['admin', 'supervisore', 'operatore', 'fornitore', 'struttura'] },
  { path: '/assistiti', label: 'Assistiti', icon: UserCheck, roles: ['admin', 'supervisore', 'operatore', 'fornitore', 'struttura'] },
  { path: '/messaggi', label: 'Messaggi', icon: MessageSquare, roles: ['admin', 'supervisore', 'operatore', 'fornitore', 'struttura'] },
  { path: '/provvigioni', label: 'Provvigioni', icon: Banknote, roles: ['admin', 'fornitore', 'struttura'] },
  { path: '/report', label: 'Report', icon: BarChart3, roles: ['admin', 'supervisore', 'fornitore'] },
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
  const { unreadTotal } = useUnreadMessages();

  const filteredItems = menuItems.filter((item) => user && item.roles.includes(user.role));
  const showSettings = user && settingsItem.roles.includes(user.role);

  const widthClass = collapsed ? 'w-16' : 'w-48';

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-dvh max-h-screen flex-col border-r border-[var(--portal-sidebar-border)] bg-[var(--portal-sidebar-bg)] shadow-[2px_0_16px_-6px_rgba(15,23,42,0.22)] transition-all duration-200 ${widthClass}`}
    >
      <Link
        to="/"
        title="Sportello Amico Servizi — Area Assicurativa"
        className={`shrink-0 border-b border-[var(--portal-sidebar-border)] outline-none transition-colors duration-200 hover:bg-[var(--portal-nav-surface-logo-hover)] focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-inset ${
          collapsed ? 'flex items-center justify-center px-2 py-3' : 'flex items-center justify-start px-4 py-3.5'
        }`}
      >
        {collapsed ? (
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

      <nav className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-3 pt-2">
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {filteredItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[10px] py-2.5 pl-[10px] pr-3 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-[var(--portal-nav-active-bg)] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                    : 'text-[var(--portal-sidebar-text)] hover:bg-[var(--portal-nav-hover)] hover:text-white'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              {collapsed ? (
                <span className="relative inline-flex shrink-0">
                  <item.icon size={20} className="shrink-0 opacity-90" strokeWidth={1.75} />
                  {item.path === '/messaggi' && unreadTotal > 0 ? (
                    <span
                      className="absolute -right-1 -top-1 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[var(--portal-sidebar-bg)]"
                      aria-label={`${unreadTotal} messaggi non letti`}
                    >
                      {unreadTotal > 99 ? '99+' : unreadTotal}
                    </span>
                  ) : null}
                </span>
              ) : (
                <item.icon size={20} className="shrink-0 opacity-90" strokeWidth={1.75} />
              )}
              {!collapsed && (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate">{item.label}</span>
                  {item.path === '/messaggi' && unreadTotal > 0 ? (
                    <span
                      className="inline-flex min-h-[1.25rem] min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-sm"
                      aria-label={`${unreadTotal} messaggi non letti`}
                    >
                      {unreadTotal > 99 ? '99+' : unreadTotal}
                    </span>
                  ) : null}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        {showSettings && (
          <div className="mt-auto shrink-0 border-t border-[var(--portal-sidebar-border)] pt-2">
            <NavLink
              to={settingsItem.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[10px] py-2.5 pl-[10px] pr-3 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-[var(--portal-nav-active-bg)] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                    : 'text-[var(--portal-sidebar-text)] hover:bg-[var(--portal-nav-hover)] hover:text-white'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
              title={collapsed ? settingsItem.label : undefined}
            >
              <Settings size={20} className="shrink-0 opacity-90" strokeWidth={1.75} />
              {!collapsed && <span className="truncate">{settingsItem.label}</span>}
            </NavLink>
          </div>
        )}
      </nav>

      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        className="flex items-center justify-center border-t border-[var(--portal-sidebar-border)] p-3 text-[var(--portal-sidebar-muted)] transition-colors duration-150 hover:bg-[var(--portal-nav-hover)] hover:text-white"
        aria-label={collapsed ? 'Espandi menu' : 'Comprimi menu'}
      >
        {collapsed ? <ChevronRight size={18} strokeWidth={1.75} /> : <ChevronLeft size={18} strokeWidth={1.75} />}
      </button>
    </aside>
  );
}
