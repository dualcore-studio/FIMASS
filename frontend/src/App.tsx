import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import UsersList from './pages/users/UsersList';
import UserCreate from './pages/users/UserCreate';
import UserEdit from './pages/users/UserEdit';
import QuotesList from './pages/quotes/QuotesList';
import QuoteCreate from './pages/quotes/QuoteCreate';
import QuoteDetail from './pages/quotes/QuoteDetail';
import PoliciesList from './pages/policies/PoliciesList';
import PolicyDetail from './pages/policies/PolicyDetail';
import PolicyRequest from './pages/policies/PolicyRequest';
import AssistedList from './pages/assisted/AssistedList';
import AssistedDetail from './pages/assisted/AssistedDetail';
import Reports from './pages/reports/Reports';
import ActivityLogs from './pages/logs/ActivityLogs';
import Settings from './pages/settings/Settings';
import CommissionsPage from './pages/commissions/CommissionsPage';
import CommissionForm from './pages/commissions/CommissionForm';
import MessagesPage from './pages/messaging/MessagesPage';
import type { ReactNode } from 'react';
import { PortalBackgroundLayers } from './components/layout/PortalBackground';

function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-[var(--portal-app-bg)]">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <PortalBackgroundLayers />
        </div>
        <div className="relative z-10 w-8 h-8 border-3 border-blue-200 border-t-blue-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />

        <Route path="utenti" element={<ProtectedRoute roles={['admin', 'supervisore']}><UsersList /></ProtectedRoute>} />
        <Route path="utenti/nuovo" element={<ProtectedRoute roles={['admin']}><UserCreate /></ProtectedRoute>} />
        <Route path="utenti/:id/modifica" element={<ProtectedRoute roles={['admin']}><UserEdit /></ProtectedRoute>} />

        <Route path="preventivi" element={<QuotesList />} />
        <Route path="preventivi/nuovo" element={<ProtectedRoute roles={['struttura']}><QuoteCreate /></ProtectedRoute>} />
        <Route path="preventivi/:id" element={<QuoteDetail />} />

        <Route path="polizze" element={<PoliciesList />} />
        <Route path="polizze/nuova" element={<ProtectedRoute roles={['struttura']}><PolicyRequest /></ProtectedRoute>} />
        <Route path="polizze/:id" element={<PolicyDetail />} />

        <Route path="assistiti" element={<AssistedList />} />
        <Route path="assistiti/:id" element={<AssistedDetail />} />

        <Route
          path="messaggi"
          element={
            <ProtectedRoute
              roles={['admin', 'supervisore', 'operatore', 'fornitore', 'struttura']}
            >
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="messaggi/:id"
          element={
            <ProtectedRoute
              roles={['admin', 'supervisore', 'operatore', 'fornitore', 'struttura']}
            >
              <MessagesPage />
            </ProtectedRoute>
          }
        />

        <Route path="provvigioni" element={<ProtectedRoute roles={['admin', 'fornitore', 'struttura']}><CommissionsPage /></ProtectedRoute>} />
        <Route path="provvigioni/nuovo" element={<ProtectedRoute roles={['admin', 'fornitore']}><CommissionForm /></ProtectedRoute>} />
        <Route path="provvigioni/:id/modifica" element={<ProtectedRoute roles={['admin', 'fornitore']}><CommissionForm /></ProtectedRoute>} />

        <Route path="report" element={<ProtectedRoute roles={['admin', 'supervisore', 'fornitore']}><Reports /></ProtectedRoute>} />
        <Route path="log-attivita" element={<ProtectedRoute roles={['admin', 'supervisore']}><ActivityLogs /></ProtectedRoute>} />
        <Route path="impostazioni" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
