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
          className={`min-h-dvh border-l border-t border-[var(--portal-border)]/80 bg-[var(--portal-main-content-bg)] px-4 pb-4 pt-[calc(3.5rem+1rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-[margin] duration-200 sm:px-6 sm:pb-6 sm:pt-[calc(3.5rem+1.5rem)] lg:rounded-tl-2xl lg:px-8 lg:pb-8 lg:pt-[calc(3.5rem+2rem)] xl:px-10 xl:pb-10 xl:pt-[calc(3.5rem+2.5rem)] ${sidebarCollapsed ? 'ml-16' : 'ml-48'}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
