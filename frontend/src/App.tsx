import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UnreadMessagesProvider } from './context/UnreadMessagesContext';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import type { ReactNode } from 'react';
import { PortalBackgroundLayers } from './components/layout/PortalBackground';
import { SCADENZE_ACCESS_ROLES } from './constants/scadenzeAccess';

const loadDashboard = () => import('./pages/dashboard/Dashboard');

const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage'));
const Dashboard = lazy(loadDashboard);
const UsersList = lazy(() => import('./pages/users/UsersList'));
const UserCreate = lazy(() => import('./pages/users/UserCreate'));
const UserEdit = lazy(() => import('./pages/users/UserEdit'));
const QuotesList = lazy(() => import('./pages/quotes/QuotesList'));
const QuoteCreate = lazy(() => import('./pages/quotes/QuoteCreate'));
const QuoteDetail = lazy(() => import('./pages/quotes/QuoteDetail'));
const PoliciesList = lazy(() => import('./pages/policies/PoliciesList'));
const PolicyDetail = lazy(() => import('./pages/policies/PolicyDetail'));
const PolicyRequest = lazy(() => import('./pages/policies/PolicyRequest'));
const ScadenzePage = lazy(() => import('./pages/scadenze/ScadenzePage'));
const AssistedList = lazy(() => import('./pages/assisted/AssistedList'));
const AssistedDetail = lazy(() => import('./pages/assisted/AssistedDetail'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const ActivityLogs = lazy(() => import('./pages/logs/ActivityLogs'));
const AuditPrivacyLogs = lazy(() => import('./pages/logs/AuditPrivacyLogs'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const CommissionsPage = lazy(() => import('./pages/commissions/CommissionsPage'));
const CommissionForm = lazy(() => import('./pages/commissions/CommissionForm'));
const MessagesPage = lazy(() => import('./pages/messaging/MessagesPage'));
const AppointmentsList = lazy(() => import('./pages/appointments/AppointmentsList'));
const AppointmentDetail = lazy(() => import('./pages/appointments/AppointmentDetail'));

// La dashboard è la prima schermata di chi ha già una sessione: scaricarla
// subito la mette in parallelo alla verifica del token invece che in coda.
if (localStorage.getItem('token')) {
  void loadDashboard();
}

function FullScreenSpinner() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--portal-app-bg)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <PortalBackgroundLayers />
      </div>
      <div className="relative z-10 w-8 h-8 border-3 border-blue-200 border-t-blue-700 rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullScreenSpinner />;

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
      <Route path="/privacy" element={<PrivacyPage />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />

        <Route path="utenti" element={<ProtectedRoute roles={['admin', 'supervisore']}><UsersList /></ProtectedRoute>} />
        <Route path="utenti/nuovo" element={<ProtectedRoute roles={['admin']}><UserCreate /></ProtectedRoute>} />
        <Route path="utenti/:id/modifica" element={<ProtectedRoute roles={['admin']}><UserEdit /></ProtectedRoute>} />

        <Route path="preventivi" element={<QuotesList />} />
        <Route path="preventivi/nuovo" element={<ProtectedRoute roles={['struttura', 'fornitore']}><QuoteCreate /></ProtectedRoute>} />
        <Route path="preventivi/:id" element={<QuoteDetail />} />

        <Route path="polizze" element={<PoliciesList />} />
        <Route path="polizze/nuova" element={<ProtectedRoute roles={['struttura']}><PolicyRequest /></ProtectedRoute>} />
        <Route path="polizze/:id" element={<PolicyDetail />} />
        <Route
          path="scadenze"
          element={
            <ProtectedRoute roles={[...SCADENZE_ACCESS_ROLES]}>
              <ScadenzePage />
            </ProtectedRoute>
          }
        />

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
          path="appuntamenti"
          element={
            <ProtectedRoute roles={['admin', 'supervisore', 'fornitore', 'struttura']}>
              <AppointmentsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="appuntamenti/:id"
          element={
            <ProtectedRoute roles={['admin', 'supervisore', 'fornitore', 'struttura']}>
              <AppointmentDetail />
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
        <Route
          path="log-audit-privacy"
          element={
            <ProtectedRoute roles={['admin', 'supervisore']}>
              <AuditPrivacyLogs />
            </ProtectedRoute>
          }
        />
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
        <UnreadMessagesProvider>
          <Suspense fallback={<FullScreenSpinner />}>
            <AppRoutes />
          </Suspense>
        </UnreadMessagesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
