import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { PortalBackgroundLayers } from './PortalBackground';

export default function Layout() {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <PortalBackgroundLayers />
      </div>
      <div className="portal-shell relative z-10 min-h-screen text-slate-200">
        <Sidebar />
        <Topbar />
        <main className="ml-60 mt-[4.5rem] p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
