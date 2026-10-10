import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from '../features/auth/pages/LoginPage.jsx';
import DashboardPage from '../features/dashboard/pages/DashboardPage.jsx';
import DrawsPage from '../features/draws/pages/DrawsPage.jsx';
import CombosPage from '../features/combos/pages/CombosPage.jsx';
import StatsPage from '../features/stats/pages/StatsPage.jsx';
import SyncPage from '../features/sync/pages/SyncPage.jsx';
import UsersPage from '../features/users/pages/UsersPage.jsx';
import AuditPage from '../features/audit/pages/AuditPage.jsx';
import MainLayout from '../layouts/MainLayout.jsx';

function Protected({ children, roles }) {
  const token = localStorage.getItem('loto_numeros_token');
  if (!token) return <Navigate to="/login" replace />;

  if (roles) {
    const user = JSON.parse(localStorage.getItem('loto_numeros_user') || 'null');
    if (!user || !roles.includes(user.rol)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <Protected>
        <MainLayout />
      </Protected>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'sorteos', element: <DrawsPage /> },
      { path: 'estadisticas', element: <StatsPage /> },
      { path: 'combinaciones', element: <CombosPage /> },
      {
        path: 'sincronizacion',
        element: (
          <Protected roles={['SUPER_ADMIN', 'ADMIN']}>
            <SyncPage />
          </Protected>
        ),
      },
      {
        path: 'usuarios',
        element: (
          <Protected roles={['SUPER_ADMIN']}>
            <UsersPage />
          </Protected>
        ),
      },
      {
        path: 'auditoria',
        element: (
          <Protected roles={['SUPER_ADMIN']}>
            <AuditPage />
          </Protected>
        ),
      },
    ],
  },
]);
