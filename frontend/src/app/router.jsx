import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from '../features/auth/pages/LoginPage.jsx';
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from '../features/auth/pages/ResetPasswordPage.jsx';
import ChangePasswordRequiredPage from '../features/auth/pages/ChangePasswordRequiredPage.jsx';
import { getToken, getUser } from '../features/auth/session.js';
import DashboardPage from '../features/dashboard/pages/DashboardPage.jsx';
import DrawsPage from '../features/draws/pages/DrawsPage.jsx';
import CombosPage from '../features/combos/pages/CombosPage.jsx';
import StatsPage from '../features/stats/pages/StatsPage.jsx';
import SyncPage from '../features/sync/pages/SyncPage.jsx';
import SettingsPage from '../features/settings/pages/SettingsPage.jsx';
import UsersPage from '../features/users/pages/UsersPage.jsx';
import AuditPage from '../features/audit/pages/AuditPage.jsx';
import MainLayout from '../layouts/MainLayout.jsx';

function Protected({ children, roles }) {
  if (!getToken()) return <Navigate to="/login" replace />;

  const user = getUser();
  // Con contraseña temporal solo se puede usar la pantalla de cambio de contraseña.
  if (user?.debeCambiarPassword) return <Navigate to="/cambiar-password" replace />;

  if (roles && (!user || !roles.includes(user.rol))) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/cambiar-password', element: <ChangePasswordRequiredPage /> },
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
        path: 'configuracion',
        element: (
          <Protected roles={['SUPER_ADMIN']}>
            <SettingsPage />
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
