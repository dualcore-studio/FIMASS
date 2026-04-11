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
        <Topbar />
        <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        <main
          className={`min-h-dvh border-l border-t border-[var(--portal-border)]/80 bg-[var(--portal-main-content-bg)] p-4 pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-[margin] duration-200 sm:p-6 lg:rounded-tl-2xl lg:p-8 xl:p-10 ${sidebarCollapsed ? 'ml-16' : 'ml-48'}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
