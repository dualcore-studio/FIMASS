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
      <div className="relative z-10 min-h-screen">
        <Sidebar />
        <Topbar />
        <main className="ml-60 mt-16 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
