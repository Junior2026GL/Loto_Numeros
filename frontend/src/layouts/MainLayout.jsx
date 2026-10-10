import { NavLink, Outlet } from 'react-router-dom';
import { IconDashboard, IconUsers, IconLogbook, IconCalendar } from '../components/icons.jsx';
import UserMenu from './UserMenu.jsx';

const baseMenu = [
  ['/', 'Dashboard', IconDashboard],
  ['/sorteos', 'Sorteos', IconCalendar],
];

export default function MainLayout() {
  const user = JSON.parse(localStorage.getItem('loto_numeros_user') || 'null');

  const menu = user?.rol === 'SUPER_ADMIN'
    ? [
        ...baseMenu,
        ['/usuarios', 'Usuarios', IconUsers],
        ['/auditoria', 'Bitácora', IconLogbook],
      ]
    : baseMenu;

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

