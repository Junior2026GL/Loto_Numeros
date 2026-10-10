import AuthAside from './AuthAside.jsx';

/** Marco común de las pantallas de acceso: panel de marca a la izquierda y tarjeta con formulario a la derecha. */
export default function AuthLayout({ title, subtitle, onSubmit, children }) {
  return (
    <div className="login-shell">
      <div className="login-box">
        <AuthAside />

        <div className="login-panel">
          <form className="login-card" onSubmit={onSubmit}>
            <div className="login-card-head">
              <h2 className="auth-title">{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {children}
          </form>

          <small className="login-copyright">© {new Date().getFullYear()} Loto Números</small>
        </div>
      </div>
    </div>
  );
}
