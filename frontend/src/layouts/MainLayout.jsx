import { NavLink, Outlet } from 'react-router-dom';
import { IconDashboard, IconUsers, IconLogbook, IconCalendar, IconDownload, IconChart, IconShuffle, IconSettings } from '../components/icons.jsx';
import UserMenu from './UserMenu.jsx';

const ADMINS = ['SUPER_ADMIN', 'ADMIN'];

// [ruta, etiqueta, ícono, roles permitidos (sin roles = todos)]
const MENU = [
  ['/', 'Dashboard', IconDashboard],
  ['/sorteos', 'Sorteos', IconCalendar],
  ['/estadisticas', 'Estadísticas', IconChart],
  ['/combinaciones', 'Combinaciones', IconShuffle],
  ['/sincronizacion', 'Sincronización', IconDownload, ADMINS],
  ['/usuarios', 'Usuarios', IconUsers, ['SUPER_ADMIN']],
  ['/configuracion', 'Configuración', IconSettings, ['SUPER_ADMIN']],
  ['/auditoria', 'Bitácora', IconLogbook, ['SUPER_ADMIN']],
];

export default function MainLayout() {
  const user = JSON.parse(localStorage.getItem('loto_numeros_user') || 'null');

  const menu = MENU.filter(([, , , roles]) => !roles || roles.includes(user?.rol));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">Loto <span>Números</span></div>
        </div>

        <nav>
          {menu.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <UserMenu user={user} />
        </header>

        <main className="content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <div className="app-footer-brand">
            <span className="app-footer-mark">LN</span>
            Loto <span>Números</span>
          </div>
          <div className="app-footer-meta">
            <span>© {new Date().getFullYear()}</span>
            <span className="app-footer-version">v1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

