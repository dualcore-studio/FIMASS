import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import SupervisorDashboard from './SupervisorDashboard';
import OperatorDashboard from './OperatorDashboard';
import StructureDashboard from './StructureDashboard';

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'supervisore':
      return <SupervisorDashboard />;
    case 'operatore':
      return <OperatorDashboard />;
    case 'struttura':
      return <StructureDashboard />;
    default:
      return <div>Ruolo non riconosciuto</div>;
  }
}
