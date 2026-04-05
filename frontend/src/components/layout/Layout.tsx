import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { PortalBackgroundLayers } from './PortalBackground';

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <PortalBackgroundLayers />
      </div>
      <div className="portal-shell relative z-10 min-h-screen text-slate-900">
        <Topbar sidebarCollapsed={sidebarCollapsed} />
        <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        <main
          className={`mt-20 min-h-[calc(100vh-5rem)] border-l border-t border-slate-200/70 bg-[var(--portal-main-content-bg)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-[margin] duration-200 sm:p-6 lg:rounded-tl-xl lg:p-8 ${sidebarCollapsed ? 'ml-16' : 'ml-52'}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
