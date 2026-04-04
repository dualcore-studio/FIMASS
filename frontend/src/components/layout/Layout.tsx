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
      <div className="portal-shell relative z-10 min-h-screen text-slate-200">
        <Topbar sidebarCollapsed={sidebarCollapsed} />
        <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        <main
          className={`mt-20 p-6 transition-[margin] duration-200 ${sidebarCollapsed ? 'ml-16' : 'ml-52'}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
